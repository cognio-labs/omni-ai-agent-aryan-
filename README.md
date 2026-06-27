# OmniClient AI Agent Platform

> A comprehensive, locally-runnable Python AI agent application — your universal Client Concierge.

![OmniClient](https://img.shields.io/badge/OmniClient-AI%20Agent%20Platform-6366f1?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Free%20Models-FF6B6B?style=for-the-badge)

---

## ✨ Features

- 🤖 **Multi-Agent System** — Create and manage specialized AI sub-agents with a 3-step wizard
- 🧠 **Persistent Memory** — Short-term + long-term SQLite memory with TF-IDF retrieval
- 🔍 **Deep Web Search** — Multi-step DuckDuckGo search with sub-topic aggregation (no API key needed)
- 💬 **Streaming Chat** — Real-time token-by-token response streaming via SSE
- 📊 **DB Query Tool** — Safe read-only SQL interface with CSV export
- 🚀 **Deployment Guide** — Auto-generated deployment checklists for any framework
- 🎨 **Premium Dark UI** — Tailwind CSS + custom animations + slide-out agent panel

---

## 🚀 Quick Start

### 1. Clone / Download
```bash
cd "OmniClient AI Agent Platform"
```

### 2. Create Virtual Environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment
```bash
# Copy the example file
copy .env.example .env      # Windows
cp .env.example .env        # macOS/Linux

# Edit .env and add your OpenRouter API key
notepad .env                # Windows
nano .env                   # macOS/Linux
```

### 5. Get Your FREE OpenRouter API Key
1. Visit [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up (free, no credit card required)
3. Click **Create Key**
4. Copy and paste into your `.env` file:
   ```
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
   ```

### 6. Run the Application
```bash
# Option A: Direct run
python main.py

# Option B: Uvicorn with auto-reload (recommended for development)
uvicorn main:app --reload --port 8000
```

### 7. Open in Browser
```
http://localhost:8000
```

---

## 📁 Project Structure

```
OmniClient AI Agent Platform/
├── .env                    # Your secrets (never commit this!)
├── .env.example            # Template for .env
├── .gitignore
├── requirements.txt
├── main.py                 # FastAPI app + all API endpoints
├── config.py               # Pydantic settings
├── database.py             # SQLAlchemy engine + session
├── models.py               # ORM models (Conversation, Message, Memory, Agent, SearchCache)
├── memory.py               # Hybrid short/long-term memory system
├── search.py               # Deep multi-step DuckDuckGo search
├── agent_engine.py         # Core AI orchestrator + tool dispatch
├── agents/
│   └── __init__.py         # Agent registry helpers
├── ui/
│   ├── index.html          # Single-page app
│   ├── styles.css          # Custom CSS (dark mode, animations)
│   └── app.js              # Vanilla JavaScript SPA logic
└── .vscode/
    └── launch.json         # VS Code debug config
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serve the main UI |
| `POST` | `/api/chat` | SSE streaming chat |
| `GET` | `/api/conversations` | List all conversations |
| `GET` | `/api/conversations/{id}` | Get full message history |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation |
| `GET` | `/api/conversations/{id}/export` | Export as Markdown or JSON |
| `POST` | `/api/agents` | Create a new sub-agent |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/{id}` | Get agent details |
| `PATCH` | `/api/agents/{id}` | Update agent settings |
| `POST` | `/api/search` | Trigger deep web search |
| `POST` | `/api/query-db` | Execute read-only SQL |
| `GET` | `/api/memory/{conv_id}` | Get conversation memories |
| `POST` | `/api/memory/{conv_id}` | Add a memory entry |
| `DELETE` | `/api/memory/entry/{id}` | Delete a memory |
| `POST` | `/api/deploy/guide` | Generate deployment guide |
| `GET` | `/api/health` | Health check |
| `GET` | `/docs` | Swagger UI (debug mode) |

---

## 🎨 UI Features

- **Left Sidebar**: Conversation list with pin/archive/delete, agent selector, new chat button
- **Center Chat**: Streaming messages, code highlighting (Prism.js), copy buttons, regenerate, bookmark
- **Slide-Out Panel** (right, 400px): Agent configuration, temperature slider, system prompt editor, memory inspector, tools toggle, deployment guide generator
- **Modals**: 3-step agent creation wizard, DB query with table view + CSV export, settings

---

## 🤖 Free AI Models Used

All models are completely free on OpenRouter:

| Model | ID |
|-------|----|
| Llama 3 8B Instruct | `meta-llama/llama-3-8b-instruct:free` |
| Mistral 7B Instruct | `mistralai/mistral-7b-instruct:free` |
| Gemma 2 9B IT | `google/gemma-2-9b-it:free` |
| OpenChat 7B | `openchat/openchat-7b:free` |

---

## 🛠️ Troubleshooting

### Port 8000 Already in Use
```bash
# Find and kill the process using port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:8000 | xargs kill
```

### ModuleNotFoundError
```bash
# Make sure your virtual environment is activated
venv\Scripts\activate    # Windows
source venv/bin/activate  # macOS/Linux

# Reinstall
pip install -r requirements.txt
```

### API Key Error (401 Unauthorized)
- Verify your `.env` file has the correct `OPENROUTER_API_KEY`
- Ensure no extra spaces around the `=` sign
- Get a new key at https://openrouter.ai/keys

### Search Not Working
```bash
pip install --upgrade duckduckgo-search
```

### Database Issues
```bash
# Delete the database and restart (will recreate automatically)
del omniclient.db       # Windows
rm omniclient.db        # macOS/Linux
python main.py
```

---

## 📖 VS Code Debugging

1. Open the project folder in VS Code
2. Press **F5** or go to **Run → Start Debugging**
3. Select **"OmniClient: Run FastAPI (uvicorn)"**
4. Set breakpoints anywhere in the Python files

---

## 🔒 Security Notes

- The `.env` file is in `.gitignore` — **never commit it**
- The DB query endpoint only allows `SELECT` and `PRAGMA` statements
- API keys are never logged or exposed in responses
- Rate limiting: 10 chat requests/minute per IP

---

## 📄 License

MIT License — free to use and modify for any purpose.
