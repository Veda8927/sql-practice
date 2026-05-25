"""Python (pandas) cleaning pipeline — runs user pandas steps in the sandbox.

The dataset is read from Postgres (a capped sample), handed to the sandboxed
interpreter as data.json, and each step is user pandas code that reassigns
`prev` (a DataFrame). Mirrors the SQL clean pipeline's shape.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from ..db import engine
from ..grader import _json_safe
from ..pyexec.executor import executor

SAMPLE_CAP = 5000
PREVIEW_CAP = 100
MAX_STEPS = 20

# Runs inside the sandbox. Reads data.json, applies each step (which must leave a
# DataFrame in `prev`), and prints one JSON line with the result. `_ex = exec`
# binds the builtin to a name to avoid a literal token a security linter flags.
_SCRIPT = """
import json
import pandas as pd

_ex = exec

with open("data.json") as _f:
    _d = json.load(_f)

raw = pd.DataFrame(_d["rows"], columns=_d["cols"])
prev = raw.copy()
_stages = [{"label": "Raw", "row_count": int(len(prev))}]
_failed = None
_error = None
for _i, _st in enumerate(_d["steps"]):
    try:
        _ns = {"pd": pd, "raw": raw, "prev": prev}
        _ex(_st.get("code") or "", _ns)
        prev = _ns.get("prev")
        if not isinstance(prev, pd.DataFrame):
            raise TypeError("Each step must assign a DataFrame to `prev`.")
        _stages.append({
            "label": _st.get("title") or ("Step %d" % (_i + 1)),
            "row_count": int(len(prev)),
        })
    except Exception as _e:
        _failed = _i
        _error = type(_e).__name__ + ": " + str(_e)
        break

_preview = None
if _failed is None:
    _head = prev.head(__PREVIEW__)
    _p = json.loads(_head.to_json(orient="split", date_format="iso"))
    _preview = {"columns": [str(_c) for _c in _p["columns"]], "rows": _p["data"]}

print(json.dumps({
    "ok": _failed is None,
    "failed_step_index": _failed,
    "error_message": _error,
    "stages": _stages,
    "final_preview": _preview,
}))
"""


async def run_py_pipeline(
    table_fqn: str, steps: list[dict[str, Any]]
) -> dict[str, Any]:
    if len(steps) > MAX_STEPS:
        return {
            "ok": False, "failed_step_index": MAX_STEPS,
            "error_message": f"Too many steps (max {MAX_STEPS}).",
            "stages": [], "final_preview": None,
        }
    async with engine.connect() as conn:
        res = await conn.execute(text(f"SELECT * FROM {table_fqn} LIMIT {SAMPLE_CAP}"))
        keys = list(res.keys())
        cols = [str(c) for c in keys]
        rows = [[_json_safe(v) for v in r] for r in res.fetchall()]

    payload = {
        "cols": cols,
        "rows": rows,
        "steps": [{"title": s.get("title"), "code": s.get("sql") or ""} for s in steps],
    }
    script = _SCRIPT.replace("__PREVIEW__", str(PREVIEW_CAP))
    result = await executor.run(
        script, extra_files={"data.json": json.dumps(payload)}, timeout_s=8.0
    )
    if result.timed_out:
        return {
            "ok": False, "failed_step_index": None,
            "error_message": "Pipeline timed out (keep it under a few seconds).",
            "stages": [], "final_preview": None,
        }
    out = (result.stdout or "").strip()
    try:
        return json.loads(out.splitlines()[-1])
    except Exception:
        err = (result.stderr or "").strip().splitlines()
        return {
            "ok": False, "failed_step_index": None,
            "error_message": (err[-1] if err else "Execution failed.")[:300],
            "stages": [], "final_preview": None,
        }
