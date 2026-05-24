import pytest

from app.clean import ingest


@pytest.mark.asyncio
async def test_load_and_profile(db_conn):
    table = 'clean."dataset_test01"'
    idents = ["id", "city"]
    rows = [["1", "Paris"], ["2", "paris"], ["3", None], ["1", "Paris"]]
    await ingest.load_dataset(table, idents, rows)
    try:
        prof = await ingest.profile_relation(table, idents)
        assert prof["row_count"] == 4
        assert prof["distinct_row_count"] == 3  # row ["1","Paris"] duplicated
        id_col = next(c for c in prof["columns"] if c["ident"] == "id")
        city_col = next(c for c in prof["columns"] if c["ident"] == "city")
        assert id_col["nulls"] == 0
        assert city_col["nulls"] == 1
        assert city_col["distinct"] == 2  # "Paris","paris"
    finally:
        from app.db import engine
        async with engine.begin() as conn:
            await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table}")
