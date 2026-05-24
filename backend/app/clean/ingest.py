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
