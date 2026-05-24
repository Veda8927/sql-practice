# Python Mode Phase 1 (Executor + Practice) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`. Full code/contracts in the spec: `docs/superpowers/specs/2026-05-24-python-mode-phase1-design.md`.

**Goal:** Python Practice mode — hardened server-side executor (sandbox-exec), test-case grading, AI + curated exercises, Monaco UI. Mirrors SQL Practice.

**Notes:** Work on `main`, atomic green commits. Sandbox verified (network + out-of-tmp writes blocked). The executor uses `asyncio` subprocess (execFile-style argv list, never a shell string) — no shell injection surface.

---

### Task 1: Config + executor (TDD)
Files: `config.py` (add `python_bin=""`, `pyexec_timeout_s=6.0`), `pyexec/__init__.py`, `pyexec/executor.py`, `tests/test_pyexec.py`.
- `ExecResult` dataclass {stdout, stderr, exit_code, timed_out, duration_ms, sandboxed}.
- `PyExecutor` Protocol `run(code, *, extra_files=None, timeout_s=None)`.
- `SandboxExecutor`: mkdtemp; write `main.py` (rlimit bootstrap + code) + extra files; argv = `[sandbox-exec, -p, profile, python, main.py]` (or bare python if no sandbox-exec); `asyncio.create_subprocess_exec`, cwd=tmp, minimal env (HOME/TMPDIR=tmp), `start_new_session=True`; wall-clock timeout via `wait_for` → kill process group; rmtree cleanup. Seatbelt profile: deny default, allow process/file-read/sysctl/mach/ipc/signal, file-write only under tmp, deny network. rlimit bootstrap sets CPU=4s, FSIZE=8MB, AS=1GB best-effort.
- Module singleton `executor = SandboxExecutor()`.
- Tests: normal code → "hi 4"; infinite loop timeout_s=2 → timed_out; extra_files readable; network attempt blocked when sandboxed (else skip).
- Verify `uv run pytest tests/test_pyexec.py -q` + ruff. Commit `feat(py): hardened sandbox executor`.

### Task 2: Grader + harness (TDD)
Files: `pyexec/grader.py`, `tests/test_pygrader.py`.
- Marker `___PYRESULT___`. Function harness: inject user code, read `tests.json` (via extra_files, no string interpolation of data), call `entrypoint(*args, **kwargs)` per case with stdout redirect, compare via `_normalize` (tuple→list recursive, round floats 6dp), emit marker+JSON {tests:[{pass,got,expected,stdout,error}]}. Script harness: run code feeding stdin, compare trimmed stdout to expected_stdout.
- `TestResult`, `GradeResult{status correct|wrong|error, tests, passed, total, error_message, duration_ms}`.
- `build_function_harness`, `build_script_harness`, `async grade(code, exercise)`: pick harness by `kind`, run via executor, parse marker line; timed_out → error "ran too long"; no marker → error with last stderr line.
- Tests: correct/wrong/exception/syntax-error/tuple-vs-list/script-mode.
- Verify + commit `feat(py): test-case grader + sandboxed harness`.

### Task 3: Pydantic schemas + session state
Files: `pyschemas.py` (new), `state.py` (edit).
- Models per spec: `PyTestCase, PyExercise, PyTestResult, PyNewQuestionRequest, PyQuestionResponse (no reference/expected; has test_count), PyRunRequest, PyRunResponse, PySubmitRequest, PyGradeResult, PyHintRequest, PyHintResponse, PyExplainResponse, PySolutionStep, PyGiveUpResponse, LoadPyCuratedRequest`.
- `SessionState`: add `py_current: dict|None=None`, `py_last_grade: dict|None=None`.
- Import check + commit `feat(py): pydantic schemas + session slots`.

### Task 4: LLM generation + helpers
Files: `llm.py` (append).
- `generate_python_question(concept, difficulty, recent_prompts)` → JSON exercise (prompt, starter_code, entrypoint, reference_solution, kind, test_cases, concepts, difficulty); system prompt requires deterministic pure-Python tests and a reference that passes them. `python_hint`, `explain_python_mistake`, `explain_python_solution` mirror SQL versions (json_object mode, key defaults).
- Import check + commit `feat(py): LLM python generation + coaching`.

### Task 5: Routes + main wiring
Files: `pyroutes.py` (new `APIRouter(prefix="/api/py")`), `main.py` (include).
- `/new_question` (generate → validate by grading reference, retry once, store py_current → PyQuestionResponse), `/run` (executor.run → stdout/stderr), `/submit` (grade vs py_current, store py_last_grade), `/hint`, `/explain`, `/give_up`, `/curated/load` (register client exercise as py_current). `SessionDep` from `..deps`.
- Boot check, full `uv run pytest -q && uv run ruff check app`, commit `feat(py): /api/py routes + wiring`.

### Task 6: Backend curl smoke (verify only)
- `/curated/load` an add(a,b) exercise → `/run` → `/submit` correct + wrong → check JSON. `/new_question` if OPENAI key present.

### Task 7: Frontend types + api + curated loader
Files: `lib/python-types.ts`, `lib/python-api.ts`, `lib/python-curated.ts`.
- TS mirrors; api client (credentials include) for `/api/py/*`; curated loader from `@/data/py-questions/index.json`. tsc clean. Commit.

### Task 8: Curated starter bank
Files: `data/py-questions/index.json` + per-concept JSON.
- ~12–15 exercises (basics, strings, lists, dicts, conditionals, loops, functions): full `PyExercise` + hints + solution_steps. Validate each reference passes its tests (scratch grader run). Commit.

### Task 9: Python components
Files: `components/python/{python-view,py-editor,test-results,py-prompt}.tsx`.
- Monaco python editor; test-results panel (per-case pass/fail, got vs expected, stdout, error, passed/total); prompt + badges; orchestrator (AI/Curated toggle, concept+difficulty selectors, New exercise, Run/Submit, hint/explain/give-up cards, resizable panels, minimal aesthetic). tsc + lint clean. Commit.

### Task 10: Wire Python mode
Files: `app/page.tsx`.
- Add `"python"` to `mode`; Python pill (Code2 icon); render branch. tsc + lint. Commit.

### Task 11: Verification
- Backend green; frontend green; browser dogfood (Run, Submit pass+fail, AI+curated, hint, SQL modes intact). Fix-ups committed.

---
**Self-review:** spec-covered (executor T1, grader T2, schemas/state T3, LLM T4, routes T5, content T8, FE T7/T9/T10, security T1, tests T1/T2/T6/T11); names consistent (PyExercise/PyTestCase/GradeResult/entrypoint/kind/test_cases, marker contract); no placeholders — full code is in the spec + executed per task.
