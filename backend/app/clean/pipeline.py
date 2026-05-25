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
EXPORT_CAP = 200_000
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


async def _profile(conn, relation: str, index: int, label: str, full: bool = True) -> dict[str, Any]:
    """Profile a relation. `full` adds the expensive distinct stats (raw + final only)."""
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
            (
                await conn.execute(
                    text(f"SELECT COUNT(*) c FROM (SELECT DISTINCT * FROM {relation}) s")
                )
            ).scalar_one()
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
        "index": index,
        "label": label,
        "row_count": n,
        "distinct_row_count": distinct_rows,
        "columns": cols,
    }


async def _execute_stages(
    conn, table_fqn: str, steps: list[dict[str, Any]], limit: int
) -> tuple[int | None, str | None]:
    """Build raw + prev views and materialize steps[0:limit], repointing prev each step.
    Returns (failed_index, error_message). The caller owns the transaction + rollback."""
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
            await conn.exec_driver_sql(
                f'CREATE TEMP VIEW prev AS SELECT * FROM "_stage_{i + 1}"'
            )
        except Exception as e:  # noqa: BLE001 - surface DB message to user
            return i, _format_db_error(e)
    return None, None


async def _run_rules(conn, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run enabled rules against `prev` with per-rule savepoints."""
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
            out.append({"id": rid, "label": label, "status": "error",
                        "violations": 0, "message": str(e)})
            continue
        sp = await conn.begin_nested()
        try:
            v = int((await conn.execute(text(vsql), vparams)).scalar_one())
            await sp.commit()
            out.append({"id": rid, "label": label,
                        "status": "pass" if v == 0 else "fail",
                        "violations": v, "message": None})
        except Exception as e:  # noqa: BLE001
            await sp.rollback()
            out.append({"id": rid, "label": label, "status": "error",
                        "violations": 0, "message": _format_db_error(e)})
    return out


async def run_pipeline(
    table_fqn: str,
    steps: list[dict[str, Any]],
    rules: list[dict[str, Any]],
    up_to_index: int | None = None,
) -> dict[str, Any]:
    """Execute steps[0:limit] from raw, profiling each stage; validate the final stage.
    Full distinct stats are computed for the raw and final stages only (tiered)."""
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
            stages.append(await _profile(conn, "prev", 0, "Raw", full=True))

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
                    stages.append(
                        await _profile(conn, "prev", i + 1, title, full=(i == limit - 1))
                    )
                except Exception as e:  # noqa: BLE001 - surface DB message to user
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

    return {
        "ok": failed is None,
        "failed_step_index": failed,
        "error_message": error,
        "final_preview": final_preview,
        "stages": stages,
        "validation": validation,
    }


async def export_pipeline(
    table_fqn: str, steps: list[dict[str, Any]]
) -> tuple[dict[str, Any] | None, str | None]:
    """Run the full pipeline and return the complete final-stage data (no preview
    cap) as {columns, rows} for CSV export. Returns (data, error)."""
    if len(steps) > MAX_STEPS:
        return None, f"Too many steps (max {MAX_STEPS})."
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            failed, error = await _execute_stages(conn, table_fqn, steps, len(steps))
            if failed is not None:
                return None, error
            res = await conn.execute(text(f"SELECT * FROM prev LIMIT {EXPORT_CAP}"))
            cols = list(res.keys())
            rows = [[_json_safe(v) for v in r] for r in res.fetchall()]
            return {"columns": cols, "rows": rows}, None
        finally:
            await trans.rollback()


async def validate_pipeline(
    table_fqn: str,
    steps: list[dict[str, Any]],
    rules: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the pipeline to the final stage (no profiling, no preview) and run rules.
    The fast path for rule changes after a successful run."""
    if len(steps) > MAX_STEPS:
        return {
            "ok": False, "failed_step_index": MAX_STEPS,
            "error_message": f"Too many steps (max {MAX_STEPS}).", "validation": [],
        }

    failed: int | None = None
    error: str | None = None
    validation: list[dict[str, Any]] = []

    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            failed, error = await _execute_stages(conn, table_fqn, steps, len(steps))
            if failed is None:
                validation = await _run_rules(conn, rules)
        finally:
            await trans.rollback()

    return {
        "ok": failed is None,
        "failed_step_index": failed,
        "error_message": error,
        "validation": validation,
    }
