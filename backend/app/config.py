from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sqlpractice"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    # Python executor (Phase 1): interpreter for running user code (empty = sys.executable).
    python_bin: str = ""
    pyexec_timeout_s: float = 6.0

    # Interactive terminal (Phase 1 = local shell). PHASE 2: set to "docker" for a
    # containerized per-session backend before any public/multi-user deployment.
    terminal_backend: str = "local"  # "local" | "docker"
    terminal_idle_timeout_s: float = 300.0  # kill after this long with no input
    terminal_max_session_s: float = 1800.0  # hard wall-clock cap per session
    terminal_max_sessions: int = 8  # concurrent session cap

    model_config = SettingsConfigDict(
        env_file=[
            Path(__file__).resolve().parent.parent.parent / ".env",
            Path(__file__).resolve().parent.parent / ".env",
        ],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
