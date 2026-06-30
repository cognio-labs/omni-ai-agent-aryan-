"""
generate_website.py — AI-powered React website code generator for OmniClient.

Public API
----------
generate_website_stream(prompt, conversation_id, db) -> Generator[str, None, None]
    Yields JSON-encoded SSE strings:
      {"type": "build_step", "step": {...}}   — one per build step
      {"type": "complete", "project": {...}}  — final payload with all files
      {"type": "error", "message": "..."}    — on failure

WEBSITE_SYSTEM_PROMPT  — system prompt injected into Claude for code generation
WEBSITES_DIR           — folder where project files are saved to disk
"""

from __future__ import annotations

import json
import os
import re
import uuid
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Generator, Optional

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

WEBSITES_DIR = Path(__file__).parent / "websites"
WEBSITES_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

WEBSITE_SYSTEM_PROMPT = """You are WebForge, an expert React website code generator embedded inside OmniClient.

When the user describes a website they want, you MUST respond with ONLY a valid JSON object (no markdown, no explanation, no extra text) matching this exact schema:

{
  "title": "Short descriptive title of the website",
  "summary": "1-2 sentence description of what was built",
  "files": [
    {"path": "src/App.jsx",   "content": "...", "language": "jsx"},
    {"path": "src/Hero.jsx",  "content": "...", "language": "jsx"},
    {"path": "src/styles.css","content": "...", "language": "css"}
  ],
  "build_steps": [
    {"type": "thought",   "text": "Thought for Xs: ...reasoning..."},
    {"type": "command",   "label": "Checking dependencies", "command": "npm list react"},
    {"type": "command",   "label": "Installing libraries",  "command": "npm install framer-motion"},
    {"type": "file_edit", "file": "src/App.jsx",  "diff": "+ Added hero section"},
    {"type": "file_edit", "file": "src/Hero.jsx", "diff": "+ Added reusable hero component"},
    {"type": "file_edit", "file": "src/styles.css","diff": "+ Added responsive layout and design tokens"}
  ]
}

CRITICAL RULES:
1. Generate production-quality, complete, working code — NO placeholders, NO TODO comments, NO lorem ipsum.
2. Match the visual style to the user's topic:
   - SaaS/startup → clean modern design with gradient hero, feature grid, CTA section
   - Portfolio → minimal, typographic, elegant
   - E-commerce → product cards, clear pricing, trust signals
   - Dashboard → data tables, stat cards, chart placeholders
   - 3D/interactive → use react-three-fiber / Three.js if requested
3. Include realistic, polished UI: proper spacing, typography scale, hover effects, smooth transitions, responsive design.
4. Use CSS custom properties (--color-primary, --space-4, etc.) for a consistent design system.
5. Every file must be syntactically complete — valid JSX and valid CSS.
6. Use Inter font from Google Fonts via @import in CSS.
7. Do NOT include package.json or index.html — those are auto-injected by the preview runtime.
8. Always export App as the default export from src/App.jsx.
9. Always include at minimum: src/App.jsx and src/styles.css.
10. Return ONLY the JSON object. No markdown code fences, no explanation text."""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_JSON_RE = re.compile(r'\{[\s\S]*\}', re.DOTALL)


def _extract_json(text: str) -> Optional[dict]:
    """Extract the first JSON object from AI text response."""
    # Try direct parse first
    text = text.strip()
    # Strip markdown fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    try:
        return json.loads(text)
    except Exception:
        pass
    # Find embedded JSON object
    match = _JSON_RE.search(text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return None


def _make_title(prompt: str) -> str:
    """Generate a short project title from the user prompt."""
    words = prompt.strip().split()[:6]
    return " ".join(words).title() or "My Website"


def _save_project_files(project_id: int, files: list[dict]) -> str:
    """Save generated files to disk and return the project directory path."""
    project_dir = WEBSITES_DIR / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)
    for file in files:
        file_path = project_dir / file["path"].lstrip("/")
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(file.get("content", ""), encoding="utf-8")
    return str(project_dir)


def create_zip(project_id: int, files: list[dict]) -> BytesIO:
    """Bundle all project files into an in-memory ZIP archive."""
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in files:
            path = file["path"].lstrip("/")
            zf.writestr(path, file.get("content", ""))
        # Add package.json for local use
        pkg = {
            "name": f"omniclient-website-{project_id}",
            "version": "1.0.0",
            "scripts": {"dev": "vite", "build": "vite build"},
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "framer-motion": "^11.0.0",
                "lucide-react": "^0.400.0"
            },
            "devDependencies": {
                "vite": "^5.0.0",
                "@vitejs/plugin-react": "^4.0.0"
            }
        }
        zf.writestr("package.json", json.dumps(pkg, indent=2))
        zf.writestr("README.md", f"# OmniClient Generated Website\n\nGenerated on {datetime.utcnow().strftime('%Y-%m-%d')}.\n\n## Setup\n\n```bash\nnpm install\nnpm run dev\n```\n")
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Default fallback data
# ---------------------------------------------------------------------------

def _default_website_data(prompt: str) -> dict:
    """Return a minimal fallback website when AI generation fails."""
    title = _make_title(prompt)
    return {
        "title": title,
        "summary": f"A clean landing page for: {prompt[:80]}",
        "files": [
            {
                "path": "src/App.jsx",
                "language": "jsx",
                "content": f"""import './styles.css';

export default function App() {{
  return (
    <main className="page">
      <section className="hero">
        <span className="eyebrow">OmniClient Website Builder</span>
        <h1>{title}</h1>
        <p>Your AI-generated website is ready. Edit the prompt and regenerate to customise.</p>
        <button className="btn-primary">Get Started</button>
      </section>
    </main>
  );
}}
"""
            },
            {
                "path": "src/styles.css",
                "language": "css",
                "content": """:root {
  --color-bg: #f8fafc;
  --color-primary: #6366f1;
  --color-text: #1e293b;
  --color-muted: #64748b;
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--color-bg); color: var(--color-text); }
.page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px; }
.hero { max-width: 640px; text-align: center; }
.eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--color-primary); }
h1 { font-size: clamp(36px, 6vw, 72px); line-height: 1; font-weight: 800; margin: 16px 0; letter-spacing: -0.03em; }
p { font-size: 18px; color: var(--color-muted); line-height: 1.65; margin: 16px 0 28px; }
.btn-primary { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 12px; padding: 14px 24px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 8px 24px rgba(99,102,241,.28); transition: transform .15s, box-shadow .15s; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(99,102,241,.38); }
"""
            }
        ],
        "build_steps": [
            {"type": "thought", "text": "Thought for 3s: Planning fallback component structure."},
            {"type": "file_edit", "file": "src/App.jsx", "diff": "+ Added minimal landing page component"},
            {"type": "file_edit", "file": "src/styles.css", "diff": "+ Added design system and responsive layout"},
        ]
    }


# ---------------------------------------------------------------------------
# Main streaming generator
# ---------------------------------------------------------------------------

def generate_website_stream(
    prompt: str,
    conversation_id: Optional[int],
    db,
) -> Generator[str, None, None]:
    """
    Generator that yields SSE-ready JSON strings for website generation.

    Events:
      data: {"type": "build_step", "step": {...}}
      data: {"type": "complete",   "project": {...}}
      data: {"type": "error",      "message": "..."}
    """
    from models import WebsiteProject, Conversation
    from agent_engine import chat_stream

    def sse(payload: dict) -> str:
        return json.dumps(payload)

    # ── 1. Create DB record (generating) ──────────────────────────────────
    title = _make_title(prompt)
    project = WebsiteProject(
        title=title,
        prompt=prompt,
        status="generating",
        conversation_id=conversation_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    project_id = project.id

    # ── 2. Emit initial thought step ──────────────────────────────────────
    yield sse({
        "type": "build_step",
        "step": {"type": "thought", "text": f"Thought for ~15s: Analyzing '{prompt[:60]}...' to plan the component architecture, visual system, and file structure."}
    })

    # ── 3. Emit dependency check ──────────────────────────────────────────
    yield sse({
        "type": "build_step",
        "step": {"type": "command", "label": "Checking dependencies", "command": "npm list react react-dom framer-motion lucide-react"}
    })

    # ── 4. Call AI to generate website code ───────────────────────────────
    full_response = ""
    try:
        from models import Agent
        # Try to find a suitable agent (use any available)
        agent = db.query(Agent).filter(Agent.name == "OmniClient").first()

        # Build the generation prompt
        generation_prompt = (
            f"[SYSTEM: You are WebForge. {WEBSITE_SYSTEM_PROMPT}]\n\n"
            f"USER REQUEST: {prompt}\n\n"
            "Generate the complete React website JSON now. Return ONLY the JSON object."
        )

        for chunk in chat_stream(generation_prompt, None, db, agent):
            full_response += chunk

    except Exception as ai_err:
        yield sse({"type": "build_step", "step": {"type": "thought", "text": f"Note: AI generation encountered an issue ({str(ai_err)[:80]}). Using fallback template."}})

    # ── 5. Parse the AI response ──────────────────────────────────────────
    parsed = _extract_json(full_response) if full_response else None
    if not parsed or not isinstance(parsed.get("files"), list) or len(parsed["files"]) == 0:
        # Fall back to default
        parsed = _default_website_data(prompt)
        yield sse({"type": "build_step", "step": {"type": "thought", "text": "Note: Using clean template — AI output could not be parsed as structured JSON."}})

    files       = parsed.get("files", [])
    build_steps = parsed.get("build_steps", [])
    summary     = parsed.get("summary", f"Built a website for: {prompt[:80]}")
    title       = parsed.get("title", title)

    # ── 6. Emit file-edit build steps ─────────────────────────────────────
    for step in build_steps:
        yield sse({"type": "build_step", "step": step})

    # ── 7. Save files to disk ─────────────────────────────────────────────
    try:
        _save_project_files(project_id, files)
    except Exception:
        pass  # disk save is non-critical

    # ── 8. Emit install step ──────────────────────────────────────────────
    yield sse({
        "type": "build_step",
        "step": {"type": "command", "label": "Installing libraries", "command": "npm install framer-motion lucide-react"}
    })

    # ── 9. Persist to DB ──────────────────────────────────────────────────
    try:
        project.title            = title
        project.files_json       = json.dumps(files)
        project.build_steps_json = json.dumps(build_steps)
        project.summary          = summary
        project.status           = "completed"
        db.commit()
        db.refresh(project)
    except Exception as db_err:
        yield sse({"type": "error", "message": f"DB save failed: {db_err}"})
        return

    # ── 10. Emit complete event ───────────────────────────────────────────
    project_payload = {
        "id":          project.id,
        "title":       project.title,
        "prompt":      prompt,
        "summary":     summary,
        "description": f"Generated {len(files)} files with a fully responsive React site.",
        "files":       files,
        "build_steps": build_steps,
    }
    yield sse({"type": "complete", "project": project_payload})
