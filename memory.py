"""
memory.py — Hybrid short-term + long-term memory system for OmniClient.

Short-term : Last N messages kept in the conversation context window.
Long-term  : SQLite-backed Memory rows with keyword-based retrieval.
Summarization: When message count exceeds threshold, older messages are
               summarised and stored as a compressed memory entry.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from math import log
from typing import List, Optional, Dict

from sqlalchemy.orm import Session

from config import get_settings
from models import Memory, Message, Conversation

settings = get_settings()


# ---------------------------------------------------------------------------
# Short-term helpers
# ---------------------------------------------------------------------------

def get_short_term_messages(db: Session, conversation_id: int, limit: int = 10) -> List[Dict]:
    """Return the last `limit` messages as dicts suitable for OpenAI chat format."""
    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.desc())
        .limit(limit)
        .all()
    )
    msgs.reverse()
    return [{"role": m.role, "content": m.content} for m in msgs]


# ---------------------------------------------------------------------------
# Long-term memory store / retrieval
# ---------------------------------------------------------------------------

def store_memory(
    db: Session,
    conversation_id: int,
    key: str,
    value: str,
    importance_score: float = 1.0,
) -> Memory:
    mem = Memory(
        conversation_id=conversation_id,
        key=key,
        value=value,
        importance_score=importance_score,
        created_at=datetime.utcnow(),
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return mem


def get_memories(db: Session, conversation_id: int) -> List[Memory]:
    """Return all memories for a conversation ordered by importance."""
    return (
        db.query(Memory)
        .filter(Memory.conversation_id == conversation_id)
        .order_by(Memory.importance_score.desc())
        .all()
    )


def retrieve_relevant_memories(
    db: Session, conversation_id: int, query: str, top_k: int = 5
) -> List[Dict]:
    """
    Simple TF-IDF-like keyword scoring to surface the most relevant memories.
    Returns list of {key, value, score} dicts.
    """
    memories = get_memories(db, conversation_id)
    if not memories:
        return []

    query_tokens = _tokenize(query)
    scored: List[tuple[float, Memory]] = []

    for mem in memories:
        text = f"{mem.key} {mem.value}"
        tokens = _tokenize(text)
        score = _tfidf_score(query_tokens, tokens) * mem.importance_score
        if score > 0:
            scored.append((score, mem))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"id": m.id, "key": m.key, "value": m.value, "score": round(s, 4)}
        for s, m in scored[:top_k]
    ]


def delete_memory(db: Session, memory_id: int) -> bool:
    mem = db.query(Memory).filter(Memory.id == memory_id).first()
    if mem:
        db.delete(mem)
        db.commit()
        return True
    return False


def update_memory(db: Session, memory_id: int, key: str, value: str) -> Optional[Memory]:
    mem = db.query(Memory).filter(Memory.id == memory_id).first()
    if mem:
        mem.key = key
        mem.value = value
        db.commit()
        db.refresh(mem)
    return mem


# ---------------------------------------------------------------------------
# Auto-summarization
# ---------------------------------------------------------------------------

def check_and_summarize(db: Session, conversation_id: int, openai_client) -> Optional[str]:
    """
    If conversation exceeds MEMORY_SUMMARY_THRESHOLD, summarise older messages
    and persist as a Memory entry. Returns summary text or None.
    """
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        return None

    threshold = settings.memory_summary_threshold
    total = db.query(Message).filter(Message.conversation_id == conversation_id).count()

    if total <= threshold:
        return None

    # Check if we already summarised recently (avoid re-summarising every turn)
    existing_summaries = (
        db.query(Memory)
        .filter(Memory.conversation_id == conversation_id, Memory.key == "auto_summary")
        .count()
    )
    # Only summarise every threshold additional messages
    if existing_summaries > 0 and total % threshold != 0:
        return None

    # Fetch older messages (skip last threshold)
    older_msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.asc())
        .limit(total - threshold)
        .all()
    )

    conversation_text = "\n".join(
        f"{m.role.upper()}: {m.content[:500]}" for m in older_msgs
    )

    try:
        resp = openai_client.chat.completions.create(
            model=settings.default_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Summarise the following conversation excerpt in 3-5 concise bullet points. "
                        "Focus on key topics, decisions, and any technical details mentioned. "
                        "Output only the bullet points, no preamble."
                    ),
                },
                {"role": "user", "content": conversation_text},
            ],
            max_tokens=300,
            temperature=0.3,
        )
        summary = resp.choices[0].message.content.strip()
        store_memory(
            db, conversation_id,
            key="auto_summary",
            value=summary,
            importance_score=2.0,
        )
        return summary
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())


def _tfidf_score(query_tokens: List[str], doc_tokens: List[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    doc_freq: Dict[str, int] = {}
    for t in doc_tokens:
        doc_freq[t] = doc_freq.get(t, 0) + 1
    score = 0.0
    for qt in query_tokens:
        if qt in doc_freq:
            tf = doc_freq[qt] / len(doc_tokens)
            idf = log(1 + 1 / (doc_freq[qt] + 1))
            score += tf * idf
    return score
