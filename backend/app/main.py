"""FastAPI entry: routes for health, data, questions, grading, explanations."""
from __future__ import annotations

import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text as sql_text

from . import data_gen, llm
from .db import engine
from .grader import _json_safe, grade
from .schemas import (
    ExplainRequest,
    ExplainResponse,
    GiveUpResponse,
    GradeResult,
    HintRequest,
    HintResponse,
    NewQuestionRequest,
    QuestionResponse,
    ResetDataRequest,
    SchemaInfo,
    SolutionStep,
    SubmitRequest,
    TableResult,
    TypoCorrection,
)
from .state import CurrentQuestion, LastGrade, session_state


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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="SQL Practice", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
    try:
        data = await llm.generate_question(schema, req.concept, req.difficulty)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    session_state.current_question = CurrentQuestion(
        question=data["question"],
        reference_sql=data["reference_sql"],
        ordered_results=bool(data["ordered_results"]),
        concepts=list(data["concepts"]),
        difficulty=data["difficulty"],
    )
    session_state.last_grade = None

    # Run the reference SQL once so the frontend can offer "peek expected" up front.
    expected = await _run_reference(data["reference_sql"])

    return QuestionResponse(
        question=data["question"],
        ordered_results=bool(data["ordered_results"]),
        concepts=list(data["concepts"]),
        difficulty=data["difficulty"],
        expected_output=expected,
    )


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
