# Python Mode — Phase 1 (Executor + Practice) — Design

**Date:** 2026-05-24
**Status:** Approved
**Scope:** Add a new top-level **Python** mode to the app, Phase 1 = a hardened server-side Python executor + a graded Practice experience (AI + curated), mirroring the SQL Practice mode. Phase 2 (Python Learn syllabus) is a separate cycle.

## Decisions (from brainstorming)
- Experience: **Both** Learn + Practice (Phase 1 = Practice; Phase 2 = Learn).
- Execution: **hardened server-side now, behind a swappable `PyExecutor` interface** (Pyodide can replace it later).
- Content: **AI + Curated toggle** (like the SQL app).
- IA: one new header pill **Python** → self-contained `PythonView` (Phase 1 renders Practice; Phase 2 adds a Learn sub-tab). Existing SQL modes untouched.

## Security model (validated)
User Python runs in `sandbox-exec` (macOS Seatbelt) with a profile that **denies network and denies filesystem writes outside a per-run temp dir**, plus a wall-clock timeout (process-group kill), `RLIMIT_CPU`, best-effort `RLIMIT_AS`/`RLIMIT_FSIZE`, stripped env, isolated cwd. Verified locally: normal code runs; `socket.create_connection` → PermissionError; writing outside temp → PermissionError. Marked **local-use-only**; if the sandbox binary is missing, fall back to timeout + rlimits and surface a degraded-mode warning.

## Backend

### Package `backend/app/pyexec/`
- `executor.py`
  - `@dataclass ExecResult{stdout: str, stderr: str, exit_code: int, timed_out: bool, duration_ms: float, sandboxed: bool}`
  - `class PyExecutor(Protocol)`: `async def run(self, code: str, *, extra_files: dict[str,str] | None = None, timeout_s: float = 6.0) -> ExecResult`
  - `class SandboxExecutor`: writes `main.py` (= `code`) + any `extra_files` into a fresh `mkdtemp()`; builds the Seatbelt profile with the resolved temp path; runs `sandbox-exec -p <profile> <python> main.py` via `asyncio.create_subprocess_exec` with `cwd=tmp`, minimal `env` (`PATH`, `LC_*`, `HOME=tmp`), `start_new_session=True`; enforces `timeout_s` with `wait_for`, killing the process group on timeout; sets rlimits inside a small bootstrap prepended to `main.py` (CPU 4s, FSIZE 8MB, AS best-effort 1GB wrapped in try/except — macOS AS is unreliable). Always cleans up the temp dir. `sandboxed=False` + no `sandbox-exec` prefix when the binary is absent.
  - `PYTHON_BIN` from settings (`config.py`): default `sys.executable`.
  - Module-level `executor: PyExecutor = SandboxExecutor()` singleton.
- `grader.py`
  - `build_function_harness(user_code, entrypoint, test_cases) -> (main_code, extra_files)`: a harness that injects `user_code`, reads `tests.json`, calls `entrypoint(*args, **kwargs)` per case with `redirect_stdout` to capture user prints, compares via `_normalize` (tuples→lists recursively, round floats to 6dp), and prints `___PYRESULT___` + JSON `{tests:[{pass,got,expected,stdout,error}]}`. `tests.json` is written via `extra_files` (no string-injection of test data).
  - `build_script_harness(user_code, cases)`: for `kind="script"` — runs the code feeding each case's `stdin` and compares trimmed stdout to `expected_stdout`.
  - `async def grade(code, exercise) -> GradeResult`: picks harness by `exercise.kind`, runs via `executor`, parses the marker line. If the marker is absent → `status="error"` with the cleaned stderr (syntax/runtime failure before tests). `GradeResult{status: "correct"|"wrong"|"error", tests: list[TestResult], passed, total, error_message, stdout, duration_ms}`.

### Schemas `backend/app/pyschemas.py` (new, to keep `schemas.py` SQL-focused)
- `PyTestCase{args: list[Any] = [], kwargs: dict[str,Any] = {}, expected: Any = None, stdin: str = "", expected_stdout: str | None = None}`
- `PyExercise{id, concept, difficulty: easy|medium|hard, kind: "function"|"script" = "function", prompt, starter_code, entrypoint: str | None, reference_solution, test_cases: list[PyTestCase]}`
- `PyTestResult{index, passed: bool, got: str | None, expected: str | None, stdout: str, error: str | None}`
- Requests/responses: `PyNewQuestionRequest{concept?, difficulty?}`, `PyQuestionResponse` (exercise minus `reference_solution`/expected leakage — but include test inputs so the UI can show "n tests"; hide `expected` until graded? Keep it simple: return prompt, starter_code, entrypoint, concept, difficulty, kind, test count only), `PyRunRequest{code}`, `PyRunResponse{stdout, stderr, timed_out, duration_ms}`, `PyGradeResult{...}` , `PySubmitRequest{code}`, `PyHintRequest{code?}`, `PyHintResponse{hint, suggested_code?}`, `PyExplainResponse{explanation}`, `PyGiveUpResponse{reference_solution, summary, steps:[{title, what_it_does, code, how_it_runs}], final_thought}`, `LoadPyCuratedRequest` (full curated exercise payload, like SQL).

### Routes `backend/app/pyroutes.py` (new `APIRouter(prefix="/api/py")`), included in `main.py`
- `POST /new_question` → `llm.generate_python_question(...)`, then **validate**: run `grade(reference_solution, exercise)`; if not all pass, retry once, else 502. Store on `state.py_current`. Return `PyQuestionResponse`.
- `POST /run` → `executor.run(code)` → stdout/stderr (the Run button; no tests). Read-only of nothing; just execution.
- `POST /submit` → `grade(code, state.py_current)`; store last result. 400 if no active exercise.
- `POST /hint`, `/explain`, `/give_up` → LLM helpers (reuse `llm.py` client patterns).
- `POST /curated/load` → register a client-supplied curated `PyExercise` as `state.py_current` (no LLM), like SQL `curated/load`.
- Session: add `py_current: PyExercise | None` and `py_last_grade` to `SessionState` (store as dicts/dataclass in `state.py`, consistent with existing).

### LLM `backend/app/llm.py`
- `generate_python_question(concept, difficulty, recent_prompts) -> dict` with a system prompt instructing: return JSON `{prompt, starter_code, entrypoint, reference_solution, kind, test_cases:[{args,kwargs,expected}], concepts, difficulty}`; the reference must pass all its own tests; tests must be deterministic, pure-Python, no I/O/network. `python_hint`, `explain_python_mistake`, `explain_python_solution` follow the SQL equivalents.

## Frontend

### Mode wiring `frontend/src/app/page.tsx`
- Extend `mode` union with `"python"`; add a **Python** pill (`Braces`/`Code2` lucide icon) in the header group; render `<PythonView />` when active (short-circuit branch like `clean`).

### Library
- `frontend/src/lib/python-types.ts` — TS mirrors of the Py schemas.
- `frontend/src/lib/python-api.ts` — client for `/api/py/*` (credentials include).
- `frontend/src/lib/python-curated.ts` — load curated bank from `@/data/py-questions/index.json` + per-concept JSON (mirror `curated.ts`).

### Components `frontend/src/components/python/`
- `python-view.tsx` — orchestrator: AI/Curated toggle, concept + difficulty selectors, "New exercise", Monaco Python editor, Run/Submit bar, resizable panels (prompt + editor | results), test-results panel, hint/explain/give-up cards. Reuses existing `ui/*`, `coach-card` styling, `react-resizable-panels`, sonner.
- `py-editor.tsx` — Monaco wrapper, `language="python"`, ⌘↵ = Run, ⌘↵-shift = Submit (or buttons).
- `test-results.tsx` — per-case pass/fail rows (got vs expected, captured stdout, error), summary `passed/total`, run stdout/stderr panel.
- `py-prompt.tsx` — renders the exercise prompt + concept/difficulty badges.

### Curated content `frontend/src/data/py-questions/`
- `index.json` + per-concept files. Seed ~12–15 starter exercises across: basics/variables, strings, lists, dicts, conditionals, loops, functions. Each is a full `PyExercise` (prompt, starter_code, entrypoint, reference_solution, test_cases) + hints + solution steps (for client-side give-up in curated mode, mirroring SQL).

## Data flow (Practice)
1. AI: New exercise → `/new_question` (LLM + reference validated in sandbox) → editor seeded with `starter_code`. Curated: pick from bank client-side → `/curated/load` registers it.
2. Run → `/run` → stdout/stderr panel (experiment freely).
3. Submit → `/submit` → grade in sandbox → per-test results + correct/wrong.
4. Hint/Explain/Give up → LLM (AI) or pre-baked (curated), like SQL.

## Error handling
- Timeout → result flagged `timed_out`, UI: "Your code ran longer than Ns and was stopped."
- Sandbox missing → degraded banner; still runs with timeout+rlimits.
- Syntax/runtime error before tests → `status="error"` + cleaned stderr shown in results.
- LLM failure → 502 → toast.

## Testing
- **Backend (pytest):** executor runs normal code; enforces timeout (infinite loop → timed_out); blocks network attempt; blocks out-of-tmp write; grader pass/fail + exception handling + normalized equality (tuple vs list, float); script-mode stdout compare; reference-validation path. Skip sandbox-specific assertions gracefully if `sandbox-exec` absent (CI safety) but assert execution + timeout always.
- **Frontend:** tsc + next lint; browser dogfood: Run prints output, Submit shows passing + failing cases, AI + curated both work, hint renders.

## Files (Phase 1)
- backend: `pyexec/__init__.py`, `pyexec/executor.py`, `pyexec/grader.py`, `pyschemas.py`, `pyroutes.py`, edits to `state.py`, `llm.py`, `main.py`, `config.py`; tests `tests/test_pyexec.py`, `tests/test_pygrader.py`.
- frontend: `lib/python-types.ts`, `lib/python-api.ts`, `lib/python-curated.ts`, `components/python/*`, `data/py-questions/*`, edit `app/page.tsx`.

## Out of scope (Phase 2+)
Python Learn syllabus, multi-file projects, third-party pip packages, stdin-interactive programs, turtle/plotting, performance profiling. Pyodide swap (interface is ready).
