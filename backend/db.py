"""Small read-only PostgreSQL access layer."""

from flask import current_app


class DatabaseUnavailable(RuntimeError):
    """Raised when public data cannot be read without exposing DB details."""


def fetch_all(query, params=()):
    """Execute one parameterised SELECT and return rows as dictionaries.

    A new connection per request is acceptable for this small Iteration 1 service
    because Neon supplies a pooled connection endpoint. The deployed application
    role must also have SELECT-only permissions as a second protection layer.
    """

    database_url = current_app.config.get("DATABASE_URL", "")
    if not database_url:
        raise DatabaseUnavailable("DATABASE_URL is not configured")

    try:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(
            database_url,
            connect_timeout=current_app.config.get("DB_CONNECT_TIMEOUT", 5),
            row_factory=dict_row,
        ) as connection:
            # Even if the credential is accidentally over-privileged, this
            # transaction rejects writes made through this API connection.
            connection.read_only = True
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                return list(cursor.fetchall())
    except Exception as error:
        # The original error remains chained for server-side diagnosis, but API
        # clients receive only a generic data-unavailable response.
        raise DatabaseUnavailable("The public database could not be read") from error


def fetch_one(query, params=()):
    rows = fetch_all(query, params)
    return rows[0] if rows else None

