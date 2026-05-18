from dataclasses import dataclass, field
from typing import Any


@dataclass
class CurrentQuestion:
    id: str
    question: str
    reference_sql: str
    ordered_results: bool
    concepts: list[str]
    difficulty: str
    expected_output: dict[str, Any] | None = None
    schema_context: dict[str, Any] | None = None


@dataclass
class LastGrade:
    user_sql: str
    user_output: dict[str, Any] | None
    expected_output: dict[str, Any] | None
    error_message: str | None
    status: str


@dataclass
class SessionState:
    seed: int = 42
    current_question: CurrentQuestion | None = None
    last_grade: LastGrade | None = None
    question_history: list[CurrentQuestion] = field(default_factory=list)
    schema_cache: dict[str, Any] = field(default_factory=dict)


session_state = SessionState()
