# Shared access boundary for both adult and Quest routes; configured once by create_app.
# Flask signed cookies hold a time-limited access marker and CSRF token, not an account or appliance data.
# All protected responses are private/no-store; only liveness and the minimal access-page assets bypass the gate.

"""Shared prototype access gate, enforced before frontend and API responses.

The shared password and cookie signing key are server environment settings.
This is deliberately independent of the appliance databases and user accounts.
"""

from datetime import timedelta
import hashlib
import hmac
from pathlib import Path
import secrets
import time

from flask import (
    Blueprint, current_app, jsonify, redirect, render_template, request,
    send_from_directory, session, url_for,
)


ACCESS_SECONDS = 4 * 60 * 60
access = Blueprint("access", __name__, template_folder="templates")

# The login gate can return only to shipped page entries, never an arbitrary URL
# or an asset/API endpoint. Exact matching rejects external hosts, backslashes,
# encoded traversal and control characters without relying on browser URL repair.
RETURN_PATHS = frozenset({
    "/", "/index.html", "/quest", "/quest/", "/quest/index.html",
    "/quest?view=parents", "/quest/?view=parents", "/quest/index.html?view=parents",
})


def _return_path(value):
    """Return a known local page, falling back to home for any untrusted value."""
    return value if isinstance(value, str) and value in RETURN_PATHS else "/"


# Keep the gate enabled except for an explicitly marked internal test/diagnostic application.
def _enabled():
    # The bypass is exclusively for internal diagnostic/test app instances.
    # There is no request header, URL parameter or environment toggle to bypass.
    return not (
        current_app.config.get("TESTING") is True
        and current_app.config.get("SITE_ACCESS_ENABLED") is False
    )


# Require usable password and signing-key settings before allowing the access flow.
def _configured():
    password = current_app.config.get("SITE_PASSWORD")
    key = current_app.config.get("SECRET_KEY")
    return (
        isinstance(password, str) and 0 < len(password) <= 1024
        and isinstance(key, str) and len(key) >= 32
    )


# Tie existing signed sessions to the current shared password without putting that password in the cookie.
def _password_marker():
    # Sessions are signed, not encrypted. Store a keyed marker, never the
    # password or an unkeyed digest that could reveal a short shared password.
    return hmac.new(
        current_app.config["SECRET_KEY"].encode("utf-8"),
        current_app.config["SITE_PASSWORD"].encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


# Reject missing, expired, future-dated or password-stale session markers.
def _authenticated():
    issued_at = session.get("access_issued_at")
    marker = session.get("access_marker")
    if not isinstance(issued_at, (int, float)) or not isinstance(marker, str):
        return False
    age = time.time() - issued_at
    return 0 <= age < ACCESS_SECONDS and hmac.compare_digest(
        marker.encode("utf-8"), _password_marker().encode("utf-8")
    )


# Reuse or create the unpredictable token used by this browser session to submit access forms.
def _csrf_token():
    token = session.get("access_csrf")
    if not isinstance(token, str):
        token = secrets.token_urlsafe(32)
        session["access_csrf"] = token
    return token


# Compare the posted form token with this session so another site cannot submit the action for the visitor.
def _valid_csrf():
    supplied = request.form.get("csrf_token", "")
    expected = session.get("access_csrf")
    return isinstance(expected, str) and bool(supplied) and hmac.compare_digest(
        supplied.encode("utf-8"), expected.encode("utf-8")
    )


# Render one access-page mode and issue a CSRF token only when its form is usable.
def _page(mode="login", error=None, status=200, next_path="/"):
    return render_template(
        "access.html", mode=mode, error=error,
        csrf_token=_csrf_token() if mode != "unavailable" else None,
        next_path=_return_path(next_path),
    ), status


@access.get("/access.css")
# Serve the gate stylesheet without loading either application or contacting the database.
def stylesheet():
    return send_from_directory(Path(__file__).resolve().parent, "access.css")


@access.get("/access.js")
# Expose only this standalone public control script, never arbitrary backend files.
def script():
    return send_from_directory(Path(__file__).resolve().parent, "access.js")


@access.route("/login", methods=["GET", "POST"])
# Check CSRF and the exact shared password, then return to the validated page entry.
def login():
    # Keep the destination in this form, not a shared session variable: another
    # tab or a late asset request must not change where this login will return.
    candidate = request.form.get("next", request.args.get("next", "/")) if request.method == "POST" else request.args.get("next", "/")
    next_path = _return_path(candidate)
    if not _enabled():
        return redirect(next_path, code=303)
    if _authenticated():
        return redirect(next_path, code=303)
    if request.method == "POST":
        if not _valid_csrf():
            return _page(error="This form has expired. Please enter the website password again.", status=400, next_path=next_path)
        supplied = request.form.get("password", "")
        expected = current_app.config["SITE_PASSWORD"]
        # Bounded input avoids unnecessary work; UTF-8 bytes support any exact
        # user-selected password while compare_digest remains constant-time.
        if len(supplied) <= 1024 and hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
            session.clear()
            session.permanent = True
            session["access_marker"] = _password_marker()
            session["access_issued_at"] = time.time()
            session["access_csrf"] = secrets.token_urlsafe(32)
            # Validate again before redirecting, even if a hidden form field was
            # edited. Session renewal and password comparison are unchanged.
            return redirect(next_path, code=303)
        return _page(error="That password did not work. Check it and try again.", status=401, next_path=next_path)
    return _page(next_path=next_path)


@access.route("/logout", methods=["GET", "POST"])
# Show confirmation on GET; clear access only after a POST with a valid CSRF token.
def logout():
    if not _enabled():
        return redirect(url_for("index"), code=303)
    if request.method == "POST":
        if not _valid_csrf():
            return _page(mode="logout", error="This form has expired. Please try locking the website again.", status=400)
        session.clear()
        return redirect(url_for("access.login"), code=303)
    return _page(mode="logout")


# Configure cookie/session limits and install request and response hooks for every protected route.
def configure_access(app):
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_NAME="fixforward_access",
        SESSION_COOKIE_PATH="/",
        PERMANENT_SESSION_LIFETIME=timedelta(seconds=ACCESS_SECONDS),
        SESSION_REFRESH_EACH_REQUEST=False,
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    app.register_blueprint(access)

    @app.before_request
    # Allow the narrow public exceptions, fail closed on missing configuration and otherwise require valid access.
    def require_website_access():
        if not _enabled():
            return None
        public_asset = request.endpoint == "frontend_asset" and request.path == "/favicon.svg"
        if request.endpoint in {"api.health", "access.stylesheet", "access.script"} or public_asset:
            return None
        if not _configured():
            if request.path.startswith("/api/"):
                return jsonify(error={
                    "code": "access_unavailable",
                    "message": "Website access is temporarily unavailable. Please try again later.",
                }), 503
            return _page(mode="unavailable", status=503)
        if request.endpoint == "access.login":
            return None
        if _authenticated():
            return None
        # Remove stale authorization, preserving a pending login form's CSRF.
        # Another tab can request a protected API while that form is open.
        session.pop("access_marker", None)
        session.pop("access_issued_at", None)
        if request.path.startswith("/api/"):
            return jsonify(error={
                "code": "access_required",
                "message": "Enter the website password to continue.",
            }), 401
        # Preserve only a known requested page and its supported parent view.
        # API requests above stay JSON; scripts and unknown paths fall back home.
        next_path = _return_path(request.full_path.removesuffix("?"))
        return redirect(url_for("access.login", next=next_path) if next_path != "/" else url_for("access.login"), code=303)

    @app.after_request
    # Replace dataset cache headers so an authenticated response is not reusable after access expires.
    def protect_response_caching(response):
        if _enabled():
            # This runs after API blueprint hooks, replacing their former public
            # caching policy. Neither a shared proxy nor browser cache should
            # retain application content after the website has been locked.
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            response.vary.add("Cookie")
        return response
