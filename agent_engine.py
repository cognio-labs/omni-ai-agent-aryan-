"""
agent_engine.py - Core AI orchestrator for OmniClient.

Responsibilities:
- Maintain the primary OmniClient system prompt
- Decide when to use tools (search, db_query, memory, code_gen)
- Stream responses from OpenRouter via the openai library
- Manage sub-agent creation workflow
- Handle fallback models and rate limit errors
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Iterator, Optional, List, Dict

from openai import (
    OpenAI, APITimeoutError, APIConnectionError,
    RateLimitError, AuthenticationError, NotFoundError, InternalServerError,
    BadRequestError, APIError,
)
from sqlalchemy.orm import Session

from config import get_settings
from models import Conversation, Message, Agent
from memory import (
    get_short_term_messages,
    retrieve_relevant_memories,
    check_and_summarize,
)
from search import deep_search, format_search_for_context
from slideforge_prompt import SLIDEFORGE_SYSTEM_PROMPT

settings = get_settings()

# ---------------------------------------------------------------------------
# Primary system prompt
# ---------------------------------------------------------------------------

OMNICLIENT_SYSTEM_PROMPT = """You are OmniClient AI, a helpful, direct, and intelligent AI assistant.

CRITICAL RULES:
1. Answer questions DIRECTLY and CONCISELY. Do NOT suggest creating presentations, workflows, slides, or deliverables unless the user EXPLICITLY asks for them.
2. For simple questions (math, facts, definitions), give a SHORT direct answer.
3. Never mention your tools, capabilities, or internal processes in responses.
4. Never offer to build things the user didn't request.
5. Be conversational and natural.
6. Do NOT show tool usage text like [TOOL: ...] in your responses - use tools silently.
7. Never start responses with tool status messages.

Use tools silently in the background. NEVER show tool invocation text in your final response to the user."""

DEFAULT_SYSTEM_PROMPT = OMNICLIENT_SYSTEM_PROMPT
def clean_response(text: str) -> str:
    """Remove tool call artifacts from response text."""
    text = re.sub(r'\[TOOL:[^\]]*\]', '', text or '')
    text = re.sub(r'\[THINKING:[^\]]*\]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    return text


def filter_response_chunk(text: str) -> str:
    """Filter streamed chunks without stripping normal token spacing."""
    if not text:
        return ''
    stripped = text.lstrip()
    if stripped.startswith('[TOOL:') or stripped.startswith('[THINKING:'):
        return ''
    text = re.sub(r'\[TOOL:[^\]]*\]', '', text)
    text = re.sub(r'\[THINKING:[^\]]*\]', '', text)
    return text


# ---------------------------------------------------------------------------
# OpenAI / OpenRouter client factory
# ---------------------------------------------------------------------------

def _make_client() -> OpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured in .env.")
    print(f"[CHAT] OpenRouter base URL: {base_url}")
    print(f"[CHAT] OpenRouter API key detected: {bool(api_key)}")
    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=60.0,
        default_headers={
            "HTTP-Referer": f"http://localhost:{os.getenv('APP_PORT', '8001')}",
            "X-OpenRouter-Title": os.getenv("APP_NAME", "OmniClient AI"),
        },
    )
# ---------------------------------------------------------------------------
# Tool detection
# ---------------------------------------------------------------------------

_SEARCH_TRIGGERS = re.compile(
    r"\b(search|look up|find|what is|latest|current|news|recent|who is|how does|"
    r"best way|compare|vs\.?|versus|2024|2025|2026)\b",
    re.IGNORECASE,
)


_MEMORY_TRIGGERS = re.compile(
    r"\b(remember|recall|earlier|before|previously|last time|we discussed|"
    r"what did|you said|i mentioned|context)\b",
    re.IGNORECASE,
)


def _should_search(message: str) -> bool:
    return bool(_SEARCH_TRIGGERS.search(message))


def _should_recall_memory(message: str) -> bool:
    return bool(_MEMORY_TRIGGERS.search(message))


# ---------------------------------------------------------------------------
# Main chat function (streaming)
# ---------------------------------------------------------------------------

def _get_status_code(e: Exception) -> Optional[int]:
    status_code = getattr(e, "status_code", None)
    if status_code:
        return status_code
    response = getattr(e, "response", None)
    return getattr(response, "status_code", None)


def _get_meaningful_error(e: Exception) -> str:
    status_code = _get_status_code(e)
    if isinstance(e, AuthenticationError) or status_code == 401:
        return (
            "Error 401: Invalid OpenRouter API key. Please check that you have "
            "set a valid `OPENROUTER_API_KEY` in your `.env` file."
        )
    elif isinstance(e, BadRequestError) or status_code == 400:
        return (
            "Error 400: OpenRouter rejected the request. Please verify the selected "
            "model supports the requested options and try again."
        )
    elif isinstance(e, NotFoundError) or status_code == 404:
        return (
            "Error 404: Model or endpoint not found. Please verify the model names "
            "and the base URL in your `.env` configuration."
        )
    elif isinstance(e, RateLimitError) or status_code == 429:
        return (
            "Error 429: Rate limit exceeded. Please wait a moment before trying again "
            "or check your OpenRouter account balance/limits."
        )
    elif isinstance(e, InternalServerError) or status_code == 500:
        return (
            "Error 500: OpenRouter server error. Please try again later."
        )
    elif isinstance(e, (APITimeoutError, APIConnectionError)):
        return (
            "Error Timeout: Connection timed out. Please check your internet connection "
            "or check OpenRouter's status page."
        )
    else:
        return f"Error {status_code or 'Unknown'}: {str(e)}"


def chat_stream(
    user_message: str,
    conversation_id: int,
    db: Session,
    agent: Optional[Agent] = None,
) -> Iterator[str]:
    """
    Generator that yields text chunks for SSE streaming.
    Handles tool use (search, memory), then streams the AI response.
    """
    client = _make_client()
    system_prompt = agent.system_prompt if agent else OMNICLIENT_SYSTEM_PROMPT
    model = agent.model if agent else settings.default_model
    temperature = agent.temperature if agent else 0.7
    max_tokens = settings.max_tokens if hasattr(settings, "max_tokens") else 4096

    # Build context messages
    messages: List[Dict] = [{"role": "system", "content": system_prompt}]

    # Inject relevant memories
    if _should_recall_memory(user_message):
        try:
            memories = retrieve_relevant_memories(db, conversation_id, user_message, top_k=3)
            if memories:
                mem_text = "\n".join(f"- **{m['key']}**: {m['value']}" for m in memories)
                messages.append({
                    "role": "system",
                    "content": f"[MEMORY CONTEXT]\n{mem_text}",
                })
        except Exception as me:
            print(f"[CHAT] Memory retrieval error: {me}")

    # Inject search results
    enable_search = agent.enable_search if agent else settings.enable_deep_search
    if enable_search and _should_search(user_message):
        try:
            print("[CHAT] Running deep search silently")
            search_result = deep_search(user_message, db, max_results=settings.max_search_results)
            search_text = format_search_for_context(search_result)
            messages.append({
                "role": "system",
                "content": f"[SEARCH RESULTS]\n{search_text}",
            })
        except Exception as e:
            print(f"[CHAT] Search unavailable: {e}")

    # Add conversation history
    try:
        history = get_short_term_messages(db, conversation_id, limit=10)
        messages.extend(history)
    except Exception as he:
        print(f"[CHAT] History retrieval error: {he}")

    # Add current user message
    messages.append({"role": "user", "content": user_message})

    # Save user message to DB
    try:
        _save_message(db, conversation_id, "user", user_message)
    except Exception as se:
        print(f"[CHAT] Message save error: {se}")

    # Stream from OpenRouter with fallback
    full_response = ""
    reasoning_details: list[Any] = []
    completed = False

    models_to_try = [model]
    if settings.fallback_model and model != settings.fallback_model:
        models_to_try.append(settings.fallback_model)

    idx = 0
    while idx < len(models_to_try):
        target_model = models_to_try[idx]
        is_fallback = (target_model == settings.fallback_model and target_model != model)

        if is_fallback:
            print("[CHAT] Switching to fallback model")

        print(f"[CHAT] Selected model: {target_model}")
        print(f"[CHAT] Incoming prompt: {user_message}")

        start_time = time.time()

        try:
            # We try the request up to 2 times if it's a timeout/connection error
            for attempt in range(2):
                try:
                    stream = client.chat.completions.create(
                        model=target_model,
                        messages=messages,
                        stream=True,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **_reasoning_kwargs(),
                    )

                    # Iterate and yield tokens
                    for chunk in stream:
                        if not chunk.choices:
                            continue
                        delta_obj = chunk.choices[0].delta
                        if not delta_obj:
                            continue
                        delta = delta_obj.content or ""
                        chunk_reasoning = _get_reasoning_details(delta_obj)
                        if chunk_reasoning:
                            reasoning_details.extend(chunk_reasoning)
                        if delta:
                            cleaned_delta = filter_response_chunk(delta)
                            if cleaned_delta:
                                full_response += cleaned_delta
                                yield cleaned_delta

                    response_time = time.time() - start_time
                    print(f"[CHAT] API response status: Success")
                    print(f"[CHAT] Response time: {response_time:.2f}s")
                    completed = True
                    break

                except (APITimeoutError, APIConnectionError) as te:
                    if attempt == 0:
                        print(f"[CHAT] Timeout/Connection error (Attempt 1) with model {target_model}: {te}. Retrying once...")
                        time.sleep(1)
                        continue
                    else:
                        raise te
                except Exception as e:
                    raise e

            if completed:
                break

        except Exception as e:
            response_time = time.time() - start_time
            print(f"[CHAT] Error with model {target_model}: {e}")
            print(f"[CHAT] Response time: {response_time:.2f}s")

            # Fallback check
            if not is_fallback and idx + 1 < len(models_to_try):
                idx += 1
                continue
            else:
                error_msg = _get_meaningful_error(e)
                yield f"\n{error_msg}\n"
                full_response = clean_response(error_msg)
                break

    full_response = clean_response(full_response)

    # Save assistant response
    if full_response:
        metadata = {"reasoning_details": reasoning_details} if reasoning_details else None
        _save_message(db, conversation_id, "assistant", full_response, metadata=metadata)

    # Auto-update conversation title on first exchange
    _maybe_update_title(db, conversation_id, user_message, client)

    # Trigger auto-summarization in background (non-blocking best effort)
    try:
        check_and_summarize(db, conversation_id, client)
    except Exception:
        pass


def chat_non_streaming(
    user_message: str,
    conversation_id: int,
    db: Session,
    agent: Optional[Agent] = None,
) -> str:
    """Non-streaming version - collects full response and returns it."""
    return clean_response("".join(chat_stream(user_message, conversation_id, db, agent)))


# ---------------------------------------------------------------------------
# Sub-agent system prompt generator
# ---------------------------------------------------------------------------

def generate_agent_system_prompt(
    purpose: str,
    capabilities: List[str],
    tone: str,
    client: Optional[OpenAI] = None,
) -> str:
    """Ask the AI to craft a tailored system prompt for a new sub-agent."""
    if client is None:
        client = _make_client()

    cap_list = ", ".join(capabilities) if capabilities else "general assistance"
    prompt = f"""Create a professional system prompt for an AI agent with these specifications:
- Purpose: {purpose}
- Capabilities: {cap_list}
- Tone/Personality: {tone}

The system prompt should be 150-250 words, define the agent's identity, expertise, and behavioral guidelines. 
Output ONLY the system prompt text, no labels or preamble."""

    try:
        resp = client.chat.completions.create(
            model=settings.default_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.7,
            **_reasoning_kwargs(),
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        # Fallback template
        return (
            f"You are a specialized AI assistant focused on {purpose}. "
            f"Your capabilities include: {cap_list}. "
            f"Maintain a {tone} tone in all interactions. "
            f"Provide accurate, helpful, and well-structured responses."
        )


def generate_deployment_guide(project_type: str, context: str = "") -> str:
    """Generate a tailored deployment guide for the given project type."""
    client = _make_client()
    prompt = f"""Generate a complete, step-by-step deployment guide for a {project_type} project.
Include:
1. requirements.txt validation steps
2. Dockerfile (if applicable)
3. Best free/low-cost platform options (Render, Railway, Fly.io, PythonAnywhere)
4. Environment variable checklist
5. Exact terminal commands

Additional context: {context if context else 'Standard deployment'}

Format as clean Markdown with code blocks for commands."""

    try:
        resp = client.chat.completions.create(
            model=settings.default_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.5,
            **_reasoning_kwargs(),
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"Failed to generate deployment guide: {e}"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _save_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: str,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(msg)
    # Update conversation message count and updated_at
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        conv.message_count = (conv.message_count or 0) + 1
        from datetime import datetime
        conv.updated_at = datetime.utcnow()
    db.commit()


def _maybe_update_title(db: Session, conversation_id: int, first_message: str, client: OpenAI) -> None:
    """Auto-generate conversation title from the first user message."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv or conv.title != "New Conversation":
        return
    if conv.message_count > 2:
        return  # Already has messages, title was set
    try:
        resp = client.chat.completions.create(
            model=settings.default_model,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Generate a short conversation title (max 6 words, no quotes) "
                        f"for a chat that starts with: '{first_message[:200]}'"
                    ),
                }
            ],
            max_tokens=20,
            temperature=0.5,
            **_reasoning_kwargs(),
        )
        title = resp.choices[0].message.content.strip().strip('"\'')
        if title:
            conv.title = title[:100]
            db.commit()
    except Exception:
        pass


def _reasoning_kwargs() -> dict[str, Any]:
    """Enable OpenRouter reasoning while keeping the OpenAI client transport."""
    if not settings.enable_reasoning:
        return {}
    return {"extra_body": {"reasoning": {"enabled": True}}}


def _get_reasoning_details(delta_obj: Any) -> list[Any]:
    reasoning_details = getattr(delta_obj, "reasoning_details", None)
    if not reasoning_details and hasattr(delta_obj, "model_extra"):
        reasoning_details = (delta_obj.model_extra or {}).get("reasoning_details")
    if not reasoning_details:
        return []
    if not isinstance(reasoning_details, list):
        reasoning_details = [reasoning_details]
    return [_to_plain_data(item) for item in reasoning_details]


def _to_plain_data(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)
    if isinstance(value, dict):
        return value
    return value









