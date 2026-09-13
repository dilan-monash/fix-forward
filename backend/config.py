# Configuration adapter used by the application factory and in-process diagnostic.
# Read environment settings and an optional local .env; never return secret values through the public API.

"""Environment-only configuration.

No database password is stored in source control. The hosting platform injects
DATABASE_URL at runtime, and local developers use an ignored .env/shell variable.
"""

from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
# Hold an immutable snapshot of backend configuration for one application instance.
class Settings:
    database_url: str
    release_version: str
    db_connect_timeout: int
    site_password: str
    secret_key: str
    session_cookie_secure: bool

    @classmethod
    # Prefer existing environment values, bound the connection timeout and retain the exact shared password.
    def from_environment(cls):
        # The local setup instructions promise .env support. Read it here so
        # python app.py, Gunicorn and the diagnostic use the same settings.
        # Hosting environment variables always take precedence.
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
        timeout_text = os.getenv("DB_CONNECT_TIMEOUT", "5")
        try:
            timeout = max(1, min(int(timeout_text), 15))
        except ValueError:
            timeout = 5
        return cls(
            database_url=os.getenv("DATABASE_URL", "").strip(),
            release_version=os.getenv(
                "RELEASE_VERSION", "iteration-2-v2.0.0-quest"
            ).strip(),
            db_connect_timeout=timeout,
            # These never enter frontend code or the public API. Keep the shared
            # password exact: spaces are significant, including during login.
            site_password=os.getenv("SITE_PASSWORD", ""),
            secret_key=os.getenv("SECRET_KEY", ""),
            session_cookie_secure=os.getenv("SESSION_COOKIE_SECURE", "true").lower() != "false",
        )
