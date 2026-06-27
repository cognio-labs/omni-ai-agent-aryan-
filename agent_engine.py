"""
agent_engine.py — Core AI orchestrator for OmniClient.

Responsibilities:
- Maintain the primary OmniClient system prompt
- Decide when to use tools (search, db_query, memory, code_gen)
- Stream responses from OpenRouter via the openai library
- Manage sub-agent creation workflow
- Handle fallback models and rate limit errors
"""
from __future__ import annotations

import json
import re
from typing import Any, Iterator, Optional, List, Dict

from openai import OpenAI, RateLimitError, APIError
from sqlalchemy.orm import Session

from config import get_settings
from models import Conversation, Message, Agent
from memory import (
    get_short_term_messages,
    retrieve_relevant_memories,
    check_and_summarize,
)
from search import deep_search, format_search_for_context

settings = get_settings()

# ---------------------------------------------------------------------------
# Primary system prompt
# ---------------------------------------------------------------------------

OMNICLIENT_SYSTEM_PROMPT = """You are OmniClient, an elite AI Client Success Architect. Your mission is to understand the client's needs, explain technical concepts clearly, and build solutions. You can:

1. Guide users through creating specialized sub-agents step-by-step.
2. Explain tools, frameworks, and processes in clear, actionable language.
3. Troubleshoot errors by analyzing logs and suggesting targeted fixes with code.
4. Write complete, production-ready Python code when requested.
5. Search the web for current information (you will be given search results when relevant).
6. Query databases to retrieve structured information.
7. Remember context across long conversations using your memory system.

**Your personality**: Proactive, precise, and empowering. If a user mentions a complex project, suggest breaking it into specialized sub-agents. If they share an error, diagnose root causes (not just symptoms). Always provide next steps.

**When writing code**: Use proper formatting with language-tagged code blocks. Include comments. Ensure code is copy-paste ready.

**Sub-agent creation**: When a user wants a new agent, gather: (1) purpose, (2) capabilities needed, (3) tone/personality. Then generate a complete system prompt and configuration.

**Format**: Use Markdown for structure. Use bullet points, headers, and code blocks to improve clarity. Keep responses concise but complete."""


# ---------------------------------------------------------------------------
# OpenAI / OpenRouter client factory
# ---------------------------------------------------------------------------

def _make_client() -> OpenAI:
    return OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        default_headers={
            "HTTP-Referer": f"http://localhost:{settings.app_port}",
            "X-OpenRouter-Title": settings.app_name,
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

    # Build context messages
    messages: List[Dict] = [{"role": "system", "content": system_prompt}]

    # Inject relevant memories
    if _should_recall_memory(user_message):
        memories = retrieve_relevant_memories(db, conversation_id, user_message, top_k=3)
        if memories:
            mem_text = "\n".join(f"- **{m['key']}**: {m['value']}" for m in memories)
            messages.append({
                "role": "system",
                "content": f"[MEMORY CONTEXT]\n{mem_text}",
            })

    # Inject search results
    enable_search = agent.enable_search if agent else settings.enable_deep_search
    if enable_search and _should_search(user_message):
        try:
            yield "[TOOL: Searching the web...]\n\n"
            search_result = deep_search(user_message, db, max_results=settings.max_search_results)
            search_text = format_search_for_context(search_result)
            messages.append({
                "role": "system",
                "content": f"[SEARCH RESULTS]\n{search_text}",
            })
        except Exception as e:
            yield f"[Search unavailable: {e}]\n\n"

    # Add conversation history
    history = get_short_term_messages(db, conversation_id, limit=10)
    messages.extend(history)

    # Add current user message
    messages.append({"role": "user", "content": user_message})

    # Save user message to DB
    _save_message(db, conversation_id, "user", user_message)

    # Stream from OpenRouter with fallback
    full_response = ""
    reasoning_details: list[Any] = []
    try:
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=temperature,
            max_tokens=2048,
            **_reasoning_kwargs(),
        )
        for chunk in stream:
            delta_obj = chunk.choices[0].delta
            delta = delta_obj.content or ""
            chunk_reasoning = _get_reasoning_details(delta_obj)
            if chunk_reasoning:
                reasoning_details.extend(chunk_reasoning)
            full_response += delta
            yield delta

    except RateLimitError:
        # Fallback model
        try:
            yield "\n[Switching to fallback model...]\n"
            stream = client.chat.completions.create(
                model=settings.fallback_model,
                messages=messages,
                stream=True,
                temperature=temperature,
                max_tokens=2048,
                **_reasoning_kwargs(),
            )
            for chunk in stream:
                delta_obj = chunk.choices[0].delta
                delta = delta_obj.content or ""
                chunk_reasoning = _get_reasoning_details(delta_obj)
                if chunk_reasoning:
                    reasoning_details.extend(chunk_reasoning)
                full_response += delta
                yield delta
        except Exception as e:
            error_msg = f"Both primary and fallback models failed: {e}"
            yield error_msg
            full_response = error_msg

    except APIError as e:
        error_msg = f"\n**API Error**: {e.message}\n\nPlease check your OpenRouter API key in the Settings panel."
        yield error_msg
        full_response = error_msg

    except Exception as e:
        error_msg = f"\n**Error**: {str(e)}"
        yield error_msg
        full_response = error_msg

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
    """Non-streaming version — collects full response and returns it."""
    return "".join(chat_stream(user_message, conversation_id, db, agent))


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
