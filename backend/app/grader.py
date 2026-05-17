"""SQL grader: executes user + reference SQL, compares results."""
from __future__ import annotations

import re
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import text

from .db import engine
from .schemas import GradeResult, TableResult

DDL_PATTERN = re.compile(r"\b(DROP|TRUNCATE|ALTER|CREATE)\b", re.IGNORECASE)


async def grade(user_sql: str, reference_sql: str, ordered: bool) -> GradeResult:
    if DDL_PATTERN.search(user_sql):
        return GradeResult(
            status="error",
            error_message="DDL statements are not allowed.",
        )

    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            await conn.execute(text("SET LOCAL statement_timeout = '5s'"))

            # Execute user SQL
            try:
                user_result = await conn.execute(text(user_sql))
                user_columns = list(user_result.keys())
                user_rows = [tuple(r) for r in user_result.fetchall()]
            except Exception as e:
                return GradeResult(
                    status="error",
                    error_message=_format_db_error(e),
                )

            # Execute reference SQL
            try:
                ref_result = await conn.execute(text(reference_sql))
                ref_columns = list(ref_result.keys())
                ref_rows = [tuple(r) for r in ref_result.fetchall()]
            except Exception as e:
                # This is a problem with the generated question, not the user.
                return GradeResult(
                    status="error",
                    error_message=f"Reference query failed: {_format_db_error(e)}",
                )
        finally:
            await trans.rollback()

    user_output = TableResult(
        columns=user_columns,
        rows=[[_json_safe(v) for v in row] for row in user_rows],
    )
    expected_output = TableResult(
        columns=ref_columns,
        rows=[[_json_safe(v) for v in row] for row in ref_rows],
    )

    status = _compare(user_columns, user_rows, ref_columns, ref_rows, ordered)

    return GradeResult(
        status=status,
        user_output=user_output,
        expected_output=expected_output,
    )


def _compare(
    user_cols: list[str],
    user_rows: list[tuple],
    ref_cols: list[str],
    ref_rows: list[tuple],
    ordered: bool,
) -> str:
    user_cols_lower = [c.lower() for c in user_cols]
    ref_cols_lower = [c.lower() for c in ref_cols]

    if sorted(user_cols_lower) != sorted(ref_cols_lower):
        return "wrong"

    if len(user_rows) != len(ref_rows):
        return "wrong"

    # Build canonical column order (sorted lowercase). Project both row sets
    # into that order so comparison is alignment-safe.
    canon = sorted(ref_cols_lower)
    user_idx = [user_cols_lower.index(c) for c in canon]
    ref_idx = [ref_cols_lower.index(c) for c in canon]

    def project(rows: list[tuple], idx: list[int]) -> list[tuple]:
        return [tuple(_normalize_cell(r[i]) for i in idx) for r in rows]

    u = project(user_rows, user_idx)
    r = project(ref_rows, ref_idx)

    if not ordered:
        u = sorted(u, key=_sort_key)
        r = sorted(r, key=_sort_key)

    return "correct" if u == r else "wrong"


def _normalize_cell(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, Decimal):
        return round(float(v), 4)
    if isinstance(v, float):
        return round(v, 4)
    if isinstance(v, int):
        return v
    return v


def _sort_key(row: tuple) -> tuple:
    # NULLs sort first; otherwise sort by (type_name, repr) to handle mixed types.
    return tuple((v is None, type(v).__name__, repr(v)) for v in row)


def _json_safe(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime, time)):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray)):
        return v.decode("utf-8", errors="replace")
    return v


def _format_db_error(e: Exception) -> str:
    msg = str(e)
    # SQLAlchemy wraps with "(psycopg.errors.X) ..." — strip the prefix for readability.
    m = re.search(r"\)\s*(.*?)(?:\n\[SQL:|$)", msg, re.DOTALL)
    if m:
        cleaned = m.group(1).strip()
        if cleaned:
            return cleaned
    return msg.split("\n")[0]
