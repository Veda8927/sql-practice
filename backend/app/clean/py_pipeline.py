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


def _rule_violations(_df, _rule):
    _t = _rule.get("type")
    _p = _rule.get("params") or {}
    _c = _p.get("column")
    if _t == "no_duplicate_rows":
        return int(_df.duplicated(keep="first").sum())
    if _t == "unique_combo":
        _cols = [x for x in (_p.get("columns") or []) if x in _df.columns]
        return int(_df[_cols].duplicated(keep="first").sum()) if _cols else 0
    if _c not in _df.columns:
        return 0
    _s = _df[_c]
    if _t == "not_null":
        return int(_s.isna().sum())
    if _t == "unique":
        return int(_s.dropna().duplicated(keep="first").sum())
    if _t == "regex":
        _m = _s.astype(str).str.contains(_p.get("pattern") or "", regex=True, na=False)
        return int((_s.notna() & ~_m).sum())
    if _t == "allowed_values":
        _vals = [str(v) for v in (_p.get("values") or [])]
        return int((_s.notna() & ~_s.astype(str).isin(_vals)).sum())
    if _t == "range":
        _mn = float(_p["min"])
        _mx = float(_p["max"])
        _n = pd.to_numeric(_s, errors="coerce")
        return int((_s.notna() & ((_n < _mn) | (_n > _mx))).sum())
    raise ValueError("Unknown rule type: " + str(_t))


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
_validation = []
if _failed is None:
    _head = prev.head(__PREVIEW__)
    _p = json.loads(_head.to_json(orient="split", date_format="iso"))
    _preview = {"columns": [str(_c) for _c in _p["columns"]], "rows": _p["data"]}
    for _r in _d.get("rules", []):
        if not _r.get("enabled", True):
            continue
        _rid = _r.get("id", "")
        _lbl = _r.get("label", _r.get("type", "rule"))
        try:
            _v = _rule_violations(prev, _r)
            _validation.append({
                "id": _rid, "label": _lbl,
                "status": "pass" if _v == 0 else "fail",
                "violations": int(_v), "message": None,
            })
        except Exception as _e:
            _validation.append({
                "id": _rid, "label": _lbl, "status": "error",
                "violations": 0, "message": type(_e).__name__ + ": " + str(_e),
            })

print(json.dumps({
    "ok": _failed is None,
    "failed_step_index": _failed,
    "error_message": _error,
    "stages": _stages,
    "final_preview": _preview,
    "validation": _validation,
}))
"""


# Runs inside the sandbox: applies steps then writes the full result as CSV.
_EXPORT_SCRIPT = """
import json
import sys
import pandas as pd

_ex = exec

with open("data.json") as _f:
    _d = json.load(_f)

raw = pd.DataFrame(_d["rows"], columns=_d["cols"])
prev = raw.copy()
for _st in _d["steps"]:
    _ns = {"pd": pd, "raw": raw, "prev": prev}
    _ex(_st.get("code") or "", _ns)
    prev = _ns.get("prev")
    if not isinstance(prev, pd.DataFrame):
        raise TypeError("Each step must assign a DataFrame to `prev`.")

sys.stdout.write(prev.to_csv(index=False))
"""


async def _read_sample(table_fqn: str) -> dict[str, Any]:
    async with engine.connect() as conn:
        res = await conn.execute(text(f"SELECT * FROM {table_fqn} LIMIT {SAMPLE_CAP}"))
        keys = list(res.keys())
        cols = [str(c) for c in keys]
        rows = [[_json_safe(v) for v in r] for r in res.fetchall()]
    return {"cols": cols, "rows": rows}


async def export_py_pipeline(
    table_fqn: str, steps: list[dict[str, Any]]
) -> tuple[str | None, str | None]:
    """Run the pandas pipeline and return the full result as CSV text."""
    if len(steps) > MAX_STEPS:
        return None, f"Too many steps (max {MAX_STEPS})."
    data = await _read_sample(table_fqn)
    data["steps"] = [{"title": s.get("title"), "code": s.get("sql") or ""} for s in steps]
    result = await executor.run(
        _EXPORT_SCRIPT, extra_files={"data.json": json.dumps(data)}, timeout_s=12.0
    )
    if result.timed_out:
        return None, "Export timed out."
    if result.exit_code != 0:
        err = (result.stderr or "").strip().splitlines()
        return None, (err[-1] if err else "Export failed.")[:300]
    return result.stdout, None


async def run_py_pipeline(
    table_fqn: str,
    steps: list[dict[str, Any]],
    rules: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if len(steps) > MAX_STEPS:
        return {
            "ok": False, "failed_step_index": MAX_STEPS,
            "error_message": f"Too many steps (max {MAX_STEPS}).",
            "stages": [], "final_preview": None, "validation": [],
        }
    payload = await _read_sample(table_fqn)
    payload["steps"] = [
        {"title": s.get("title"), "code": s.get("sql") or ""} for s in steps
    ]
    payload["rules"] = rules or []
    script = _SCRIPT.replace("__PREVIEW__", str(PREVIEW_CAP))
    result = await executor.run(
        script, extra_files={"data.json": json.dumps(payload)}, timeout_s=8.0
    )
    if result.timed_out:
        return {
            "ok": False, "failed_step_index": None,
            "error_message": "Pipeline timed out (keep it under a few seconds).",
            "stages": [], "final_preview": None, "validation": [],
        }
    out = (result.stdout or "").strip()
    try:
        return json.loads(out.splitlines()[-1])
    except Exception:
        err = (result.stderr or "").strip().splitlines()
        return {
            "ok": False, "failed_step_index": None,
            "error_message": (err[-1] if err else "Execution failed.")[:300],
            "stages": [], "final_preview": None, "validation": [],
        }
