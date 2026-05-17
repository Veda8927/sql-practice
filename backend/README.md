# SQL Practice Backend

FastAPI backend for the SQL practice app.

## Setup

```bash
uv sync
cp ../.env.example ../.env  # then edit ../.env with your OPENAI_API_KEY
```

## Run

Requires Postgres running (`docker compose up -d` from repo root).

```bash
uv run uvicorn app.main:app --reload
```

Visit http://localhost:8000/docs for the OpenAPI UI.

## Routes

- `GET  /api/health`
- `POST /api/reset_data`   body `{"seed": int?}`
- `GET  /api/schema`
- `POST /api/new_question` body `{"concept": str?}`
- `POST /api/submit`       body `{"sql": str}`
- `POST /api/explain`      body `{"sql": str}`
