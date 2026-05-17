"""Schema scenarios. Each `reset_data` call picks (or accepts) a scenario and
regenerates *all* its tables + data from scratch. Adding a new scenario means
adding one entry to SCENARIOS — everything else (schema introspection, FK
discovery, etc.) is generic.
"""
from __future__ import annotations

import random
from collections.abc import Awaitable, Callable
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from faker import Faker
from sqlalchemy import text

from .db import engine

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


SCENARIOS: dict[str, dict[str, Any]] = {
    "ecommerce": {"label": "E-commerce", "table_order": ["customers", "orders", "order_items"], "gen": _gen_ecommerce},
    "library":   {"label": "Library",    "table_order": ["members", "books", "loans"],          "gen": _gen_library},
    "movies":    {"label": "Movie ratings", "table_order": ["movies", "users", "ratings"],      "gen": _gen_movies},
}


# ── public api ────────────────────────────────────────────────────────────────

async def reset_data(seed: int, scenario: str | None = None) -> dict[str, str]:
    """Drop everything, generate a (random or specified) scenario, return its id+label."""
    Faker.seed(seed)
    random.seed(seed)
    fake = Faker()
    rng = random.Random(seed)

    if scenario is None or scenario not in SCENARIOS:
        scenario = rng.choice(list(SCENARIOS.keys()))

    async with engine.begin() as conn:
        await conn.exec_driver_sql(DROP_ALL_PUBLIC)

    await SCENARIOS[scenario]["gen"](fake, rng)

    # Cache the scenario id on a tiny meta table so /api/schema can report it.
    async with engine.begin() as conn:
        await conn.exec_driver_sql(
            "CREATE TABLE IF NOT EXISTS _scenario_meta (id TEXT PRIMARY KEY, label TEXT, seed INTEGER)"
        )
        await conn.execute(text("DELETE FROM _scenario_meta"))
        await conn.execute(
            text("INSERT INTO _scenario_meta (id, label, seed) VALUES (:i, :l, :s)"),
            {"i": scenario, "l": SCENARIOS[scenario]["label"], "s": seed},
        )

    return {"id": scenario, "label": SCENARIOS[scenario]["label"]}


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
