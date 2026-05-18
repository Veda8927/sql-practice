"""FastAPI entry: routes for health, data, questions, grading, explanations."""
from __future__ import annotations

import random
import re
import uuid
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text as sql_text

from . import data_gen, llm
from .db import engine
from .grader import _json_safe, grade
from .schemas import (
    ErrorHelpResponse,
    ExplainRequest,
    ExplainResponse,
    GiveUpResponse,
    GradeResult,
    HintRequest,
    HintResponse,
    NewQuestionRequest,
    PerformanceRequest,
    PerformanceResponse,
    QuestionHistoryItem,
    QuestionResponse,
    QuestionSchemaContext,
    QuestionSchemaJoin,
    QuestionSchemaTable,
    ResetDataRequest,
    SchemaInfo,
    SelectQuestionRequest,
    SolutionStep,
    SubmitRequest,
    TableResult,
    TypoCorrection,
)
from .state import CurrentQuestion, LastGrade, session_state

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


def _remember_question(q: CurrentQuestion) -> None:
    session_state.question_history = [
        item for item in session_state.question_history if item.id != q.id
    ]
    session_state.question_history.insert(0, q)
    session_state.question_history = session_state.question_history[:10]


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
async def reset_data(req: ResetDataRequest) -> SchemaInfo:
    seed = req.seed if req.seed is not None else random.randint(1, 1_000_000)
    await data_gen.reset_data(seed)
    session_state.seed = seed
    session_state.current_question = None
    session_state.last_grade = None
    session_state.question_history = []
    return await _build_schema_info(seed)


@app.get("/api/schema", response_model=SchemaInfo)
async def get_schema() -> SchemaInfo:
    # Auto-seed if the tables don't exist yet so the first page load isn't empty.
    try:
        return await _build_schema_info(session_state.seed)
    except Exception:
        seed = random.randint(1, 1_000_000)
        await data_gen.reset_data(seed)
        session_state.seed = seed
        return await _build_schema_info(seed)


@app.post("/api/new_question", response_model=QuestionResponse)
async def new_question(req: NewQuestionRequest) -> QuestionResponse:
    schema = await data_gen.get_schema_info()
    recent = [q.question for q in session_state.question_history[:5]]
    try:
        data = await llm.generate_question(
            schema,
            req.concept,
            req.difficulty,
            recent_questions=recent,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    session_state.last_grade = None

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
    )
    session_state.current_question = q
    _remember_question(q)

    return _question_response_from_state(q)


@app.get("/api/question_history", response_model=list[QuestionHistoryItem])
async def question_history() -> list[QuestionHistoryItem]:
    return [
        QuestionHistoryItem(
            id=q.id,
            question=q.question,
            concepts=q.concepts,
            difficulty=q.difficulty,
        )
        for q in session_state.question_history
    ]


@app.post("/api/select_question", response_model=QuestionResponse)
async def select_question(req: SelectQuestionRequest) -> QuestionResponse:
    for q in session_state.question_history:
        if q.id == req.question_id:
            session_state.current_question = q
            session_state.last_grade = None
            _remember_question(q)
            return _question_response_from_state(q)
    raise HTTPException(status_code=404, detail="Question not found in history.")


@app.post("/api/submit", response_model=GradeResult)
async def submit(req: SubmitRequest) -> GradeResult:
    q = session_state.current_question
    if q is None:
        raise HTTPException(status_code=400, detail="No active question. Request a new one first.")

    result = await grade(req.sql, q.reference_sql, q.ordered_results)
    session_state.last_grade = LastGrade(
        user_sql=req.sql,
        user_output=result.user_output.model_dump() if result.user_output else None,
        expected_output=result.expected_output.model_dump() if result.expected_output else None,
        error_message=result.error_message,
        status=result.status,
    )
    return result


@app.post("/api/explain", response_model=ExplainResponse)
async def explain(req: ExplainRequest) -> ExplainResponse:
    q = session_state.current_question
    g = session_state.last_grade
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
async def error_help() -> ErrorHelpResponse:
    q = session_state.current_question
    g = session_state.last_grade
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
    )


@app.post("/api/performance", response_model=PerformanceResponse)
async def performance(req: PerformanceRequest) -> PerformanceResponse:
    q = session_state.current_question
    if q is None:
        raise HTTPException(status_code=400, detail="No active question.")

    try:
        user_plan, user_time_ms = await _explain_analyze(req.sql)
        _, reference_time_ms = await _explain_analyze(q.reference_sql)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

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
async def hint(req: HintRequest) -> HintResponse:
    q = session_state.current_question
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

    return HintResponse(hint=data["hint"])


@app.post("/api/give_up", response_model=GiveUpResponse)
async def give_up() -> GiveUpResponse:
    q = session_state.current_question
    if q is None:
        raise HTTPException(status_code=400, detail="No active question.")

    schema = await data_gen.get_schema_info()
    try:
        data = await llm.explain_solution(q.question, q.reference_sql, schema)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return GiveUpResponse(
        reference_sql=q.reference_sql,
        summary=data["summary"],
        steps=[SolutionStep(**s) for s in data["steps"]],
        final_thought=data["final_thought"],
    )
