"""Deterministic messy-dataset generator with a known issue rubric."""
from __future__ import annotations

import random
from typing import Any

HEADER = ["customer_id", "full_name", "email", "country", "signup_date", "spend", "status"]

_NAMES = ["Alice Smith", "Bob Jones", "Carla Diaz", "Dan Lee", "Eve Ng", "Frank Ito",
          "Grace Kim", "Hiro Tan", "Ivy Park", "Jack Roy"]
_COUNTRIES = ["USA", "U.S.A.", "united states", "Canada", "canada", "CA", "UK", "uk"]
_STATUSES = ["active", "ACTIVE", "Active", "inactive", "Inactive", "pending"]
_SENTINELS = [None, "", "N/A", "-", "unknown"]


def _messy_date(rng: random.Random, y: int, m: int, d: int) -> str:
    fmt = rng.choice(["{y}-{m:02d}-{d:02d}", "{m:02d}/{d:02d}/{y}", "{y}/{m}/{d}"])
    return fmt.format(y=y, m=m, d=d)


def _messy_money(rng: random.Random, amount: float) -> str:
    style = rng.choice(["${a:.2f}", "{a:.2f}", "{ai:,}", "$ {a:.0f}"])
    return style.format(a=amount, ai=int(amount))


def generate_messy(
    seed: int, n: int = 200
) -> tuple[list[str], list[list[Any]], list[dict[str, Any]]]:
    """Return (header, rows, rubric). All cells are strings/None (CSV-like)."""
    rng = random.Random(seed)
    rows: list[list[Any]] = []
    for i in range(n):
        name = rng.choice(_NAMES)
        if rng.random() < 0.3:  # whitespace + casing noise
            name = "  " + name.upper() + " " if rng.random() < 0.5 else name.lower()
        local = name.strip().lower().replace(" ", ".")
        email = (
            f"{local}@example.com"
            if rng.random() < 0.85
            else rng.choice(["bad-email", "x@", local])
        )
        country = rng.choice(_COUNTRIES)
        date = _messy_date(rng, rng.randint(2021, 2024), rng.randint(1, 12), rng.randint(1, 28))
        spend = _messy_money(rng, rng.uniform(-20, 5000))
        status = rng.choice(_STATUSES)
        row = [str(i + 1), name, email, country, date, spend, status]
        if rng.random() < 0.12:  # inject sentinels/nulls into one non-id column
            row[rng.randint(2, 6)] = rng.choice(_SENTINELS)
        rows.append(row)
    # duplicate ~8% of rows
    dupes = max(1, n // 12)
    for _ in range(dupes):
        rows.append(list(rng.choice(rows)))
    rng.shuffle(rows)

    rubric = [
        {"issue": "whitespace_casing", "column": "full_name",
         "description": "names have stray whitespace and inconsistent casing"},
        {"issue": "invalid_format", "column": "email",
         "description": "some emails are malformed"},
        {"issue": "inconsistent_categories", "column": "country",
         "description": "country labels vary (USA / U.S.A. / united states / CA)"},
        {"issue": "mixed_date_formats", "column": "signup_date",
         "description": "dates appear in several formats stored as text"},
        {"issue": "money_as_text", "column": "spend",
         "description": "spend has $, commas, and negatives; stored as text"},
        {"issue": "inconsistent_categories", "column": "status",
         "description": "status casing is inconsistent"},
        {"issue": "nulls_sentinels", "column": "*",
         "description": "missing values appear as NULL, '', 'N/A', '-', 'unknown'"},
        {"issue": "duplicate_rows", "column": "*",
         "description": "some rows are exact duplicates"},
    ]
    return HEADER, rows, rubric
