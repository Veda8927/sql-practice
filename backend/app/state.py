from dataclasses import dataclass, field
from threading import Lock
from typing import Any

from .clean.state import CleanSession


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
    shape_id: str | None = None
    solution: dict[str, Any] | None = None


@dataclass
class LastGrade:
    user_sql: str
    user_output: dict[str, Any] | None
    expected_output: dict[str, Any] | None
    error_message: str | None
    status: str


@dataclass
class SessionState:
    sid: str = ""
    seed: int = 42
    current_question: CurrentQuestion | None = None
    last_grade: LastGrade | None = None
    question_history: list[CurrentQuestion] = field(default_factory=list)
    schema_cache: dict[str, Any] = field(default_factory=dict)
    clean: CleanSession | None = None
    # Python practice mode (Phase 1): active exercise + last grade, stored as plain dicts.
    py_current: dict[str, Any] | None = None
    py_last_grade: dict[str, Any] | None = None


# Per-session-id state map. Two different browsers (different cookies) get
# isolated practice state. Keyed by a UUID stored in the `sql_session_id`
# cookie; created lazily on first request.
_SESSIONS: dict[str, SessionState] = {}
_SESSIONS_LOCK = Lock()


def get_session_state(session_id: str) -> SessionState:
    with _SESSIONS_LOCK:
        s = _SESSIONS.get(session_id)
        if s is None:
            s = SessionState(sid=session_id)
            _SESSIONS[session_id] = s
        return s
