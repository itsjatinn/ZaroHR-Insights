from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_env_file() -> Path | None:
    project_root = Path(__file__).resolve().parents[2]
    for relative in (Path(".env"), Path("server/.env")):
        candidate = project_root / relative
        if candidate.exists():
            return candidate
    return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_resolve_env_file(),
        env_file_encoding="utf-8",
        extra="allow",
    )

    database_url: str
    redis_url: str | None = None
    backend_port: int | None = None
    frontend_port: int | None = None
    frontend_base_url: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_pass: str | None = None
    from_name: str | None = None
    from_email: str | None = None
    contact_email: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
