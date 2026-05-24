"""FastAPI entry: routes for health, data, questions, grading, explanations."""
from __future__ import annotations

import asyncio
import random
import re
import uuid
from contextlib import asynccontextmanager
from time import perf_counter
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text as sql_text

from . import data_gen, llm
from .db import engine
from .grader import _json_safe, grade
from .schemas import (
    BreakdownItem,
    ErrorHelpResponse,
    ExplainRequest,
    ExplainResponse,
    GiveUpResponse,
    GradeResult,
    HintRequest,
    HintResponse,
    LoadCuratedQuestionRequest,
    NewQuestionRequest,
    PerformanceRequest,
    PerformanceResponse,
    QuestionHistoryItem,
    QuestionResponse,
    QuestionSchemaContext,
    QuestionSchemaJoin,
    QuestionSchemaTable,
    ResetDataRequest,
    RunQueryRequest,
    RunQueryResponse,
    SchemaInfo,
    SelectQuestionRequest,
    SolutionStep,
    SubmitRequest,
    TableResult,
    TypoCorrection,
)
from .deps import SessionDep
from .state import CurrentQuestion, LastGrade, SessionState, get_session_state

READONLY_PATTERN = re.compile(r"^\s*(WITH|SELECT)\b", re.IGNORECASE)
WRITE_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|MERGE|DROP|TRUNCATE|ALTER|CREATE)\b",
    re.IGNORECASE,
)


async def _run_reference(sql: str) -> TableResult | None:
    """Execute reference SQL in a rolled-back transaction; return TableResult or None."""
    try:
        async with engine.connect() as conn:
            trans = await conn.begin()
            try:
                await conn.execute(sql_text("SET LOCAL statement_timeout = '5s'"))
                result = await conn.execute(sql_text(sql))
                cols = list(result.keys())
                rows = [[_json_safe(v) for v in r] for r in result.fetchall()]
            finally:
                await trans.rollback()
        return TableResult(columns=cols, rows=rows)
    except Exception:
        return None


def _build_question_schema_context(
    reference_sql: str,
    schema: dict,
) -> QuestionSchemaContext:
    sql_lower = reference_sql.lower()
    tables = schema.get("tables", [])

    relevant_table_names: set[str] = set()
    for table in tables:
        name = table["name"]
        if re.search(rf"\b{re.escape(name.lower())}\b", sql_lower):
            relevant_table_names.add(name)

    table_context: list[QuestionSchemaTable] = []
    for table in tables:
        name = table["name"]
        if name not in relevant_table_names:
            continue

        columns: list[str] = []
        for column in table["columns"]:
            column_name = column["name"]
            if re.search(rf"\b{re.escape(column_name.lower())}\b", sql_lower):
                columns.append(column_name)

        table_context.append(QuestionSchemaTable(name=name, columns=columns[:10]))

    joins: list[QuestionSchemaJoin] = []
    for table in tables:
        from_table = table["name"]
        if from_table not in relevant_table_names:
            continue
        for column in table["columns"]:
            foreign_key = column.get("foreign_key")
            if not foreign_key:
                continue
            to_table, to_column = foreign_key.split(".", 1)
            if to_table not in relevant_table_names:
                continue
            joins.append(
                QuestionSchemaJoin(
                    from_table=from_table,
                    from_column=column["name"],
                    to_table=to_table,
                    to_column=to_column,
                )
            )

    return QuestionSchemaContext(tables=table_context, joins=joins)


async def _precompute_solution(
    state: SessionState,
    question_id: str,
    question_text: str,
    reference_sql: str,
    schema: dict,
) -> None:
    """Background task: generate the give-up solution and attach it to the live
    question on this session, only if that question is still current. Failures
    are swallowed — the on-demand path in /api/give_up will retry."""
    try:
        data = await llm.explain_solution(question_text, reference_sql, schema)
    except Exception:
        return
    q = state.current_question
    if q is not None and q.id == question_id:
        q.solution = data
    # Also patch the history entry if the same question is still there.
    for hist_q in state.question_history:
        if hist_q.id == question_id and hist_q.solution is None:
            hist_q.solution = data
            break


def _question_response_from_state(q: CurrentQuestion) -> QuestionResponse:
    expected = TableResult(**q.expected_output) if q.expected_output else None
    schema_context = (
        QuestionSchemaContext(**q.schema_context) if q.schema_context else None
    )
    return QuestionResponse(
        id=q.id,
        question=q.question,
        ordered_results=q.ordered_results,
        concepts=q.concepts,
        difficulty=q.difficulty,
        expected_output=expected,
        schema_context=schema_context,
    )


def _remember_question(state: SessionState, q: CurrentQuestion) -> None:
    state.question_history = [
        item for item in state.question_history if item.id != q.id
    ]
    state.question_history.insert(0, q)
    state.question_history = state.question_history[:10]


async def _explain_analyze(sql: str) -> tuple[object, float]:
    normalized = sql.strip().rstrip(";")
    if not READONLY_PATTERN.search(normalized) or WRITE_PATTERN.search(normalized):
        raise HTTPException(
            status_code=400,
            detail="Only SELECT or WITH queries can be analyzed.",
        )

    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            await conn.execute(sql_text("SET LOCAL statement_timeout = '5s'"))
            started = perf_counter()
            result = await conn.execute(
                sql_text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {normalized}")
            )
            elapsed = round((perf_counter() - started) * 1000, 2)
            plan = result.scalar_one()
        finally:
            await trans.rollback()
    return plan, elapsed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="SQL Practice", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


async def _build_schema_info(seed: int) -> SchemaInfo:
    raw = await data_gen.get_schema_info()
    return SchemaInfo(
        tables=raw["tables"],
        seed=seed,
        scenario_id=raw.get("scenario_id"),
        scenario_label=raw.get("scenario_label"),
    )


@app.post("/api/reset_data", response_model=SchemaInfo)
async def reset_data(
    req: ResetDataRequest,
    state: SessionDep,
) -> SchemaInfo:
    seed = req.seed if req.seed is not None else random.randint(1, 1_000_000)
    try:
        if req.mode == "ai_fresh":
            await data_gen.generate_and_materialize_ai_schema(seed)
        else:
            await data_gen.reset_data(seed, scenario=req.scenario, mode=req.mode)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"reset_data failed: {e}") from e
    state.seed = seed
    state.current_question = None
    state.last_grade = None
    state.question_history = []
    return await _build_schema_info(seed)


@app.get("/api/schema", response_model=SchemaInfo)
async def get_schema(
    state: SessionDep,
) -> SchemaInfo:
    # Auto-seed if the tables don't exist yet so the first page load isn't empty.
    try:
        return await _build_schema_info(state.seed)
    except Exception:
        seed = random.randint(1, 1_000_000)
        await data_gen.reset_data(seed)
        state.seed = seed
        return await _build_schema_info(seed)


@app.post("/api/new_question", response_model=QuestionResponse)
async def new_question(
    req: NewQuestionRequest,
    state: SessionDep,
) -> QuestionResponse:
    schema = await data_gen.get_schema_info()
    recent = [q.question for q in state.question_history[:8]]
    recent_shapes = [q.shape_id for q in state.question_history[:8] if q.shape_id]
    try:
        data = await llm.generate_question(
            schema,
            req.concept,
            req.difficulty,
            recent_questions=recent,
            recent_shapes=recent_shapes,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    state.last_grade = None

    # Run the reference SQL once so the frontend can offer "peek expected" up front.
    expected = await _run_reference(data["reference_sql"])
    schema_context = _build_question_schema_context(data["reference_sql"], schema)

    q = CurrentQuestion(
        id=str(uuid.uuid4()),
        question=data["question"],
        reference_sql=data["reference_sql"],
        ordered_results=bool(data["ordered_results"]),
        concepts=list(data["concepts"]),
        difficulty=data["difficulty"],
        expected_output=expected.model_dump() if expected else None,
        schema_context=schema_context.model_dump(),
        shape_id=data.get("_shape_id"),
    )
    state.current_question = q
    _remember_question(state, q)

    # Pre-generate the solution in the background so "Show answer" is instant
    # when the user finally clicks it. Fire-and-forget; failures are silent.
    asyncio.create_task(
        _precompute_solution(state, q.id, q.question, q.reference_sql, schema),
    )

    return _question_response_from_state(q)


@app.get("/api/question_history", response_model=list[QuestionHistoryItem])
async def question_history(
    state: SessionDep,
) -> list[QuestionHistoryItem]:
    return [
        QuestionHistoryItem(
            id=q.id,
            question=q.question,
            concepts=q.concepts,
            difficulty=q.difficulty,
        )
        for q in state.question_history
    ]


@app.post("/api/select_question", response_model=QuestionResponse)
async def select_question(
    req: SelectQuestionRequest,
    state: SessionDep,
) -> QuestionResponse:
    for q in state.question_history:
        if q.id == req.question_id:
            state.current_question = q
            state.last_grade = None
            _remember_question(state, q)
            return _question_response_from_state(q)
    raise HTTPException(status_code=404, detail="Question not found in history.")


_DROP_ALL_PUBLIC = sql_text(
    """
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
"""
)


@app.post("/api/curated/load", response_model=QuestionResponse)
async def load_curated_question(
    req: LoadCuratedQuestionRequest,
    state: SessionDep,
) -> QuestionResponse:
    """Apply a curated question's schema to Postgres and register it as the
    session's active question for grading. Hints and solutions stay client-side
    in curated mode, so this endpoint doesn't touch the LLM."""
    async with engine.begin() as conn:
        await conn.execute(_DROP_ALL_PUBLIC)
        # Execute the curated setup SQL. Split on semicolons because exec_driver_sql
        # only handles a single statement; the curated payload is multi-statement.
        for stmt in [s.strip() for s in req.schema_setup_sql.split(";") if s.strip()]:
            await conn.exec_driver_sql(stmt)
        # Recreate _scenario_meta so data_gen.get_schema_info() doesn't trip
        # over a missing-relation error (which would poison the txn and trigger
        # an auto-regeneration of a random AI scenario on the next /api/schema).
        await conn.exec_driver_sql(
            "CREATE TABLE _scenario_meta (id TEXT PRIMARY KEY, label TEXT NOT NULL)"
        )
        await conn.exec_driver_sql(
            "INSERT INTO _scenario_meta (id, label) VALUES ('curated', 'Curated bank')"
        )

    q = CurrentQuestion(
        id=req.id,
        question=req.prompt,
        reference_sql=req.reference_solution_sql,
        ordered_results=req.ordered_results,
        concepts=[req.concept],
        difficulty=req.difficulty,
        expected_output=req.expected_output.model_dump(),
        schema_context=req.schema_context.model_dump(),
        shape_id=None,
    )
    state.current_question = q
    state.last_grade = None
    _remember_question(state, q)
    return _question_response_from_state(q)


@app.post("/api/run_query", response_model=RunQueryResponse)
async def run_query(req: RunQueryRequest) -> RunQueryResponse:
    """Execute the learner's SQL read-only and return the rows. No grading,
    no comparison to the reference. Used for free-form iteration."""
    normalized = req.sql.strip().rstrip(";")
    if not READONLY_PATTERN.search(normalized) or WRITE_PATTERN.search(normalized):
        return RunQueryResponse(
            status="error",
            error_message="Only SELECT or WITH queries can be run here.",
        )

    started = perf_counter()
    try:
        async with engine.connect() as conn:
            trans = await conn.begin()
            try:
                await conn.execute(sql_text("SET LOCAL statement_timeout = '5s'"))
                result = await conn.execute(sql_text(normalized))
                cols = list(result.keys())
                rows = [[_json_safe(v) for v in r] for r in result.fetchall()]
            finally:
                await trans.rollback()
    except Exception as e:
        return RunQueryResponse(
            status="error",
            error_message=str(e).split("\n")[0],
            execution_time_ms=round((perf_counter() - started) * 1000, 2),
        )

    return RunQueryResponse(
        status="ok",
        output=TableResult(columns=cols, rows=rows),
        execution_time_ms=round((perf_counter() - started) * 1000, 2),
    )


@app.post("/api/submit", response_model=GradeResult)
async def submit(
    req: SubmitRequest,
    state: SessionDep,
) -> GradeResult:
    q = state.current_question
    if q is None:
        raise HTTPException(status_code=400, detail="No active question. Request a new one first.")

    result = await grade(req.sql, q.reference_sql, q.ordered_results)
    state.last_grade = LastGrade(
        user_sql=req.sql,
        user_output=result.user_output.model_dump() if result.user_output else None,
        expected_output=result.expected_output.model_dump() if result.expected_output else None,
        error_message=result.error_message,
        status=result.status,
    )
    return result


@app.post("/api/explain", response_model=ExplainResponse)
async def explain(
    req: ExplainRequest,
    state: SessionDep,
) -> ExplainResponse:
    q = state.current_question
    g = state.last_grade
    if q is None or g is None:
        raise HTTPException(status_code=400, detail="No graded submission to explain.")

    try:
        data = await llm.explain_mistake(
            question=q.question,
            reference_sql=q.reference_sql,
            user_sql=req.sql or g.user_sql,
            user_output=g.user_output,
            expected_output=g.expected_output,
            error_message=g.error_message,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return ExplainResponse(
        explanation=data["explanation"],
        typo_corrections=[TypoCorrection(**t) for t in data["typo_corrections"]],
    )


@app.post("/api/error_help", response_model=ErrorHelpResponse)
async def error_help(
    state: SessionDep,
) -> ErrorHelpResponse:
    q = state.current_question
    g = state.last_grade
    if q is None or g is None or g.status != "error" or not g.error_message:
        raise HTTPException(status_code=400, detail="No SQL error to explain.")

    schema = await data_gen.get_schema_info()
    try:
        data = await llm.explain_sql_error(
            question=q.question,
            user_sql=g.user_sql,
            error_message=g.error_message,
            schema_info=schema,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return ErrorHelpResponse(
        explanation=data["explanation"],
        next_step=data["next_step"],
        suggested_sql=data.get("suggested_sql"),
    )


@app.post("/api/performance", response_model=PerformanceResponse)
async def performance(
    req: PerformanceRequest,
    state: SessionDep,
) -> PerformanceResponse:
    """EXPLAIN ANALYZE the user's SQL. If there's an active question, also
    benchmark the reference SQL alongside and feed both plans to the LLM for
    a coached review. If there's no active question (free-form Run flow),
    return just the plan + timing — no LLM call, no comparison."""
    q = state.current_question

    try:
        user_plan, user_time_ms = await _explain_analyze(req.sql)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if q is None:
        return PerformanceResponse(
            user_time_ms=user_time_ms,
            reference_time_ms=None,
            raw_plan=user_plan,
            summary=f"Query ran in {user_time_ms} ms.",
            suggestions=[],
            optimized_sql=None,
        )

    try:
        _, reference_time_ms = await _explain_analyze(q.reference_sql)
    except Exception:
        reference_time_ms = None

    schema = await data_gen.get_schema_info()
    try:
        data = await llm.review_performance(
            question=q.question,
            user_sql=req.sql,
            reference_sql=q.reference_sql,
            schema_info=schema,
            user_plan=user_plan,
            user_time_ms=user_time_ms,
            reference_time_ms=reference_time_ms,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return PerformanceResponse(
        user_time_ms=user_time_ms,
        reference_time_ms=reference_time_ms,
        raw_plan=user_plan,
        summary=data["summary"],
        suggestions=data["suggestions"],
        optimized_sql=data["optimized_sql"],
    )


@app.post("/api/hint", response_model=HintResponse)
async def hint(
    req: HintRequest,
    state: SessionDep,
) -> HintResponse:
    q = state.current_question
    if q is None:
        raise HTTPException(status_code=400, detail="No active question.")

    schema = await data_gen.get_schema_info()
    try:
        data = await llm.give_hint(
            question=q.question,
            reference_sql=q.reference_sql,
            schema_info=schema,
            user_sql=req.sql,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return HintResponse(
        hint=data["hint"],
        suggested_sql=data.get("suggested_sql"),
    )


@app.post("/api/give_up", response_model=GiveUpResponse)
async def give_up(
    state: SessionDep,
) -> GiveUpResponse:
    q = state.current_question
    if q is None:
        raise HTTPException(status_code=400, detail="No active question.")

    # Use the pre-computed solution from new_question if the background task
    # already finished; otherwise generate on demand and cache for next time.
    data = q.solution
    if data is None:
        schema = await data_gen.get_schema_info()
        try:
            data = await llm.explain_solution(q.question, q.reference_sql, schema)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
        q.solution = data

    breakdown_raw = data.get("breakdown") or []
    breakdown_items: list[BreakdownItem] = []
    for item in breakdown_raw:
        if isinstance(item, dict) and "phrase" in item and "means" in item:
            breakdown_items.append(BreakdownItem(phrase=item["phrase"], means=item["means"]))

    return GiveUpResponse(
        reference_sql=q.reference_sql,
        summary=data.get("summary", ""),
        breakdown=breakdown_items,
        approach=data.get("approach", ""),
        steps=[SolutionStep(**s) for s in data.get("steps", [])],
        final_thought=data.get("final_thought", ""),
    )
