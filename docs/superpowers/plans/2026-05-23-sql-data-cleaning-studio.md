# SQL Data Cleaning Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Clean" mode where the user uploads a messy CSV (or generates a messy dataset) and cleans it with an ordered pipeline of SQL steps, with a per-step audit log, validation rules, and an AI review.

**Architecture:** A re-run-from-raw pipeline: each step is a `SELECT` reading a fixed `prev` (and `raw`) alias; the backend materializes each stage as a temp table inside one rolled-back transaction and snapshots a profile after each. All cleaning data lives in an isolated `clean` Postgres schema (the practice app wipes `public`). Steps/rules are client-owned and posted on each run; the backend persists only the raw table + dataset metadata + (for generated data) an issue rubric.

**Tech Stack:** FastAPI, SQLAlchemy async, Postgres 16, Pydantic, OpenAI (gpt-4o-mini), Next.js 15 / React 19, React Query, Monaco, Tailwind, sonner. New deps: `python-multipart` (uploads), `pytest` + `pytest-asyncio` (tests).

Spec: `docs/superpowers/specs/2026-05-23-sql-data-cleaning-studio-design.md`

---

## File structure

**Backend (new under `backend/app/clean/`):**
- `__init__.py` — package marker
- `state.py` — `CleanSession` dataclass
- `ingest.py` — CSV parse, identifier sanitization, type guess, load, profile, suggest rules
- `rules.py` — rule vocabulary → violation-count SQL builder
- `pipeline.py` — staged execution + profiling + validation
- `generate.py` — deterministic messy-dataset generator + rubric
- `schemas.py` — Pydantic request/response models
- `routes.py` — `/api/clean/*` APIRouter

**Backend (modified):**
- `backend/app/deps.py` (new) — shared `SessionDep`
- `backend/app/state.py` — add `sid` + `clean` fields
- `backend/app/main.py` — import `SessionDep` from `deps`; include clean router
- `backend/app/llm.py` — add `review_cleaning`
- `backend/pyproject.toml` — add deps
- `backend/tests/` (new) — pytest suite

**Frontend (new):**
- `frontend/src/lib/clean-types.ts`
- `frontend/src/lib/clean-api.ts`
- `frontend/src/components/clean/clean-view.tsx`
- `frontend/src/components/clean/upload-dropzone.tsx`
- `frontend/src/components/clean/step-editor.tsx`
- `frontend/src/components/clean/pipeline-panel.tsx`
- `frontend/src/components/clean/data-view.tsx`
- `frontend/src/components/clean/audit-log.tsx`
- `frontend/src/components/clean/validation-panel.tsx`
- `frontend/src/components/clean/review-card.tsx`

**Frontend (modified):**
- `frontend/src/app/page.tsx` — add `"clean"` mode + pill + render branch

---

## Phase 0 — Setup

### Task 0: Dependencies + pytest scaffolding

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`

- [ ] **Step 1: Add deps to `backend/pyproject.toml`**

Add `"python-multipart>=0.0.9"` to `[project].dependencies`. Replace the `[dependency-groups]` dev list with:
```toml
[dependency-groups]
dev = [
    "ruff>=0.7",
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
]
```

Add pytest config at the end of the file:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create `backend/tests/__init__.py`** (empty file).

- [ ] **Step 3: Create `backend/tests/conftest.py`**

```python
"""Shared test fixtures. DB-backed tests skip automatically if Postgres is down."""
import pytest
import pytest_asyncio
from sqlalchemy import text

from app.db import engine


@pytest_asyncio.fixture
async def db_conn():
    try:
        conn = await engine.connect()
    except Exception:
        pytest.skip("Postgres not available")
    trans = await conn.begin()
    try:
        yield conn
    finally:
        await trans.rollback()
        await conn.close()
```

- [ ] **Step 4: Sync + sanity check**

Run: `cd backend && uv sync && uv run pytest -q`
Expected: dependencies install; pytest collects 0 tests and exits 0 (no tests yet).

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests/__init__.py backend/tests/conftest.py
git commit -m "chore(clean): add multipart + pytest scaffolding"
```

---

## Phase 1 — Shared session dependency

### Task 1: Extract `SessionDep` into `deps.py`; add session fields

**Files:**
- Create: `backend/app/deps.py`
- Modify: `backend/app/state.py`
- Modify: `backend/app/main.py:49-70`

- [ ] **Step 1: Create `backend/app/clean/__init__.py`** (empty file) and **`backend/app/clean/state.py`**

```python
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CleanSession:
    dataset_id: str
    source: str  # "upload" | "generated"
    table: str  # fully-qualified, e.g. clean."dataset_ab12cd34"
    idents: list[str]  # sanitized column identifiers, in order
    row_count: int
    summary: dict[str, Any]  # cached DatasetSummary payload for GET /dataset
    rubric: list[dict[str, Any]] | None = field(default=None)
```

- [ ] **Step 2: Modify `backend/app/state.py`** — add `sid` + `clean`, set `sid` on creation

Add import at top:
```python
from .clean.state import CleanSession
```
Add fields to `SessionState` (keep existing fields):
```python
    sid: str = ""
    clean: CleanSession | None = None
```
Change `get_session_state` to stamp the id:
```python
def get_session_state(session_id: str) -> SessionState:
    with _SESSIONS_LOCK:
        s = _SESSIONS.get(session_id)
        if s is None:
            s = SessionState(sid=session_id)
            _SESSIONS[session_id] = s
        return s
```

- [ ] **Step 3: Create `backend/app/deps.py`**

```python
"""Shared FastAPI dependencies."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request, Response

from .state import SessionState, get_session_state

SESSION_COOKIE = "sql_session_id"


def session_dep(request: Request, response: Response) -> SessionState:
    """Return the SessionState for this browser, setting a session cookie if absent."""
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        sid = str(uuid.uuid4())
        response.set_cookie(
            SESSION_COOKIE,
            sid,
            max_age=60 * 60 * 24 * 30,
            samesite="lax",
            httponly=False,
            path="/",
        )
    return get_session_state(sid)


SessionDep = Annotated[SessionState, Depends(session_dep)]
```

- [ ] **Step 4: Modify `backend/app/main.py`** — use the shared dep

Remove the local `SESSION_COOKIE` constant, the `_session_dep` function, and the `SessionDep = Annotated[...]` line (lines ~49-70). Add to the imports near the other `from .` imports:
```python
from .deps import SessionDep
from .clean.routes import router as clean_router
```
After `app.add_middleware(...)` block, add:
```python
app.include_router(clean_router)
```
(`clean_router` is created in Task 7; this import will fail until then — that's fine because Task 7 lands before any server run. If executing strictly in order, comment the two clean-router lines and uncomment in Task 7. Prefer: do Task 7 before running the server.)

- [ ] **Step 5: Verify import graph (no server yet)**

Run: `cd backend && uv run python -c "import app.state; import app.deps; print('ok')"`
Expected: `ok` (this validates the `state` ↔ `clean.state` import wiring; `app.main` is validated in Task 7).

- [ ] **Step 6: Commit**

```bash
git add backend/app/deps.py backend/app/state.py backend/app/clean/__init__.py backend/app/clean/state.py backend/app/main.py
git commit -m "refactor(clean): shared SessionDep + session clean slot"
```

---

## Phase 2 — Ingestion

### Task 2: Identifier sanitization + type guessing (pure, TDD)

**Files:**
- Create: `backend/app/clean/ingest.py`
- Test: `backend/tests/test_ingest_pure.py`

- [ ] **Step 1: Write failing tests** — `backend/tests/test_ingest_pure.py`

```python
from app.clean.ingest import sanitize_idents, guess_type


def test_sanitize_basic():
    assert sanitize_idents(["Full Name", "E-mail!"]) == ["full_name", "e_mail"]


def test_sanitize_dedupes_collisions():
    assert sanitize_idents(["Name", "name", "NAME"]) == ["name", "name_1", "name_2"]


def test_sanitize_empty_and_leading_digit():
    out = sanitize_idents(["", "1st", "  "])
    assert out[0].startswith("col")
    assert out[1][0].isalpha()
    assert len(set(out)) == 3


def test_guess_type():
    assert guess_type(["1", "2", "30"]) == "integer"
    assert guess_type(["1.5", "2", "3.0"]) == "numeric"
    assert guess_type(["2024-01-02", "2023-12-31"]) == "date"
    assert guess_type(["true", "FALSE", "true"]) == "boolean"
    assert guess_type(["alice", "bob"]) == "text"
    assert guess_type([]) == "text"
```

- [ ] **Step 2: Run, expect failure**

Run: `cd backend && uv run pytest tests/test_ingest_pure.py -q`
Expected: ImportError / failures.

- [ ] **Step 3: Implement the pure helpers in `backend/app/clean/ingest.py`**

```python
"""CSV ingestion: parse, sanitize identifiers, guess types, load, profile."""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from typing import Any

from sqlalchemy import text

from ..db import engine

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000
MAX_COLS = 60

_NON_IDENT = re.compile(r"[^a-z0-9_]+")
_INT_RE = re.compile(r"^-?\d+$")
_NUM_RE = re.compile(r"^-?\d+(\.\d+)?$")
_DATE_FMTS = ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y")
_BOOLS = {"true", "false", "t", "f", "yes", "no", "0", "1"}


def _one_ident(name: str) -> str:
    base = _NON_IDENT.sub("_", name.strip().lower()).strip("_")
    if not base:
        return "col"
    if not base[0].isalpha():
        base = "c_" + base
    return base[:60]


def sanitize_idents(names: list[str]) -> list[str]:
    """Map header names to unique, safe lowercase SQL identifiers (order preserved)."""
    used: set[str] = set()
    out: list[str] = []
    for n in names:
        cand = _one_ident(n)
        final = cand
        i = 1
        while final in used:
            final = f"{cand}_{i}"
            i += 1
        used.add(final)
        out.append(final)
    return out


def _looks_date(v: str) -> bool:
    for fmt in _DATE_FMTS:
        try:
            datetime.strptime(v, fmt)
            return True
        except ValueError:
            continue
    return False


def guess_type(values: list[str]) -> str:
    """Display-only type hint from non-empty sample values. Never enforced."""
    vals = [v.strip() for v in values if v is not None and v.strip() != ""]
    if not vals:
        return "text"
    if all(_INT_RE.match(v) for v in vals):
        return "integer"
    if all(_NUM_RE.match(v) for v in vals):
        return "numeric"
    if all(_looks_date(v) for v in vals):
        return "date"
    if all(v.lower() in _BOOLS for v in vals):
        return "boolean"
    return "text"
```

- [ ] **Step 4: Run, expect pass**

Run: `cd backend && uv run pytest tests/test_ingest_pure.py -q`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/clean/ingest.py backend/tests/test_ingest_pure.py
git commit -m "feat(clean): identifier sanitization + type guessing"
```

### Task 3: CSV parsing + caps (pure, TDD)

**Files:**
- Modify: `backend/app/clean/ingest.py`
- Test: `backend/tests/test_ingest_parse.py`

- [ ] **Step 1: Write failing tests** — `backend/tests/test_ingest_parse.py`

```python
import pytest

from app.clean.ingest import parse_csv


def test_parse_basic():
    raw = b"Name,Age\nAlice,30\nBob,\n"
    header, rows = parse_csv(raw)
    assert header == ["Name", "Age"]
    assert rows == [["Alice", "30"], ["Bob", None]]  # empty -> None


def test_parse_strips_bom():
    raw = "﻿A,B\n1,2\n".encode("utf-8")
    header, _ = parse_csv(raw)
    assert header == ["A", "B"]


def test_parse_rejects_empty():
    with pytest.raises(ValueError):
        parse_csv(b"")


def test_parse_rejects_too_many_cols():
    header = ",".join(f"c{i}" for i in range(61))
    with pytest.raises(ValueError):
        parse_csv((header + "\n1\n").encode())


def test_parse_caps_rows():
    body = "A\n" + "\n".join(str(i) for i in range(6000)) + "\n"
    _, rows = parse_csv(body.encode())
    assert len(rows) == 5000
```

- [ ] **Step 2: Run, expect failure**

Run: `cd backend && uv run pytest tests/test_ingest_parse.py -q`
Expected: ImportError.

- [ ] **Step 3: Implement `parse_csv` (append to `ingest.py`)**

```python
def parse_csv(raw: bytes) -> tuple[list[str], list[list[Any]]]:
    """Parse CSV bytes -> (header, rows). Empty cells become None. Enforces caps."""
    if len(raw) > MAX_BYTES:
        raise ValueError(f"File too large (max {MAX_BYTES // (1024 * 1024)} MB).")
    decoded = raw.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(decoded))
    all_rows = [r for r in reader if any(c.strip() for c in r)]
    if not all_rows:
        raise ValueError("The file has no rows.")
    header = [h.strip() for h in all_rows[0]]
    if len(header) == 0:
        raise ValueError("The file has no header row.")
    if len(header) > MAX_COLS:
        raise ValueError(f"Too many columns (max {MAX_COLS}).")
    width = len(header)
    data: list[list[Any]] = []
    for raw_row in all_rows[1 : MAX_ROWS + 1]:
        row = list(raw_row[:width]) + [""] * (width - len(raw_row))
        data.append([(c if c.strip() != "" else None) for c in row])
    return header, data
```

- [ ] **Step 4: Run, expect pass**

Run: `cd backend && uv run pytest tests/test_ingest_parse.py -q`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/clean/ingest.py backend/tests/test_ingest_parse.py
git commit -m "feat(clean): CSV parsing with size/row/col caps"
```

### Task 4: Load + profile + suggest rules (DB-backed)

**Files:**
- Modify: `backend/app/clean/ingest.py`
- Test: `backend/tests/test_ingest_db.py`

- [ ] **Step 1: Implement load/profile/suggest (append to `ingest.py`)**

```python
def _quote(ident: str) -> str:
    # idents come only from sanitize_idents (regex-restricted), so this is safe.
    return '"' + ident + '"'


async def load_dataset(table_fqn: str, idents: list[str], rows: list[list[Any]]) -> None:
    """(Re)create `table_fqn` in the clean schema with all-TEXT columns and insert rows."""
    cols_ddl = ", ".join(f"{_quote(i)} TEXT" for i in idents)
    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE SCHEMA IF NOT EXISTS clean")
        await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table_fqn}")
        await conn.exec_driver_sql(f"CREATE TABLE {table_fqn} ({cols_ddl})")
        if not rows:
            return
        placeholders = ", ".join(f":c{i}" for i in range(len(idents)))
        col_list = ", ".join(_quote(i) for i in idents)
        insert = text(f"INSERT INTO {table_fqn} ({col_list}) VALUES ({placeholders})")
        batch: list[dict[str, Any]] = []
        for row in rows:
            batch.append({f"c{i}": row[i] for i in range(len(idents))})
            if len(batch) >= 500:
                await conn.execute(insert, batch)
                batch = []
        if batch:
            await conn.execute(insert, batch)


async def profile_relation(relation: str, idents: list[str]) -> dict[str, Any]:
    """Return {row_count, distinct_row_count, columns:[{ident,non_null,nulls,distinct}]}."""
    select_parts = ["COUNT(*) AS n"]
    for idx, i in enumerate(idents):
        select_parts.append(f"COUNT({_quote(i)}) AS nn{idx}")
        select_parts.append(f"COUNT(DISTINCT {_quote(i)}) AS d{idx}")
    agg_sql = "SELECT " + ", ".join(select_parts) + f" FROM {relation}"
    async with engine.connect() as conn:
        agg = (await conn.execute(text(agg_sql))).mappings().first()
        distinct_rows = (
            await conn.execute(
                text(f"SELECT COUNT(*) AS c FROM (SELECT DISTINCT * FROM {relation}) s")
            )
        ).scalar_one()
    n = int(agg["n"])
    cols = []
    for idx, i in enumerate(idents):
        non_null = int(agg[f"nn{idx}"])
        cols.append(
            {
                "ident": i,
                "non_null": non_null,
                "nulls": n - non_null,
                "distinct": int(agg[f"d{idx}"]),
            }
        )
    return {"row_count": n, "distinct_row_count": int(distinct_rows), "columns": cols}


_EMAIL_HINT = re.compile(r".+@.+\..+")


def suggest_rules(profile: dict[str, Any], samples: dict[str, list[str]]) -> list[dict[str, Any]]:
    """Heuristic starter rules from the raw profile + per-column sample values."""
    n = profile["row_count"]
    out: list[dict[str, Any]] = []
    rid = 0
    for col in profile["columns"]:
        ident = col["ident"]
        if n > 0 and col["nulls"] == 0 and col["distinct"] == n:
            out.append({"id": f"r{rid}", "type": "unique", "label": f"{ident} is unique",
                        "params": {"column": ident}, "enabled": True}); rid += 1
            out.append({"id": f"r{rid}", "type": "not_null", "label": f"{ident} has no nulls",
                        "params": {"column": ident}, "enabled": True}); rid += 1
        col_samples = [s for s in samples.get(ident, []) if s]
        if col_samples and all(_EMAIL_HINT.match(s) for s in col_samples):
            out.append({"id": f"r{rid}", "type": "regex",
                        "label": f"{ident} looks like an email",
                        "params": {"column": ident, "pattern": r"^[^@\s]+@[^@\s]+\.[^@\s]+$"},
                        "enabled": True}); rid += 1
    if profile["distinct_row_count"] < n:
        out.append({"id": f"r{rid}", "type": "no_duplicate_rows", "label": "No duplicate rows",
                    "params": {}, "enabled": True}); rid += 1
    return out
```

- [ ] **Step 2: Write DB test** — `backend/tests/test_ingest_db.py`

```python
import pytest

from app.clean import ingest


@pytest.mark.asyncio
async def test_load_and_profile(db_conn):
    table = 'clean."dataset_test01"'
    idents = ["id", "city"]
    rows = [["1", "Paris"], ["2", "paris"], ["3", None], ["1", "Paris"]]
    await ingest.load_dataset(table, idents, rows)
    try:
        prof = await ingest.profile_relation(table, idents)
        assert prof["row_count"] == 4
        assert prof["distinct_row_count"] == 3  # row ["1","Paris"] duplicated
        id_col = next(c for c in prof["columns"] if c["ident"] == "id")
        city_col = next(c for c in prof["columns"] if c["ident"] == "city")
        assert id_col["nulls"] == 0
        assert city_col["nulls"] == 1
        assert city_col["distinct"] == 2  # "Paris","paris"
    finally:
        from app.db import engine
        async with engine.begin() as conn:
            await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table}")
```

- [ ] **Step 3: Run (skips if no DB)**

Run: `cd backend && uv run pytest tests/test_ingest_db.py -q`
Expected: 1 passed (or skipped if Postgres down — bring it up with `docker compose up -d` from repo root and re-run).

- [ ] **Step 4: Commit**

```bash
git add backend/app/clean/ingest.py backend/tests/test_ingest_db.py
git commit -m "feat(clean): load to clean schema + profiling + rule suggestions"
```

---

## Phase 3 — Validation rules

### Task 5: Rule → violation-query builder (pure, TDD)

**Files:**
- Create: `backend/app/clean/rules.py`
- Test: `backend/tests/test_rules.py`

- [ ] **Step 1: Write failing tests** — `backend/tests/test_rules.py`

```python
import pytest

from app.clean.rules import build_violation_query, RuleError

IDENTS = {"id", "email", "country", "age"}


def test_not_null():
    sql, params = build_violation_query(
        {"type": "not_null", "params": {"column": "id"}}, IDENTS)
    assert "IS NULL" in sql and '"id"' in sql and params == {}


def test_regex_binds_pattern():
    sql, params = build_violation_query(
        {"type": "regex", "params": {"column": "email", "pattern": "x"}}, IDENTS)
    assert "!~" in sql and params == {"pattern": "x"}


def test_allowed_values_binds_list():
    sql, params = build_violation_query(
        {"type": "allowed_values", "params": {"column": "country", "values": ["US", "CA"]}},
        IDENTS)
    assert params == {"vals": ["US", "CA"]}


def test_no_duplicate_rows():
    sql, params = build_violation_query({"type": "no_duplicate_rows", "params": {}}, IDENTS)
    assert "DISTINCT" in sql and params == {}


def test_unknown_column_rejected():
    with pytest.raises(RuleError):
        build_violation_query({"type": "not_null", "params": {"column": "nope"}}, IDENTS)


def test_unknown_type_rejected():
    with pytest.raises(RuleError):
        build_violation_query({"type": "bogus", "params": {}}, IDENTS)
```

- [ ] **Step 2: Run, expect failure**

Run: `cd backend && uv run pytest tests/test_rules.py -q`
Expected: ImportError.

- [ ] **Step 3: Implement `backend/app/clean/rules.py`**

```python
"""Validation rule vocabulary -> violation-count SQL against the `prev` relation."""
from __future__ import annotations

from typing import Any


class RuleError(ValueError):
    """Raised when a rule references an unknown column or is malformed."""


def _col(params: dict[str, Any], idents: set[str], key: str = "column") -> str:
    name = params.get(key)
    if name not in idents:
        raise RuleError(f"Unknown column: {name!r}")
    return '"' + name + '"'


def build_violation_query(rule: dict[str, Any], idents: set[str]) -> tuple[str, dict[str, Any]]:
    """Return (sql, params). The query selects a single integer `v` = violation count,
    evaluated against the relation named `prev`."""
    rtype = rule.get("type")
    params = rule.get("params") or {}

    if rtype == "not_null":
        c = _col(params, idents)
        return (f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NULL", {})

    if rtype == "unique":
        c = _col(params, idents)
        return (
            f"SELECT COALESCE(SUM(cnt - 1), 0) AS v FROM "
            f"(SELECT COUNT(*) cnt FROM prev WHERE {c} IS NOT NULL "
            f"GROUP BY {c} HAVING COUNT(*) > 1) g",
            {},
        )

    if rtype == "unique_combo":
        cols = params.get("columns") or []
        if not cols:
            raise RuleError("unique_combo needs columns")
        quoted = ", ".join(_col({"column": c}, idents) for c in cols)
        return (
            f"SELECT COALESCE(SUM(cnt - 1), 0) AS v FROM "
            f"(SELECT COUNT(*) cnt FROM prev GROUP BY {quoted} HAVING COUNT(*) > 1) g",
            {},
        )

    if rtype == "no_duplicate_rows":
        return (
            "SELECT (SELECT COUNT(*) FROM prev) - "
            "(SELECT COUNT(*) FROM (SELECT DISTINCT * FROM prev) d) AS v",
            {},
        )

    if rtype == "regex":
        c = _col(params, idents)
        pattern = params.get("pattern")
        if not isinstance(pattern, str) or not pattern:
            raise RuleError("regex needs a pattern")
        return (
            f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NOT NULL AND {c} !~ :pattern",
            {"pattern": pattern},
        )

    if rtype == "allowed_values":
        c = _col(params, idents)
        values = params.get("values")
        if not isinstance(values, list) or not values:
            raise RuleError("allowed_values needs a non-empty list")
        return (
            f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NOT NULL AND NOT ({c} = ANY(:vals))",
            {"vals": [str(v) for v in values]},
        )

    if rtype == "range":
        c = _col(params, idents)
        try:
            mn = float(params["min"])
            mx = float(params["max"])
        except (KeyError, TypeError, ValueError) as e:
            raise RuleError("range needs numeric min and max") from e
        return (
            f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NOT NULL "
            f"AND {c}::numeric NOT BETWEEN :mn AND :mx",
            {"mn": mn, "mx": mx},
        )

    raise RuleError(f"Unknown rule type: {rtype!r}")
```

- [ ] **Step 4: Run, expect pass**

Run: `cd backend && uv run pytest tests/test_rules.py -q`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/clean/rules.py backend/tests/test_rules.py
git commit -m "feat(clean): validation rule vocabulary + safe SQL builder"
```

---

## Phase 4 — Pipeline execution

### Task 6: Pipeline composition + profiling + validation (DB-backed, TDD)

**Files:**
- Create: `backend/app/clean/pipeline.py`
- Test: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Implement `backend/app/clean/pipeline.py`**

```python
"""Re-run-from-raw staged pipeline: materialize each step, profile each stage, validate."""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy import text

from ..db import engine
from ..grader import _format_db_error, _json_safe
from .ingest import _quote
from .rules import RuleError, build_violation_query

_READONLY = re.compile(r"^\s*(WITH|SELECT)\b", re.IGNORECASE)
_WRITE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|MERGE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY|VACUUM)\b",
    re.IGNORECASE,
)

PREVIEW_CAP = 100
MAX_STEPS = 20


def validate_fragment(sql: str) -> str | None:
    """Return an error message if the step SQL isn't a single read-only SELECT/WITH."""
    s = (sql or "").strip().rstrip(";")
    if not s:
        return "Step is empty."
    if not _READONLY.search(s):
        return "Each step must be a SELECT or WITH query that reads `prev`."
    if _WRITE.search(s):
        return "Steps can only read data (SELECT/WITH) — no INSERT/UPDATE/DDL."
    if ";" in s:
        return "One statement per step (no semicolons)."
    return None


async def _columns(conn, relation: str) -> list[str]:
    res = await conn.execute(text(f"SELECT * FROM {relation} LIMIT 0"))
    return list(res.keys())


async def _profile(conn, relation: str, index: int, label: str) -> dict[str, Any]:
    idents = await _columns(conn, relation)
    parts = ["COUNT(*) AS n"]
    for idx, i in enumerate(idents):
        parts.append(f"COUNT({_quote(i)}) AS nn{idx}")
        parts.append(f"COUNT(DISTINCT {_quote(i)}) AS d{idx}")
    agg = (await conn.execute(text("SELECT " + ", ".join(parts) + f" FROM {relation}"))).mappings().first()
    distinct_rows = (
        await conn.execute(text(f"SELECT COUNT(*) c FROM (SELECT DISTINCT * FROM {relation}) s"))
    ).scalar_one()
    n = int(agg["n"])
    cols = [
        {
            "ident": i,
            "non_null": int(agg[f"nn{idx}"]),
            "nulls": n - int(agg[f"nn{idx}"]),
            "distinct": int(agg[f"d{idx}"]),
        }
        for idx, i in enumerate(idents)
    ]
    return {
        "index": index,
        "label": label,
        "row_count": n,
        "distinct_row_count": int(distinct_rows),
        "columns": cols,
    }


async def run_pipeline(
    table_fqn: str,
    steps: list[dict[str, Any]],
    rules: list[dict[str, Any]],
    up_to_index: int | None = None,
) -> dict[str, Any]:
    """Execute steps[0:limit] from raw, profiling each stage; validate the final stage."""
    limit = len(steps) if up_to_index is None else max(0, min(up_to_index, len(steps)))
    if len(steps) > MAX_STEPS:
        return {
            "ok": False, "failed_step_index": MAX_STEPS,
            "error_message": f"Too many steps (max {MAX_STEPS}).",
            "final_preview": None, "stages": [], "validation": [],
        }

    stages: list[dict[str, Any]] = []
    failed: int | None = None
    error: str | None = None
    final_preview: dict[str, Any] | None = None
    validation: list[dict[str, Any]] = []

    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            await conn.execute(text("SET LOCAL statement_timeout = '5s'"))
            await conn.exec_driver_sql(f"CREATE TEMP VIEW raw AS SELECT * FROM {table_fqn}")
            await conn.exec_driver_sql("CREATE TEMP VIEW prev AS SELECT * FROM raw")
            stages.append(await _profile(conn, "prev", 0, "Raw"))

            for i in range(limit):
                frag = (steps[i].get("sql") or "").strip().rstrip(";")
                err = validate_fragment(frag)
                if err:
                    failed, error = i, err
                    break
                title = steps[i].get("title") or f"Step {i + 1}"
                try:
                    await conn.exec_driver_sql(f'CREATE TEMP TABLE "_stage_{i + 1}" AS {frag}')
                    await conn.exec_driver_sql("DROP VIEW prev")
                    await conn.exec_driver_sql(
                        f'CREATE TEMP VIEW prev AS SELECT * FROM "_stage_{i + 1}"'
                    )
                    stages.append(await _profile(conn, "prev", i + 1, title))
                except Exception as e:  # noqa: BLE001 - surface DB message to user
                    failed, error = i, _format_db_error(e)
                    break

            if failed is None:
                res = await conn.execute(text(f"SELECT * FROM prev LIMIT {PREVIEW_CAP}"))
                cols = list(res.keys())
                rows = [[_json_safe(v) for v in r] for r in res.fetchall()]
                final_preview = {"columns": cols, "rows": rows}
                ident_set = set(cols)
                for rule in rules:
                    if not rule.get("enabled", True):
                        continue
                    rid = rule.get("id", "")
                    label = rule.get("label", rule.get("type", "rule"))
                    try:
                        vsql, vparams = build_violation_query(rule, ident_set)
                        v = int((await conn.execute(text(vsql), vparams)).scalar_one())
                        validation.append({
                            "id": rid, "label": label,
                            "status": "pass" if v == 0 else "fail",
                            "violations": v, "message": None,
                        })
                    except RuleError as e:
                        validation.append({"id": rid, "label": label, "status": "error",
                                           "violations": 0, "message": str(e)})
                    except Exception as e:  # noqa: BLE001
                        validation.append({"id": rid, "label": label, "status": "error",
                                           "violations": 0, "message": _format_db_error(e)})
        finally:
            await trans.rollback()

    return {
        "ok": failed is None,
        "failed_step_index": failed,
        "error_message": error,
        "final_preview": final_preview,
        "stages": stages,
        "validation": validation,
    }
```

Note: validation runs in the same transaction after the final stage, so each rule query may abort the transaction on a DB error (e.g. a `range` cast failure), which would make subsequent rule queries fail too. To keep rules independent, wrap each rule in a SAVEPOINT. Replace the rule loop body with savepoint-protected execution:

```python
                for rule in rules:
                    if not rule.get("enabled", True):
                        continue
                    rid = rule.get("id", "")
                    label = rule.get("label", rule.get("type", "rule"))
                    try:
                        vsql, vparams = build_violation_query(rule, ident_set)
                    except RuleError as e:
                        validation.append({"id": rid, "label": label, "status": "error",
                                           "violations": 0, "message": str(e)})
                        continue
                    sp = await conn.begin_nested()
                    try:
                        v = int((await conn.execute(text(vsql), vparams)).scalar_one())
                        await sp.commit()
                        validation.append({"id": rid, "label": label,
                                           "status": "pass" if v == 0 else "fail",
                                           "violations": v, "message": None})
                    except Exception as e:  # noqa: BLE001
                        await sp.rollback()
                        validation.append({"id": rid, "label": label, "status": "error",
                                           "violations": 0, "message": _format_db_error(e)})
```

Use the savepoint version (delete the simpler loop above when implementing).

- [ ] **Step 2: Write DB tests** — `backend/tests/test_pipeline.py`

```python
import pytest

from app.clean import ingest, pipeline
from app.db import engine

TABLE = 'clean."dataset_pl01"'


def test_validate_fragment_guards():
    assert pipeline.validate_fragment("SELECT * FROM prev") is None
    assert pipeline.validate_fragment("WITH x AS (SELECT 1) SELECT * FROM x") is None
    assert pipeline.validate_fragment("DROP TABLE prev") is not None
    assert pipeline.validate_fragment("UPDATE prev SET a=1") is not None
    assert pipeline.validate_fragment("SELECT 1; SELECT 2") is not None
    assert pipeline.validate_fragment("") is not None


@pytest.fixture
async def loaded():
    idents = ["name", "amount"]
    rows = [["  Alice ", "$10"], ["BOB", "20"], ["Alice", "$10"], [None, "x"]]
    await ingest.load_dataset(TABLE, idents, rows)
    yield idents
    async with engine.begin() as conn:
        await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {TABLE}")


@pytest.mark.asyncio
async def test_pipeline_chains_prev(loaded):
    steps = [
        {"title": "trim+lower", "sql": "SELECT LOWER(TRIM(name)) AS name, amount FROM prev"},
        {"title": "dedupe", "sql": "SELECT DISTINCT name, amount FROM prev WHERE name IS NOT NULL"},
    ]
    out = await pipeline.run_pipeline(TABLE, steps, rules=[])
    assert out["ok"] is True
    assert len(out["stages"]) == 3  # raw + 2 steps
    assert out["stages"][0]["row_count"] == 4
    # after trim/lower: "alice","bob","alice",null ; dedupe non-null -> alice/$10, bob/20
    assert out["stages"][2]["row_count"] == 2
    assert {c for c in out["final_preview"]["columns"]} == {"name", "amount"}


@pytest.mark.asyncio
async def test_pipeline_reports_bad_step(loaded):
    steps = [{"title": "boom", "sql": "SELECT nonexistent_col FROM prev"}]
    out = await pipeline.run_pipeline(TABLE, steps, rules=[])
    assert out["ok"] is False
    assert out["failed_step_index"] == 0
    assert out["error_message"]


@pytest.mark.asyncio
async def test_pipeline_runs_rules(loaded):
    steps = [{"title": "clean", "sql": "SELECT LOWER(TRIM(name)) AS name FROM prev WHERE name IS NOT NULL"}]
    rules = [
        {"id": "r0", "type": "not_null", "label": "name not null", "params": {"column": "name"}, "enabled": True},
        {"id": "r1", "type": "no_duplicate_rows", "label": "no dup rows", "params": {}, "enabled": True},
    ]
    out = await pipeline.run_pipeline(TABLE, steps, rules=rules)
    by_id = {r["id"]: r for r in out["validation"]}
    assert by_id["r0"]["status"] == "pass"
    assert by_id["r1"]["status"] == "fail"  # alice appears twice after cleaning
```

- [ ] **Step 3: Run (needs DB up)**

Run: `cd backend && uv run pytest tests/test_pipeline.py -q`
Expected: 4 passed (start Postgres with `docker compose up -d` if skipped).

- [ ] **Step 4: Commit**

```bash
git add backend/app/clean/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat(clean): staged pipeline execution + per-stage profiling + validation"
```

---

## Phase 5 — Generated messy dataset

### Task 7a: Deterministic generator (TDD)

**Files:**
- Create: `backend/app/clean/generate.py`
- Test: `backend/tests/test_generate.py`

- [ ] **Step 1: Implement `backend/app/clean/generate.py`**

```python
"""Deterministic messy-dataset generator with a known issue rubric."""
from __future__ import annotations

import random
from typing import Any

HEADER = ["customer_id", "full_name", "email", "country", "signup_date", "spend", "status"]

_NAMES = ["Alice Smith", "Bob Jones", "Carla Diaz", "Dan Lee", "Eve Ng", "Frank Ito",
          "Grace Kim", "Hiro Tan", "Ivy Park", "Jack Roy"]
_COUNTRIES = ["USA", "U.S.A.", "united states", "Canada", "canada", "CA", "UK", "uk"]
_STATUSES = ["active", "ACTIVE", "Active", "inactive", "Inactive", "pending"]
_SENTINELS = [None, "", "N/A", "-", "unknown"]


def _messy_date(rng: random.Random, y: int, m: int, d: int) -> str:
    fmt = rng.choice(["{y}-{m:02d}-{d:02d}", "{m:02d}/{d:02d}/{y}", "{y}/{m}/{d}"])
    return fmt.format(y=y, m=m, d=d)


def _messy_money(rng: random.Random, amount: float) -> str:
    style = rng.choice(["${a:.2f}", "{a:.2f}", "{ai:,}", "$ {a:.0f}"])
    return style.format(a=amount, ai=int(amount))


def generate_messy(seed: int, n: int = 200) -> tuple[list[str], list[list[Any]], list[dict[str, Any]]]:
    """Return (header, rows, rubric). All cells are strings/None (CSV-like)."""
    rng = random.Random(seed)
    rows: list[list[Any]] = []
    for i in range(n):
        name = rng.choice(_NAMES)
        if rng.random() < 0.3:  # whitespace + casing noise
            name = "  " + name.upper() + " " if rng.random() < 0.5 else name.lower()
        local = name.strip().lower().replace(" ", ".")
        email = f"{local}@example.com" if rng.random() < 0.85 else rng.choice(["bad-email", "x@", local])
        country = rng.choice(_COUNTRIES)
        date = _messy_date(rng, rng.randint(2021, 2024), rng.randint(1, 12), rng.randint(1, 28))
        spend = _messy_money(rng, rng.uniform(-20, 5000))
        status = rng.choice(_STATUSES)
        if rng.random() < 0.12:  # inject sentinels/nulls
            col = rng.randint(2, 6)
            row = [str(i + 1), name, email, country, date, spend, status]
            row[col] = rng.choice(_SENTINELS)
            rows.append(row)
        else:
            rows.append([str(i + 1), name, email, country, date, spend, status])
    # duplicate ~8% of rows
    dupes = max(1, n // 12)
    for _ in range(dupes):
        rows.append(list(rng.choice(rows)))
    rng.shuffle(rows)

    rubric = [
        {"issue": "whitespace_casing", "column": "full_name",
         "description": "names have stray whitespace and inconsistent casing"},
        {"issue": "invalid_format", "column": "email",
         "description": "some emails are malformed"},
        {"issue": "inconsistent_categories", "column": "country",
         "description": "country labels vary (USA / U.S.A. / united states / CA)"},
        {"issue": "mixed_date_formats", "column": "signup_date",
         "description": "dates appear in several formats stored as text"},
        {"issue": "money_as_text", "column": "spend",
         "description": "spend has $, commas, and negatives; stored as text"},
        {"issue": "inconsistent_categories", "column": "status",
         "description": "status casing is inconsistent"},
        {"issue": "nulls_sentinels", "column": "*",
         "description": "missing values appear as NULL, '', 'N/A', '-', 'unknown'"},
        {"issue": "duplicate_rows", "column": "*",
         "description": "some rows are exact duplicates"},
    ]
    return HEADER, rows, rubric
```

- [ ] **Step 2: Write tests** — `backend/tests/test_generate.py`

```python
from app.clean.generate import generate_messy


def test_generate_deterministic():
    h1, r1, rub1 = generate_messy(42)
    h2, r2, _ = generate_messy(42)
    assert h1 == h2
    assert r1 == r2  # same seed -> identical
    assert len(r1) > 200  # base rows + duplicates


def test_generate_varies_by_seed():
    _, r1, _ = generate_messy(1)
    _, r2, _ = generate_messy(2)
    assert r1 != r2


def test_rubric_shape():
    _, _, rubric = generate_messy(7)
    assert all({"issue", "column", "description"} <= set(item) for item in rubric)
```

- [ ] **Step 3: Run, expect pass**

Run: `cd backend && uv run pytest tests/test_generate.py -q`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/app/clean/generate.py backend/tests/test_generate.py
git commit -m "feat(clean): deterministic messy-dataset generator + rubric"
```

---

## Phase 6 — Schemas, LLM review, routes, wiring

### Task 7: Pydantic schemas + LLM review + routes + main wiring

**Files:**
- Create: `backend/app/clean/schemas.py`
- Modify: `backend/app/llm.py` (append)
- Create: `backend/app/clean/routes.py`
- Modify: `backend/app/main.py` (router include — already added in Task 1 Step 4)

- [ ] **Step 1: Create `backend/app/clean/schemas.py`**

```python
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from ..schemas import TableResult


class ColumnMeta(BaseModel):
    name: str
    ident: str
    guessed_type: str


class ColumnProfile(BaseModel):
    ident: str
    non_null: int
    nulls: int
    distinct: int


class StageProfile(BaseModel):
    index: int
    label: str
    row_count: int
    distinct_row_count: int
    columns: list[ColumnProfile]


class RuleModel(BaseModel):
    id: str
    type: str
    label: str
    params: dict[str, Any] = {}
    enabled: bool = True


class RuleResult(BaseModel):
    id: str
    label: str
    status: Literal["pass", "fail", "error"]
    violations: int
    message: str | None = None


class DatasetSummary(BaseModel):
    dataset_id: str
    source: Literal["upload", "generated"]
    row_count: int
    columns: list[ColumnMeta]
    raw_preview: TableResult
    profile: list[ColumnProfile]
    suggested_rules: list[RuleModel]


class StepModel(BaseModel):
    title: str = ""
    sql: str


class RunRequest(BaseModel):
    steps: list[StepModel] = []
    rules: list[RuleModel] = []
    up_to_index: int | None = None


class RunResponse(BaseModel):
    ok: bool
    failed_step_index: int | None = None
    error_message: str | None = None
    final_preview: TableResult | None = None
    stages: list[StageProfile] = []
    validation: list[RuleResult] = []


class GenerateRequest(BaseModel):
    seed: int | None = None


class ReviewRequest(BaseModel):
    steps: list[StepModel] = []
    rules: list[RuleModel] = []


class ReviewResponse(BaseModel):
    assessment: str
    remaining_issues: list[str] = []
    suggestions: list[str] = []
    praise: list[str] = []
    score: int
```

- [ ] **Step 2: Append `review_cleaning` to `backend/app/llm.py`**

```python
CLEAN_REVIEW_SYSTEM_PROMPT = """You review a data-cleaning pipeline written in SQL by a learner using PostgreSQL.
You are given: the raw data profile, the ordered cleaning steps (each a SELECT that transforms the previous step), the final-stage profile, the results of validation rules, and (sometimes) a rubric of the issues that were deliberately injected into the data.

Judge how well the pipeline cleaned the data. Be concrete and reference columns by name. If a rubric is present, check whether each injected issue was addressed.

Return ONLY a JSON object:
{
  "assessment": "2-4 sentence plain-English overall verdict",
  "remaining_issues": ["specific problems still present in the final data"],
  "suggestions": ["concrete next SQL moves, each one sentence"],
  "praise": ["specific things done well"],
  "score": 0-100
}
Keep each list to at most 5 items. score is an integer cleanliness rating of the FINAL data."""


async def review_cleaning(payload: dict[str, Any]) -> dict[str, Any]:
    client = _get_client()
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": CLEAN_REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    data.setdefault("assessment", "I couldn't generate a review. Please try again.")
    for k in ("remaining_issues", "suggestions", "praise"):
        if not isinstance(data.get(k), list):
            data[k] = []
    try:
        data["score"] = max(0, min(100, int(data.get("score", 0))))
    except (TypeError, ValueError):
        data["score"] = 0
    return data
```

- [ ] **Step 3: Create `backend/app/clean/routes.py`**

```python
"""/api/clean/* routes: upload, generate, dataset, run, review, reset."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from sqlalchemy import text

from .. import llm
from ..db import engine
from ..deps import SessionDep
from ..schemas import TableResult
from . import generate, ingest
from .pipeline import run_pipeline
from .schemas import (
    DatasetSummary,
    GenerateRequest,
    ReviewRequest,
    ReviewResponse,
    RunRequest,
    RunResponse,
)
from .state import CleanSession

router = APIRouter(prefix="/api/clean", tags=["clean"])


def _table_for(state) -> str:
    sid8 = (state.sid or "anon")[:8].replace("-", "") or "anon"
    return f'clean."dataset_{sid8}"'


async def _build_summary(state, source: str, header, idents, rows) -> DatasetSummary:
    table = _table_for(state)
    await ingest.load_dataset(table, idents, rows)
    profile = await ingest.profile_relation(table, idents)
    samples: dict[str, list[str]] = {ident: [] for ident in idents}
    for row in rows[:30]:
        for j, ident in enumerate(idents):
            if row[j]:
                samples[ident].append(row[j])
    columns = [
        {"name": header[j], "ident": idents[j],
         "guessed_type": ingest.guess_type([str(r[j]) for r in rows[:200] if r[j] is not None])}
        for j in range(len(idents))
    ]
    preview_rows = [[(r[j] if r[j] is not None else None) for j in range(len(idents))] for r in rows[:50]]
    suggested = ingest.suggest_rules(profile, samples)
    dataset_id = str(uuid.uuid4())
    summary = DatasetSummary(
        dataset_id=dataset_id,
        source=source,
        row_count=profile["row_count"],
        columns=columns,
        raw_preview=TableResult(columns=idents, rows=preview_rows),
        profile=profile["columns"],
        suggested_rules=suggested,
    )
    state.clean = CleanSession(
        dataset_id=dataset_id, source=source, table=table, idents=idents,
        row_count=profile["row_count"], summary=summary.model_dump(),
        rubric=None,
    )
    return summary


@router.post("/upload", response_model=DatasetSummary)
async def upload(state: SessionDep, file: UploadFile = File(...)) -> DatasetSummary:
    raw = await file.read()
    try:
        header, rows = ingest.parse_csv(raw)
        idents = ingest.sanitize_idents(header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return await _build_summary(state, "upload", header, idents, rows)


@router.post("/generate", response_model=DatasetSummary)
async def generate_dataset(req: GenerateRequest, state: SessionDep) -> DatasetSummary:
    seed = req.seed if req.seed is not None else uuid.uuid4().int % 1_000_000
    header, rows, rubric = generate.generate_messy(seed)
    idents = ingest.sanitize_idents(header)
    summary = await _build_summary(state, "generated", header, idents, rows)
    if state.clean is not None:
        state.clean.rubric = rubric
    return summary


@router.get("/dataset", response_model=DatasetSummary)
async def get_dataset(state: SessionDep) -> DatasetSummary:
    if state.clean is None:
        raise HTTPException(status_code=404, detail="No dataset loaded.")
    return DatasetSummary(**state.clean.summary)


@router.post("/run", response_model=RunResponse)
async def run(req: RunRequest, state: SessionDep) -> RunResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    out = await run_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
        up_to_index=req.up_to_index,
    )
    return RunResponse(**out)


@router.post("/review", response_model=ReviewResponse)
async def review(req: ReviewRequest, state: SessionDep) -> ReviewResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    run_out = await run_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
    )
    payload = {
        "raw_profile": run_out["stages"][0] if run_out["stages"] else None,
        "final_profile": run_out["stages"][-1] if run_out["stages"] else None,
        "steps": [s.model_dump() for s in req.steps],
        "validation": run_out["validation"],
        "pipeline_ok": run_out["ok"],
        "error_message": run_out["error_message"],
        "rubric": state.clean.rubric,
    }
    try:
        data = await llm.review_cleaning(payload)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return ReviewResponse(**data)


@router.post("/reset")
async def reset(state: SessionDep) -> dict[str, bool]:
    if state.clean is not None:
        async with engine.begin() as conn:
            await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {state.clean.table}")
        state.clean = None
    return {"ok": True}
```

- [ ] **Step 4: Confirm `main.py` includes the router** (added in Task 1 Step 4). Ensure these lines are present and uncommented:
```python
from .clean.routes import router as clean_router
...
app.include_router(clean_router)
```

- [ ] **Step 5: Import + app boot check**

Run: `cd backend && uv run python -c "from app.main import app; print([r.path for r in app.routes if '/clean' in r.path])"`
Expected: prints the six `/api/clean/*` paths.

- [ ] **Step 6: Full backend test run**

Run: `cd backend && uv run pytest -q && uv run ruff check app`
Expected: all tests pass (DB tests need Postgres up); ruff clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/clean/schemas.py backend/app/clean/routes.py backend/app/llm.py backend/app/main.py
git commit -m "feat(clean): schemas, LLM review, /api/clean routes + wiring"
```

### Task 8: Manual backend smoke test (curl)

**Files:** none (verification only)

- [ ] **Step 1: Ensure infra up**

Run from repo root (main checkout, where `.env` lives):
```bash
docker compose up -d
# copy env into the worktree so config picks up DB url + key when run from here
cp /Users/veda/Desktop/SQL/.env .env 2>/dev/null || true
cd backend && uv run uvicorn app.main:app --reload --port 8000 &
```
Wait ~2s, then `curl -s localhost:8000/api/health` → `{"ok":true}`.

- [ ] **Step 2: Generate + run a 2-step pipeline**

```bash
curl -s -c /tmp/cj.txt -X POST localhost:8000/api/clean/generate -H 'content-type: application/json' -d '{"seed":42}' | head -c 400
curl -s -b /tmp/cj.txt -X POST localhost:8000/api/clean/run -H 'content-type: application/json' \
  -d '{"steps":[{"title":"clean names","sql":"SELECT customer_id, LOWER(TRIM(full_name)) AS full_name, email, country, signup_date, spend, status FROM prev"},{"title":"dedupe","sql":"SELECT DISTINCT * FROM prev"}],"rules":[{"id":"r1","type":"no_duplicate_rows","label":"no dups","params":{},"enabled":true}]}' | head -c 600
```
Expected: generate returns a DatasetSummary JSON; run returns `"ok":true`, 3 stages, and a validation entry.

- [ ] **Step 3: Upload a CSV**

```bash
printf 'Name,Email\n Alice ,a@b.com\nBOB,bad\n' > /tmp/m.csv
curl -s -b /tmp/cj.txt -X POST localhost:8000/api/clean/upload -F 'file=@/tmp/m.csv' | head -c 400
```
Expected: DatasetSummary with `columns` `name`,`email` and a raw preview.

- [ ] **Step 4: Stop the server** (`kill %1` or Ctrl-C). No commit (verification only).

---

## Phase 7 — Frontend

### Task 9: Types + API client

**Files:**
- Create: `frontend/src/lib/clean-types.ts`
- Create: `frontend/src/lib/clean-api.ts`

- [ ] **Step 1: Create `frontend/src/lib/clean-types.ts`**

```typescript
import type { TableResult } from "./types";

export type ColumnMeta = { name: string; ident: string; guessed_type: string };
export type ColumnProfile = { ident: string; non_null: number; nulls: number; distinct: number };
export type StageProfile = {
  index: number;
  label: string;
  row_count: number;
  distinct_row_count: number;
  columns: ColumnProfile[];
};
export type RuleType =
  | "not_null" | "unique" | "unique_combo" | "no_duplicate_rows"
  | "regex" | "allowed_values" | "range";
export type Rule = {
  id: string;
  type: RuleType;
  label: string;
  params: Record<string, unknown>;
  enabled: boolean;
};
export type RuleResult = {
  id: string;
  label: string;
  status: "pass" | "fail" | "error";
  violations: number;
  message: string | null;
};
export type DatasetSummary = {
  dataset_id: string;
  source: "upload" | "generated";
  row_count: number;
  columns: ColumnMeta[];
  raw_preview: TableResult;
  profile: ColumnProfile[];
  suggested_rules: Rule[];
};
export type Step = { title: string; sql: string };
export type RunResponse = {
  ok: boolean;
  failed_step_index: number | null;
  error_message: string | null;
  final_preview: TableResult | null;
  stages: StageProfile[];
  validation: RuleResult[];
};
export type ReviewResponse = {
  assessment: string;
  remaining_issues: string[];
  suggestions: string[];
  praise: string[];
  score: number;
};
```

- [ ] **Step 2: Create `frontend/src/lib/clean-api.ts`**

```typescript
import type {
  DatasetSummary,
  ReviewResponse,
  Rule,
  RunResponse,
  Step,
} from "./clean-types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function json<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).detail; } catch { detail = await res.text(); }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const cleanApi = {
  upload: async (file: File): Promise<DatasetSummary> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE_URL}/api/clean/upload`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail; } catch { detail = await res.text(); }
      throw new Error(detail || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<DatasetSummary>;
  },
  generate: (seed?: number) => json<DatasetSummary>("/api/clean/generate", { seed: seed ?? null }),
  getDataset: async (): Promise<DatasetSummary | null> => {
    const res = await fetch(`${BASE_URL}/api/clean/dataset`, { credentials: "include" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return res.json() as Promise<DatasetSummary>;
  },
  run: (steps: Step[], rules: Rule[], upToIndex?: number) =>
    json<RunResponse>("/api/clean/run", { steps, rules, up_to_index: upToIndex ?? null }),
  review: (steps: Step[], rules: Rule[]) =>
    json<ReviewResponse>("/api/clean/review", { steps, rules }),
  reset: () => json<{ ok: boolean }>("/api/clean/reset", {}),
};
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/clean-types.ts frontend/src/lib/clean-api.ts
git commit -m "feat(clean): frontend types + API client"
```

### Task 10: Leaf components — step editor, dropzone, data view, review card

**Files:**
- Create: `frontend/src/components/clean/step-editor.tsx`
- Create: `frontend/src/components/clean/upload-dropzone.tsx`
- Create: `frontend/src/components/clean/data-view.tsx`
- Create: `frontend/src/components/clean/review-card.tsx`

- [ ] **Step 1: `step-editor.tsx`**

```tsx
"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  height?: number;
};

export function StepEditor({ value, onChange, onRun, height = 120 }: Props) {
  const { resolvedTheme } = useTheme();
  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Editor
        height={height}
        language="sql"
        theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={(editor, monaco) => {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
            onRunRef.current(),
          );
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          scrollbar: { vertical: "auto" },
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: `upload-dropzone.tsx`**

```tsx
"use client";

import * as React from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onFile: (f: File) => void;
  onGenerate: () => void;
  busy: boolean;
};

export function UploadDropzone({ onFile, onGenerate, busy }: Props) {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 transition-colors hover:border-primary/50",
          drag && "border-primary bg-primary/5",
        )}
      >
        <Upload className="h-7 w-7 text-muted-foreground" />
        <div className="text-sm font-medium">Drop a CSV here, or click to choose</div>
        <div className="text-xs text-muted-foreground">Up to 2 MB · 5,000 rows · 60 columns</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px w-8 bg-border" /> or <span className="h-px w-8 bg-border" />
      </div>
      <Button variant="outline" onClick={onGenerate} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate a sample messy dataset
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: `data-view.tsx`**

```tsx
"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table";
import type { TableResult } from "@/lib/types";

type Props = {
  raw: TableResult;
  cleaned: TableResult | null;
};

export function DataView({ raw, cleaned }: Props) {
  const [tab, setTab] = React.useState<"cleaned" | "raw">(cleaned ? "cleaned" : "raw");
  const active = tab === "cleaned" && cleaned ? cleaned : raw;
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5 self-start">
        {(["cleaned", "raw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={t === "cleaned" && !cleaned}
            className={
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40 " +
              (tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <DataTable columns={active.columns} rows={active.rows} maxRows={100} className="h-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `review-card.tsx`**

```tsx
"use client";

import { CheckCircle2, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import type { ReviewResponse } from "@/lib/clean-types";

export function ReviewCard({ review }: { review: ReviewResponse }) {
  const tone = review.score >= 80 ? "text-emerald-600" : review.score >= 50 ? "text-amber-600" : "text-destructive";
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI review
        </div>
        <div className={`text-2xl font-bold tabular-nums ${tone}`}>{review.score}<span className="text-sm text-muted-foreground">/100</span></div>
      </div>
      <p className="text-sm text-foreground/90">{review.assessment}</p>
      {review.praise.length > 0 && (
        <Section icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} title="Done well" items={review.praise} />
      )}
      {review.remaining_issues.length > 0 && (
        <Section icon={<TriangleAlert className="h-4 w-4 text-amber-600" />} title="Still to fix" items={review.remaining_issues} />
      )}
      {review.suggestions.length > 0 && (
        <Section icon={<Lightbulb className="h-4 w-4 text-primary" />} title="Suggestions" items={review.suggestions} />
      )}
    </div>
  );
}

function Section({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{title}</div>
      <ul className="ml-1 flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-foreground/85">• {it}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.
```bash
git add frontend/src/components/clean/step-editor.tsx frontend/src/components/clean/upload-dropzone.tsx frontend/src/components/clean/data-view.tsx frontend/src/components/clean/review-card.tsx
git commit -m "feat(clean): leaf components (editor, dropzone, data view, review)"
```

### Task 11: Audit log + validation panel

**Files:**
- Create: `frontend/src/components/clean/audit-log.tsx`
- Create: `frontend/src/components/clean/validation-panel.tsx`

- [ ] **Step 1: `audit-log.tsx`**

```tsx
"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import type { StageProfile } from "@/lib/clean-types";

function delta(before: number, after: number) {
  const d = after - before;
  if (d === 0) return <span className="text-muted-foreground">no change</span>;
  const up = d > 0;
  return (
    <span className={up ? "text-emerald-600" : "text-amber-600"}>
      {up ? <Plus className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
      {Math.abs(d)}
    </span>
  );
}

export function AuditLog({ stages }: { stages: StageProfile[] }) {
  if (stages.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Run the pipeline to see the audit trail.</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const prevCols = new Set(prev?.columns.map((c) => c.ident) ?? []);
        const curCols = new Set(stage.columns.map((c) => c.ident));
        const added = [...curCols].filter((c) => !prevCols.has(c));
        const removed = [...prevCols].filter((c) => !curCols.has(c));
        const nullsBefore = prev ? prev.columns.reduce((a, c) => a + c.nulls, 0) : 0;
        const nullsNow = stage.columns.reduce((a, c) => a + c.nulls, 0);
        const dupBefore = prev ? prev.row_count - prev.distinct_row_count : 0;
        const dupNow = stage.row_count - stage.distinct_row_count;
        return (
          <div key={stage.index} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px]">{stage.index}</span>
              {stage.label}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <Stat label="Rows" value={stage.row_count} extra={prev ? delta(prev.row_count, stage.row_count) : null} />
              <Stat label="Duplicates" value={dupNow} extra={prev ? delta(dupBefore, dupNow) : null} />
              <Stat label="Total nulls" value={nullsNow} extra={prev ? delta(nullsBefore, nullsNow) : null} />
              <Stat label="Columns" value={stage.columns.length} extra={null} />
            </dl>
            {(added.length > 0 || removed.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                {added.map((c) => (
                  <span key={`a${c}`} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">+{c}</span>
                ))}
                {removed.map((c) => (
                  <span key={`r${c}`} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400 line-through">{c}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: number; extra: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 font-medium tabular-nums">
        {value} {extra && <span className="text-[11px]">{extra}</span>}
      </dd>
    </div>
  );
}
```

- [ ] **Step 2: `validation-panel.tsx`**

```tsx
"use client";

import * as React from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColumnMeta, Rule, RuleResult, RuleType } from "@/lib/clean-types";

const RULE_LABELS: Record<RuleType, string> = {
  not_null: "No nulls",
  unique: "Unique values",
  unique_combo: "Unique combination",
  no_duplicate_rows: "No duplicate rows",
  regex: "Matches pattern",
  allowed_values: "Allowed values",
  range: "Numeric range",
};

type Props = {
  columns: ColumnMeta[];
  rules: Rule[];
  results: RuleResult[];
  onChange: (rules: Rule[]) => void;
};

export function ValidationPanel({ columns, rules, results, onChange }: Props) {
  const resultById = React.useMemo(
    () => Object.fromEntries(results.map((r) => [r.id, r])),
    [results],
  );
  const [adding, setAdding] = React.useState(false);

  function update(id: string, patch: Partial<Rule>) {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) { onChange(rules.filter((r) => r.id !== id)); }
  function add(type: RuleType, column: string) {
    const id = `u${Date.now()}`;
    const params: Record<string, unknown> = {};
    if (type !== "no_duplicate_rows") params.column = column;
    if (type === "regex") params.pattern = "^.+$";
    if (type === "range") { params.min = 0; params.max = 100; }
    const label =
      type === "no_duplicate_rows" ? RULE_LABELS[type] : `${column}: ${RULE_LABELS[type]}`;
    onChange([...rules, { id, type, label, params, enabled: true }]);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && (
        <div className="text-sm text-muted-foreground">No rules yet. Add one to validate the cleaned data.</div>
      )}
      {rules.map((rule) => {
        const res = resultById[rule.id];
        return (
          <div key={rule.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => update(rule.id, { enabled: e.target.checked })}
              className="h-3.5 w-3.5 accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{rule.label}</div>
              {res?.status === "error" && res.message && (
                <div className="truncate text-[11px] text-destructive">{res.message}</div>
              )}
            </div>
            {res && rule.enabled && (
              <div className="flex items-center gap-1 text-xs">
                {res.status === "pass" ? (
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> pass</span>
                ) : res.status === "fail" ? (
                  <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {res.violations}</span>
                ) : (
                  <span className="text-muted-foreground">error</span>
                )}
              </div>
            )}
            <button onClick={() => remove(rule.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {adding ? (
        <AddRuleForm columns={columns} onAdd={add} onCancel={() => setAdding(false)} />
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add rule
        </Button>
      )}
    </div>
  );
}

function AddRuleForm({
  columns, onAdd, onCancel,
}: { columns: ColumnMeta[]; onAdd: (t: RuleType, c: string) => void; onCancel: () => void }) {
  const [type, setType] = React.useState<RuleType>("not_null");
  const [column, setColumn] = React.useState(columns[0]?.ident ?? "");
  const needsColumn = type !== "no_duplicate_rows" && type !== "unique_combo";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
      <select value={type} onChange={(e) => setType(e.target.value as RuleType)}
        className="rounded border border-border bg-background px-2 py-1 text-xs">
        {(Object.keys(RULE_LABELS) as RuleType[]).map((t) => (
          <option key={t} value={t}>{RULE_LABELS[t]}</option>
        ))}
      </select>
      {needsColumn && (
        <select value={column} onChange={(e) => setColumn(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs">
          {columns.map((c) => <option key={c.ident} value={c.ident}>{c.ident}</option>)}
        </select>
      )}
      <Button size="sm" className="h-7 text-xs" onClick={() => onAdd(type, column)}>Add</Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.
```bash
git add frontend/src/components/clean/audit-log.tsx frontend/src/components/clean/validation-panel.tsx
git commit -m "feat(clean): audit log + validation panel"
```

### Task 12: Pipeline panel

**Files:**
- Create: `frontend/src/components/clean/pipeline-panel.tsx`

- [ ] **Step 1: `pipeline-panel.tsx`**

```tsx
"use client";

import { ArrowDown, ArrowUp, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepEditor } from "@/components/clean/step-editor";
import type { Step } from "@/lib/clean-types";
import { cn } from "@/lib/utils";

type Props = {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  onRun: () => void;
  running: boolean;
  failedIndex: number | null;
  errorMessage: string | null;
  stageRowCounts: number[]; // index-aligned with stages (0 = raw)
};

export function PipelinePanel({
  steps, onChange, onRun, running, failedIndex, errorMessage, stageRowCounts,
}: Props) {
  function update(i: number, patch: Partial<Step>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) { onChange(steps.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const copy = [...steps];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }
  function add() {
    onChange([...steps, { title: `Step ${steps.length + 1}`, sql: "SELECT * FROM prev" }]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold">Cleaning pipeline</div>
        <Button size="sm" onClick={onRun} disabled={running} className="h-8 gap-1.5">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        <p className="text-xs text-muted-foreground">
          Each step is a <code className="font-mono">SELECT</code> that reads{" "}
          <code className="font-mono">prev</code> (the previous step) or{" "}
          <code className="font-mono">raw</code> (the original data).
        </p>
        {steps.map((step, i) => {
          const rowsAfter = stageRowCounts[i + 1];
          const rowsBefore = stageRowCounts[i];
          const failed = failedIndex === i;
          return (
            <div key={i} className={cn(
              "rounded-lg border bg-card p-2.5",
              failed ? "border-destructive" : "border-border",
            )}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px]">{i + 1}</span>
                <input
                  value={step.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                  placeholder={`Step ${i + 1}`}
                />
                {typeof rowsAfter === "number" && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {rowsBefore} → {rowsAfter}
                  </span>
                )}
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <StepEditor value={step.sql} onChange={(v) => update(i, { sql: v })} onRun={onRun} />
              {failed && errorMessage && (
                <div className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{errorMessage}</div>
              )}
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.
```bash
git add frontend/src/components/clean/pipeline-panel.tsx
git commit -m "feat(clean): pipeline panel with reorderable SQL steps"
```

### Task 13: CleanView orchestrator

**Files:**
- Create: `frontend/src/components/clean/clean-view.tsx`

- [ ] **Step 1: `clean-view.tsx`**

```tsx
"use client";

import * as React from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLog } from "@/components/clean/audit-log";
import { DataView } from "@/components/clean/data-view";
import { PipelinePanel } from "@/components/clean/pipeline-panel";
import { ReviewCard } from "@/components/clean/review-card";
import { UploadDropzone } from "@/components/clean/upload-dropzone";
import { ValidationPanel } from "@/components/clean/validation-panel";
import { cleanApi } from "@/lib/clean-api";
import type {
  DatasetSummary, ReviewResponse, Rule, RunResponse, Step,
} from "@/lib/clean-types";

export function CleanView() {
  const [dataset, setDataset] = React.useState<DatasetSummary | null>(null);
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [run, setRun] = React.useState<RunResponse | null>(null);
  const [review, setReview] = React.useState<ReviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [tab, setTab] = React.useState("data");

  React.useEffect(() => {
    cleanApi.getDataset().then((d) => {
      if (d) { setDataset(d); setRules(d.suggested_rules); }
    }).catch(() => {});
  }, []);

  async function loadFile(file: File) {
    setLoading(true);
    try {
      const d = await cleanApi.upload(file);
      setDataset(d); setRules(d.suggested_rules); setSteps([]); setRun(null); setReview(null);
      toast.success(`Loaded ${d.row_count} rows`);
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  }

  async function generate() {
    setLoading(true);
    try {
      const d = await cleanApi.generate();
      setDataset(d); setRules(d.suggested_rules); setSteps([]); setRun(null); setReview(null);
      toast.success("Generated a messy dataset");
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setLoading(false); }
  }

  async function doRun() {
    if (!dataset) return;
    setRunning(true);
    try {
      const r = await cleanApi.run(steps, rules);
      setRun(r);
      if (!r.ok && r.error_message) toast.error(r.error_message);
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setRunning(false); }
  }

  // Re-validate when rules change and we already have a successful run.
  React.useEffect(() => {
    if (run?.ok) void doRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  async function doReview() {
    if (!dataset) return;
    setReviewing(true); setTab("review");
    try {
      setReview(await cleanApi.review(steps, rules));
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setReviewing(false); }
  }

  async function reset() {
    await cleanApi.reset().catch(() => {});
    setDataset(null); setSteps([]); setRules([]); setRun(null); setReview(null);
  }

  if (!dataset) {
    return <UploadDropzone onFile={loadFile} onGenerate={generate} busy={loading} />;
  }

  const stageRowCounts = run?.stages.map((s) => s.row_count) ?? [dataset.row_count];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{dataset.source === "generated" ? "Sample dataset" : "Your dataset"}</span>
          <span className="text-muted-foreground">· {dataset.row_count} rows · {dataset.columns.length} cols</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={doReview} disabled={reviewing}>
            {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI review
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> New dataset
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
          <PipelinePanel
            steps={steps}
            onChange={setSteps}
            onRun={doRun}
            running={running}
            failedIndex={run?.failed_step_index ?? null}
            errorMessage={run?.error_message ?? null}
            stageRowCounts={stageRowCounts}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-3 mb-0 self-start">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="review">AI review</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <TabsContent value="data" className="mt-0 h-full">
                <DataView raw={dataset.raw_preview} cleaned={run?.final_preview ?? null} />
              </TabsContent>
              <TabsContent value="audit" className="mt-0">
                <AuditLog stages={run?.stages ?? []} />
              </TabsContent>
              <TabsContent value="validation" className="mt-0">
                <ValidationPanel
                  columns={dataset.columns}
                  rules={rules}
                  results={run?.validation ?? []}
                  onChange={setRules}
                />
              </TabsContent>
              <TabsContent value="review" className="mt-0">
                {reviewing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reviewing…</div>
                ) : review ? (
                  <ReviewCard review={review} />
                ) : (
                  <div className="text-sm text-muted-foreground">Click “AI review” to get feedback on your pipeline.</div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.
```bash
git add frontend/src/components/clean/clean-view.tsx
git commit -m "feat(clean): CleanView orchestrator"
```

### Task 14: Wire "Clean" mode into the header + main

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Add the import** near the other component imports (after the `ResultsPanel`/`SyllabusView` imports, ~line 37-39):
```tsx
import { CleanView } from "@/components/clean/clean-view";
```
Add `Wand2` to the existing `lucide-react` icon import list.

- [ ] **Step 2: Widen the `mode` state** (~line 291):
```tsx
  const [mode, setMode] = React.useState<"practice" | "learn" | "clean">("practice");
```

- [ ] **Step 3: Add the "Clean" pill** in the header toggle group, immediately after the "Practice" `<button>` (after line ~726, before the closing `</div>` of the pill group):
```tsx
            <button
              type="button"
              onClick={() => setMode("clean")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                mode === "clean"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Clean
            </button>
```

- [ ] **Step 4: Add the render branch.** Find the `<main>` block (~line 821): `{mode === "learn" ? (<SyllabusView … />) : ( <> <PanelGroup …`. Change the conditional so clean mode short-circuits. Replace the opening of that ternary:

From:
```tsx
        {mode === "learn" ? (
          <SyllabusView
            onPracticeConcept={(concept, difficulty) => {
              setMode("practice");
              newQuestionMutation.mutate({ concept, difficulty });
            }}
          />
        ) : (
```
To:
```tsx
        {mode === "clean" ? (
          <CleanView />
        ) : mode === "learn" ? (
          <SyllabusView
            onPracticeConcept={(concept, difficulty) => {
              setMode("practice");
              newQuestionMutation.mutate({ concept, difficulty });
            }}
          />
        ) : (
```

- [ ] **Step 5: Type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(clean): add Clean mode to header + main view"
```

---

## Phase 8 — Verification

### Task 15: End-to-end browser verification

**Files:** none (verification + any fix-up commits)

- [ ] **Step 1: Start infra** (repo root has `.env`): `docker compose up -d`; copy `.env` into the worktree; start backend `cd backend && uv run uvicorn app.main:app --reload --port 8000`; start frontend `cd frontend && npm run dev`.

- [ ] **Step 2: Golden path** — open the app, click **Clean**, click **Generate a sample messy dataset**. Verify: data table shows messy rows; add a step `SELECT customer_id, LOWER(TRIM(full_name)) AS full_name, email, country, signup_date, spend, status FROM prev`; **Run**; the cleaned preview, audit log (row/null deltas), and validation update.

- [ ] **Step 3: Validation + review** — add a `not_null` rule on `customer_id` and `no_duplicate_rows`; add a dedupe step (`SELECT DISTINCT * FROM prev`); Run; confirm rules flip to pass. Click **AI review**; confirm a score + feedback render.

- [ ] **Step 4: Edge cases** — upload a tiny CSV; trigger a SQL error in a step (`SELECT bad_col FROM prev`) and confirm the step shows the error inline without crashing; switch to Practice mode and confirm it still works (clean schema isolation intact); switch back to Clean and confirm the dataset reloaded via `GET /dataset`.

- [ ] **Step 5:** Fix any issues found, committing each fix atomically. Run full backend tests + frontend type-check once more.

- [ ] **Step 6: Final commit** (if any verification fixes were made).

---

## Self-review notes

- **Spec coverage:** hybrid upload+generate (Tasks 4, 7a, 7), all four audit outputs — data-quality report + audit log (Task 6 profiles, Task 11 audit-log), validation rules (Tasks 5, 11), AI feedback (Tasks 7, 10) — view-only output (Task 10 DataView, no export), CSV format (Task 3), `clean` schema isolation (Task 4 load), session storage of raw+meta+rubric (Tasks 1, 7), client-owned steps/rules (Task 9 api), error handling (Task 6 failed_step, Task 13 toasts), tests (Tasks 2-7).
- **Types consistent:** `Rule`/`RuleResult`/`StageProfile`/`DatasetSummary`/`RunResponse`/`Step` identical between `clean-types.ts`, `schemas.py`, and component props. `prev`/`raw` aliases consistent across pipeline + UI copy. `_quote`/`_format_db_error`/`_json_safe` reused from existing modules.
- **No placeholders:** every step has concrete code/commands.
