"""Validate curated question JSON files by executing them against Postgres.

For each question:
  1. Create an isolated schema (tmp_<uuid>).
  2. SET search_path to that schema.
  3. Execute schema_setup_sql.
  4. Execute reference_solution_sql.
  5. Diff result columns + rows against expected_output (respecting ordered_results).
  6. DROP SCHEMA CASCADE.

Usage: python -m scripts.validate_curated frontend/src/data/questions/joins.json
"""

from __future__ import annotations

import json
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg


def normalize(v: Any) -> Any:
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()[:10] if isinstance(v, date) and not isinstance(v, datetime) else v.isoformat()
    return v


def run_question(conn: psycopg.Connection, q: dict) -> list[str]:
    errors: list[str] = []
    schema_name = f"curated_test_{uuid.uuid4().hex[:8]}"
    with conn.cursor() as cur:
        cur.execute(f'CREATE SCHEMA "{schema_name}"')
        cur.execute(f'SET search_path TO "{schema_name}"')
        try:
            cur.execute(q["schema_setup_sql"])
            cur.execute(q["reference_solution_sql"])
            cols = [d[0] for d in cur.description]
            rows = [[normalize(v) for v in r] for r in cur.fetchall()]

            exp_cols = q["expected_output"]["columns"]
            exp_rows = [[normalize(v) for v in r] for r in q["expected_output"]["rows"]]

            if cols != exp_cols:
                errors.append(f"column mismatch: got {cols}, expected {exp_cols}")

            if q["ordered_results"]:
                if rows != exp_rows:
                    errors.append(f"row mismatch (ordered):\n  got:      {rows}\n  expected: {exp_rows}")
            else:
                gset = sorted([tuple(r) for r in rows])
                eset = sorted([tuple(r) for r in exp_rows])
                if gset != eset:
                    errors.append(f"row mismatch (set):\n  got:      {gset}\n  expected: {eset}")
        finally:
            cur.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
    conn.commit()
    return errors


def main(path: str) -> int:
    data = json.loads(Path(path).read_text())
    dsn = "postgresql://postgres:postgres@localhost:5433/sqlpractice"
    failures = 0
    with psycopg.connect(dsn, autocommit=False) as conn:
        for q in data:
            errs = run_question(conn, q)
            if errs:
                failures += 1
                print(f"✗ {q['id']} ({q['subconcept']})")
                for e in errs:
                    print(f"    {e}")
            else:
                print(f"✓ {q['id']} ({q['subconcept']})")
    print(f"\n{len(data) - failures}/{len(data)} passed")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "frontend/src/data/questions/joins.json"))
