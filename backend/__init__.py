# Application assembly: app.py, diagnostics and tests call create_app to get a configured Flask instance.
# This file connects the access gate, read-only API and explicit adult/Quest asset routes; it does not run imports or migrations.

"""Flask application factory for the FixForward public-data API."""

from pathlib import Path
import hashlib
import re

from .config import Settings


PROJECT_ROOT = Path(__file__).resolve().parents[1]
# This shared stylesheet is an exact public asset, not a wildcard for source files.
FRONTEND_FILES = {"index.html", "styles.css", "favicon.svg", "404.html", "500.html", "src/photo-helper.css"}

# The I3 family world is a reviewed entry point, not an open prototype directory.
# Exact names keep tests, local servers, documentation and future experiments private.
WORLD_FRONTEND_ASSETS = {
    f"prototypes/i3-world-preview/{name}" for name in (
        "index.html", "app.js", "world.css", "world-engine.js", "models.js",
        "explore.js", "explore.css", "catalogue.js", "action.js", "action.css",
        "progress.js", "vendor/three.module.js", "vendor/three.core.js",
        "vendor/OrbitControls.js",
    )
} | {"prototypes/i3-family-preview/sorting.js", "prototypes/i3-family-preview/sorting.css"}

# The disabled SigLIP candidate may serve only these reviewed, same-origin files.
# Keeping exact names here prevents the model folders becoming directory servers.
SIGLIP_PUBLIC_ASSETS = {
    "model/appliance-siglip/model_manifest.json",
    "model/appliance-siglip/text-embeddings.json",
    "model/appliance-siglip/text-embeddings.f32",
    "vendor/transformers/transformers.min.js",
    "vendor/transformers/ort-wasm-simd-threaded.jsep.mjs",
    "vendor/transformers/ort-wasm-simd-threaded.jsep.wasm",
    "model/appliance-siglip/upstream/siglip2-base-patch32-256/config.json",
    "model/appliance-siglip/upstream/siglip2-base-patch32-256/preprocessor_config.json",
    "model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/vision_model.9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499_q4.onnx",
}

# Python does not know the ONNX or raw float extensions. Explicit MIME types
# keep nosniff enabled while allowing browser WASM/model fetches to succeed.
SIGLIP_ASSET_MIME = {
    ".f32": "application/octet-stream",
    ".onnx": "application/octet-stream",
    ".wasm": "application/wasm",
    ".mjs": "text/javascript; charset=utf-8",
}

# The browser deliberately avoids downloading the large model twice merely to
# hash it. Flask therefore verifies each executable/model artifact once per file
# version before serving it, then reuses the result while size and mtime match.
SIGLIP_ASSET_INTEGRITY = {
    "model/appliance-siglip/text-embeddings.json": (3037, "4b01be52acad78dae1783978e1bc191d50532dc63781a5cd7b96e24f3a390093"),
    "model/appliance-siglip/text-embeddings.f32": (89088, "2e63f55601cf3f011bf13b3c347bd456111c1b8132f9d8164105fff0a29877f2"),
    "vendor/transformers/transformers.min.js": (888173, "aa5002b70e789798da263f5f99c62bd3e8fcd0c119258a493c40c180648365fa"),
    "vendor/transformers/ort-wasm-simd-threaded.jsep.mjs": (44484, "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9"),
    "vendor/transformers/ort-wasm-simd-threaded.jsep.wasm": (21596019, "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39"),
    "model/appliance-siglip/upstream/siglip2-base-patch32-256/config.json": (480, "9b84493fcc18f5ea0bb6b763ee0e740ea77e4323c431072834a1a8f80a1a21a4"),
    "model/appliance-siglip/upstream/siglip2-base-patch32-256/preprocessor_config.json": (394, "d14ba2ee3fd816f3de8abaddc31953565128eaf37c73ad4bed32101a98465aff"),
    "model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/vision_model.9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499_q4.onnx": (69938403, "9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499"),
}


# Build one Flask application and attach its configuration, routes and response protections.
def create_app(test_config=None):
    """Create an isolated app instance.

    An application factory keeps configuration out of module globals and makes the
    service easier to test. It also prevents a database connection from opening at
    import time.
    """

    from flask import Flask, jsonify, redirect, request, send_from_directory
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
        PRICE_CATALOGUE_STORAGE=settings.price_catalogue_storage,
    )
    if test_config:
        app.config.update(test_config)

    # Hosting platforms terminate HTTPS before forwarding the request to Gunicorn.
    # Trust exactly one proxy so Flask can still determine the original scheme/host.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    app.register_blueprint(api)
    configure_access(app)
    siglip_integrity_cache = {}

    # Fail closed if a deployed executable/model file no longer matches the
    # reviewed bytes. The cache key includes file metadata, so a replacement is
    # hashed again without imposing a 70 MB hash on every request.
    def siglip_asset_has_expected_bytes(asset_path):
        expected = SIGLIP_ASSET_INTEGRITY.get(asset_path)
        if expected is None:
            return True
        file_path = PROJECT_ROOT / asset_path
        try:
            stat = file_path.stat()
        except OSError:
            return False
        expected_size, expected_digest = expected
        if stat.st_size != expected_size:
            return False
        cache_key = (stat.st_size, stat.st_mtime_ns)
        if siglip_integrity_cache.get(asset_path, {}).get("key") == cache_key:
            return siglip_integrity_cache[asset_path]["valid"]
        hasher = hashlib.sha256()
        try:
            with file_path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    hasher.update(chunk)
        except OSError:
            return False
        valid = hasher.hexdigest() == expected_digest
        siglip_integrity_cache[asset_path] = {"key": cache_key, "valid": valid}
        return valid

    @app.get("/")
    @app.get("/index.html")
    # The same access gate now opens the unified I3 world. Its API calls remain
    # same-origin GET requests to the existing read-only Flask routes below.
    def index():
        return send_from_directory(PROJECT_ROOT / "prototypes/i3-world-preview", "index.html")

    @app.get("/legacy")
    # Keep the approved earlier adult journey available without copying or changing it.
    def legacy():
        return send_from_directory(PROJECT_ROOT, "index.html")

    @app.get("/legacy/")
    def legacy_slash():
        # Its relative stylesheet/script paths require the slash-free document URL.
        return redirect("/legacy", code=302)

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
        allowed = asset_path in FRONTEND_FILES or asset_path in WORLD_FRONTEND_ASSETS or (
            # Only direct app modules are public; src/../prototype tests must
            # not bypass the exact world allowlist through an alternate path.
            re.fullmatch(r"src/[A-Za-z0-9_-]+\.js", asset_path) is not None
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
            # Browser inference assets are explicitly allowlisted; arbitrary model
            # files must never become downloadable through the frontend route.
            re.fullmatch(
                r"model/appliance-classifier/(?:model\.json|labels\.json|model_manifest\.json|group\d+-shard\d+of\d+\.bin)",
                asset_path,
            ) is not None
        ) or (
            asset_path in SIGLIP_PUBLIC_ASSETS
        ) or (
            # Only generated, content-addressed story audio is public, not arbitrary files.
            re.fullmatch(r"quest/audio/[a-f0-9]{16}\.mp3", asset_path) is not None
        )
        if not allowed:
            return _not_found_response(request.path)
        if asset_path in SIGLIP_PUBLIC_ASSETS and not siglip_asset_has_expected_bytes(asset_path):
            # A generic unavailable response keeps corrupt model details out of
            # the UI; the photo helper converts this into its manual fallback.
            return "Asset unavailable", 503
        response = send_from_directory(PROJECT_ROOT, asset_path)
        explicit_mime = SIGLIP_ASSET_MIME.get(Path(asset_path).suffix.lower())
        if explicit_mime:
            response.headers["Content-Type"] = explicit_mime
        return response

    @app.after_request
    # Attach browser protections to every response; HTTPS-only HSTS depends on the trusted proxy scheme.
    def add_security_headers(response):
        # Inline styles remain in the Iteration 1 UI, hence style-src unsafe-inline.
        # Leaflet 1.9.4 is loaded only on the map screen and pinned with Subresource Integrity.
        # The optional inference runtime is local; WebAssembly compilation gets
        # its narrow CSP token without granting general JavaScript eval.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://unpkg.com 'wasm-unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com; "
            "img-src 'self' data: https://tile.openstreetmap.org https://unpkg.com; "
            "connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            # WebXR may use spatial tracking after an explicit user permission.
            # Same-origin camera permission does not start capture on page load.
            "camera=(self), xr-spatial-tracking=(self), microphone=(), geolocation=(self), payment=(), usb=()"
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
