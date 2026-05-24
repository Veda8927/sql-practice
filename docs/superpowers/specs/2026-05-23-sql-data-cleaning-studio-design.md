# SQL Data Cleaning Studio — Design

**Date:** 2026-05-23
**Status:** Approved (Approach B — iterative cleaning pipeline)
**Author:** Claude (brainstormed with Veda)

## 1. Summary

A third app mode — **Clean** — alongside the existing Learn and Practice modes. The
user brings a messy CSV (or loads a generated messy dataset), then cleans it with an
**ordered pipeline of small SQL steps**. Every step is audited (before/after diff),
the result is validated against rules, and the AI reviews the whole pipeline. Output
is view-only (no file export in v1).

This reuses the app's existing strengths: Postgres execution with a rolled-back
transaction + statement timeout, the `DataTable` renderer, Monaco editor, React Query,
the LLM client, and the mode-toggle UI pattern.

### Decisions captured during brainstorming
- **Purpose:** Hybrid — upload your own CSV *or* load a generated messy dataset; same
  workflow for both.
- **Audit outputs (all four):** data-quality report, AI feedback on the SQL, validation
  rules, and a per-step change/audit log.
- **Output:** View-only in-app (no download in v1).
- **Format:** CSV upload for v1 (.xlsx is a future extension).
- **Lifetime:** Session-scoped, one active dataset at a time.

## 2. Core model: the re-run-from-raw pipeline

Cleaning is an **ordered list of steps**. Each step is a single `SELECT`/`WITH`
fragment that reads from a fixed alias `prev` (the previous step's output) and may
also read `raw` (the original uploaded data). Step 1's `prev` *is* `raw`.

The pipeline **re-runs from raw on every execution**. To compute state after step *k*,
the backend runs, inside one rolled-back transaction:

```sql
SET LOCAL statement_timeout = '5s';
CREATE TEMP VIEW raw  AS SELECT * FROM clean.dataset_<sid>;   -- original, stable
CREATE TEMP VIEW prev AS SELECT * FROM raw;                    -- stage 0

-- for each step i in 1..k:
CREATE TEMP TABLE _stage_i AS <step i fragment>;              -- reads prev / raw
DROP VIEW prev;
CREATE TEMP VIEW prev AS SELECT * FROM _stage_i;
-- (capture a profile snapshot of _stage_i here)

SELECT * FROM prev LIMIT <preview cap>;   -- result after step k
-- ROLLBACK (nothing persists; temp objects vanish)
```

Why this design:
- **Perfect audit log** — each stage has an exact profile snapshot, so before/after
  diffs are real, not estimated.
- **Trivial undo** — removing a step just shortens the list; no state drift.
- **Safe** — the user only writes `SELECT` fragments; the backend wraps them in
  `CREATE TEMP TABLE … AS` and everything rolls back. The raw table is written once at
  upload and never mutated.
- **Learnable** — "each step transforms `prev`" mirrors real ETL/dbt thinking.

## 3. Isolation (critical constraint)

The existing app uses a **single shared `public` schema** that is dropped wholesale on
`/api/reset_data` and `/api/curated/load`. Therefore cleaning data MUST NOT live in
`public`. All cleaning data lives in a dedicated **`clean`** schema:

- `CREATE SCHEMA IF NOT EXISTS clean` on first use.
- Raw upload stored as `clean.dataset_<sid8>` where `<sid8>` is the first 8 hex chars
  of the session id (isolates concurrent browsers; this is a local single-user app so
  collisions are not a real concern, but the suffix keeps it tidy).
- On a new upload/generate, the session's previous `clean.dataset_<sid8>` is dropped
  first.
- Practice/Learn mode is completely unaffected; switching modes never touches `clean`.

## 4. Backend

### 4.1 New package: `backend/app/clean/`
- `__init__.py`
- `schemas.py` — Pydantic request/response models (see §4.3).
- `ingest.py` — CSV parse, identifier sanitization, type *guess*, load into `clean`
  schema, raw profiling, heuristic rule suggestions.
- `pipeline.py` — compose + execute the staged pipeline in a rolled-back transaction;
  capture per-stage profiles; run validation rules on the final stage; return preview +
  audit log + validation results.
- `rules.py` — the rule vocabulary → violation-count SQL builder (identifier-safe,
  parameter-bound).
- `generate.py` — deterministic messy-dataset generator + issue rubric.
- `routes.py` — `APIRouter` with the `/api/clean/*` endpoints; included from `main.py`.

### 4.2 Shared session dependency
Extract the existing `_session_dep` / `SessionDep` (cookie → `SessionState`) from
`main.py` into a small `backend/app/deps.py` so both `main.py` and `clean/routes.py`
share it without a circular import. `main.py` imports `SessionDep` from `deps`.

Add one field to `SessionState` (`state.py`):
```python
clean: CleanSession | None = None
```
`CleanSession` (dataclass) holds: `dataset_id`, `source` ("upload"|"generated"),
`table` (e.g. `clean.dataset_ab12cd34`), `columns` (list of `{name, ident, guessed_type}`),
`raw_profile` (dict), `rubric` (list | None, for generated datasets), `created_at`.
**Steps and rules are NOT stored server-side** — the client owns them and sends them on
every `run`/`review` (mirrors how curated mode keeps hints client-side). The backend
persists only the raw table + dataset metadata + rubric.

### 4.3 Endpoints (all under `/api/clean`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/clean/upload` | multipart CSV → ingest, profile, suggest rules → dataset summary |
| POST | `/api/clean/generate` | `{theme?, seed?}` → generate messy dataset → dataset summary (rubric hidden) |
| GET  | `/api/clean/dataset` | current dataset summary (for reload), or 404 if none |
| POST | `/api/clean/run` | `{steps[], up_to_index?, rules[]}` → final preview + per-stage audit log + validation results |
| POST | `/api/clean/review` | `{steps[], rules[]}` → LLM feedback on the pipeline |
| POST | `/api/clean/reset` | drop the session's dataset |

**Dataset summary** shape: `{dataset_id, source, row_count, columns:[{name,ident,guessed_type}],
raw_preview: TableResult, profile: ColumnProfile[], suggested_rules: Rule[]}`.

**Run response** shape:
```
{
  ok: bool,
  failed_step_index: int | null,        # which step errored (null = all ran)
  error_message: str | null,
  final_preview: TableResult | null,
  stages: StageProfile[],               # index 0 = raw, then one per step
  validation: RuleResult[]              # evaluated against the final stage
}
```
`StageProfile`: `{index, label, row_count, distinct_row_count, columns:[{ident, non_null,
nulls, distinct}]}`. The frontend derives diffs (row delta, columns added/removed,
null-count change per column) from consecutive `StageProfile`s.

`RuleResult`: `{id, label, status: "pass"|"fail"|"error", violations: int, message?: str}`.

### 4.4 Ingestion (`ingest.py`)
- Parse with Python stdlib `csv` (no new dependency). First row = headers.
- Sanitize each header to a safe SQL identifier (lowercase, `[a-z0-9_]`, dedupe
  collisions with numeric suffixes, fall back to `col_N` for empty). Keep a
  `name → ident` map (display name preserved for UI).
- **All columns ingested as `TEXT`** — messy data has no trustworthy types; the user
  casts during cleaning.
- Guess a *display-only* type per column (int / numeric / date / bool / text) by
  sampling values — shown as a hint, not enforced.
- Caps: ≤ 2 MB file, ≤ 5,000 rows, ≤ 60 columns. Exceeding → 400 with a clear message.
- Load via parameterized multi-row inserts (batched) into `clean.dataset_<sid8>`.
- Profile the raw table (one aggregate query: row count + per-column non-null/distinct;
  one query for distinct full-row count) → `ColumnProfile[]`.
- Heuristic suggested rules from the profile, e.g.:
  - column with 0 nulls and all-distinct → suggest `unique` + `not_null`.
  - column that looks like email (regex sample hit) → suggest `regex(email)`.
  - duplicate full rows present → suggest `no_duplicate_rows`.

### 4.5 Pipeline execution (`pipeline.py`)
- Validate every step fragment: must match `^\s*(WITH|SELECT)\b` and contain no
  write/DDL keywords (reuse the `READONLY_PATTERN` / `WRITE_PATTERN` approach from
  `main.py`).
- Run the §2 transaction. If a stage fails, stop, roll back, and return
  `failed_step_index` + a cleaned DB message (reuse `grader._format_db_error`).
- Capture a `StageProfile` after each stage (and for raw as stage 0).
- After the final stage, evaluate each enabled rule via `rules.py` (same transaction,
  `prev` = final stage).
- Cap preview to 100 rows; cap steps to 20; per-statement `statement_timeout = '5s'`.
- Always roll back.

### 4.6 Rule vocabulary (`rules.py`)
Fixed, safe vocabulary. The user never writes raw rule SQL — they pick a type and the
column(s) (AI/heuristics pre-fill). Each rule compiles to one violation-count query
against `prev`, with column names validated against the dataset's known identifier set
(then quoted) and all literals bound as parameters.

| type | params | violation count |
|---|---|---|
| `not_null` | column | rows where column `IS NULL` |
| `unique` | column | extra rows in duplicated non-null groups |
| `unique_combo` | columns[] | extra rows in duplicated combos |
| `no_duplicate_rows` | — | total rows − distinct rows |
| `regex` | column, pattern | non-null rows where `column !~ :pattern` |
| `allowed_values` | column, values[] | non-null rows where `column <> ALL(:values)` |
| `range` | column, min, max | rows where `column::numeric NOT BETWEEN :min AND :max` (assumes the column is numeric by the final stage; a cast error → rule `status: "error"` with a hint) |

`status`: `pass` if `violations == 0`, else `fail`; `error` if the query itself throws.

### 4.7 Generated messy dataset (`generate.py`)
**Deterministic** (no LLM) — far more controllable than an LLM at producing precisely
messy data, and it's fast and free. Seeded. Picks a theme (e.g. `customers`,
`orders`, `products`) and emits ~150–400 rows with a known set of injected issues, then
loads them into `clean.dataset_<sid8>` exactly like an upload (all TEXT). The injected
issues form a **rubric** stored in the session (hidden from the client) used by the AI
review to grade coverage. Injected issue types:
- leading/trailing whitespace; inconsistent casing
- mixed date formats stored as text (`2024-01-02`, `01/02/2024`, `Jan 2 2024`)
- duplicate rows
- NULLs / empty strings / sentinel values (`N/A`, `-`, `unknown`)
- numbers stored as text with `$`, `,`, `%`
- inconsistent category labels (`USA`/`U.S.A`/`united states`)
- a few out-of-range / impossible values

### 4.8 LLM review (`llm.py` + `clean/`)
New `async def review_cleaning(...)` following the existing pattern (`_get_client`,
`chat.completions.create(..., response_format={"type":"json_object"})`, `json.loads`).
Input payload: raw profile, the ordered step fragments, final-stage profile, validation
results, and (if present) the generated rubric. Returns JSON:
```
{ "assessment": str,            # overall, plain-English
  "remaining_issues": [str],    # problems still in the data
  "suggestions": [str],         # concrete next SQL moves
  "praise": [str],              # what was done well
  "score": int }                # 0–100 cleanliness score
```
On missing API key / failure → 502 (frontend toasts gracefully), same as other LLM
endpoints.

## 5. Frontend

### 5.1 Mode integration (`app/page.tsx`)
- Extend `mode` from `"practice" | "learn"` to `… | "clean"`.
- Add a third pill button ("Clean", `Wand2`/`Sparkles` icon) in the existing header
  toggle group.
- When `mode === "clean"`, render `<CleanView />` instead of the practice
  `PanelGroup`. The practice-only header buttons are already gated on
  `mode === "practice"`, so they hide automatically.
- `CleanView` is self-contained (like `SyllabusView`): it owns its data/steps/rules/
  results state and calls the clean API directly.

### 5.2 New library code
- `frontend/src/lib/clean-types.ts` — TS mirrors of the backend schemas.
- `frontend/src/lib/clean-api.ts` — fetch client (`credentials:"include"`), incl.
  multipart upload (no JSON `Content-Type` for the upload call).

### 5.3 New components (`frontend/src/components/clean/`)
- `clean-view.tsx` — orchestrator + layout. Empty state = dropzone + "Generate a
  sample messy dataset". With a dataset: left = pipeline; right = tabs
  **Data / Audit / Validation / AI Review**. A top source bar shows the dataset name,
  row count, source badge, and a "New dataset" action.
- `upload-dropzone.tsx` — drag/drop + file picker; "Generate sample" button.
- `pipeline-panel.tsx` — ordered, reorderable step list (add / remove / move), each
  step a title + a Monaco editor reading `prev`; per-step row-delta badge; "Run
  pipeline" (⌘↵). Shows the failed step inline on error.
- `step-editor.tsx` — small `@monaco-editor/react` wrapper (SQL, theme-aware).
- `data-view.tsx` — `DataTable` of the selected stage's output (default: final);
  toggle Raw ↔ Cleaned.
- `audit-log.tsx` — per-stage cards: rows before→after (+/- delta), columns
  added/removed, per-column null-count change; plus the data-quality summary.
- `validation-panel.tsx` — rule list with pass/fail/violation counts; toggle on/off;
  add/edit a rule from the fixed vocabulary via a small form.
- `review-card.tsx` — AI feedback (assessment, remaining issues, suggestions, praise,
  score), styled like `coach-card`.

### 5.4 Reuse
`DataTable`, `ui/{card,badge,button,tabs,scroll-area,tooltip}`, `sonner` toasts,
`framer-motion`, `@monaco-editor/react`, `cn`, design tokens (HSL CSS vars; primary
blue, destructive red, muted/border neutrals; green for pass states).

## 6. Data flow (happy path)
1. Upload CSV / Generate → backend ingests to `clean.dataset_<sid8>`, profiles, returns
   summary (columns, raw preview, profile, suggested rules).
2. User adds Step 1 (`SELECT TRIM(name) AS name, … FROM prev`), runs → POST
   `/clean/run` → final preview + audit (stage 0 raw + stage 1) + validation.
3. Iterate: add steps, run; the audit log grows; validation flips to green as issues
   are fixed.
4. "Get AI review" → POST `/clean/review` → feedback card with score.
5. View-only; no export in v1.

## 7. Error handling
- Bad/empty/oversized CSV → 400 + message → toast.
- Step SQL error → `failed_step_index` + cleaned DB message; highlight that step; the
  pipeline does not crash.
- LLM unconfigured/failure → 502 → toast; the rest of the studio still works.
- Empty pipeline run → just profiles raw (stage 0).

## 8. Testing
- **Backend unit (no DB):** identifier sanitization, CSV parsing + caps, rule SQL
  builder output, generator rubric shape, read-only fragment guard.
- **Backend integration (Postgres):** ingest → table; multi-step `prev`/`raw` chaining;
  write/DDL fragment rejected; profiles correct across stages; rule violation counts;
  generated dataset loads + profiles. Skip gracefully if Postgres is unavailable.
- **Frontend:** `tsc` type-check + ESLint; manual browser dogfood of the golden path
  (upload sample → clean → audit → validate → review) and key edge cases (bad CSV, SQL
  error in a step, empty pipeline) using the browse tooling.
- **Verification before completion:** run the backend, exercise upload→clean→validate→
  review end-to-end via curl, and verify the UI in a browser before declaring done.

## 9. Scope / YAGNI
**In v1:** CSV only, view-only, one dataset per session, fixed rule vocabulary,
deterministic generator, on-demand AI review, `clean` schema isolation.

**Deferred:** .xlsx import, CSV/Excel export, multiple saved datasets, shareable/saved
pipelines, undo history beyond removing steps, a dedicated column-rename UI (use SQL),
referencing arbitrary earlier stages (only `prev` + `raw` in v1).
