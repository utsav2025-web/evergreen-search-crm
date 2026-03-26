"""Application configuration via Pydantic Settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ───────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_NAME: str = "Evergreen Search"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    SESSION_COOKIE_NAME: str = "sf_session"
    SESSION_MAX_AGE: int = 2592000  # 30 days

    # ── Database ──────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./searchfund.db"

    # ── Redis / Celery ────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── Users ─────────────────────────────────────────────────────
    USER_MATT_PASSWORD: str = "changeme_matt"
    USER_UTSAV_PASSWORD: str = "changeme_utsav"

    # ── Google OAuth ──────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/email/oauth/callback"

    # ── OpenAI ────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""

    # ── Email Ingestion Webhook ─────────────────────────────────
    # Secret token required to POST to /api/email-ingest/webhook
    EMAIL_INGEST_TOKEN: str = "change-me-ingest-token"

    # ── Scraper ───────────────────────────────────────────────
    SCRAPER_DELAY_SECONDS: int = 2
    SCRAPER_MAX_RETRIES: int = 3

    # ── Outbound Communications ───────────────────────────────────
    # When True, all outbound send endpoints (email, SMS, calls) return 503.
    # Set to False only when outbound integrations are fully configured and tested.
    OUTBOUND_DISABLED: bool = True

    # ── CORS ──────────────────────────────────────────────────────
    # Base origins always allowed
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]
    # Add your Netlify URL here (or set via env var as a comma-separated string)
    # e.g. CORS_ORIGINS_EXTRA=https://your-app.netlify.app,https://custom-domain.com
    CORS_ORIGINS_EXTRA: str = ""

    @property
    def all_cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.CORS_ORIGINS_EXTRA.split(",") if o.strip()]
        return self.CORS_ORIGINS + extra


settings = Settings()
