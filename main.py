"""
main.py - FastAPI application entry point for OmniClient AI Agent Platform.

Run with:
    python main.py
    or
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import os
from dotenv import load_dotenv
load_dotenv()

import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db, init_db
from models import Conversation, Message, Agent, Memory
from memory import (
    get_memories,
    retrieve_relevant_memories,
    store_memory,
    delete_memory,
    update_memory,
)
from search import deep_search
from agent_engine import (
    chat_stream,
    generate_agent_system_prompt,
    generate_deployment_guide,
    OMNICLIENT_SYSTEM_PROMPT,
)
from agents import create_agent, list_agents, get_agent_by_id
from slideforge_prompt import SLIDEFORGE_SYSTEM_PROMPT

settings = get_settings()

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.app_name,
    description="AI Agent Platform with persistent memory and deep search",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
UI_DIR = Path(__file__).parent / "ui"
app.mount("/static", StaticFiles(directory=str(UI_DIR)), name="static")


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
def on_startup():
    init_db()
    # Seed default OmniClient agent if not present
    db = next(get_db())
    try:
        existing = db.query(Agent).filter(Agent.name == "OmniClient").first()
        if not existing:
            agent = Agent(
                name="OmniClient",
                description="Elite AI Client Success Architect - your primary assistant.",
                system_prompt=OMNICLIENT_SYSTEM_PROMPT,
                model=settings.default_model,
                temperature=0.7,
                enable_search=True,
                enable_db_query=True,
                enable_code_gen=True,
                config_json=json.dumps({"is_primary": True}),
            )
            db.add(agent)
            db.commit()
        elif existing.config_json and json.loads(existing.config_json or "{}").get("is_primary"):
            if existing.model != settings.default_model:
                existing.model = settings.default_model
                db.commit()

        slideforge = db.query(Agent).filter(Agent.name == "SlideForge").first()
        slideforge_config = json.dumps({"is_slideforge": True, "version": "3.0"})
        if not slideforge:
            slideforge = Agent(
                name="SlideForge",
                description="AI Presentation and Automation Architect for slides, chat UIs, and n8n workflows.",
                system_prompt=SLIDEFORGE_SYSTEM_PROMPT,
                model=settings.default_model,
                temperature=0.4,
                enable_search=True,
                enable_db_query=False,
                enable_code_gen=True,
                config_json=slideforge_config,
            )
            db.add(slideforge)
            db.commit()
        else:
            cfg = json.loads(slideforge.config_json or "{}")
            if cfg.get("is_slideforge") or not slideforge.config_json:
                slideforge.description = "AI Presentation and Automation Architect for slides, chat UIs, and n8n workflows."
                slideforge.system_prompt = SLIDEFORGE_SYSTEM_PROMPT
                slideforge.model = settings.default_model
                slideforge.temperature = 0.4
                slideforge.enable_search = True
                slideforge.enable_db_query = False
                slideforge.enable_code_gen = True
                slideforge.config_json = slideforge_config
                db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    agent_id: Optional[int] = None


class CreateAgentRequest(BaseModel):
    name: str
    description: str = ""
    purpose: str
    capabilities: list[str] = []
    tone: str = "Professional"
    model: str = ""
    temperature: float = 0.7
    enable_search: bool = True
    enable_db_query: bool = False
    enable_code_gen: bool = True
    system_prompt: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    max_results: int = 5


class DBQueryRequest(BaseModel):
    sql: str
    conversation_id: Optional[int] = None


class DeployGuideRequest(BaseModel):
    project_type: str
    context: str = ""


class MemoryUpdateRequest(BaseModel):
    key: str
    value: str


class MemoryCreateRequest(BaseModel):
    key: str
    value: str
    importance_score: float = 1.0


# ---------------------------------------------------------------------------
# Root - serve UI
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    index_path = UI_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>OmniClient UI not found. Check ui/index.html</h1>", status_code=404)


# ---------------------------------------------------------------------------
# Chat endpoint (SSE streaming)
# ---------------------------------------------------------------------------

@app.post("/api/chat")
@limiter.limit("10/minute")
async def chat_endpoint(request: Request, body: ChatRequest, db: Session = Depends(get_db)):
    """Main chat endpoint. Returns Server-Sent Events stream."""

    # Sanitize input
    user_message = _sanitize(body.message)
    if not user_message.strip():
        raise HTTPException(400, "Message cannot be empty.")

    # Get or create conversation
    conversation_id = body.conversation_id
    if not conversation_id:
        conv = Conversation(title="New Conversation")
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id
    else:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(404, f"Conversation {conversation_id} not found.")

    # Resolve agent
    agent = None
    if body.agent_id:
        agent = db.query(Agent).filter(Agent.id == body.agent_id).first()

    def generate():
        # First chunk: conversation_id metadata
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation_id})}\n\n"
        for chunk in chat_stream(user_message, conversation_id, db, agent):
            payload = json.dumps({"type": "token", "content": chunk})
            yield f"data: {payload}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

@app.get("/api/conversations")
def list_conversations(db: Session = Depends(get_db)):
    convs = (
        db.query(Conversation)
        .filter(Conversation.archived == False)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "message_count": c.message_count,
            "pinned": c.pinned,
            "archived": c.archived,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found.")
    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.timestamp.asc())
        .all()
    )
    return {
        "id": conv.id,
        "title": conv.title,
        "pinned": conv.pinned,
        "archived": conv.archived,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                "bookmarked": m.bookmarked,
            }
            for m in msgs
        ],
    }


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found.")
    db.delete(conv)
    db.commit()
    return {"status": "deleted", "id": conv_id}


@app.patch("/api/conversations/{conv_id}")
async def update_conversation(conv_id: int, request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found.")
    if "pinned" in body:
        conv.pinned = body["pinned"]
    if "archived" in body:
        conv.archived = body["archived"]
    if "title" in body:
        conv.title = _sanitize(body["title"])[:100]
    db.commit()
    return {"status": "updated"}


@app.patch("/api/messages/{msg_id}/bookmark")
def bookmark_message(msg_id: int, db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id).first()
    if not msg:
        raise HTTPException(404, "Message not found.")
    msg.bookmarked = not msg.bookmarked
    db.commit()
    return {"bookmarked": msg.bookmarked}


@app.delete("/api/messages/{msg_id}")
def delete_message(msg_id: int, db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == msg_id).first()
    if not msg:
        raise HTTPException(404, "Message not found.")
    db.delete(msg)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

@app.post("/api/agents")
def create_new_agent(body: CreateAgentRequest, db: Session = Depends(get_db)):
    model = body.model or settings.default_model
    if not model.endswith(":free"):
        # Ensure free model suffix
        pass  # User may specify any valid free model

    # Generate system prompt if not provided
    system_prompt = body.system_prompt
    if not system_prompt:
        system_prompt = generate_agent_system_prompt(
            purpose=body.purpose,
            capabilities=body.capabilities,
            tone=body.tone,
        )

    agent = create_agent(
        db=db,
        name=_sanitize(body.name),
        description=_sanitize(body.description),
        system_prompt=system_prompt,
        model=model,
        temperature=body.temperature,
        enable_search=body.enable_search,
        enable_db_query=body.enable_db_query,
        enable_code_gen=body.enable_code_gen,
        config_json=json.dumps({
            "purpose": body.purpose,
            "capabilities": body.capabilities,
            "tone": body.tone,
        }),
    )
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "model": agent.model,
        "system_prompt": agent.system_prompt,
        "temperature": agent.temperature,
        "enable_search": agent.enable_search,
        "enable_db_query": agent.enable_db_query,
        "enable_code_gen": agent.enable_code_gen,
    }


@app.get("/api/agents")
def get_agents(db: Session = Depends(get_db)):
    agents = list_agents(db)
    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "model": a.model,
            "temperature": a.temperature,
            "enable_search": a.enable_search,
            "enable_db_query": a.enable_db_query,
            "enable_code_gen": a.enable_code_gen,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in agents
    ]


@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = get_agent_by_id(db, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found.")
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "system_prompt": agent.system_prompt,
        "model": agent.model,
        "temperature": agent.temperature,
        "enable_search": agent.enable_search,
        "enable_db_query": agent.enable_db_query,
        "enable_code_gen": agent.enable_code_gen,
        "config_json": agent.config_json,
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
    }


@app.patch("/api/agents/{agent_id}")
async def update_agent(agent_id: int, request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    agent = get_agent_by_id(db, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found.")
    allowed = ["name", "description", "system_prompt", "model", "temperature",
               "enable_search", "enable_db_query", "enable_code_gen"]
    for field in allowed:
        if field in body:
            setattr(agent, field, body[field])
    db.commit()
    return {"status": "updated"}


@app.delete("/api/agents/{agent_id}")
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = get_agent_by_id(db, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found.")
    db.delete(agent)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@app.post("/api/search")
@limiter.limit("20/minute")
async def search_endpoint(request: Request, body: SearchRequest, db: Session = Depends(get_db)):
    if not body.query.strip():
        raise HTTPException(400, "Query cannot be empty.")
    result = deep_search(body.query, db, max_results=body.max_results)
    return result


# ---------------------------------------------------------------------------
# DB Query (read-only)
# ---------------------------------------------------------------------------

_BLOCKED_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)


@app.post("/api/query-db")
def query_db(body: DBQueryRequest, db: Session = Depends(get_db)):
    sql = body.sql.strip()
    if not sql:
        raise HTTPException(400, "SQL cannot be empty.")

    # Safety check: block write operations
    if _BLOCKED_SQL.search(sql):
        raise HTTPException(
            400,
            "Only SELECT and PRAGMA statements are allowed for safety. "
            "Write operations (INSERT, UPDATE, DELETE, DROP, etc.) are blocked."
        )

    try:
        from sqlalchemy import text
        result = db.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchall()]
        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "sql": sql,
        }
    except Exception as e:
        raise HTTPException(400, f"Query error: {str(e)}")


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------

@app.get("/api/memory/{conversation_id}")
def get_memory(conversation_id: int, q: Optional[str] = None, db: Session = Depends(get_db)):
    if q:
        memories = retrieve_relevant_memories(db, conversation_id, q)
    else:
        mems = get_memories(db, conversation_id)
        memories = [
            {"id": m.id, "key": m.key, "value": m.value,
             "importance_score": m.importance_score,
             "created_at": m.created_at.isoformat() if m.created_at else None}
            for m in mems
        ]
    return {"conversation_id": conversation_id, "memories": memories}


@app.post("/api/memory/{conversation_id}")
def create_memory(conversation_id: int, body: MemoryCreateRequest, db: Session = Depends(get_db)):
    mem = store_memory(db, conversation_id, _sanitize(body.key), _sanitize(body.value), body.importance_score)
    return {"id": mem.id, "key": mem.key, "value": mem.value}


@app.patch("/api/memory/entry/{memory_id}")
def patch_memory(memory_id: int, body: MemoryUpdateRequest, db: Session = Depends(get_db)):
    mem = update_memory(db, memory_id, _sanitize(body.key), _sanitize(body.value))
    if not mem:
        raise HTTPException(404, "Memory not found.")
    return {"id": mem.id, "key": mem.key, "value": mem.value}


@app.delete("/api/memory/entry/{memory_id}")
def remove_memory(memory_id: int, db: Session = Depends(get_db)):
    ok = delete_memory(db, memory_id)
    if not ok:
        raise HTTPException(404, "Memory not found.")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# SlideForge export
# ---------------------------------------------------------------------------

@app.post("/api/slideforge/export/pptx")
def slideforge_export_pptx(request: Request):
    """Generate and return the current SlideForge PPTX deck."""
    try:
        from generate_presentation import create_presentation
        create_presentation()
    except Exception as e:
        raise HTTPException(500, f"Failed to generate PPTX: {e}")

    pptx_path = Path(__file__).parent / "digital_marketing_strategy_presentation.pptx"
    if not pptx_path.exists():
        raise HTTPException(500, "PPTX generation completed but output file was not found.")

    return FileResponse(
        path=str(pptx_path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename="digital_marketing_strategy_presentation.pptx",
    )

# ---------------------------------------------------------------------------
# Deployment guide
# ---------------------------------------------------------------------------

@app.post("/api/deploy/guide")
@limiter.limit("5/minute")
async def deploy_guide(request: Request, body: DeployGuideRequest):
    guide = generate_deployment_guide(body.project_type, body.context)
    return {"guide": guide, "project_type": body.project_type}


# ---------------------------------------------------------------------------
# Export conversation
# ---------------------------------------------------------------------------

@app.get("/api/conversations/{conv_id}/export")
def export_conversation(conv_id: int, fmt: str = "markdown", db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found.")
    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.timestamp.asc())
        .all()
    )

    if fmt == "json":
        data = {
            "title": conv.title,
            "exported_at": datetime.utcnow().isoformat(),
            "messages": [
                {"role": m.role, "content": m.content,
                 "timestamp": m.timestamp.isoformat() if m.timestamp else None}
                for m in msgs
            ],
        }
        return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="conversation_{conv_id}.json"'})

    # Markdown export
    lines = [f"# {conv.title}\n", f"*Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC*\n\n---\n"]
    for m in msgs:
        label = "**You**" if m.role == "user" else "**OmniClient**"
        lines.append(f"{label}:\n{m.content}\n\n---\n")
    md = "\n".join(lines)
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="conversation_{conv_id}.md"'},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name, "time": datetime.utcnow().isoformat()}


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


# ---------------------------------------------------------------------------
# Input sanitization helper
# ---------------------------------------------------------------------------

def _sanitize(text: str) -> str:
    if not text:
        return ""
    # Remove null bytes, strip leading/trailing whitespace
    return text.replace("\x00", "").strip()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.app_port,
        reload=settings.debug,
        log_level="info",
    )
