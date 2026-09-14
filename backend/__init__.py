# Application assembly: app.py, diagnostics and tests call create_app to get a configured Flask instance.
# This file connects the access gate, read-only API and explicit adult/Quest asset routes; it does not run imports or migrations.

"""Flask application factory for the FixForward public-data API."""

from pathlib import Path
import re

from .config import Settings


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_FILES = {"index.html", "styles.css", "favicon.svg", "404.html", "500.html"}


# Build one Flask application and attach its configuration, routes and response protections.
def create_app(test_config=None):
    """Create an isolated app instance.

    An application factory keeps configuration out of module globals and makes the
    service easier to test. It also prevents a database connection from opening at
    import time.
    """

    from flask import Flask, jsonify, request, send_from_directory
    from werkzeug.middleware.proxy_fix import ProxyFix

    from .api import api
    from .access import configure_access

    settings = Settings.from_environment()
    app = Flask(__name__, static_folder=None)
    app.config.from_mapping(
        DATABASE_URL=settings.database_url,
        RELEASE_VERSION=settings.release_version,
        DB_CONNECT_TIMEOUT=settings.db_connect_timeout,
        SITE_PASSWORD=settings.site_password,
        SECRET_KEY=settings.secret_key,
        SITE_ACCESS_ENABLED=True,
        SESSION_COOKIE_SECURE=settings.session_cookie_secure,
    )
    if test_config:
        app.config.update(test_config)

    # Hosting platforms terminate HTTPS before forwarding the request to Gunicorn.
    # Trust exactly one proxy so Flask can still determine the original scheme/host.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    app.register_blueprint(api)
    configure_access(app)

    @app.get("/")
    # Serve the existing adult document after the shared access check has passed.
    def index():
        return send_from_directory(PROJECT_ROOT, "index.html")

    @app.get("/quest")
    @app.get("/quest/")
    # Serve the separate child document using the same access session as the adult route.
    def quest():
        # The existing before_request access gate also protects the child route.
        return send_from_directory(PROJECT_ROOT / "quest", "index.html")

    @app.get("/<path:asset_path>")
    # Serve only named public assets, so adding a child module also requires updating this allowlist.
    def frontend_asset(asset_path):
        # Only public frontend assets are served. Backend code, migrations and
        # environment templates must never be downloadable from the website.
        allowed = asset_path in FRONTEND_FILES or (
            asset_path.startswith("src/") and asset_path.endswith(".js")
        ) or (
            asset_path in {"quest/index.html", "quest/quest.css", "quest/app.js",
                           "quest/art.js", "quest/content.js", "quest/engine.js",
                           "quest/touch-fx.js", "quest/touch-fx.css", "quest/scene-play.css",
                           "quest/adventure-world.js", "quest/adventure-world.css",
                           # Local gesture help and still-learning policy stay behind the same access gate.
                           "quest/sort-demo.js", "quest/sort-demo.css", "quest/motion-context.js", "quest/learning-focus.css",
                           "quest/storage.js", "quest/drag.js", "quest/play-effects.css",
                           "quest/postcard.js", "quest/postcard-options.js",
                           "quest/progression.js", "quest/tablet-play.css",
                           "quest/navigation.js", "quest/narration.js", "quest/parent-guide.js",
                           "quest/visual-play.js", "quest/visual-play.css", "quest/word-help.js", "quest/word-help.css", "quest/haptics.js", "quest/reward-voice.js", "quest/reward-fx.js", "quest/sounds.js", "quest/game-feel.css",
                           "quest/picture-help.js", "quest/feedback.js", "quest/clue-play.css",
                           "quest/family-guide.css", "quest/story-audio.js", "quest/audio/story-manifest.js",
                           "quest/audio/KOKORO-LICENSE.txt"}
        ) or (
            # Only generated, content-addressed story audio is public, not arbitrary files.
            re.fullmatch(r"quest/audio/[a-f0-9]{16}\.mp3", asset_path) is not None
        )
        if not allowed:
            return _not_found_response(request.path)
        return send_from_directory(PROJECT_ROOT, asset_path)

    @app.after_request
    # Attach browser protections to every response; HTTPS-only HSTS depends on the trusted proxy scheme.
    def add_security_headers(response):
        # Inline styles remain in the Iteration 1 UI, hence style-src unsafe-inline.
        # Leaflet 1.9.4 is loaded only on the map screen and pinned with Subresource Integrity; all other scripts are local.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com; "
            "img-src 'self' data: https://tile.openstreetmap.org https://unpkg.com; "
            "connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(self), payment=(), usb=()"
        )
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.errorhandler(404)
    # Choose the API JSON or browser HTML response for a missing route.
    def not_found(_error):
        return _not_found_response(request.path)

    @app.errorhandler(500)
    # Return a generic failure page or JSON payload without exposing exception details.
    def unexpected_error(_error):
        if request.path.startswith("/api/"):
            return jsonify(
                error={
                    "code": "internal_error",
                    "message": "The public-data service could not complete the request.",
                }
            ), 500
        return send_from_directory(PROJECT_ROOT, "500.html"), 500

    # Keep unknown API paths machine-readable while browser paths receive the local 404 page.
    def _not_found_response(path):
        if path.startswith("/api/"):
            return jsonify(
                error={"code": "not_found", "message": "API endpoint not found."}
            ), 404
        return send_from_directory(PROJECT_ROOT, "404.html"), 404

    return app
