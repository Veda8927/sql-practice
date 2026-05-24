"""Pydantic models for the Python practice mode (kept separate from SQL schemas.py)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Difficulty = Literal["easy", "medium", "hard"]


class PyTestCase(BaseModel):
    args: list[Any] = Field(default_factory=list)
    kwargs: dict[str, Any] = Field(default_factory=dict)
    expected: Any = None
    stdin: str = ""
    expected_stdout: str | None = None


class PySolutionStep(BaseModel):
    title: str
    what_it_does: str
    code: str
    how_it_runs: str


class PyHint(BaseModel):
    hint: str
    suggested_code: str | None = None


class PyExercise(BaseModel):
    """Full exercise. AI mode stores this server-side; curated mode ships it from the client."""

    id: str
    concept: str
    difficulty: Difficulty
    kind: Literal["function", "script"] = "function"
    prompt: str
    starter_code: str = ""
    entrypoint: str | None = None
    reference_solution: str = ""
    test_cases: list[PyTestCase] = Field(default_factory=list)
    # Curated extras (client-side coaching), optional for AI exercises.
    hints: list[PyHint] = Field(default_factory=list)
    solution_steps: list[PySolutionStep] = Field(default_factory=list)
    solution_summary: str = ""
    solution_final_thought: str = ""


class PyTestResult(BaseModel):
    index: int
    passed: bool
    got: str | None = None
    expected: str | None = None
    stdout: str = ""
    error: str | None = None


class PyNewQuestionRequest(BaseModel):
    concept: str | None = None
    difficulty: Difficulty | None = None


class PyQuestionResponse(BaseModel):
    """What the client sees for an active exercise — never leaks the reference or
    per-case expected values."""

    id: str
    concept: str
    difficulty: Difficulty
    kind: Literal["function", "script"]
    prompt: str
    starter_code: str
    entrypoint: str | None
    test_count: int


class PyRunRequest(BaseModel):
    code: str


class PyRunResponse(BaseModel):
    stdout: str
    stderr: str
    timed_out: bool
    duration_ms: float
    sandboxed: bool


class PySubmitRequest(BaseModel):
    code: str


class PyGradeResult(BaseModel):
    status: Literal["correct", "wrong", "error"]
    tests: list[PyTestResult] = Field(default_factory=list)
    passed: int = 0
    total: int = 0
    error_message: str | None = None
    duration_ms: float = 0.0


class PyHintRequest(BaseModel):
    code: str | None = None


class PyHintResponse(BaseModel):
    hint: str
    suggested_code: str | None = None


class PyExplainResponse(BaseModel):
    explanation: str


class PyGiveUpResponse(BaseModel):
    reference_solution: str
    summary: str
    steps: list[PySolutionStep] = Field(default_factory=list)
    final_thought: str = ""


class LoadPyCuratedRequest(BaseModel):
    """Client ships a full curated exercise; backend registers it as the active one."""

    exercise: PyExercise
