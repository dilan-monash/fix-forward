"""Flask application factory for the FixForward public-data API."""

from pathlib import Path

from .config import Settings


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_FILES = {"index.html", "styles.css", "404.html", "500.html"}


def create_app(test_config=None):
    """Create an isolated app instance.

    An application factory keeps configuration out of module globals and makes the
    service easier to test. It also prevents a database connection from opening at
    import time.
    """

    from flask import Flask, jsonify, request, send_from_directory
    from werkzeug.middleware.proxy_fix import ProxyFix

    from .api import api

    settings = Settings.from_environment()
    app = Flask(__name__, static_folder=None)
    app.config.from_mapping(
        DATABASE_URL=settings.database_url,
        RELEASE_VERSION=settings.release_version,
        DB_CONNECT_TIMEOUT=settings.db_connect_timeout,
    )
    if test_config:
        app.config.update(test_config)

    # Hosting platforms terminate HTTPS before forwarding the request to Gunicorn.
    # Trust exactly one proxy so Flask can still determine the original scheme/host.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    app.register_blueprint(api)

    @app.get("/")
    def index():
        return send_from_directory(PROJECT_ROOT, "index.html")

    @app.get("/<path:asset_path>")
    def frontend_asset(asset_path):
        # Only public frontend assets are served. Backend code, migrations and
        # environment templates must never be downloadable from the website.
        allowed = asset_path in FRONTEND_FILES or (
            asset_path.startswith("src/") and asset_path.endswith(".js")
        )
        if not allowed:
            return _not_found_response(request.path)
        return send_from_directory(PROJECT_ROOT, asset_path)

    @app.after_request
    def add_security_headers(response):
        # Inline styles remain in the Iteration 1 UI, hence style-src unsafe-inline.
        # Scripts are still restricted to files hosted by FixForward itself.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.errorhandler(404)
    def not_found(_error):
        return _not_found_response(request.path)

    @app.errorhandler(500)
    def unexpected_error(_error):
        if request.path.startswith("/api/"):
            return jsonify(
                error={
                    "code": "internal_error",
                    "message": "The public-data service could not complete the request.",
                }
            ), 500
        return send_from_directory(PROJECT_ROOT, "500.html"), 500

    def _not_found_response(path):
        if path.startswith("/api/"):
            return jsonify(
                error={"code": "not_found", "message": "API endpoint not found."}
            ), 404
        return send_from_directory(PROJECT_ROOT, "404.html"), 404

    return app

