"""CSV ingestion: parse, sanitize identifiers, guess types, load, profile."""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from typing import Any

from sqlalchemy import text

from ..db import engine

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000
MAX_COLS = 60

_NON_IDENT = re.compile(r"[^a-z0-9_]+")
_INT_RE = re.compile(r"^-?\d+$")
_NUM_RE = re.compile(r"^-?\d+(\.\d+)?$")
_DATE_FMTS = ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y")
_BOOLS = {"true", "false", "t", "f", "yes", "no", "0", "1"}


def _one_ident(name: str) -> str:
    base = _NON_IDENT.sub("_", name.strip().lower()).strip("_")
    if not base:
        return "col"
    if not base[0].isalpha():
        base = "c_" + base
    return base[:60]


def sanitize_idents(names: list[str]) -> list[str]:
    """Map header names to unique, safe lowercase SQL identifiers (order preserved)."""
    used: set[str] = set()
    out: list[str] = []
    for n in names:
        cand = _one_ident(n)
        final = cand
        i = 1
        while final in used:
            final = f"{cand}_{i}"
            i += 1
        used.add(final)
        out.append(final)
    return out


def _looks_date(v: str) -> bool:
    for fmt in _DATE_FMTS:
        try:
            datetime.strptime(v, fmt)
            return True
        except ValueError:
            continue
    return False


def guess_type(values: list[str]) -> str:
    """Display-only type hint from non-empty sample values. Never enforced."""
    vals = [v.strip() for v in values if v is not None and v.strip() != ""]
    if not vals:
        return "text"
    if all(_INT_RE.match(v) for v in vals):
        return "integer"
    if all(_NUM_RE.match(v) for v in vals):
        return "numeric"
    if all(_looks_date(v) for v in vals):
        return "date"
    if all(v.lower() in _BOOLS for v in vals):
        return "boolean"
    return "text"


def parse_csv(raw: bytes) -> tuple[list[str], list[list[Any]]]:
    """Parse CSV bytes -> (header, rows). Empty cells become None. Enforces caps."""
    if len(raw) > MAX_BYTES:
        raise ValueError(f"File too large (max {MAX_BYTES // (1024 * 1024)} MB).")
    decoded = raw.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(decoded))
    all_rows = [r for r in reader if any(c.strip() for c in r)]
    if not all_rows:
        raise ValueError("The file has no rows.")
    header = [h.strip() for h in all_rows[0]]
    if len(header) == 0:
        raise ValueError("The file has no header row.")
    if len(header) > MAX_COLS:
        raise ValueError(f"Too many columns (max {MAX_COLS}).")
    width = len(header)
    data: list[list[Any]] = []
    for raw_row in all_rows[1 : MAX_ROWS + 1]:
        row = list(raw_row[:width]) + [""] * (width - len(raw_row))
        data.append([(c if c.strip() != "" else None) for c in row])
    return header, data


def _quote(ident: str) -> str:
    # idents come only from sanitize_idents (regex-restricted), so this is safe.
    return '"' + ident + '"'


async def load_dataset(table_fqn: str, idents: list[str], rows: list[list[Any]]) -> None:
    """(Re)create `table_fqn` in the clean schema with all-TEXT columns and insert rows."""
    cols_ddl = ", ".join(f"{_quote(i)} TEXT" for i in idents)
    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE SCHEMA IF NOT EXISTS clean")
        await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table_fqn}")
        await conn.exec_driver_sql(f"CREATE TABLE {table_fqn} ({cols_ddl})")
        if not rows:
            return
        placeholders = ", ".join(f":c{i}" for i in range(len(idents)))
        col_list = ", ".join(_quote(i) for i in idents)
        insert = text(f"INSERT INTO {table_fqn} ({col_list}) VALUES ({placeholders})")
        batch: list[dict[str, Any]] = []
        for row in rows:
            batch.append({f"c{i}": row[i] for i in range(len(idents))})
            if len(batch) >= 500:
                await conn.execute(insert, batch)
                batch = []
        if batch:
            await conn.execute(insert, batch)


async def profile_relation(relation: str, idents: list[str]) -> dict[str, Any]:
    """Return {row_count, distinct_row_count, columns:[{ident,non_null,nulls,distinct}]}."""
    select_parts = ["COUNT(*) AS n"]
    for idx, i in enumerate(idents):
        select_parts.append(f"COUNT({_quote(i)}) AS nn{idx}")
        select_parts.append(f"COUNT(DISTINCT {_quote(i)}) AS d{idx}")
    agg_sql = "SELECT " + ", ".join(select_parts) + f" FROM {relation}"
    async with engine.connect() as conn:
        agg = (await conn.execute(text(agg_sql))).mappings().first()
        distinct_rows = (
            await conn.execute(
                text(f"SELECT COUNT(*) AS c FROM (SELECT DISTINCT * FROM {relation}) s")
            )
        ).scalar_one()
    n = int(agg["n"])
    cols = []
    for idx, i in enumerate(idents):
        non_null = int(agg[f"nn{idx}"])
        cols.append(
            {
                "ident": i,
                "non_null": non_null,
                "nulls": n - non_null,
                "distinct": int(agg[f"d{idx}"]),
            }
        )
    return {"row_count": n, "distinct_row_count": int(distinct_rows), "columns": cols}


_EMAIL_HINT = re.compile(r".+@.+\..+")


def suggest_rules(profile: dict[str, Any], samples: dict[str, list[str]]) -> list[dict[str, Any]]:
    """Heuristic starter rules from the raw profile + per-column sample values."""
    n = profile["row_count"]
    out: list[dict[str, Any]] = []
    rid = 0
    for col in profile["columns"]:
        ident = col["ident"]
        if n > 0 and col["nulls"] == 0 and col["distinct"] == n:
            out.append({"id": f"r{rid}", "type": "unique", "label": f"{ident} is unique",
                        "params": {"column": ident}, "enabled": True})
            rid += 1
            out.append({"id": f"r{rid}", "type": "not_null", "label": f"{ident} has no nulls",
                        "params": {"column": ident}, "enabled": True})
            rid += 1
        col_samples = [s for s in samples.get(ident, []) if s]
        if col_samples and all(_EMAIL_HINT.match(s) for s in col_samples):
            out.append({"id": f"r{rid}", "type": "regex",
                        "label": f"{ident} looks like an email",
                        "params": {"column": ident, "pattern": r"^[^@\s]+@[^@\s]+\.[^@\s]+$"},
                        "enabled": True})
            rid += 1
    if profile["distinct_row_count"] < n:
        out.append({"id": f"r{rid}", "type": "no_duplicate_rows", "label": "No duplicate rows",
                    "params": {}, "enabled": True})
        rid += 1
    return out
