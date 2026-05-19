"""Schema scenarios. Each `reset_data` call picks (or accepts) a scenario and
regenerates *all* its tables + data from scratch. Adding a new scenario means
adding one entry to SCENARIOS — everything else (schema introspection, FK
discovery, etc.) is generic.
"""
from __future__ import annotations

import contextlib
import json
import random
import re
from collections.abc import Awaitable, Callable
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from faker import Faker
from sqlalchemy import text

from .db import engine

# ── identifier safety ─────────────────────────────────────────────────────────

_IDENT = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
_PG_RESERVED = {
    "user", "order", "group", "select", "from", "where", "table", "all",
    "any", "and", "or", "not", "null", "default", "primary", "foreign",
    "references", "constraint", "check", "unique", "index", "view", "column",
    "into", "values", "insert", "update", "delete", "create", "drop",
}


def _safe_ident(name: str) -> str:
    if not isinstance(name, str) or not _IDENT.match(name) or name.lower() in _PG_RESERVED:
        raise ValueError(f"unsafe identifier: {name!r}")
    return name


_ALLOWED_TYPE_PATTERNS = [
    re.compile(r"^SERIAL PRIMARY KEY$", re.IGNORECASE),
    re.compile(r"^BIGSERIAL PRIMARY KEY$", re.IGNORECASE),
    re.compile(r"^INTEGER$", re.IGNORECASE),
    re.compile(r"^BIGINT$", re.IGNORECASE),
    re.compile(r"^SMALLINT$", re.IGNORECASE),
    re.compile(r"^TEXT$", re.IGNORECASE),
    re.compile(r"^VARCHAR\(\s*\d+\s*\)$", re.IGNORECASE),
    re.compile(r"^BOOLEAN$", re.IGNORECASE),
    re.compile(r"^DATE$", re.IGNORECASE),
    re.compile(r"^TIMESTAMP$", re.IGNORECASE),
    re.compile(r"^NUMERIC\(\s*\d+\s*,\s*\d+\s*\)$", re.IGNORECASE),
]


def _safe_type(t: str) -> str:
    if not isinstance(t, str):
        raise ValueError(f"bad type: {t!r}")
    t = t.strip()
    for p in _ALLOWED_TYPE_PATTERNS:
        if p.match(t):
            return t.upper() if t.upper() in {"INTEGER", "BIGINT", "TEXT", "BOOLEAN", "DATE", "TIMESTAMP"} else t
    raise ValueError(f"disallowed type: {t!r}")

# ── helpers ───────────────────────────────────────────────────────────────────

DROP_ALL_PUBLIC = """
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
"""


def _json_safe(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


# ── scenarios ─────────────────────────────────────────────────────────────────

ScenarioFn = Callable[["Faker", random.Random], Awaitable[None]]


async def _gen_ecommerce(fake: Faker, rng: random.Random) -> None:
    """customers · orders · order_items."""
    countries = [
        "United States", "United Kingdom", "Canada", "Germany", "France",
        "Australia", "Japan", "Brazil", "Mexico", "India",
        "Spain", "Italy", "Netherlands", "Sweden", "Poland",
    ]
    product_adjs = [
        "Wireless", "Vintage", "Premium", "Compact", "Heavy-Duty",
        "Eco-Friendly", "Smart", "Portable", "Rechargeable", "Stainless",
    ]
    product_nouns = [
        "Headphones", "Keyboard", "Mouse", "Monitor", "Lamp", "Backpack",
        "Water Bottle", "Notebook", "Coffee Maker", "Blender", "Speaker",
        "Tablet", "Charger", "Camera", "Desk Chair", "Mug", "Pen Set",
        "Yoga Mat", "Toaster", "Vacuum", "Sunglasses", "Wallet", "Umbrella",
        "Phone Case", "Watch",
    ]
    statuses = ["completed", "pending", "cancelled"]

    ddl = """
    CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        signup_date DATE NOT NULL,
        country TEXT NOT NULL,
        age INTEGER
    );
    CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        order_date DATE NOT NULL,
        status TEXT,
        total_amount NUMERIC(10, 2) NOT NULL
    );
    CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL
    );
    CREATE INDEX idx_orders_customer ON orders(customer_id);
    CREATE INDEX idx_order_items_order ON order_items(order_id);
    """

    n_customers, n_orders, n_items = 500, 3000, 8000
    today = date(2026, 5, 17)
    two_years_ago = today - timedelta(days=730)

    products: list[str] = []
    while len(products) < 50:
        n = f"{rng.choice(product_adjs)} {rng.choice(product_nouns)}"
        if n not in products:
            products.append(n)

    customers: list[tuple] = []
    for _ in range(n_customers):
        first, last = fake.first_name(), fake.last_name()
        name = f"{first} {last}"
        email = f"{first.lower()}.{last.lower()}{rng.randint(1, 999)}@{fake.free_email_domain()}"
        signup = fake.date_between(start_date=two_years_ago, end_date=today)
        country = rng.choice(countries)
        age = None if rng.random() < 0.05 else rng.randint(18, 75)
        customers.append((name, email, signup, country, age))

    eligible_cids = rng.sample(range(1, n_customers + 1), int(n_customers * 0.8))
    orders: list[tuple] = []
    for _ in range(n_orders):
        cid = rng.choice(eligible_cids)
        signup = customers[cid - 1][2]
        odate = fake.date_between(start_date=signup, end_date=today) if signup < today else today
        status = None if rng.random() < 0.10 else rng.choice(statuses)
        orders.append((cid, odate, status, Decimal("0.00")))

    eligible_oids = rng.sample(range(1, n_orders + 1), int(n_orders * 0.95))
    items: list[tuple] = []
    totals: dict[int, Decimal] = {oid: Decimal("0.00") for oid in range(1, n_orders + 1)}
    for _ in range(n_items):
        oid = rng.choice(eligible_oids)
        prod = rng.choice(products)
        qty = rng.randint(1, 5)
        price = Decimal(f"{rng.uniform(2.99, 299.99):.2f}")
        items.append((oid, prod, qty, price))
        totals[oid] += price * qty

    orders = [
        (cid, od, st, totals[i + 1].quantize(Decimal("0.01")))
        for i, (cid, od, st, _) in enumerate(orders)
    ]

    async with engine.begin() as conn:
        await conn.exec_driver_sql(ddl)
        await conn.execute(
            text("INSERT INTO customers (name, email, signup_date, country, age) VALUES (:n, :e, :s, :c, :a)"),
            [{"n": n_, "e": e_, "s": s_, "c": c_, "a": a_} for (n_, e_, s_, c_, a_) in customers],
        )
        await conn.execute(
            text("INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES (:c, :d, :s, :t)"),
            [{"c": c_, "d": d_, "s": s_, "t": t_} for (c_, d_, s_, t_) in orders],
        )
        await conn.execute(
            text("INSERT INTO order_items (order_id, product_name, quantity, unit_price) VALUES (:o, :p, :q, :u)"),
            [{"o": o_, "p": p_, "q": q_, "u": u_} for (o_, p_, q_, u_) in items],
        )


async def _gen_library(fake: Faker, rng: random.Random) -> None:
    """members · books · loans."""
    genres = ["Fiction", "Non-fiction", "Mystery", "Sci-Fi", "Fantasy",
              "Biography", "History", "Children", "Romance", "Thriller"]
    membership_types = ["standard", "premium", "student", "senior"]

    ddl = """
    CREATE TABLE members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        joined_date DATE NOT NULL,
        membership_type TEXT NOT NULL,
        city TEXT
    );
    CREATE TABLE books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT NOT NULL,
        published_year INTEGER NOT NULL,
        copies_total INTEGER NOT NULL
    );
    CREATE TABLE loans (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id),
        book_id INTEGER NOT NULL REFERENCES books(id),
        borrowed_date DATE NOT NULL,
        due_date DATE NOT NULL,
        returned_date DATE
    );
    CREATE INDEX idx_loans_member ON loans(member_id);
    CREATE INDEX idx_loans_book ON loans(book_id);
    """

    n_members, n_books, n_loans = 300, 200, 2500
    today = date(2026, 5, 17)
    three_years_ago = today - timedelta(days=1095)

    members: list[tuple] = []
    for _ in range(n_members):
        first, last = fake.first_name(), fake.last_name()
        members.append((
            f"{first} {last}",
            f"{first.lower()}.{last.lower()}{rng.randint(1, 999)}@email.com",
            fake.date_between(start_date=three_years_ago, end_date=today),
            rng.choice(membership_types),
            fake.city() if rng.random() > 0.05 else None,
        ))

    books: list[tuple] = []
    for _ in range(n_books):
        books.append((
            fake.sentence(nb_words=rng.randint(2, 5)).rstrip("."),
            f"{fake.first_name()} {fake.last_name()}",
            rng.choice(genres),
            rng.randint(1950, 2025),
            rng.randint(1, 8),
        ))

    loans: list[tuple] = []
    for _ in range(n_loans):
        mid = rng.randint(1, n_members)
        bid = rng.randint(1, n_books)
        borrowed = fake.date_between(start_date=three_years_ago, end_date=today)
        due = borrowed + timedelta(days=21)
        # 70% returned, some overdue
        returned = (borrowed + timedelta(days=rng.randint(1, 35))) if rng.random() < 0.7 else None
        if returned and returned > today:
            returned = None
        loans.append((mid, bid, borrowed, due, returned))

    async with engine.begin() as conn:
        await conn.exec_driver_sql(ddl)
        await conn.execute(
            text("INSERT INTO members (name, email, joined_date, membership_type, city) VALUES (:n, :e, :j, :m, :c)"),
            [{"n": n_, "e": e_, "j": j_, "m": m_, "c": c_} for (n_, e_, j_, m_, c_) in members],
        )
        await conn.execute(
            text("INSERT INTO books (title, author, genre, published_year, copies_total) VALUES (:t, :a, :g, :y, :c)"),
            [{"t": t_, "a": a_, "g": g_, "y": y_, "c": c_} for (t_, a_, g_, y_, c_) in books],
        )
        await conn.execute(
            text("INSERT INTO loans (member_id, book_id, borrowed_date, due_date, returned_date) VALUES (:m, :b, :br, :du, :re)"),
            [{"m": m_, "b": b_, "br": br_, "du": du_, "re": re_} for (m_, b_, br_, du_, re_) in loans],
        )


async def _gen_movies(fake: Faker, rng: random.Random) -> None:
    """movies · users · ratings."""
    genres = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Romance",
              "Thriller", "Documentary", "Animation", "Fantasy"]
    countries = ["USA", "UK", "France", "Germany", "Japan", "South Korea",
                 "India", "Brazil", "Canada", "Australia"]

    ddl = """
    CREATE TABLE movies (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        release_year INTEGER NOT NULL,
        genre TEXT NOT NULL,
        runtime_minutes INTEGER NOT NULL,
        director TEXT NOT NULL,
        budget_millions NUMERIC(8, 2)
    );
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        country TEXT NOT NULL,
        joined_date DATE NOT NULL,
        age INTEGER
    );
    CREATE TABLE ratings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        movie_id INTEGER NOT NULL REFERENCES movies(id),
        rating NUMERIC(2, 1) NOT NULL,
        rated_date DATE NOT NULL,
        review TEXT
    );
    CREATE INDEX idx_ratings_user ON ratings(user_id);
    CREATE INDEX idx_ratings_movie ON ratings(movie_id);
    """

    n_movies, n_users, n_ratings = 200, 400, 5000
    today = date(2026, 5, 17)
    three_years_ago = today - timedelta(days=1095)

    movies: list[tuple] = []
    for _ in range(n_movies):
        movies.append((
            fake.sentence(nb_words=rng.randint(2, 4)).rstrip("."),
            rng.randint(1980, 2025),
            rng.choice(genres),
            rng.randint(75, 210),
            f"{fake.first_name()} {fake.last_name()}",
            Decimal(f"{rng.uniform(0.5, 300):.2f}") if rng.random() > 0.1 else None,
        ))

    users: list[tuple] = []
    for _ in range(n_users):
        users.append((
            fake.user_name(),
            rng.choice(countries),
            fake.date_between(start_date=three_years_ago, end_date=today),
            None if rng.random() < 0.08 else rng.randint(13, 80),
        ))

    ratings: list[tuple] = []
    for _ in range(n_ratings):
        uid = rng.randint(1, n_users)
        mid = rng.randint(1, n_movies)
        rating = Decimal(str(round(rng.uniform(1, 5) * 2) / 2))  # 0.5 increments
        rated = fake.date_between(start_date=three_years_ago, end_date=today)
        review = fake.sentence(nb_words=rng.randint(5, 14)) if rng.random() > 0.5 else None
        ratings.append((uid, mid, rating, rated, review))

    async with engine.begin() as conn:
        await conn.exec_driver_sql(ddl)
        await conn.execute(
            text("INSERT INTO movies (title, release_year, genre, runtime_minutes, director, budget_millions) VALUES (:t, :y, :g, :r, :d, :b)"),
            [{"t": t_, "y": y_, "g": g_, "r": r_, "d": d_, "b": b_} for (t_, y_, g_, r_, d_, b_) in movies],
        )
        await conn.execute(
            text("INSERT INTO users (username, country, joined_date, age) VALUES (:u, :c, :j, :a)"),
            [{"u": u_, "c": c_, "j": j_, "a": a_} for (u_, c_, j_, a_) in users],
        )
        await conn.execute(
            text("INSERT INTO ratings (user_id, movie_id, rating, rated_date, review) VALUES (:u, :m, :r, :d, :rv)"),
            [{"u": u_, "m": m_, "r": r_, "d": d_, "rv": rv_} for (u_, m_, r_, d_, rv_) in ratings],
        )


# ── AI schema executor ────────────────────────────────────────────────────────

SCHEMA_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "ai_schemas"
MAX_AI_CACHE = 30  # cap on the on-disk pool


def _faker_value(fake: Faker, method: str) -> Any:
    allowed = {
        "name", "first_name", "last_name", "email", "user_name", "city",
        "country", "company", "street_address", "phone_number", "sentence",
        "word", "domain_word",
    }
    if method not in allowed:
        raise ValueError(f"unsupported faker method: {method!r}")
    v = getattr(fake, method)()
    if isinstance(v, str) and method == "sentence":
        return v.rstrip(".")
    return v


def _eval_recipe(
    recipe: dict[str, Any],
    fake: Faker,
    rng: random.Random,
    row_index: int,
    row_so_far: dict[str, Any],
    parent_ids: dict[str, list[int]],
    own_ids: list[int],
) -> Any:
    """Materialize one value from a recipe, with safe defaults if it's malformed."""
    if not isinstance(recipe, dict):
        return None
    kind = recipe.get("kind")

    if kind == "faker":
        return _faker_value(fake, recipe.get("method", "word"))

    if kind == "choice":
        values = recipe.get("values") or []
        if not values:
            return None
        return rng.choice(values)

    if kind == "weighted_choice":
        values = recipe.get("values") or []
        weights = recipe.get("weights") or [1] * len(values)
        if not values:
            return None
        if len(weights) != len(values):
            weights = [1] * len(values)
        return rng.choices(values, weights=weights, k=1)[0]

    if kind == "int_range":
        lo, hi = int(recipe.get("min", 0)), int(recipe.get("max", 100))
        if lo > hi:
            lo, hi = hi, lo
        return rng.randint(lo, hi)

    if kind == "decimal_range":
        lo = float(recipe.get("min", 0))
        hi = float(recipe.get("max", 100))
        digits = int(recipe.get("digits", 2))
        if lo > hi:
            lo, hi = hi, lo
        return Decimal(f"{rng.uniform(lo, hi):.{digits}f}")

    if kind == "date_range":
        start = _parse_date(recipe.get("start"), date(2023, 1, 1))
        end = _parse_date(recipe.get("end"), date(2026, 5, 1))
        if start > end:
            start, end = end, start
        delta_days = (end - start).days
        return start + timedelta(days=rng.randint(0, max(delta_days, 0)))

    if kind == "date_after_col":
        base = row_so_far.get(recipe.get("column", ""))
        min_d = int(recipe.get("min_days", 1))
        max_d = int(recipe.get("max_days", 30))
        if isinstance(base, date):
            return base + timedelta(days=rng.randint(min(min_d, max_d), max(min_d, max_d)))
        return _eval_recipe(
            {"kind": "date_range", "start": "2024-01-01", "end": "2026-05-01"},
            fake, rng, row_index, row_so_far, parent_ids, own_ids,
        )

    if kind == "fk":
        ref = recipe.get("references", "")
        ids = parent_ids.get(ref) or []
        if not ids:
            return None
        return rng.choice(ids)

    if kind == "self_fk":
        if not own_ids:
            return None
        if rng.random() < float(recipe.get("null_rate", 0.3)):
            return None
        return rng.choice(own_ids)

    if kind == "template":
        fmt = recipe.get("format", "")
        parts = recipe.get("parts", {}) or {}
        rendered = {}
        for key, sub in parts.items():
            val = _eval_recipe(sub, fake, rng, row_index, row_so_far, parent_ids, own_ids)
            rendered[key] = str(val).lower() if isinstance(val, str) else val
        try:
            return fmt.format(**rendered, i=row_index, rand=rng.randint(1, 9999))
        except Exception:
            return None

    if kind == "constant":
        return recipe.get("value")

    if kind == "row_index":
        return row_index

    if kind == "bool":
        return rng.random() < float(recipe.get("true_rate", 0.5))

    if kind in (None, "null"):
        return None

    return None


def _parse_date(v: Any, default: date) -> date:
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return date.fromisoformat(v[:10])
        except ValueError:
            return default
    return default


async def materialize_schema(spec: dict[str, Any], seed: int) -> dict[str, str]:
    """Take an LLM-generated schema spec and actually create + populate it in Postgres.
    Returns {id, label}. Raises ValueError on validation failure."""
    sid = _safe_ident(str(spec.get("id", "ai_schema")))
    label = str(spec.get("label", "AI scenario"))[:80]
    tables = spec.get("tables") or []
    if not isinstance(tables, list) or len(tables) < 3:
        raise ValueError("schema must define at least 3 tables")

    Faker.seed(seed)
    fake = Faker()
    rng = random.Random(seed)

    # Build DDL + plan inserts.
    ddl_parts: list[str] = []
    table_plans: list[dict[str, Any]] = []
    known_table_names: set[str] = set()

    for tbl in tables:
        tname = _safe_ident(tbl["name"])
        if tname in known_table_names:
            raise ValueError(f"duplicate table name {tname!r}")
        known_table_names.add(tname)

        cols = tbl.get("columns") or []
        if not cols:
            raise ValueError(f"table {tname!r} has no columns")

        col_defs: list[str] = []
        gen_cols: list[dict[str, Any]] = []  # cols we need to INSERT values for
        for col in cols:
            cname = _safe_ident(col["name"])
            ctype = _safe_type(col["type"])
            fk = col.get("foreign_key")
            nullable = bool(col.get("nullable", True))
            is_pk = "PRIMARY KEY" in ctype.upper()

            piece = f"    {cname} {ctype}"
            if not is_pk:
                if not nullable:
                    piece += " NOT NULL"
                if fk:
                    ref_table, ref_col = fk.split(".", 1)
                    ref_table = _safe_ident(ref_table)
                    ref_col = _safe_ident(ref_col)
                    if ref_table not in known_table_names:
                        raise ValueError(f"FK on {tname}.{cname} → unknown table {ref_table!r}")
                    piece += f" REFERENCES {ref_table}({ref_col})"
            col_defs.append(piece)

            if not is_pk:
                gen_cols.append({
                    "name": cname,
                    "fk": fk,
                    "nullable": nullable,
                    "nullable_rate": float(col.get("nullable_rate", 0.0) or 0.0),
                    "gen": col.get("gen"),
                })

        ddl_parts.append(f"CREATE TABLE {tname} (\n" + ",\n".join(col_defs) + "\n);")
        row_count = max(1, min(int(tbl.get("row_count", 200)), 5000))
        table_plans.append({"name": tname, "row_count": row_count, "gen_cols": gen_cols})

    # Indexes
    for idx in spec.get("indexes") or []:
        if not isinstance(idx, list) or len(idx) != 2:
            continue
        try:
            t = _safe_ident(idx[0])
            c = _safe_ident(idx[1])
        except ValueError:
            continue
        if t not in known_table_names:
            continue
        ddl_parts.append(f"CREATE INDEX idx_{t}_{c} ON {t}({c});")

    ddl = "\n".join(ddl_parts)

    # Execute DDL + inserts in one transaction.
    async with engine.begin() as conn:
        await conn.exec_driver_sql(DROP_ALL_PUBLIC)
        await conn.exec_driver_sql(ddl)

        parent_ids: dict[str, list[int]] = {}  # "table.column" → list of pk ids

        for plan in table_plans:
            tname = plan["name"]
            gen_cols = plan["gen_cols"]
            row_count = plan["row_count"]
            own_ids: list[int] = []

            if not gen_cols:
                # No insertable columns — skip (table is just SERIAL pk, weird but allowed).
                continue

            rows: list[dict[str, Any]] = []
            for i in range(1, row_count + 1):
                row: dict[str, Any] = {}
                for col in gen_cols:
                    if col["nullable"] and rng.random() < col["nullable_rate"]:
                        row[col["name"]] = None
                        continue
                    val = _eval_recipe(
                        col["gen"] or {"kind": "null"},
                        fake, rng, i, row, parent_ids, own_ids,
                    )
                    if val is None and not col["nullable"] and col["fk"]:
                        # FK to empty parent — skip this row entirely.
                        row = {}
                        break
                    row[col["name"]] = val
                if row:
                    rows.append(row)
                    own_ids.append(i)  # SERIAL starts at 1, monotonic

            if not rows:
                continue

            col_names = [c["name"] for c in gen_cols]
            placeholders = ", ".join(f":{c}" for c in col_names)
            sql = f"INSERT INTO {tname} ({', '.join(col_names)}) VALUES ({placeholders})"
            await conn.execute(text(sql), rows)

            # After insert, parents need accurate id list. SERIAL assigns 1..len(rows) on a fresh table.
            actual_ids = list(range(1, len(rows) + 1))
            parent_ids[f"{tname}.id"] = actual_ids

        # Optional post-setup SQL (e.g. derived columns).
        post_sql = spec.get("post_setup_sql") or []
        if isinstance(post_sql, list):
            for stmt in post_sql:
                if not isinstance(stmt, str):
                    continue
                # Conservative whitelist: only UPDATE statements, single statement.
                if not re.match(r"^\s*UPDATE\s+", stmt, re.IGNORECASE):
                    continue
                if ";" in stmt.rstrip().rstrip(";"):
                    continue
                with contextlib.suppress(Exception):
                    await conn.execute(text(stmt))

        # Cache scenario meta.
        await conn.exec_driver_sql(
            "CREATE TABLE IF NOT EXISTS _scenario_meta (id TEXT PRIMARY KEY, label TEXT, seed INTEGER)"
        )
        await conn.execute(text("DELETE FROM _scenario_meta"))
        await conn.execute(
            text("INSERT INTO _scenario_meta (id, label, seed) VALUES (:i, :l, :s)"),
            {"i": sid, "l": label, "s": seed},
        )

    return {"id": sid, "label": label}


# ── on-disk AI schema pool ────────────────────────────────────────────────────

def _ensure_cache_dir() -> None:
    SCHEMA_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def list_ai_schemas() -> list[dict[str, Any]]:
    _ensure_cache_dir()
    out: list[dict[str, Any]] = []
    for p in sorted(SCHEMA_CACHE_DIR.glob("*.json")):
        try:
            out.append(json.loads(p.read_text()))
        except Exception:
            continue
    return out


def save_ai_schema(spec: dict[str, Any]) -> None:
    _ensure_cache_dir()
    sid = re.sub(r"[^a-z0-9_]", "", spec.get("id", "ai")[:40].lower()) or "ai"
    # ensure unique-ish file name
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = SCHEMA_CACHE_DIR / f"{sid}_{stamp}.json"
    path.write_text(json.dumps(spec, indent=2, default=str))
    # Trim pool
    files = sorted(SCHEMA_CACHE_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
    while len(files) > MAX_AI_CACHE:
        files[0].unlink(missing_ok=True)
        files = files[1:]


def pick_cached_ai_schema(rng: random.Random) -> dict[str, Any] | None:
    schemas = list_ai_schemas()
    if not schemas:
        return None
    return rng.choice(schemas)


def recent_ai_domains(limit: int = 8) -> list[str]:
    return [
        s.get("domain") or s.get("label") or s.get("id", "")
        for s in list_ai_schemas()[-limit:]
        if isinstance(s, dict)
    ]


SCENARIOS: dict[str, dict[str, Any]] = {
    "ecommerce": {"label": "E-commerce", "table_order": ["customers", "orders", "order_items"], "gen": _gen_ecommerce},
    "library":   {"label": "Library",    "table_order": ["members", "books", "loans"],          "gen": _gen_library},
    "movies":    {"label": "Movie ratings", "table_order": ["movies", "users", "ratings"],      "gen": _gen_movies},
}


# ── public api ────────────────────────────────────────────────────────────────

async def reset_data(
    seed: int,
    scenario: str | None = None,
    mode: str = "auto",
) -> dict[str, str]:
    """Drop everything, generate a scenario, return its id+label.

    mode:
      - "auto": current behaviour — random hardcoded scenario (unless `scenario` given).
      - "ai":  pick from cached AI schemas; if `scenario` is given and matches a cached
               AI schema id, use it. (Use generate_and_materialize_ai_schema for fresh.)
      - explicit scenario id falls through to whichever pool contains it.
    """
    Faker.seed(seed)
    random.seed(seed)
    fake = Faker()
    rng = random.Random(seed)

    if scenario and scenario in SCENARIOS:
        async with engine.begin() as conn:
            await conn.exec_driver_sql(DROP_ALL_PUBLIC)
        await SCENARIOS[scenario]["gen"](fake, rng)
        await _stamp_meta_async(scenario, SCENARIOS[scenario]["label"], seed)
        return {"id": scenario, "label": SCENARIOS[scenario]["label"]}

    if mode == "ai":
        # Try to find a matching cached AI schema (by id) or pick one at random.
        cached = list_ai_schemas()
        chosen: dict[str, Any] | None = None
        if scenario:
            for s in cached:
                if s.get("id") == scenario:
                    chosen = s
                    break
        if chosen is None and cached:
            chosen = rng.choice(cached)
        if chosen is not None:
            out = await materialize_schema(chosen, seed)
            return out
        # Fall through to hardcoded if cache empty.

    if scenario is None or scenario not in SCENARIOS:
        scenario = rng.choice(list(SCENARIOS.keys()))

    async with engine.begin() as conn:
        await conn.exec_driver_sql(DROP_ALL_PUBLIC)

    await SCENARIOS[scenario]["gen"](fake, rng)
    await _stamp_meta_async(scenario, SCENARIOS[scenario]["label"], seed)
    return {"id": scenario, "label": SCENARIOS[scenario]["label"]}


async def _stamp_meta_async(sid: str, label: str, seed: int) -> None:
    async with engine.begin() as conn:
        await conn.exec_driver_sql(
            "CREATE TABLE IF NOT EXISTS _scenario_meta (id TEXT PRIMARY KEY, label TEXT, seed INTEGER)"
        )
        await conn.execute(text("DELETE FROM _scenario_meta"))
        await conn.execute(
            text("INSERT INTO _scenario_meta (id, label, seed) VALUES (:i, :l, :s)"),
            {"i": sid, "l": label, "s": seed},
        )


async def generate_and_materialize_ai_schema(seed: int) -> dict[str, str]:
    """Ask the LLM to design a fresh schema, materialize it, and cache it to disk.
    Falls back to a cached one if the live attempt fails. Lazy-imports llm to keep
    data_gen importable without an API key in tests."""
    from . import llm  # local import to avoid hard dep at import time

    recent = recent_ai_domains()
    last_err: Exception | None = None
    for _attempt in range(2):
        try:
            spec = await llm.generate_schema(recent_domains=recent)
            out = await materialize_schema(spec, seed)
            # Only cache after a successful materialize.
            save_ai_schema(spec)
            return out
        except Exception as e:
            last_err = e
            continue

    cached = list_ai_schemas()
    if cached:
        rng = random.Random(seed)
        spec = rng.choice(cached)
        return await materialize_schema(spec, seed)

    raise RuntimeError(f"AI schema generation failed: {last_err}")


async def get_schema_info() -> dict[str, Any]:
    """Inspect the live schema. Returns tables (with columns + PK/FK), sample rows,
    row counts, and the active scenario."""
    out_tables: list[dict[str, Any]] = []
    scenario_id: str | None = None
    scenario_label: str | None = None

    async with engine.connect() as conn:
        # Pull scenario meta if present.
        try:
            meta = await conn.execute(text("SELECT id, label FROM _scenario_meta LIMIT 1"))
            row = meta.first()
            if row:
                scenario_id, scenario_label = row[0], row[1]
        except Exception:
            pass

        # Determine ordered table list. Prefer the scenario's order; fall back to alphabetical.
        if scenario_id and scenario_id in SCENARIOS:
            ordered = list(SCENARIOS[scenario_id]["table_order"])
        else:
            tables_res = await conn.execute(
                text(
                    "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                    "AND tablename NOT LIKE '\\_%' ESCAPE '\\' ORDER BY tablename"
                )
            )
            ordered = [r[0] for r in tables_res.fetchall()]

        for table in ordered:
            cols_res = await conn.execute(
                text(
                    """
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=:t
                    ORDER BY ordinal_position
                    """
                ),
                {"t": table},
            )
            cols_rows = cols_res.fetchall()
            if not cols_rows:
                continue

            # Primary keys
            pk_res = await conn.execute(
                text(
                    """
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema   = kcu.table_schema
                     AND tc.table_name     = kcu.table_name
                    WHERE tc.constraint_type='PRIMARY KEY'
                      AND tc.table_schema='public' AND tc.table_name=:t
                    """
                ),
                {"t": table},
            )
            pk_cols = {r[0] for r in pk_res.fetchall()}

            # Foreign keys
            fk_res = await conn.execute(
                text(
                    """
                    SELECT kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage ccu
                      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
                    WHERE tc.constraint_type='FOREIGN KEY'
                      AND tc.table_schema='public' AND tc.table_name=:t
                    """
                ),
                {"t": table},
            )
            fk_map = {r[0]: f"{r[1]}.{r[2]}" for r in fk_res.fetchall()}

            columns = []
            for c_name, c_type, c_nullable in cols_rows:
                columns.append({
                    "name": c_name,
                    "type": c_type,
                    "nullable": c_nullable == "YES",
                    "primary_key": c_name in pk_cols,
                    "foreign_key": fk_map.get(c_name),  # None or "table.col"
                })

            count_res = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            row_count = count_res.scalar_one()

            sample_res = await conn.execute(
                text(f"SELECT * FROM {table} ORDER BY 1 LIMIT 5")
            )
            sample_cols = list(sample_res.keys())
            sample_rows = [
                {col: _json_safe(val) for col, val in zip(sample_cols, r, strict=False)}
                for r in sample_res.fetchall()
            ]

            out_tables.append({
                "name": table,
                "columns": columns,
                "sample_rows": sample_rows,
                "row_count": row_count,
            })

    return {
        "tables": out_tables,
        "scenario_id": scenario_id,
        "scenario_label": scenario_label,
    }
