"""Shared test fixtures. DB-backed tests skip automatically if Postgres is down."""
import pytest
import pytest_asyncio
from sqlalchemy import text

from app.db import engine


@pytest_asyncio.fixture
async def db_conn():
    try:
        conn = await engine.connect()
    except Exception:
        pytest.skip("Postgres not available")
    trans = await conn.begin()
    try:
        yield conn
    finally:
        await trans.rollback()
        await conn.close()
