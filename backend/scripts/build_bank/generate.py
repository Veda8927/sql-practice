"""LLM batch generator for the curated SQL question bank.

For a given concept, calls OpenAI to draft N candidate CuratedQuestion entries,
executes each against Postgres in an isolated schema, replaces the LLM's
claimed expected_output with the actually-observed result, and writes survivors
to frontend/src/data/questions/<concept>.json.

Usage:
    python -m scripts.build_bank.generate subqueries --count 10
    python -m scripts.build_bank.generate joins --count 5 --append
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from decimal import Decimal
from datetime import date, datetime
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI

# Allow `python -m scripts.build_bank.generate` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from app.config import settings  # noqa: E402

import psycopg  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "frontend" / "src" / "data" / "questions"
JOINS_FEWSHOT_PATH = DATA_DIR / "joins.json"
INDEX_PATH = DATA_DIR / "index.json"

# Maps frontend concept slug -> human label for the prompt. Mirrors
# CONCEPT_CATEGORIES in frontend/src/components/question-bar.tsx.
CONCEPT_LABELS: dict[str, str] = {
    "joins": "Joins",
    "left_joins": "Left joins",
    "self_joins": "Self joins",
    "full_joins": "Full outer joins",
    "lateral_joins": "Lateral joins",
    "subqueries": "Subqueries",
    "correlated_subqueries": "Correlated subqueries",
    "exists": "EXISTS / NOT EXISTS",
    "set_operations": "Set operations (UNION, INTERSECT, EXCEPT)",
    "aggregations": "Aggregations (COUNT, SUM, AVG, MIN, MAX)",
    "distinct": "DISTINCT",
    "group_by": "GROUP BY",
    "having": "HAVING",
    "filter_clause": "FILTER clause on aggregates",
    "grouping_sets": "GROUPING SETS / ROLLUP / CUBE",
    "window_functions": "Window functions (OVER, PARTITION BY)",
    "cte": "CTEs (WITH)",
    "recursive_cte": "Recursive CTEs",
    "case_when": "CASE WHEN",
    "pivot": "Pivot / conditional aggregation",
    "date_functions": "Date functions",
    "string_functions": "String functions",
    "regex": "Regular expressions",
    "null_handling": "NULL handling (COALESCE, NULLIF, IS NULL)",
    "json_functions": "JSON / JSONB functions",
    "array_functions": "Array functions",
    "deduplication": "Deduplication",
    "type_casting": "Type casting",
    "data_validation": "Data validation",
    "standardization": "Standardization / cleanup",
}

CONCEPT_CATEGORY: dict[str, str] = {
    **{k: "query_patterns" for k in ["joins","left_joins","self_joins","full_joins","lateral_joins","subqueries","correlated_subqueries","exists","set_operations"]},
    **{k: "aggregation" for k in ["aggregations","distinct","group_by","having","filter_clause","grouping_sets"]},
    **{k: "advanced" for k in ["window_functions","cte","recursive_cte","case_when","pivot"]},
    **{k: "data_ops" for k in ["date_functions","string_functions","regex","null_handling","json_functions","array_functions"]},
    **{k: "data_cleaning" for k in ["deduplication","type_casting","data_validation","standardization"]},
}

# Domain hints for shard-based generation. Each shard call gets a distinct
# domain so the LLM can't default to the same e-commerce or healthcare schema
# every time. Order matters less than coverage.
DOMAINS: list[str] = [
    "e-commerce (customers, orders, products)",
    "logistics (warehouses, shipments, routes)",
    "music streaming (artists, albums, tracks, plays)",
    "education (students, courses, enrollments, grades)",
    "finance (accounts, transactions, holdings)",
    "healthcare (patients, doctors, visits, prescriptions)",
    "social network (users, posts, follows, likes)",
    "real estate (listings, agents, sales)",
    "gaming (players, matches, items, scores)",
    "sports analytics (teams, players, games, stats)",
    "ride-sharing (drivers, trips, riders, ratings)",
    "library system (books, members, loans)",
    "HR / payroll (employees, departments, salaries)",
    "airline reservations (flights, passengers, tickets)",
    "restaurants (menus, orders, reservations)",
]


SYSTEM_PROMPT = """You generate SQL interview-style practice questions in strict JSON.

Output rules:
- Reply with a JSON object: {"questions": [ ... ]} — nothing else, no markdown fences.
- Postgres dialect ONLY. No MySQL/SQL Server quirks.
- Each question MUST be fully self-contained: it ships its own schema + seed data.
- Schemas: 1 to 5 tables, 5-20 rows per table, deterministic (no random()).
- schema_setup_sql MUST start with DROP TABLE IF EXISTS ... CASCADE for every table it creates, in reverse-dependency order.
- reference_solution_sql MUST execute correctly against the schema and produce a deterministic result.
- expected_output: provide your best guess of columns + rows; the build pipeline will re-run the reference SQL and use the ACTUAL output, so don't sweat exact NUMERIC formatting — but the row count and column names should match.
- prompt: clear interview phrasing. State sort order explicitly if the result has more than one row and the expected_output is ordered.
- hints[]: exactly 3 progressive hints. First conceptual nudge, second points at a SQL construct, third reveals the approach (may include suggested_sql).
- solution_steps[]: 3-4 steps, each with title + what_it_does + sql_snippet + how_postgres_reads_it.
- Vary subconcept across the batch (e.g. for "subqueries" produce scalar, IN-clause, FROM-clause derived table, EXISTS, etc.).
- Vary difficulty across the batch: roughly 30% easy, 50% medium, 20% hard. The 'difficulty' field MUST be one of: "easy", "medium", "hard".

Required JSON shape per question:
{
  "id": "<concept-slug>-<3-digit-number>",
  "concept": "<concept-slug>",
  "subconcept": "<short-kebab-case>",
  "difficulty": "easy" | "medium" | "hard",
  "prompt": "<one paragraph>",
  "ordered_results": true | false,
  "schema_setup_sql": "DROP TABLE IF EXISTS ...; CREATE TABLE ...; INSERT INTO ...;",
  "schema_context": {
    "tables": [{ "name": "<table>", "columns": ["col1","col2",...] }, ...],
    "joins": [{ "from_table": "...", "from_column": "...", "to_table": "...", "to_column": "..." }, ...]
  },
  "expected_output": { "columns": [...], "rows": [[...], ...] },
  "reference_solution_sql": "...",
  "hints": [{ "hint": "...", "suggested_sql": null | "..." }, {...}, {...}],
  "solution_steps": [{ "title": "...", "what_it_does": "...", "sql_snippet": "...", "how_postgres_reads_it": "..." }, ...],
  "solution_summary": "<one sentence>",
  "solution_final_thought": "<one sentence — the principle to remember>",
  "explanation": "<2-4 sentences explaining why the answer works>",
  "source": "llm-generated",
  "license": "MIT",
  "attribution_url": null
}
"""


def _fewshot_block() -> str:
    """Compact few-shot from joins-001 so the model sees the exact shape it must produce."""
    if not JOINS_FEWSHOT_PATH.exists():
        return ""
    bank = json.loads(JOINS_FEWSHOT_PATH.read_text())
    example = bank[0]  # joins-001, the simplest
    # Strip to keep the prompt short — model only needs to see the SHAPE.
    return (
        "Reference example (for shape only — do NOT reuse its schema or prompt):\n\n"
        + json.dumps(example, indent=2)
    )


def build_user_prompt(
    concept_slug: str,
    count: int,
    existing_prompts: list[str],
    domain: str | None = None,
) -> str:
    label = CONCEPT_LABELS.get(concept_slug, concept_slug)
    avoid = ""
    if existing_prompts:
        avoid_list = "\n".join(f"  - {p[:120]}" for p in existing_prompts[:20])
        avoid = f"\n\nDo NOT duplicate the following existing prompts:\n{avoid_list}"
    domain_block = ""
    if domain:
        domain_block = (
            f"\n\nDOMAIN CONSTRAINT: All {count} questions in this batch MUST use a "
            f"{domain} schema. Tables, column names, and seed data should fit this domain. "
            f"Vary the subconcept and difficulty within the batch."
        )
    return (
        f"Generate {count} new SQL interview questions for the concept: **{label}** (slug: `{concept_slug}`).\n\n"
        f"Every question MUST exercise {label} as its core challenge. Vary subconcepts and difficulty as instructed."
        f"{domain_block}"
        f"{avoid}\n\n"
        f"{_fewshot_block()}"
    )


def _normalize(v: Any) -> Any:
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return v


def validate_and_capture(
    conn: psycopg.Connection, q: dict
) -> tuple[bool, str, dict | None]:
    """Run schema_setup + reference SQL in an isolated schema. Returns
    (ok, message, actual_expected_output). On success, actual_expected_output
    replaces the LLM's claim."""
    schema_name = f"gen_test_{uuid.uuid4().hex[:8]}"
    try:
        with conn.cursor() as cur:
            cur.execute(f'CREATE SCHEMA "{schema_name}"')
            cur.execute(f'SET search_path TO "{schema_name}"')
            try:
                cur.execute(q["schema_setup_sql"])
            except Exception as e:
                conn.rollback()
                return False, f"schema_setup_sql failed: {e}", None
            try:
                cur.execute(q["reference_solution_sql"])
            except Exception as e:
                conn.rollback()
                return False, f"reference_solution_sql failed: {e}", None
            cols = [d[0] for d in cur.description]
            rows = [[_normalize(v) for v in r] for r in cur.fetchall()]
            actual = {"columns": cols, "rows": rows}
            if not rows:
                conn.rollback()
                return False, "reference_solution_sql returned zero rows (boring question)", None
            return True, "ok", actual
    finally:
        try:
            with conn.cursor() as cur:
                cur.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
            conn.commit()
        except Exception:
            conn.rollback()


async def call_llm(
    concept_slug: str,
    count: int,
    existing_prompts: list[str],
    domain: str | None = None,
) -> list[dict]:
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    user = build_user_prompt(concept_slug, count, existing_prompts, domain=domain)
    resp = await client.chat.completions.create(
        model=settings.openai_model,
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    )
    content = resp.choices[0].message.content or "{}"
    parsed = json.loads(content)
    questions = parsed.get("questions") or parsed.get("data") or []
    if not isinstance(questions, list):
        return []
    return questions


def load_existing(concept_slug: str) -> list[dict]:
    path = DATA_DIR / f"{concept_slug}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def save_bank(concept_slug: str, bank: list[dict]) -> None:
    path = DATA_DIR / f"{concept_slug}.json"
    path.write_text(json.dumps(bank, indent=2) + "\n")


def update_index(concept_slug: str, count: int) -> None:
    idx = json.loads(INDEX_PATH.read_text()) if INDEX_PATH.exists() else {
        "generated_at": datetime.utcnow().date().isoformat(),
        "concepts": [],
    }
    entry = next((c for c in idx["concepts"] if c["concept"] == concept_slug), None)
    if entry is None:
        idx["concepts"].append({
            "concept": concept_slug,
            "label": CONCEPT_LABELS.get(concept_slug, concept_slug),
            "category": CONCEPT_CATEGORY.get(concept_slug, "uncategorized"),
            "count": count,
            "file": f"{concept_slug}.json",
        })
    else:
        entry["count"] = count
    idx["generated_at"] = datetime.utcnow().date().isoformat()
    INDEX_PATH.write_text(json.dumps(idx, indent=2) + "\n")


async def generate_for_concept(
    concept_slug: str,
    total: int,
    shards: int,
    append: bool,
    dry_run: bool,
    dsn: str,
) -> int:
    """Run sharded generation for a single concept. Returns final bank size."""
    if concept_slug not in CONCEPT_LABELS:
        raise ValueError(f"Unknown concept slug: {concept_slug}")
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    existing = load_existing(concept_slug)
    existing_prompts = [q["prompt"] for q in existing]

    per_shard = max(1, total // shards)
    domain_offset = abs(hash(concept_slug)) % len(DOMAINS)
    domains_to_use = [DOMAINS[(domain_offset + i) % len(DOMAINS)] for i in range(shards)]

    print(f"\n[{concept_slug}] Requesting {per_shard} × {shards} shards "
          f"= {per_shard * shards} candidates from {settings.openai_model}")

    all_candidates: list[dict] = []
    # Run shards concurrently (each is an independent API call).
    tasks = [
        call_llm(concept_slug, per_shard, existing_prompts, domain=d)
        for d in domains_to_use
    ]
    shard_results = await asyncio.gather(*tasks, return_exceptions=True)
    for d, result in zip(domains_to_use, shard_results):
        if isinstance(result, Exception):
            print(f"  [{concept_slug}] shard '{d[:30]}...' FAILED: {result}")
            continue
        print(f"  [{concept_slug}] shard '{d[:40]}' returned {len(result)} candidates")
        all_candidates.extend(result)

    # Defensive: LLMs occasionally emit a stray string or null in the list.
    all_candidates = [c for c in all_candidates if isinstance(c, dict) and c.get("schema_setup_sql")]
    print(f"\n[{concept_slug}] Validating {len(all_candidates)} candidates against Postgres...")

    survivors: list[dict] = []
    conn = psycopg.connect(dsn, autocommit=False)
    try:
        for i, q in enumerate(all_candidates, 1):
            q["id"] = q.get("id") or f"{concept_slug}-{uuid.uuid4().hex[:6]}"
            q["concept"] = concept_slug
            q["source"] = q.get("source", "llm-generated")
            q["license"] = q.get("license", "MIT")
            q["attribution_url"] = q.get("attribution_url", None)
            ok, msg, actual = validate_and_capture(conn, q)
            mark = "✓" if ok else "✗"
            print(f"  {mark} [{concept_slug}][{i}/{len(all_candidates)}] {q.get('subconcept','?')}/{q.get('difficulty','?')}: {msg[:80]}")
            if ok and actual is not None:
                q["expected_output"] = actual
                survivors.append(q)
    finally:
        conn.close()

    if dry_run:
        print(f"\n[dry-run] [{concept_slug}] Would write {len(survivors)} survivors")
        return len(survivors)

    final = (existing + survivors) if append else survivors
    for i, q in enumerate(final, 1):
        q["id"] = f"{concept_slug}-{i:03d}"
    save_bank(concept_slug, final)
    update_index(concept_slug, len(final))
    print(f"[{concept_slug}] Wrote {len(final)} questions ({len(survivors)} new survivors)")
    return len(final)


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("concept", help="Concept slug (e.g. subqueries, window_functions)")
    parser.add_argument("--count", type=int, default=40, help="Total candidates to request (split across shards)")
    parser.add_argument("--shards", type=int, default=5, help="How many separate LLM calls, each with a distinct domain")
    parser.add_argument("--append", action="store_true", help="Append to existing bank instead of replacing")
    parser.add_argument("--dry-run", action="store_true", help="Print candidates without writing")
    parser.add_argument("--dsn", default="postgresql://postgres:postgres@localhost:5433/sqlpractice")
    args = parser.parse_args()

    try:
        await generate_for_concept(
            args.concept, args.count, args.shards, args.append, args.dry_run, args.dsn
        )
    except (ValueError, RuntimeError) as e:
        print(str(e), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
