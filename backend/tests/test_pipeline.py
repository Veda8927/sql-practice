import pytest

from app.clean import ingest, pipeline
from app.db import engine

TABLE = 'clean."dataset_pl01"'


def test_validate_fragment_guards():
    assert pipeline.validate_fragment("SELECT * FROM prev") is None
    assert pipeline.validate_fragment("WITH x AS (SELECT 1) SELECT * FROM x") is None
    assert pipeline.validate_fragment("DROP TABLE prev") is not None
    assert pipeline.validate_fragment("UPDATE prev SET a=1") is not None
    assert pipeline.validate_fragment("SELECT 1; SELECT 2") is not None
    assert pipeline.validate_fragment("") is not None


@pytest.fixture
async def loaded():
    idents = ["name", "amount"]
    rows = [["  Alice ", "$10"], ["BOB", "20"], ["Alice", "$10"], [None, "x"]]
    await ingest.load_dataset(TABLE, idents, rows)
    yield idents
    async with engine.begin() as conn:
        await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {TABLE}")


@pytest.mark.asyncio
async def test_pipeline_chains_prev(loaded):
    steps = [
        {"title": "trim+lower", "sql": "SELECT LOWER(TRIM(name)) AS name, amount FROM prev"},
        {"title": "dedupe", "sql": "SELECT DISTINCT name, amount FROM prev WHERE name IS NOT NULL"},
    ]
    out = await pipeline.run_pipeline(TABLE, steps, rules=[])
    assert out["ok"] is True
    assert len(out["stages"]) == 3  # raw + 2 steps
    assert out["stages"][0]["row_count"] == 4
    # after trim/lower: "alice","bob","alice",null ; dedupe non-null -> alice/$10, bob/20
    assert out["stages"][2]["row_count"] == 2
    assert {c for c in out["final_preview"]["columns"]} == {"name", "amount"}


@pytest.mark.asyncio
async def test_pipeline_reports_bad_step(loaded):
    steps = [{"title": "boom", "sql": "SELECT nonexistent_col FROM prev"}]
    out = await pipeline.run_pipeline(TABLE, steps, rules=[])
    assert out["ok"] is False
    assert out["failed_step_index"] == 0
    assert out["error_message"]


@pytest.mark.asyncio
async def test_pipeline_runs_rules(loaded):
    steps = [{"title": "clean",
              "sql": "SELECT LOWER(TRIM(name)) AS name FROM prev WHERE name IS NOT NULL"}]
    rules = [
        {"id": "r0", "type": "not_null", "label": "name not null",
         "params": {"column": "name"}, "enabled": True},
        {"id": "r1", "type": "no_duplicate_rows", "label": "no dup rows",
         "params": {}, "enabled": True},
    ]
    out = await pipeline.run_pipeline(TABLE, steps, rules=rules)
    by_id = {r["id"]: r for r in out["validation"]}
    assert by_id["r0"]["status"] == "pass"
    assert by_id["r1"]["status"] == "fail"  # alice appears twice after cleaning


@pytest.mark.asyncio
async def test_tiered_profiling(loaded):
    steps = [
        {"title": "s1", "sql": "SELECT name, amount FROM prev"},
        {"title": "s2", "sql": "SELECT name, amount FROM prev"},
    ]
    out = await pipeline.run_pipeline(TABLE, steps, rules=[])
    raw, mid, final = out["stages"][0], out["stages"][1], out["stages"][2]
    assert raw["distinct_row_count"] is not None
    assert final["distinct_row_count"] is not None
    assert mid["distinct_row_count"] is None
    assert raw["columns"][0]["distinct"] is not None
    assert mid["columns"][0]["distinct"] is None
    assert all("nulls" in c for c in mid["columns"])


@pytest.mark.asyncio
async def test_validate_pipeline_pass_fail(loaded):
    steps = [{"title": "clean",
              "sql": "SELECT LOWER(TRIM(name)) AS name FROM prev WHERE name IS NOT NULL"}]
    rules = [
        {"id": "r0", "type": "not_null", "label": "nn",
         "params": {"column": "name"}, "enabled": True},
        {"id": "r1", "type": "no_duplicate_rows", "label": "dup",
         "params": {}, "enabled": True},
    ]
    out = await pipeline.validate_pipeline(TABLE, steps, rules)
    assert out["ok"] is True
    assert "stages" not in out
    by_id = {r["id"]: r for r in out["validation"]}
    assert by_id["r0"]["status"] == "pass"
    assert by_id["r1"]["status"] == "fail"


@pytest.mark.asyncio
async def test_validate_pipeline_bad_step(loaded):
    out = await pipeline.validate_pipeline(
        TABLE, [{"title": "boom", "sql": "SELECT nope FROM prev"}], rules=[])
    assert out["ok"] is False
    assert out["failed_step_index"] == 0
    assert out["error_message"]
    assert out["validation"] == []
