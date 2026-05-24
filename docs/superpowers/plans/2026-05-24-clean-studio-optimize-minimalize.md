# Clean Studio Optimize + Minimalize — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Clean-mode validation instant and large-file profiling cheap, and minimalize the UI to match the app (resizable panels, single AI-review entry, less chrome).

**Architecture:** Extract a shared staged-execution core in `pipeline.py`; add tiered profiling (full distinct stats only at raw + final) and a `validate_pipeline` used by a new `/api/clean/validate`. Frontend switches the results layout to `react-resizable-panels`, dedupes the AI-review entry into the tab, and calls `/validate` on rule changes.

**Tech Stack:** FastAPI, SQLAlchemy async, Postgres; Next.js 15/React 19, react-resizable-panels, Monaco, Tailwind.

Spec: `docs/superpowers/specs/2026-05-24-clean-studio-optimize-minimalize-design.md`. Work on `main` with atomic commits. Servers run from the main checkout (backend `--reload` on :8000, frontend pnpm dev on :3000). Postgres on :5433.

---

## Task 1: Backend schemas (nullable distinct + validate types)

**Files:** Modify `backend/app/clean/schemas.py`

- [ ] **Step 1:** In `ColumnProfile`, change `distinct: int` → `distinct: int | None = None`. In `StageProfile`, change `distinct_row_count: int` → `distinct_row_count: int | None = None`.

- [ ] **Step 2:** Append new models after `RunResponse`:
```python
class ValidateRequest(BaseModel):
    steps: list[StepModel] = []
    rules: list[RuleModel] = []


class ValidateResponse(BaseModel):
    ok: bool
    failed_step_index: int | None = None
    error_message: str | None = None
    validation: list[RuleResult] = []
```

- [ ] **Step 3:** Verify import: `cd backend && uv run python -c "from app.clean import schemas; print('ok')"` → `ok`.

- [ ] **Step 4:** Commit: `git add backend/app/clean/schemas.py && git commit -m "feat(clean): nullable distinct profile fields + validate schemas"`

## Task 2: Pipeline refactor — shared core, tiered profiling, validate (TDD)

**Files:** Modify `backend/app/clean/pipeline.py`, `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests** (append to `backend/tests/test_pipeline.py`):
```python
@pytest.mark.asyncio
async def test_tiered_profiling(loaded):
    steps = [
        {"title": "s1", "sql": "SELECT name, amount FROM prev"},
        {"title": "s2", "sql": "SELECT name, amount FROM prev"},
    ]
    out = await pipeline.run_pipeline(TABLE, steps, rules=[])
    raw, mid, final = out["stages"][0], out["stages"][1], out["stages"][2]
    # raw + final get full distinct stats; intermediate is cheap
    assert raw["distinct_row_count"] is not None
    assert final["distinct_row_count"] is not None
    assert mid["distinct_row_count"] is None
    assert raw["columns"][0]["distinct"] is not None
    assert mid["columns"][0]["distinct"] is None
    # null counts always present
    assert all("nulls" in c for c in mid["columns"])


@pytest.mark.asyncio
async def test_validate_pipeline_pass_fail(loaded):
    steps = [{"title": "clean",
              "sql": "SELECT LOWER(TRIM(name)) AS name FROM prev WHERE name IS NOT NULL"}]
    rules = [
        {"id": "r0", "type": "not_null", "label": "nn", "params": {"column": "name"}, "enabled": True},
        {"id": "r1", "type": "no_duplicate_rows", "label": "dup", "params": {}, "enabled": True},
    ]
    out = await pipeline.validate_pipeline(TABLE, steps, rules)
    assert out["ok"] is True
    assert "stages" not in out  # validate does no profiling
    by_id = {r["id"]: r for r in out["validation"]}
    assert by_id["r0"]["status"] == "pass"
    assert by_id["r1"]["status"] == "fail"


@pytest.mark.asyncio
async def test_validate_pipeline_bad_step(loaded):
    out = await pipeline.validate_pipeline(
        TABLE, [{"title": "boom", "sql": "SELECT nope FROM prev"}], rules=[])
    assert out["ok"] is False
    assert out["failed_step_index"] == 0
    assert out["error_message"]
    assert out["validation"] == []
```

- [ ] **Step 2: Run, expect failure**
Run: `cd backend && uv run pytest tests/test_pipeline.py -q`
Expected: failures (`validate_pipeline` undefined; tiered assertions fail).

- [ ] **Step 3: Refactor `pipeline.py`.** Replace the body of `_profile` and `run_pipeline`, and add helpers, so the file reads:

Replace the existing `_profile` function with:
```python
async def _profile(conn, relation: str, index: int, label: str, full: bool = True) -> dict[str, Any]:
    idents = await _columns(conn, relation)
    parts = ["COUNT(*) AS n"]
    for idx, i in enumerate(idents):
        parts.append(f"COUNT({_quote(i)}) AS nn{idx}")
        if full:
            parts.append(f"COUNT(DISTINCT {_quote(i)}) AS d{idx}")
    agg = (
        await conn.execute(text("SELECT " + ", ".join(parts) + f" FROM {relation}"))
    ).mappings().first()
    n = int(agg["n"])
    distinct_rows: int | None = None
    if full:
        distinct_rows = int(
            (await conn.execute(
                text(f"SELECT COUNT(*) c FROM (SELECT DISTINCT * FROM {relation}) s")
            )).scalar_one()
        )
    cols = [
        {
            "ident": i,
            "non_null": int(agg[f"nn{idx}"]),
            "nulls": n - int(agg[f"nn{idx}"]),
            "distinct": int(agg[f"d{idx}"]) if full else None,
        }
        for idx, i in enumerate(idents)
    ]
    return {
        "index": index, "label": label, "row_count": n,
        "distinct_row_count": distinct_rows, "columns": cols,
    }
```

Add a shared staged-execution helper (place above `run_pipeline`):
```python
async def _execute_stages(conn, table_fqn: str, steps: list[dict[str, Any]], limit: int):
    """Build raw + prev views, materialize steps[0:limit], repoint prev each step.
    Returns (failed_index, error_message). Caller wraps this in a txn it rolls back."""
    await conn.execute(text("SET LOCAL statement_timeout = '5s'"))
    await conn.exec_driver_sql(f"CREATE TEMP VIEW raw AS SELECT * FROM {table_fqn}")
    await conn.exec_driver_sql("CREATE TEMP VIEW prev AS SELECT * FROM raw")
    for i in range(limit):
        frag = (steps[i].get("sql") or "").strip().rstrip(";")
        err = validate_fragment(frag)
        if err:
            return i, err
        try:
            await conn.exec_driver_sql(f'CREATE TEMP TABLE "_stage_{i + 1}" AS {frag}')
            await conn.exec_driver_sql("DROP VIEW prev")
            await conn.exec_driver_sql(f'CREATE TEMP VIEW prev AS SELECT * FROM "_stage_{i + 1}"')
        except Exception as e:  # noqa: BLE001
            return i, _format_db_error(e)
    return None, None


async def _run_rules(conn, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run enabled rules against `prev` with per-rule savepoints. Returns RuleResult dicts."""
    res = await conn.execute(text("SELECT * FROM prev LIMIT 0"))
    ident_set = set(res.keys())
    out: list[dict[str, Any]] = []
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        rid = rule.get("id", "")
        label = rule.get("label", rule.get("type", "rule"))
        try:
            vsql, vparams = build_violation_query(rule, ident_set)
        except RuleError as e:
            out.append({"id": rid, "label": label, "status": "error", "violations": 0, "message": str(e)})
            continue
        sp = await conn.begin_nested()
        try:
            v = int((await conn.execute(text(vsql), vparams)).scalar_one())
            await sp.commit()
            out.append({"id": rid, "label": label,
                        "status": "pass" if v == 0 else "fail", "violations": v, "message": None})
        except Exception as e:  # noqa: BLE001
            await sp.rollback()
            out.append({"id": rid, "label": label, "status": "error", "violations": 0,
                        "message": _format_db_error(e)})
    return out
```

Replace `run_pipeline` with a version that uses the helpers + tiered profiling:
```python
async def run_pipeline(table_fqn, steps, rules, up_to_index=None):
    limit = len(steps) if up_to_index is None else max(0, min(up_to_index, len(steps)))
    if len(steps) > MAX_STEPS:
        return {"ok": False, "failed_step_index": MAX_STEPS,
                "error_message": f"Too many steps (max {MAX_STEPS}).",
                "final_preview": None, "stages": [], "validation": []}
    stages: list[dict[str, Any]] = []
    final_preview = None
    validation: list[dict[str, Any]] = []
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            await conn.execute(text("SET LOCAL statement_timeout = '5s'"))
            await conn.exec_driver_sql(f"CREATE TEMP VIEW raw AS SELECT * FROM {table_fqn}")
            await conn.exec_driver_sql("CREATE TEMP VIEW prev AS SELECT * FROM raw")
            stages.append(await _profile(conn, "prev", 0, "Raw", full=True))
            failed = None
            error = None
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
                    await conn.exec_driver_sql(f'CREATE TEMP VIEW prev AS SELECT * FROM "_stage_{i + 1}"')
                    is_final = i == limit - 1
                    stages.append(await _profile(conn, "prev", i + 1, title, full=is_final))
                except Exception as e:  # noqa: BLE001
                    failed, error = i, _format_db_error(e)
                    break
            if failed is None:
                res = await conn.execute(text(f"SELECT * FROM prev LIMIT {PREVIEW_CAP}"))
                cols = list(res.keys())
                rows = [[_json_safe(v) for v in r] for r in res.fetchall()]
                final_preview = {"columns": cols, "rows": rows}
                validation = await _run_rules(conn, rules)
        finally:
            await trans.rollback()
    return {"ok": failed is None, "failed_step_index": failed, "error_message": error,
            "final_preview": final_preview, "stages": stages, "validation": validation}
```
Note: when `limit == 0` (no steps), the only stage is raw (full); `is_final` never triggers — raw already full, fine.

Add `validate_pipeline` at the end of the file:
```python
async def validate_pipeline(table_fqn, steps, rules):
    if len(steps) > MAX_STEPS:
        return {"ok": False, "failed_step_index": MAX_STEPS,
                "error_message": f"Too many steps (max {MAX_STEPS}).", "validation": []}
    validation: list[dict[str, Any]] = []
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            failed, error = await _execute_stages(conn, table_fqn, steps, len(steps))
            if failed is None:
                validation = await _run_rules(conn, rules)
        finally:
            await trans.rollback()
    return {"ok": failed is None, "failed_step_index": failed,
            "error_message": error, "validation": validation}
```

- [ ] **Step 4: Run, expect pass**
Run: `cd backend && uv run pytest tests/test_pipeline.py -q`
Expected: all pass (incl. existing tests — note `test_pipeline_runs_rules` final stage still has distinct populated since it's the final stage).

- [ ] **Step 5: Full suite + lint**
Run: `cd backend && uv run pytest -q && uv run ruff check app`
Expected: all pass, ruff clean.

- [ ] **Step 6: Commit**
`git add backend/app/clean/pipeline.py backend/tests/test_pipeline.py && git commit -m "perf(clean): shared staged-execution core, tiered profiling, validate_pipeline"`

## Task 3: `/api/clean/validate` route

**Files:** Modify `backend/app/clean/routes.py`

- [ ] **Step 1:** Add imports: in the `from .schemas import (...)` block add `ValidateRequest, ValidateResponse`. In `from .pipeline import ...` add `validate_pipeline` (currently `from .pipeline import run_pipeline` → `from .pipeline import run_pipeline, validate_pipeline`).

- [ ] **Step 2:** Add the route after `run`:
```python
@router.post("/validate", response_model=ValidateResponse)
async def validate(req: ValidateRequest, state: SessionDep) -> ValidateResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    out = await validate_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
    )
    return ValidateResponse(**out)
```

- [ ] **Step 3:** Verify route registered:
`cd backend && uv run python -c "from app.main import app; print('/api/clean/validate' in [r.path for r in app.routes])"` → `True`

- [ ] **Step 4:** Ruff + commit:
`uv run ruff check app && cd .. && git add backend/app/clean/routes.py && git commit -m "feat(clean): /api/clean/validate endpoint"`

## Task 4: Frontend types + api client

**Files:** Modify `frontend/src/lib/clean-types.ts`, `frontend/src/lib/clean-api.ts`

- [ ] **Step 1:** In `clean-types.ts`: `ColumnProfile.distinct: number | null`; `StageProfile.distinct_row_count: number | null`. Add:
```typescript
export type ValidateResponse = {
  ok: boolean;
  failed_step_index: number | null;
  error_message: string | null;
  validation: RuleResult[];
};
```

- [ ] **Step 2:** In `clean-api.ts`, add to the `cleanApi` object (after `run`):
```typescript
  validate: (steps: Step[], rules: Rule[]) =>
    postJson<ValidateResponse>("/api/clean/validate", { steps, rules }),
```
and import `ValidateResponse` in the type import block.

- [ ] **Step 3:** Typecheck: `cd frontend && node_modules/.bin/tsc --noEmit` → clean.

- [ ] **Step 4:** Commit: `git add frontend/src/lib/clean-types.ts frontend/src/lib/clean-api.ts && git commit -m "feat(clean): validate api + nullable distinct types"`

## Task 5: CleanView — resizable panels, review dedup, validate wiring

**Files:** Modify `frontend/src/components/clean/clean-view.tsx`

- [ ] **Step 1:** Add imports at top:
```tsx
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
```
Add a local responsive hook (above the component):
```tsx
function useWide() {
  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}
```

- [ ] **Step 2:** Replace the rules-change effect (the `useEffect(() => { if (hasRun) void doRun(); }, [rules])`) with a validate-only effect:
```tsx
  const hasRun = run?.ok ?? false;
  React.useEffect(() => {
    if (!hasRun) return;
    let cancelled = false;
    cleanApi.validate(stepsRef.current, rulesRef.current).then((v) => {
      if (cancelled) return;
      setRun((prev) => (prev ? { ...prev, validation: v.validation } : prev));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);
```

- [ ] **Step 3:** Remove the header "AI review" `<Button>` (keep only "New dataset"). Delete the `doReview` trigger from the header; `doReview` stays defined (used by the tab now). Remove the now-unused `setTab("review")` call inside doReview if it conflicts; keep `doReview` setting reviewing + fetching.

- [ ] **Step 4:** Replace the results container (the `<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">...</div>`) with a resizable group. Pipeline panel left, results (tabs) panel right:
```tsx
      <PanelGroup orientation={wide ? "horizontal" : "vertical"} className="min-h-0 flex-1">
        <Panel defaultSize="45%" minSize="25%" className="min-h-0">
          <PipelinePanel
            steps={steps}
            onChange={setSteps}
            onRun={doRun}
            running={running}
            failedIndex={run?.failed_step_index ?? null}
            errorMessage={run?.error_message ?? null}
            stageRowCounts={stageRowCounts}
          />
        </Panel>
        <PanelResizeHandle className={wide ? "w-px bg-border hover:bg-primary/40 transition-colors" : "h-px bg-border"} />
        <Panel defaultSize="55%" minSize="30%" className="min-h-0">
          {/* existing Tabs block goes here unchanged except the review tab content (Step 5) */}
        </Panel>
      </PanelGroup>
```
where `const wide = useWide();` is added near the other hooks, and `stageRowCounts` stays as defined.

- [ ] **Step 5:** In the `review` TabsContent, replace the current empty/loading/review conditional so the tab is the single entry:
```tsx
              <TabsContent value="review" className="mt-0">
                {reviewing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reviewing…
                  </div>
                ) : review ? (
                  <div className="flex flex-col gap-3">
                    <ReviewCard review={review} />
                    <button onClick={doReview} className="self-start text-xs text-primary hover:underline">
                      Re-run review
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Get AI feedback on your cleaning pipeline.</p>
                    <Button size="sm" className="gap-1.5" onClick={doReview}>
                      <Sparkles className="h-3.5 w-3.5" /> Get AI review
                    </Button>
                  </div>
                )}
              </TabsContent>
```
Keep the `Sparkles` import (already imported).

- [ ] **Step 6:** Typecheck + lint: `cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/next lint --dir src` → clean.

- [ ] **Step 7:** Commit: `git add frontend/src/components/clean/clean-view.tsx && git commit -m "feat(clean): resizable panels, single AI-review entry, instant validate"`

## Task 6: Minimal chrome — audit null-safe, dropzone, validation

**Files:** Modify `frontend/src/components/clean/audit-log.tsx`, `upload-dropzone.tsx`, `validation-panel.tsx`

- [ ] **Step 1: audit-log.tsx** — make Duplicates stat null-safe (intermediate stages have `distinct_row_count: null`). Replace the `dupBefore`/`dupNow` computation and the Duplicates `<Stat>` so it only renders when distinct is known:
```tsx
        const dupNow = stage.distinct_row_count == null ? null : stage.row_count - stage.distinct_row_count;
        const dupBefore = prev && prev.distinct_row_count != null ? prev.row_count - prev.distinct_row_count : null;
```
and in the `<dl>` replace the Duplicates Stat with:
```tsx
              {dupNow != null && (
                <Stat label="Duplicates" value={dupNow}
                      extra={dupBefore != null ? delta(dupBefore, dupNow) : null} />
              )}
```
Lighten chrome: change card class `rounded-lg border border-border bg-card p-3` → `rounded-md border border-border/60 bg-card/50 p-3`.

- [ ] **Step 2: upload-dropzone.tsx** — trim the empty state. Replace the heading block (`<div><h2>...</h2><p>...</p></div>`) with a single line:
```tsx
      <p className="text-sm text-muted-foreground">Upload a CSV to clean it with SQL — audited, validated, reviewed.</p>
```
and replace the "or" divider + Button block with a quieter generate link:
```tsx
      <button onClick={onGenerate} disabled={busy}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
        {busy ? "Generating…" : "or generate a sample messy dataset"}
      </button>
```
(Remove the now-unused `Sparkles`/`Loader2`/`Button` imports if they become unused; keep `Upload`.)

- [ ] **Step 3: validation-panel.tsx** — flatten rows: change row class `rounded-lg border border-border bg-card px-3 py-2` → `rounded-md border border-border/60 px-3 py-1.5`.

- [ ] **Step 4:** Typecheck + lint: `cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/next lint --dir src` → clean.

- [ ] **Step 5:** Commit: `git add frontend/src/components/clean/audit-log.tsx frontend/src/components/clean/upload-dropzone.tsx frontend/src/components/clean/validation-panel.tsx && git commit -m "style(clean): minimal chrome + null-safe audit stats"`

## Task 7: Verification

**Files:** none (verify + fix-ups)

- [ ] **Step 1:** Backend green: `cd backend && uv run pytest -q && uv run ruff check app` → all pass.

- [ ] **Step 2:** Frontend green: `cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/next lint --dir src` → clean.

- [ ] **Step 3:** Restart backend if needed; confirm `/api/clean/validate` works:
```bash
curl -s -c /tmp/v.txt -X POST localhost:8000/api/clean/generate -H 'content-type: application/json' -d '{"seed":1}' -o /dev/null -w "gen %{http_code}\n"
curl -s -b /tmp/v.txt -X POST localhost:8000/api/clean/validate -H 'content-type: application/json' \
  -d '{"steps":[],"rules":[{"id":"r1","type":"no_duplicate_rows","label":"dup","params":{},"enabled":true}]}' -w " validate %{http_code}\n"
```
Expected: gen 200; validate 200 with a `validation` array (no `stages`).

- [ ] **Step 4:** Browser dogfood at http://localhost:3000 → Clean: drag the panel divider; generate dataset + run a step; toggle a rule and confirm via backend log that `/api/clean/validate` is hit (not `/run`); AI-review tab is the only entry; layout reads minimal.

- [ ] **Step 5:** Fix anything found (atomic commits).

---

## Self-review
- **Spec coverage:** B1 shared core (Task 2 `_execute_stages`/`_run_rules`), B2 tiered profiling (Task 2 `_profile(full=)`), B3 validate_pipeline + route (Tasks 2, 3), B4 schemas (Task 1) + types (Task 4); F1 panels (Task 5), F2 review dedup (Task 5), F3 chrome (Task 6), F4 validate wiring (Tasks 4, 5). Testing in Tasks 2 and 7.
- **Types consistent:** `validate_pipeline`/`validate` names, `ValidateResponse{ok,failed_step_index,error_message,validation}`, nullable `distinct`/`distinct_row_count` consistent across backend schemas, frontend types, and UI null-guards.
- **No placeholders:** all steps have concrete code/commands.
