# Live Interactive Terminal for Python Practice

**Date:** 2026-05-30
**Status:** Approved (Phase 1 = local full shell; Phase 2 = containerized, deferred)

## Problem

The Python practice view runs code as a one-shot batch: the editor buffer is written
to `main.py`, executed once under a macOS `sandbox-exec` Seatbelt profile, and
stdout/stderr are returned when the process exits. The subprocess gets **no stdin**, so
`input()` hits EOF and any interactive program is impossible. Running a bare function
definition prints nothing, which reads to users as "nothing happened."

The user wants a real terminal experience — run a program, get prompted, type input
live, and generally work the way they would in a real environment (basics → advanced),
including `python`, `pip`, `ls`, `cat`.

## Goal

A live, interactive web terminal embedded in the Python practice view, backed by a real
shell process attached to a pseudo-terminal (PTY). Phase 1 runs locally on the user's own
machine with light isolation. The terminal layer is designed so a containerized,
per-session backend can be swapped in for public deployment without changing the frontend
or the WebSocket protocol.

## Approach (chosen)

**xterm.js (browser) ↔ WebSocket ↔ PTY-backed process (FastAPI backend).** Standard web
terminal pattern. Integrates with the existing FastAPI backend, gives full control over
session lifecycle, and isolates the local-vs-container decision behind one interface.

Rejected: in-browser Pyodide (can't be a real shell — no bash/pip/ls); embedding
ttyd/gotty (separate service, awkward session/auth integration, murkier Phase-2 path).

## Architecture

### Frontend — `frontend/src/components/python/python-terminal.tsx`
- xterm.js (`@xterm/xterm`) + `@xterm/addon-fit` mounted in a new **Terminal** tab in the
  right-hand panel (alongside Output / Tests / Coach). Output tab is kept for the existing
  one-shot run.
- Opens a WebSocket to `/api/py/terminal`. Streams keystrokes up, output frames down, and
  sends `resize` on mount/container-resize so wrapping is correct.
- The **▷ Run** button now: focuses the Terminal tab and sends a `run` message (backend
  writes the current editor buffer to `main.py` and feeds `python main.py\n`). The
  terminal is otherwise free-form — `ls`, `pip install ...`, `python`, etc.
- Reconnects if the socket drops. Dark theme matched to the app.

### Backend — `backend/app/pyexec/terminal.py`
- `PtyBackend` protocol — the swappable isolation seam:
  ```python
  class PtyBackend(Protocol):
      async def spawn(self, workdir: str) -> tuple[int, int]: ...   # (pid, master_fd)
      async def kill(self, pid: int) -> None: ...
  ```
- `LocalPtyBackend` (Phase 1): `pty.openpty()`, spawn `bash` with the slave as
  controlling tty (`os.setsid` + `TIOCSCTTY` via `preexec_fn`), `cwd=workdir`,
  `HOME=workdir`, `TERM=xterm-256color`, network ON so `pip` works. A per-session venv
  (`python3 -m venv .venv --system-site-packages`) is created lazily and auto-activated via
  a seeded `.bashrc`, so `pip install` is isolated from the app's own venv.
- `TerminalSession`: owns the workdir + backend, runs an asyncio read loop on the master
  fd (`loop.add_reader`), exposes `write(data)`, `resize(cols, rows)`, `write_file(name,
  content)`, and `close()`. Enforces idle timeout, hard wall-clock cap, and process-group
  kill on close. Temp workdir removed on teardown.
- A module-level registry caps concurrent sessions.

### WebSocket route — `backend/app/pyroutes.py`
`@py_router.websocket("/api/py/terminal")`. On connect: create `TerminalSession`, then
bridge two directions concurrently — WS→session (input/resize/run) and session→WS (output
frames, exit). Teardown on disconnect/exit.

### Protocol (JSON envelopes)
- client→server: `{type:"input", data}`, `{type:"resize", cols, rows}`,
  `{type:"run", code}` (write `main.py`, send `python main.py\n`)
- server→client: `{type:"output", data}`, `{type:"exit", code}`

### Settings (`backend/app/settings` / config)
`terminal_backend` (`local`|`docker`, default `local`), `terminal_idle_timeout_s`,
`terminal_max_session_s`, `terminal_max_sessions`. All env-overridable.

## Phase 2 hook (deferred, required before public deploy)
`DockerPtyBackend` implements the same `PtyBackend` interface via `docker run` a
per-session container with CPU/memory/pid/disk caps and a locked-down network. Selected by
`terminal_backend=docker`. Frontend, protocol, and `TerminalSession` are unchanged. A
`# PHASE 2: required before public deployment` marker is left at the backend selection
point, and this is called out so the local shell is never shipped publicly by accident.

## Security posture
Phase 1 is a real shell on the user's own machine, scoped to a per-session temp dir,
network-on for pip. Acceptable for local solo use (the chosen scope). The containerized
backend is the gate before any multi-user/public deployment.

## Testing
- Backend unit tests (`backend/tests`): `TerminalSession` spawn → `echo hi\n` → reads
  `hi`; exit-code propagation; idle-timeout and max-session kill; workdir cleanup.
- Frontend: component test that the terminal mounts, sends input, renders output frames.
- Manual E2E: run a program that calls `input()` and type a response live; confirm `ls`,
  `python`, and `pip install` work.

## Non-goals (Phase 1)
Containerized isolation; multi-user concurrency hardening; a separate REPL-only mode (the
shell already provides `python`); persisting terminal scrollback across reloads.
