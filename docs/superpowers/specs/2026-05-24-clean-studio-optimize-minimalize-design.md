# Clean Studio — Optimize & Minimalize — Design

**Date:** 2026-05-24
**Status:** Approved
**Scope:** Refactor of the existing SQL Data Cleaning Studio (Clean mode). Performance optimization + UI/UX minimalization to match the app's restrained aesthetic. No new user-facing capability.

## Goals
1. Make validation rule changes near-instant (don't re-run the full profiled pipeline).
2. Keep large files (up to the 200k-row cap) snappy by bounding the expensive profiling work.
3. Minimalize the UI to match the rest of the app (resizable panels, less chrome, single AI-review entry, restrained type/colour).

## Decisions
- **Layout:** side-by-side resizable (pipeline left, results right); stacks vertically on narrow screens.
- **Audit depth:** full distinct/duplicate stats only for the **raw (stage 0)** and **final** stages; intermediate stages get row + null counts only.

## Backend

### B1. Extract shared staged-execution core (`pipeline.py`)
Factor the staged execution (open connection/txn, `SET LOCAL statement_timeout`, create `raw` + `prev` temp views, validate each fragment, materialize `_stage_i`, repoint `prev`, stop on first failing step) into a reusable async helper, e.g. `_execute_stages(conn, table_fqn, steps, limit) -> (failed_index, error, last_stage_relation)`. Both `run_pipeline` and the new `validate_pipeline` use it. DRY — the materialization logic exists once.

### B2. Tiered profiling (`pipeline.py`)
`_profile(conn, relation, index, label, full: bool)`:
- Always (cheap, one aggregate): `COUNT(*)` + `COUNT(col)` per column → `row_count`, per-column `non_null`/`nulls`.
- When `full=True` only: add `COUNT(DISTINCT col)` per column and a `SELECT COUNT(*) FROM (SELECT DISTINCT * FROM rel)` → `distinct_row_count` + per-column `distinct`.
- `run_pipeline` calls `_profile(full=True)` for stage 0 (raw) and the final stage, `full=False` for all intermediate stages.

When `full=False`, `distinct_row_count` and each column's `distinct` are `None`.

### B3. New `validate_pipeline` + `/api/clean/validate`
`validate_pipeline(table_fqn, steps, rules) -> {ok, failed_step_index, error_message, validation}`:
- Uses `_execute_stages` to build to the final stage. No profiling, no preview.
- Runs each enabled rule against the final stage (`prev`) with the same savepoint-protected logic as `run_pipeline`.
- Route `POST /api/clean/validate` (body `ValidateRequest{steps, rules}`) → `ValidateResponse{ok, failed_step_index, error_message, validation}`. Requires an active dataset (400 otherwise), same as `/run`.

### B4. Schema changes (`clean/schemas.py`)
- `ColumnProfile.distinct: int | None = None`
- `StageProfile.distinct_row_count: int | None = None`
- New `ValidateRequest{steps: list[StepModel], rules: list[RuleModel]}`
- New `ValidateResponse{ok: bool, failed_step_index: int | None, error_message: str | None, validation: list[RuleResult]}`

`/run` response shape is otherwise unchanged (stages still returned; some distinct fields now null for intermediate stages).

## Frontend

### F1. Resizable side-by-side layout (`clean-view.tsx`)
Replace the `grid grid-cols-1 lg:grid-cols-2` container with `react-resizable-panels` (`Group as PanelGroup`, `Panel`, `Separator as PanelResizeHandle`) — pipeline Panel (`defaultSize="45%"`, `minSize="25%"`) | handle | results Panel (`defaultSize="55%"`, `minSize="30%"`). Orientation `horizontal` on wide screens, `vertical` on narrow (reuse the `useSplitDirection`-style media-query hook pattern from `page.tsx`, local to the component). Same visual handle styling as Practice.

### F2. Single AI-review entry (`clean-view.tsx`, `review-card.tsx`)
- Remove the header "AI review" `<Button>`. Keep "New dataset" in the header.
- The AI-review **tab** is the only entry. Its content:
  - no review yet → a centered "Get AI review" button (calls `doReview`)
  - loading → spinner
  - done → `ReviewCard` with a small "Re-run review" link.

### F3. Minimal chrome
- Empty state (`upload-dropzone.tsx`): trim to a single line of copy + dropzone + a quiet text "or generate a sample" link (less heading/divider weight).
- Audit cards (`audit-log.tsx`): lighter — reduce borders, lean on whitespace; when `distinct_row_count`/`distinct` is null, omit the Duplicates stat for that stage (show only on raw + final).
- Validation rows (`validation-panel.tsx`): flatter rows, tighter spacing.
- Source bar + tabs: restrained type scale (text-xs/[11px]), ghost buttons, sparing primary blue — consistent with header/Practice.

### F4. Instant validation wiring (`clean-view.tsx`, `clean-api.ts`, `clean-types.ts`)
- Add `cleanApi.validate(steps, rules)` → `POST /api/clean/validate`.
- Add `ValidateResponse` type; make `ColumnProfile.distinct` and `StageProfile.distinct_row_count` `number | null`.
- Replace the current "re-run full pipeline on rules change" effect: when `rules` change and a successful `run` exists, call `validate` and merge only `validation` into the existing `run` state (audit/preview untouched). Full `/run` still fires on Run and on step edits.

## Error handling
- `/validate`: step failure → `ok:false` + `failed_step_index` + cleaned DB message, `validation: []`. Frontend toasts on failure, same as run.
- Null distinct fields render gracefully (omit the stat, no NaN).

## Testing
- **Backend:** `validate_pipeline` returns correct pass/fail without profiling; reports a bad step. Tiered profiling: intermediate stage has `distinct_row_count is None` and column `distinct is None`; raw + final populated. Update existing `test_pipeline.py` assertions that read `distinct` on the final stage (still populated) and adjust any that assumed intermediate distinct. All rule/ingest/generate tests unchanged.
- **Frontend:** `tsc` + `next lint` clean. Browser dogfood: drag-resize works; toggling a rule updates pass/fail without a full re-run (verify via backend log: `/validate` hit, not `/run`); AI review has one entry point; layout reads minimal and matches the app.

## Files touched
- `backend/app/clean/pipeline.py` — `_execute_stages`, tiered `_profile`, `validate_pipeline`
- `backend/app/clean/routes.py` — `/validate`
- `backend/app/clean/schemas.py` — nullable distinct fields, `ValidateRequest`/`ValidateResponse`
- `backend/tests/test_pipeline.py` — validate + tiered profiling tests
- `frontend/src/lib/clean-types.ts` — nullable distinct, `ValidateResponse`
- `frontend/src/lib/clean-api.ts` — `validate`
- `frontend/src/components/clean/clean-view.tsx` — panels, review dedup, validate wiring
- `frontend/src/components/clean/review-card.tsx` — in-tab get/re-run review
- `frontend/src/components/clean/audit-log.tsx` — null-safe stats, lighter chrome
- `frontend/src/components/clean/validation-panel.tsx` — flatter rows
- `frontend/src/components/clean/upload-dropzone.tsx` — trimmed empty state

## Out of scope
CSV/Excel export, multi-dataset, saved pipelines, column-rename UI, referencing arbitrary earlier stages. Unchanged from the original feature.
