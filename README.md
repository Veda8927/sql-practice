# SQL Practice

A local SQL practice app with an AI tutor. Generates realistic synthetic data, asks you questions, grades your answers, and walks you through solutions in plain English when you get stuck.

> Postgres 16 · FastAPI · Next.js 15 · GPT-4o-mini · Monaco · Tailwind · framer-motion

## Highlights

- **Three rotating schemas** — e-commerce, library, movie ratings. Reset gives you a different scenario with fresh data and FK relationships.
- **GPT-4o-mini tutor** that generates difficulty-tunable questions and pre-runs the reference SQL so the expected output is peekable.
- **Real grading**: executes your SQL and the reference SQL in a rolled-back transaction with a 5s statement timeout, then compares results column-by-column (order-aware or order-agnostic per the question).
- **Inline lint** — SQL keyword typo detection with quick-fix code actions in the Monaco editor.
- **Step-by-step solution reveal** in 5th-grade language when you give up, with copy/paste-to-editor.
- **Light + dark mode**, keyboard-driven (⌘↵ to run, ⌘N for a new question), responsive down to phone widths.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15, App Router, TS, Tailwind, Monaco)         │
│  ┌──────────────┬───────────────────────────────────────────┐   │
│  │ Schema drawer│ Question bar (chat-style)                 │   │
│  │ List|Table   │ ─────────────────────────────────────────── │   │
│  │ PK/FK badges │ Monaco editor  │  Result | Expected toggle│   │
│  └──────────────┴───────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP/JSON
┌─────────────────────────────────▼───────────────────────────────┐
│  FastAPI (async)                                                │
│   /api/health    /api/schema       /api/reset_data              │
│   /api/new_question (LLM + ref-SQL preflight)                   │
│   /api/submit       (grader + statement timeout + DDL guard)    │
│   /api/explain      (typo correction + 3-5 sentence hint)       │
│   /api/give_up      (5th-grade walkthrough w/ SQL snippets)     │
└──────────┬─────────────────────────────────────────────┬────────┘
           │                                             │
           ▼                                             ▼
┌──────────────────┐                          ┌──────────────────┐
│  Postgres 16     │                          │   OpenAI         │
│  (Docker, 5433)  │                          │   gpt-4o-mini    │
└──────────────────┘                          └──────────────────┘
```

## Quick start

```bash
# 1. clone + env
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
# put your OpenAI key in .env

# 2. Postgres
docker compose up -d

# 3. Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# 4. Frontend (new shell)
cd frontend
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Keyboard shortcuts

| Combo               | Action       |
| ------------------- | ------------ |
| ⌘/Ctrl + Enter      | Run query    |
| ⌘/Ctrl + N          | New question |
| ⌘/Ctrl + Shift + F  | Format SQL   |

## Project layout

```text
sql-practice/
├── backend/                FastAPI app
│   ├── app/
│   │   ├── main.py         routes
│   │   ├── data_gen.py     schema scenarios + introspection
│   │   ├── grader.py       SQL execution + result diffing
│   │   ├── llm.py          OpenAI prompts + retries
│   │   ├── schemas.py      Pydantic models
│   │   ├── state.py        in-memory session state
│   │   ├── db.py           async SQLAlchemy engine
│   │   └── config.py       env-driven settings
│   └── pyproject.toml
├── frontend/               Next.js 15 (App Router, TS)
│   ├── src/
│   │   ├── app/
│   │   ├── components/     domain + shadcn primitives
│   │   └── lib/            api client, types, SQL lint
│   └── package.json
├── design-system/          UI/UX Pro Max generated specs
├── docker-compose.yml      Postgres 16 (port 5433)
└── .mcp.json               21st.dev Magic MCP scaffolding
```

## Testing it locally

```bash
# end-to-end smoke (backend running on :8000)
curl -s http://localhost:8000/api/health
curl -s -X POST http://localhost:8000/api/reset_data -d '{}' -H 'Content-Type: application/json' | jq '.scenario_label, .tables[].name'
curl -s -X POST http://localhost:8000/api/new_question -d '{"difficulty":"easy"}' -H 'Content-Type: application/json' | jq '.question'
```

## Tooling

- **uv** for Python deps (Postgres + FastAPI + OpenAI SDK)
- **pnpm** for Node deps
- **Docker Compose** for Postgres
- **Ruff** for Python lint/format
- **ESLint + Next** for frontend lint
- **uipro** (UI/UX Pro Max CLI) generated the design system

## License

MIT — see [LICENSE](LICENSE).
