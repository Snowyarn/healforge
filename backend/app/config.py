"""Application settings loaded from environment / .env (never from Vite)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database (Supabase PostgreSQL is the authoritative data source)
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres"
    database_schema: str = "public"

    # Supabase Platform Connection
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9."
        "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    supabase_service_role_key: str = ""

    # AI Provider: "nebius" (hackathon default) or "nvidia"
    ai_provider: str = "nebius"

    # Nebius Token Factory (backend-only secret; OpenAI-compatible)
    nebius_api_key: str = ""
    nebius_base_url: str = "https://api.tokenfactory.nebius.com/v1"
    nebius_model: str = "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF"
    nebius_timeout_seconds: float = 60.0
    nebius_max_output_tokens: int = 2048

    # NVIDIA NIM (alternative provider)
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model_id: str = "nvidia/nemotron-3-super-120b-a12b"
    nvidia_timeout_seconds: float = 60.0
    nvidia_max_output_tokens: int = 2048

    # Auth & Identity (aligned with Supabase seed user Alex Vance)
    healforge_single_user: bool = False
    healforge_default_user_email: str = "alex.vance@healforge.internal"
    healforge_default_user_id: str = "00000000-0000-0000-0000-000000000001"
    session_ttl_hours: int = 168

    # Deployment mode: "local" (developer machine) or "production" (real deployment).
    healforge_env: str = "local"
    # Escape hatch for operators who accept the risk of a shared dev owner in production.
    # Not recommended; requires an explicit additional opt-in.
    healforge_allow_single_user_in_production: bool = False

    # Background jobs. The only supported backend today is an in-process thread
    # pool: NOT durable across restarts (interrupted jobs are honestly marked
    # failed). A real broker (e.g. Celery + RabbitMQ) is required for durable
    # production queues; see README "Background jobs".
    job_backend: str = "in_process"

    # Verification runner — execution stays disabled until isolation is proven.
    runner_verified: bool = False

    # Upload limits
    max_archive_bytes: int = 20 * 1024 * 1024
    max_archive_entries: int = 500
    max_file_bytes: int = 256 * 1024
    max_total_text_bytes: int = 8 * 1024 * 1024

    # CORS: exact origins, comma separated
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    semgrep_available: bool = False

    @field_validator("healforge_env")
    @classmethod
    def _validate_env(cls, value: str) -> str:
        v = (value or "local").strip().lower()
        if v not in ("local", "production"):
            raise ValueError("healforge_env must be 'local' or 'production'")
        return v

    @field_validator("job_backend")
    @classmethod
    def _validate_job_backend(cls, value: str) -> str:
        v = (value or "in_process").strip().lower()
        if v != "in_process":
            raise ValueError(
                "job_backend currently supports only 'in_process' (local development). "
                "Durable queue backends are a documented production prerequisite."
            )
        return v

    @field_validator("database_url", mode="after")
    @classmethod
    def _normalize_db_url(cls, value: str) -> str:
        """Accept both SQLAlchemy URLs and Prisma-style file: URLs from the platform env."""
        value = (value or "").strip()
        if not value:
            return "sqlite:///./healforge.db"
        if value.startswith("file:"):
            path = value[5:]
            return (
                f"sqlite://{path if path.startswith('/') else '///' + path}"
                if not path.startswith("/")
                else f"sqlite:////{path.lstrip('/')}"
            )
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def nebius_configured(self) -> bool:
        return bool(self.nebius_api_key.strip())

    @property
    def nvidia_configured(self) -> bool:
        return bool(self.nvidia_api_key.strip())

    @property
    def ai_configured(self) -> bool:
        if self.ai_provider == "nebius":
            return self.nebius_configured
        return self.nvidia_configured

    @property
    def active_ai_model(self) -> str:
        if self.ai_provider == "nebius":
            return self.nebius_model
        return self.nvidia_model_id


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
