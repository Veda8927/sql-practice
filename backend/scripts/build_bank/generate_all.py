"""Generate curated questions for every concept in the taxonomy.

Loops over CONCEPT_LABELS, runs sharded generation per concept with isolated
domains, and continues past per-concept failures. Prints a final summary.

Usage:
    python -m scripts.build_bank.generate_all
    python -m scripts.build_bank.generate_all --count 40 --shards 5
    python -m scripts.build_bank.generate_all --only joins,subqueries
    python -m scripts.build_bank.generate_all --skip-existing  # don't touch concepts already on disk
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from app.config import settings  # noqa: E402
from scripts.build_bank.generate import (  # noqa: E402
    CONCEPT_LABELS,
    DATA_DIR,
    generate_for_concept,
)


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--shards", type=int, default=5)
    parser.add_argument("--only", help="Comma-separated concept slugs to run (defaults to all)")
    parser.add_argument("--exclude", help="Comma-separated concept slugs to skip (e.g. preserve hand-written ones)")
    parser.add_argument("--skip-existing", action="store_true", help="Skip concepts that already have a JSON file")
    parser.add_argument("--dsn", default="postgresql://postgres:postgres@localhost:5433/sqlpractice")
    args = parser.parse_args()

    if not settings.openai_api_key:
        print("OPENAI_API_KEY not set", file=sys.stderr)
        return 2

    if args.only:
        concepts = [c.strip() for c in args.only.split(",") if c.strip()]
        unknown = [c for c in concepts if c not in CONCEPT_LABELS]
        if unknown:
            print(f"Unknown concept(s): {unknown}", file=sys.stderr)
            return 2
    else:
        concepts = list(CONCEPT_LABELS.keys())

    if args.exclude:
        excluded = {c.strip() for c in args.exclude.split(",") if c.strip()}
        concepts = [c for c in concepts if c not in excluded]

    if args.skip_existing:
        concepts = [c for c in concepts if not (DATA_DIR / f"{c}.json").exists()]

    print(f"Will generate {args.count} candidates × {args.shards} shards "
          f"for {len(concepts)} concept(s): {', '.join(concepts)}\n")

    results: dict[str, int | str] = {}
    started = time.time()
    for slug in concepts:
        t0 = time.time()
        try:
            n = await generate_for_concept(
                slug, args.count, args.shards, append=False, dry_run=False, dsn=args.dsn
            )
            results[slug] = n
            print(f"[{slug}] done: {n} questions ({time.time() - t0:.1f}s)\n")
        except Exception as e:
            results[slug] = f"ERROR: {type(e).__name__}: {e}"
            print(f"[{slug}] FAILED: {e}\n")

    elapsed = time.time() - started
    print("=" * 60)
    print(f"Generation complete in {elapsed:.1f}s")
    total = 0
    for slug, r in results.items():
        if isinstance(r, int):
            total += r
            print(f"  {slug:30} {r:>4} questions")
        else:
            print(f"  {slug:30} {r}")
    print(f"\nTotal: {total} questions across {sum(1 for r in results.values() if isinstance(r, int))} concepts")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
