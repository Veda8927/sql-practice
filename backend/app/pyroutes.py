"""/api/py/* routes: Python practice — run, submit, generate, coach, curated."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from . import llm
from .deps import SessionDep
from .pyexec.executor import executor
from .pyexec.grader import grade
from .pyschemas import (
    LoadPyCuratedRequest,
    PyExplainResponse,
    PyGiveUpResponse,
    PyGradeResult,
    PyHintRequest,
    PyHintResponse,
    PyNewQuestionRequest,
    PyQuestionResponse,
    PyRunRequest,
    PyRunResponse,
    PySolutionStep,
    PySubmitRequest,
    PyTestResult,
)

router = APIRouter(prefix="/api/py", tags=["python"])

_DIFFS = {"easy", "medium", "hard"}


def _coerce_difficulty(value: Any, fallback: str | None) -> str:
    if value in _DIFFS:
        return value
    if fallback in _DIFFS:
        return fallback
    return "easy"


def _question_response(ex: dict[str, Any]) -> PyQuestionResponse:
    return PyQuestionResponse(
        id=ex["id"],
        concept=ex.get("concept", "general"),
        difficulty=_coerce_difficulty(ex.get("difficulty"), None),
        kind=ex.get("kind", "function"),
        prompt=ex["prompt"],
        starter_code=ex.get("starter_code", ""),
        entrypoint=ex.get("entrypoint"),
        test_count=len(ex.get("test_cases", []) or []),
    )


def _exercise_from_llm(data: dict[str, Any], req: PyNewQuestionRequest) -> dict[str, Any]:
    concepts = data.get("concepts") or ([req.concept] if req.concept else ["general"])
    return {
        "id": str(uuid.uuid4()),
        "concept": (concepts[0] if concepts else "general") or "general",
        "difficulty": _coerce_difficulty(data.get("difficulty"), req.difficulty),
        "kind": data.get("kind", "function"),
        "prompt": data.get("prompt", ""),
        "starter_code": data.get("starter_code", ""),
        "entrypoint": data.get("entrypoint"),
        "reference_solution": data.get("reference_solution", ""),
        "test_cases": data.get("test_cases", []) or [],
    }


@router.post("/new_question", response_model=PyQuestionResponse)
async def new_question(req: PyNewQuestionRequest, state: SessionDep) -> PyQuestionResponse:
    last_err = ""
    for _ in range(2):  # generate, validate by grading the reference; retry once
        try:
            data = await llm.generate_python_question(req.concept, req.difficulty, [])
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=str(e)) from e
        ex = _exercise_from_llm(data, req)
        if not ex["prompt"] or not ex["test_cases"]:
            last_err = "incomplete exercise"
            continue
        res = await grade(ex["reference_solution"], ex)
        if res.status == "correct":
            state.py_current = ex
            state.py_last_grade = None
            return _question_response(ex)
        last_err = res.error_message or "reference solution did not pass its own tests"
    raise HTTPException(status_code=502, detail=f"Could not generate a valid exercise ({last_err}).")


@router.post("/run", response_model=PyRunResponse)
async def run(req: PyRunRequest) -> PyRunResponse:
    res = await executor.run(req.code)
    return PyRunResponse(
        stdout=res.stdout,
        stderr=res.stderr,
        timed_out=res.timed_out,
        duration_ms=res.duration_ms,
        sandboxed=res.sandboxed,
    )


@router.post("/submit", response_model=PyGradeResult)
async def submit(req: PySubmitRequest, state: SessionDep) -> PyGradeResult:
    ex = state.py_current
    if ex is None:
        raise HTTPException(status_code=400, detail="No active exercise. Request a new one first.")
    res = await grade(req.code, ex)
    tests = [PyTestResult(**t.__dict__) for t in res.tests]
    state.py_last_grade = {
        "code": req.code,
        "status": res.status,
        "tests": [t.__dict__ for t in res.tests],
    }
    return PyGradeResult(
        status=res.status,
        tests=tests,
        passed=res.passed,
        total=res.total,
        error_message=res.error_message,
        duration_ms=res.duration_ms,
    )


@router.post("/hint", response_model=PyHintResponse)
async def hint(req: PyHintRequest, state: SessionDep) -> PyHintResponse:
    ex = state.py_current
    if ex is None:
        raise HTTPException(status_code=400, detail="No active exercise.")
    try:
        data = await llm.python_hint(ex.get("prompt", ""), ex.get("reference_solution", ""), req.code)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return PyHintResponse(hint=data["hint"], suggested_code=data.get("suggested_code"))


@router.post("/explain", response_model=PyExplainResponse)
async def explain(state: SessionDep) -> PyExplainResponse:
    ex = state.py_current
    g = state.py_last_grade
    if ex is None or g is None:
        raise HTTPException(status_code=400, detail="No graded submission to explain.")
    failing = [t for t in g.get("tests", []) if not t.get("passed")]
    try:
        data = await llm.explain_python_mistake(
            ex.get("prompt", ""), ex.get("reference_solution", ""), g.get("code", ""), failing
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return PyExplainResponse(explanation=data["explanation"])


def _steps(raw: list[dict[str, Any]]) -> list[PySolutionStep]:
    out: list[PySolutionStep] = []
    for s in raw:
        if all(k in s for k in ("title", "what_it_does", "code", "how_it_runs")):
            out.append(PySolutionStep(**{k: s[k] for k in ("title", "what_it_does", "code", "how_it_runs")}))
    return out


@router.post("/give_up", response_model=PyGiveUpResponse)
async def give_up(state: SessionDep) -> PyGiveUpResponse:
    ex = state.py_current
    if ex is None:
        raise HTTPException(status_code=400, detail="No active exercise.")
    if ex.get("solution_steps"):  # curated exercises ship their own walkthrough
        return PyGiveUpResponse(
            reference_solution=ex.get("reference_solution", ""),
            summary=ex.get("solution_summary", ""),
            steps=_steps(ex["solution_steps"]),
            final_thought=ex.get("solution_final_thought", ""),
        )
    try:
        data = await llm.explain_python_solution(ex.get("prompt", ""), ex.get("reference_solution", ""))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return PyGiveUpResponse(
        reference_solution=ex.get("reference_solution", ""),
        summary=data.get("summary", ""),
        steps=_steps(data.get("steps", [])),
        final_thought=data.get("final_thought", ""),
    )


@router.post("/curated/load", response_model=PyQuestionResponse)
async def curated_load(req: LoadPyCuratedRequest, state: SessionDep) -> PyQuestionResponse:
    ex = req.exercise.model_dump()
    state.py_current = ex
    state.py_last_grade = None
    return _question_response(ex)
