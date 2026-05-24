"""Shared FastAPI dependencies."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request, Response

from .state import SessionState, get_session_state

SESSION_COOKIE = "sql_session_id"


def session_dep(request: Request, response: Response) -> SessionState:
    """Return the SessionState for this browser, setting a session cookie if absent."""
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        sid = str(uuid.uuid4())
        response.set_cookie(
            SESSION_COOKIE,
            sid,
            max_age=60 * 60 * 24 * 30,
            samesite="lax",
            httponly=False,
            path="/",
        )
    return get_session_state(sid)


SessionDep = Annotated[SessionState, Depends(session_dep)]
