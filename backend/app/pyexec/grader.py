"""Grade Python submissions by running an entrypoint against test cases in the sandbox.

The harness body is static; user code is concatenated and the entrypoint name + test
cases are passed as JSON side-files (no string interpolation of untrusted data into the
harness source). Results are emitted on a single marker line so user prints can't corrupt
them.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .executor import executor

_MARKER = "___PYRESULT___"

_FUNC_PREFIX = """\
import json, io, contextlib


def _normalize(v):
    if isinstance(v, (list, tuple)):
        return [_normalize(x) for x in v]
    if isinstance(v, dict):
        return {k: _normalize(x) for k, x in v.items()}
    if isinstance(v, float):
        return round(v, 6)
    return v

# ===== user code =====
"""

_FUNC_SUFFIX = """
# ===== end user code =====
_meta = json.load(open("meta.json"))
_tests = json.load(open("tests.json"))
_fn = globals().get(_meta["entrypoint"])
_out = []
for _tc in _tests:
    _buf = io.StringIO()
    if _fn is None or not callable(_fn):
        _out.append({"pass": False, "error": "Define a function named " + repr(_meta["entrypoint"]), "stdout": ""})
        continue
    try:
        with contextlib.redirect_stdout(_buf):
            _got = _fn(*_tc.get("args", []), **_tc.get("kwargs", {}))
        _ok = _normalize(_got) == _normalize(_tc.get("expected"))
        _out.append({"pass": bool(_ok), "got": repr(_got), "expected": repr(_tc.get("expected")), "stdout": _buf.getvalue()})
    except Exception as _e:
        _out.append({"pass": False, "error": type(_e).__name__ + ": " + str(_e), "stdout": _buf.getvalue()})
print("___PYRESULT___" + json.dumps({"tests": _out}))
"""

_SCRIPT_HARNESS = """\
import json, io, sys, contextlib, runpy

_cases = json.load(open("tests.json"))
_out = []
for _tc in _cases:
    _buf = io.StringIO()
    sys.stdin = io.StringIO(_tc.get("stdin", ""))
    try:
        with contextlib.redirect_stdout(_buf):
            runpy.run_path("user_code.py", run_name="__main__")
        _got = _buf.getvalue()
        _exp = _tc.get("expected_stdout") or ""
        _out.append({"pass": _got.strip() == _exp.strip(), "got": _got, "expected": _exp, "stdout": _got})
    except Exception as _e:
        _out.append({"pass": False, "error": type(_e).__name__ + ": " + str(_e), "stdout": _buf.getvalue()})
print("___PYRESULT___" + json.dumps({"tests": _out}))
"""


@dataclass
class TestResult:
    index: int
    passed: bool
    got: str | None
    expected: str | None
    stdout: str
    error: str | None


@dataclass
class GradeResult:
    status: str  # correct | wrong | error
    tests: list[TestResult]
    passed: int
    total: int
    error_message: str | None
    duration_ms: float


def build_function_harness(user_code: str, entrypoint: str, test_cases: list[dict[str, Any]]):
    main = _FUNC_PREFIX + user_code + _FUNC_SUFFIX
    files = {
        "meta.json": json.dumps({"entrypoint": entrypoint or "main"}),
        "tests.json": json.dumps(test_cases),
    }
    return main, files


def build_script_harness(user_code: str, test_cases: list[dict[str, Any]]):
    files = {"tests.json": json.dumps(test_cases), "user_code.py": user_code}
    return _SCRIPT_HARNESS, files


async def grade(code: str, exercise: dict[str, Any]) -> GradeResult:
    kind = exercise.get("kind", "function")
    cases = exercise.get("test_cases", []) or []
    if kind == "script":
        main, files = build_script_harness(code, cases)
    else:
        main, files = build_function_harness(code, exercise.get("entrypoint") or "main", cases)

    res = await executor.run(main, extra_files=files)

    if res.timed_out:
        return GradeResult("error", [], 0, len(cases),
                           "Your code ran too long and was stopped.", res.duration_ms)

    line = next((ln for ln in res.stdout.splitlines() if ln.startswith(_MARKER)), None)
    if line is None:
        tail = res.stderr.strip().splitlines()
        msg = tail[-1] if tail else "Your code could not be run."
        return GradeResult("error", [], 0, len(cases), msg, res.duration_ms)

    data = json.loads(line[len(_MARKER):])
    tests = [
        TestResult(i, bool(t.get("pass")), t.get("got"), t.get("expected"),
                   t.get("stdout", ""), t.get("error"))
        for i, t in enumerate(data.get("tests", []))
    ]
    passed = sum(1 for t in tests if t.passed)
    status = "correct" if tests and passed == len(tests) else "wrong"
    return GradeResult(status, tests, passed, len(tests), None, res.duration_ms)
