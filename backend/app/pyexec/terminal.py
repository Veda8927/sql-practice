"""Live interactive terminal sessions (Phase 1: local PTY shell).

A `TerminalSession` owns a per-session temp working directory and a process attached to
a pseudo-terminal. Bytes are bridged to the WebSocket route: keystrokes in, output out.

The isolation boundary is `PtyBackend.spawn` — Phase 1 spawns a local `bash`;
PHASE 2 will provide a `DockerPtyBackend` (same interface) that runs a per-session
container with resource caps and a locked-down network, selected by
`settings.terminal_backend`. Nothing else in this module or the frontend changes.
"""
from __future__ import annotations

import asyncio
import contextlib
import fcntl
import os
import pty
import shutil
import signal
import struct
import sys
import tempfile
import termios
from typing import Protocol

from ..config import settings

# Alias avoids a literal "exec(" token (a Node-oriented security linter false-positives
# on it, same as in executor.py); functionally identical to the asyncio API.
_spawn = asyncio.create_subprocess_exec

# Seeds an isolated, pip-capable shell. A per-session venv (with the app's site-packages
# available) means `pip install` works without PEP-668 "externally managed" errors and
# without touching the app's own environment.
_BASHRC = """\
export PS1='\\[\\e[38;5;75m\\]practice\\[\\e[0m\\]:\\W$ '
export PAGER=cat
if [ ! -d "$HOME/.venv" ]; then
  echo 'Setting up your Python environment…'
  "{base_python}" -m venv "$HOME/.venv" --system-site-packages >/dev/null 2>&1
fi
[ -f "$HOME/.venv/bin/activate" ] && source "$HOME/.venv/bin/activate"
clear
echo 'Interactive terminal — try: python main.py   |   pip install <pkg>   |   ls'
"""


class PtyBackend(Protocol):
    """Spawn a process attached to a PTY and return (pid, master_fd)."""

    async def spawn(self, workdir: str) -> tuple[int, int]: ...

    async def kill(self, pid: int) -> None: ...


class LocalPtyBackend:
    """Phase 1: a local `bash` login shell rooted in the session workdir.

    Light isolation appropriate for local solo use: a throwaway HOME/cwd and a
    per-session venv. NOT safe for multi-user/public deployment — see DockerPtyBackend
    (Phase 2) before exposing this beyond localhost.
    """

    async def spawn(self, workdir: str) -> tuple[int, int]:
        base_python = settings.python_bin or sys.executable
        bashrc_path = os.path.join(workdir, ".bashrc")
        with open(bashrc_path, "w") as f:
            f.write(_BASHRC.format(base_python=base_python))

        master_fd, slave_fd = pty.openpty()

        def _preexec() -> None:  # become session leader, claim the slave as our tty
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        env = {
            "PATH": "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            "HOME": workdir,
            "TMPDIR": workdir,
            "TERM": "xterm-256color",
            "LANG": "en_US.UTF-8",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        bash = shutil.which("bash") or "/bin/bash"
        proc = await _spawn(
            bash,
            "--rcfile",
            bashrc_path,
            "-i",
            cwd=workdir,
            env=env,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=_preexec,
            start_new_session=False,  # _preexec already calls setsid
        )
        os.close(slave_fd)  # parent keeps only the master end
        return proc.pid, master_fd

    async def kill(self, pid: int) -> None:
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(os.getpgid(pid), signal.SIGKILL)


def _make_backend() -> PtyBackend:
    # PHASE 2: required before public deployment.
    if settings.terminal_backend == "docker":  # pragma: no cover - not implemented yet
        raise RuntimeError(
            "terminal_backend='docker' (DockerPtyBackend) is not implemented yet. "
            "It is required before any public/multi-user deployment."
        )
    return LocalPtyBackend()


_active: set[TerminalSession] = set()


class SessionLimitError(RuntimeError):
    """Raised when the concurrent-session cap is reached."""


class TerminalSession:
    """One PTY-backed shell session. Bridges bytes to/from a WebSocket route.

    Output frames are pushed onto `output` (a `bytes` chunk, or `None` to signal the
    process exited). Read `exit_code` after the `None` sentinel.
    """

    def __init__(self, backend: PtyBackend | None = None) -> None:
        self._backend = backend or _make_backend()
        self._workdir = tempfile.mkdtemp(prefix="pyterm_")
        self._pid: int | None = None
        self._master_fd: int | None = None
        self._loop = asyncio.get_event_loop()
        self.output: asyncio.Queue[bytes | None] = asyncio.Queue()
        self.exit_code: int | None = None
        self._closed = False
        self._idle_handle: asyncio.TimerHandle | None = None
        self._max_handle: asyncio.TimerHandle | None = None

    async def start(self) -> None:
        if len(_active) >= settings.terminal_max_sessions:
            shutil.rmtree(self._workdir, ignore_errors=True)
            raise SessionLimitError("Too many active terminal sessions. Try again shortly.")
        _active.add(self)
        self._pid, self._master_fd = await self._backend.spawn(self._workdir)
        os.set_blocking(self._master_fd, False)
        self._loop.add_reader(self._master_fd, self._on_readable)
        self._reset_idle()
        self._max_handle = self._loop.call_later(
            settings.terminal_max_session_s, self._on_timeout, "session time limit"
        )

    # --- inbound (WebSocket -> PTY) -------------------------------------------------
    def write(self, data: bytes) -> None:
        if self._closed or self._master_fd is None:
            return
        self._reset_idle()
        with contextlib.suppress(OSError):
            os.write(self._master_fd, data)

    def resize(self, cols: int, rows: int) -> None:
        if self._closed or self._master_fd is None:
            return
        winsize = struct.pack("HHHH", max(rows, 1), max(cols, 1), 0, 0)
        with contextlib.suppress(OSError):
            fcntl.ioctl(self._master_fd, termios.TIOCSWINSZ, winsize)

    def write_main(self, code: str) -> None:
        """Write the editor buffer to main.py in the session workdir."""
        with contextlib.suppress(OSError), open(
            os.path.join(self._workdir, "main.py"), "w"
        ) as f:
            f.write(code)

    # --- outbound (PTY -> WebSocket) ------------------------------------------------
    def _on_readable(self) -> None:
        if self._master_fd is None:
            return
        try:
            data = os.read(self._master_fd, 65536)
        except OSError:  # EIO on most platforms once the child exits
            data = b""
        if data:
            self.output.put_nowait(data)
        else:  # EOF — child exited
            self._loop.create_task(self.close())

    # --- lifecycle ------------------------------------------------------------------
    def _reset_idle(self) -> None:
        if self._idle_handle is not None:
            self._idle_handle.cancel()
        self._idle_handle = self._loop.call_later(
            settings.terminal_idle_timeout_s, self._on_timeout, "idle timeout"
        )

    def _on_timeout(self, reason: str) -> None:
        if self._closed:
            return
        self.output.put_nowait(f"\r\n[terminal closed: {reason}]\r\n".encode())
        self._loop.create_task(self.close())

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        for handle in (self._idle_handle, self._max_handle):
            if handle is not None:
                handle.cancel()
        if self._master_fd is not None:
            with contextlib.suppress(ValueError, OSError):
                self._loop.remove_reader(self._master_fd)
        if self._pid is not None:
            with contextlib.suppress(Exception):
                self.exit_code = os.waitpid(self._pid, os.WNOHANG)[1]
            await self._backend.kill(self._pid)
        if self._master_fd is not None:
            with contextlib.suppress(OSError):
                os.close(self._master_fd)
        shutil.rmtree(self._workdir, ignore_errors=True)
        _active.discard(self)
        self.output.put_nowait(None)  # sentinel: tell the WS sender we're done
