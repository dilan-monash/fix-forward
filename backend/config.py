"""Environment-only configuration.

No database password is stored in source control. The hosting platform injects
DATABASE_URL at runtime, and local developers use an ignored .env/shell variable.
"""

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    database_url: str
    release_version: str
    db_connect_timeout: int

    @classmethod
    def from_environment(cls):
        timeout_text = os.getenv("DB_CONNECT_TIMEOUT", "5")
        try:
            timeout = max(1, min(int(timeout_text), 15))
        except ValueError:
            timeout = 5
        return cls(
            database_url=os.getenv("DATABASE_URL", "").strip(),
            release_version=os.getenv(
                "RELEASE_VERSION", "iteration-1-v1.2.0"
            ).strip(),
            db_connect_timeout=timeout,
        )
