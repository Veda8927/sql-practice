from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from .config import settings

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    # This app drops & recreates all tables on every scenario reset / curated
    # load. psycopg auto-prepares a statement server-side after 5 runs, and a
    # pooled connection that reuses that plan after the DDL throws "cached plan
    # must not change result type". Disabling prepared statements avoids it.
    connect_args={"prepare_threshold": None},
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
