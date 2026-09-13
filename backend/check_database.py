# Read-only diagnostic entry point for the local backend configuration, not a deployed-site or data-accuracy check.
# It calls real API handlers in process and may contact the configured PostgreSQL database; it does not start a public server.

"""Read-only checks of the database-backed endpoints, without printing secrets.

Run from the project root: python -m backend.check_database
This uses the same configuration and routes as Flask. It does not start a server
or prove that a separately deployed website has the same configuration.
"""

from __future__ import annotations

from . import create_app


DATASET_CHECKS = (
    ("/api/recalls", "recalls"),
    ("/api/sources", "sources"),
    ("/api/repair-evidence", "evidence"),
    ("/api/locations", "locations"),
)


# Check readiness first, then collect only dataset status/count results; stop early after failed connectivity.
def run_checks(app):
    """Return only safe status/count fields; never connection or row details."""
    results = []
    with app.test_client() as client:
        for path, key in (("/api/ready", None), *DATASET_CHECKS):
            response = client.get(path)
            payload = response.get_json(silent=True) or {}
            passed = response.status_code == 200
            count = None
            if key:
                rows = payload.get(key)
                passed = passed and isinstance(rows, list)
                if isinstance(rows, list):
                    count = len(rows)
            else:
                passed = passed and payload.get("database") == "available"
            results.append({
                "endpoint": path,
                "http_status": response.status_code,
                "passed": passed,
                "row_count": count,
            })
            # Avoid repeating slow connection attempts after a failed basic read.
            if path == "/api/ready" and not passed:
                break
    return results


# Load diagnostic configuration, run safe reads and distinguish missing setup, failed endpoints and empty imports.
def main():
    try:
        # This in-process diagnostic is not a public HTTP server. Bypass only
        # the visitor gate so it can check PostgreSQL independently of login.
        app = create_app({"TESTING": True, "SITE_ACCESS_ENABLED": False})
    except ImportError:
        print("SETUP NEEDED: Python dependencies are missing.")
        print("Run: python -m pip install -r requirements.txt")
        return 1

    if not app.config.get("DATABASE_URL"):
        print("NOT CONNECTED: DATABASE_URL is not configured for this app.")
        print("Copy .env.example to .env and enter the SELECT-only PostgreSQL URL locally.")
        print("Restart Flask after saving. Do not paste the URL in chat or frontend code.")
        return 1

    results = run_checks(app)
    for result in results:
        label = "PASS" if result["passed"] else "FAIL"
        count = result["row_count"]
        count_text = f", {count} rows" if count is not None else ""
        print(f"{label}: {result['endpoint']} (HTTP {result['http_status']}{count_text})")

    if not all(result["passed"] for result in results):
        print("NOT READY: at least one database/API check failed.")
        print("Check the URL, network access, schema migrations and SELECT permissions locally.")
        print("No connection string or database error details have been printed.")
        return 1

    if any(result["row_count"] == 0 for result in results):
        print("CONNECTED, BUT DATA INCOMPLETE: one or more public datasets are empty.")
        print("Check the import/seed results before relying on the website's data.")
        return 2

    print("PASS: this local Flask configuration can read all four public datasets.")
    print("This does not verify a deployed website, data accuracy, or the role's complete privileges.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
