"""Adversarial integration checks with synthetic sessions and no database access.

The factory's environment adapter is replaced before app creation, so this
suite never reads local credentials or connects to the shared Neon database.
"""

from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import hashlib
import hmac
from pathlib import Path
import re
import sqlite3
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from backend import create_app
from backend.access_limits import ATTEMPT_LIMIT, WINDOW_SECONDS


PASSWORD = "synthetic-audit-password-only"
SIGNING_KEY = "synthetic-audit-signing-key-more-than-thirty-two-characters"
RENDER_MARKERS = {
    "RENDER": "true", "RENDER_SERVICE_TYPE": "web",
    "RENDER_EXTERNAL_HOSTNAME": "fix-forward-main.onrender.com",
}


def isolated_app(**overrides):
    settings = SimpleNamespace(
        database_url="", release_version="audit-synthetic", db_connect_timeout=1,
        site_password=PASSWORD, secret_key=SIGNING_KEY,
        session_cookie_secure=False, price_catalogue_storage="local",
    )
    with patch("backend.Settings.from_environment", return_value=settings):
        return create_app({"TESTING": True, "SITE_ACCESS_ENABLED": True, **overrides})


def csrf(client):
    with client.get("/login") as response:
        return re.search(r'name="csrf_token" value="([^"]+)"', response.text).group(1)


def submit(client, password=PASSWORD, **kwargs):
    return client.post("/login", data={"csrf_token": csrf(client), "password": password}, **kwargs)


class SecurityAuditTests(unittest.TestCase):
    def setUp(self):
        self.app = isolated_app()
        self.client = self.app.test_client()

    def unlock(self):
        with submit(self.client) as response:
            self.assertEqual(response.status_code, 303)

    def test_header_and_query_bypass_attempts_never_reach_the_repository(self):
        headers = {
            "X-Original-URL": "/", "X-Rewrite-URL": "/api/sources",
            "X-Forwarded-User": "admin", "Authorization": "Bearer synthetic-admin",
        }
        with patch("backend.api.repository.sources") as repository:
            for query in ("admin=true", "SITE_ACCESS_ENABLED=false", "TESTING=true", "auth=1", "role=admin"):
                with self.subTest(query=query), self.client.get("/api/sources?" + query, headers=headers) as response:
                    self.assertEqual(response.status_code, 401)
            repository.assert_not_called()

    def test_encoded_traversal_and_private_files_stay_unavailable_after_login(self):
        self.unlock()
        for path in (
            "/.env", "/.git/config", "/backend/access.py", "/backend/access_limits.py",
            "/src/..%2f..%2fbackend/access.py", "/src/%2e%2e/backend/config.py",
            "/%2e%2e/%2e%2e/.env", "/src/%252e%252e/%252e%252e/.env",
            "/src/..%5cbackend%5cconfig.py", "/backend%00/access.py",
            "/test_backend/test_security_audit.py", "/requirements.txt",
            "/prototypes/i3-five-games/serve.mjs", "/tmp/i3-family-site-release/.env",
        ):
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 404)
                self.assertNotIn(b"SITE_PASSWORD", response.data)
                self.assertNotIn(b"import hmac", response.data)

    def test_api_write_methods_are_rejected_without_repository_calls(self):
        self.unlock()
        with patch("backend.api.repository.sources") as repository:
            for method in ("POST", "PUT", "PATCH", "DELETE", "TRACE"):
                with self.subTest(method=method), self.client.open("/api/sources", method=method, json={"role": "admin"}) as response:
                    self.assertEqual(response.status_code, 405)
            repository.assert_not_called()

    def test_query_injection_never_becomes_a_repository_argument(self):
        self.unlock()
        payload = "' OR 1=1; SELECT pg_sleep(60); -- <script>alert(1)</script>"
        with patch("backend.api.repository.sources", return_value=[]) as repository:
            with self.client.get("/api/sources", query_string={"id": payload, "url": "http://127.0.0.1/", "path": "../../.env"}) as response:
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["sources"], [])
                self.assertNotIn(payload, response.text)
            repository.assert_called_once_with()

    def test_cross_site_api_read_does_not_receive_cors_permission(self):
        self.unlock()
        with patch("backend.api.repository.sources", return_value=[]):
            with self.client.get("/api/sources", headers={"Origin": "https://untrusted.example"}) as response:
                self.assertNotIn("Access-Control-Allow-Origin", response.headers)
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")

    def test_another_browser_csrf_token_cannot_authenticate(self):
        other = self.app.test_client()
        foreign_token = csrf(other)
        csrf(self.client)
        with self.client.post("/login", data={"password": PASSWORD, "csrf_token": foreign_token}) as response:
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_new_login_rotates_csrf_and_drops_untrusted_session_fields(self):
        old_token = csrf(self.client)
        with self.client.session_transaction() as stored:
            stored["untrusted_before_login"] = "discard-me"
        with self.client.post("/login", data={"password": PASSWORD, "csrf_token": old_token}) as response:
            self.assertEqual(response.status_code, 303)
        with self.client.session_transaction() as stored:
            self.assertNotEqual(stored["access_csrf"], old_token)
            self.assertNotIn("untrusted_before_login", stored)

    def test_previous_iteration_cookie_cannot_be_replayed_under_main_cookie_name(self):
        # Simulate an I2 cookie even when both deployments accidentally reuse
        # their secret/password. Rename it to Main to bypass only browser scoping;
        # the server's audience-bound marker must still reject it.
        self.unlock()
        with self.client.session_transaction() as stored:
            payload = dict(stored)
        old_marker = hmac.new(SIGNING_KEY.encode(), PASSWORD.encode(), hashlib.sha256).hexdigest()
        serializer = self.app.session_interface.get_signing_serializer(self.app)
        # Keep a valid current registry nonce in this deliberately stronger
        # fixture, proving the audience check itself rejects the old marker.
        payload["access_marker"] = old_marker
        old_cookie = serializer.dumps(payload)
        self.client.set_cookie("fixforward_main_access", old_cookie)
        with self.client.get("/api/sources") as response:
            self.assertEqual(response.status_code, 401)

    def test_cookie_has_main_name_and_is_host_only(self):
        with submit(self.client) as response:
            cookie = response.headers["Set-Cookie"]
            self.assertTrue(cookie.startswith("fixforward_main_access="))
            self.assertNotIn("Domain=", cookie)
            self.assertIn("HttpOnly", cookie)
            self.assertIn("SameSite=Lax", cookie)

    def test_copied_cookie_is_revoked_when_visitor_locks_the_website(self):
        self.unlock()
        cookie_name = self.app.config["SESSION_COOKIE_NAME"]
        copied = self.client.get_cookie(cookie_name).value
        with self.client.session_transaction() as stored:
            token = stored["access_csrf"]
        with self.client.post("/logout", data={"csrf_token": token}) as response:
            self.assertEqual(response.status_code, 303)
        attacker = self.app.test_client()
        attacker.set_cookie(cookie_name, copied)
        with attacker.get("/api/sources") as response:
            self.assertEqual(response.status_code, 401)

    def test_nonce_missing_or_unregistered_in_signed_cookie_stays_locked(self):
        for nonce in (None, "x" * 43, "invalid-nonce"):
            with self.subTest(nonce=nonce):
                self.client = self.app.test_client()
                self.unlock()
                with self.client.session_transaction() as stored:
                    if nonce is None:
                        stored.pop("access_id")
                    else:
                        stored["access_id"] = nonce
                with self.client.get("/api/sources") as response:
                    self.assertEqual(response.status_code, 401)

    def test_registry_expiry_rejects_otherwise_current_signed_cookie(self):
        self.unlock()
        limiter = self.app.extensions["access_limiter"]
        with closing(sqlite3.connect(limiter.path)) as connection:
            connection.execute("UPDATE access_sessions SET expires_at = ?", (time.time() - 1,))
            connection.commit()
        with self.client.get("/api/sources") as response:
            self.assertEqual(response.status_code, 401)

    def test_empty_store_after_instance_restart_rejects_old_cookie(self):
        self.unlock()
        name = self.app.config["SESSION_COOKIE_NAME"]
        copied = self.client.get_cookie(name).value
        replacement_app = isolated_app()
        replacement_client = replacement_app.test_client()
        replacement_client.set_cookie(name, copied)
        with replacement_client.get("/api/sources") as response:
            self.assertEqual(response.status_code, 401)

    def test_shared_workers_see_login_and_logout_without_a_cookie_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "attempts.sqlite3")
            first_app = isolated_app(ACCESS_LIMIT_DB=path)
            second_app = isolated_app(ACCESS_LIMIT_DB=path)
            first = first_app.test_client()
            second = second_app.test_client()
            submit(first).close()
            name = first_app.config["SESSION_COOKIE_NAME"]
            copied = first.get_cookie(name).value
            second.set_cookie(name, copied)
            with patch("backend.api.repository.sources", return_value=[]):
                with second.get("/api/sources") as response:
                    self.assertEqual(response.status_code, 200)
            with first.session_transaction() as stored:
                token = stored["access_csrf"]
            with first.post("/logout", data={"csrf_token": token}) as response:
                self.assertEqual(response.status_code, 303)
            with second.get("/api/sources") as response:
                self.assertEqual(response.status_code, 401)

    def test_corrupt_registry_fails_closed_even_with_valid_login_cookie(self):
        self.unlock()
        limiter = self.app.extensions["access_limiter"]
        limiter.path.write_bytes(b"synthetic-corruption-after-login")
        with self.client.get("/api/sources") as response:
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json["error"]["code"], "access_unavailable")
            self.assertNotIn("sqlite", response.text.lower())
        with self.client.get("/") as response:
            self.assertEqual(response.status_code, 503)

    def test_session_registry_is_bounded_without_evicting_valid_visitors(self):
        with patch("backend.access_limits.MAX_SESSIONS", 2):
            first = self.app.test_client()
            second = self.app.test_client()
            third = self.app.test_client()
            for client in (first, second):
                with submit(client) as response:
                    self.assertEqual(response.status_code, 303)
            with submit(third) as response:
                self.assertEqual(response.status_code, 503)
            with patch("backend.api.repository.sources", return_value=[]):
                with first.get("/api/sources") as response:
                    self.assertEqual(response.status_code, 200)
            with third.get("/api/sources") as response:
                self.assertEqual(response.status_code, 401)
        limiter = self.app.extensions["access_limiter"]
        with closing(sqlite3.connect(limiter.path)) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM access_sessions").fetchone()[0], 2)

    def test_registry_does_not_persist_raw_nonce_or_cookie(self):
        self.unlock()
        with self.client.session_transaction() as stored:
            nonce = stored["access_id"]
        cookie = self.client.get_cookie(self.app.config["SESSION_COOKIE_NAME"]).value
        limiter = self.app.extensions["access_limiter"]
        with closing(sqlite3.connect(limiter.path)) as connection:
            rows = connection.execute("SELECT session_key, expires_at FROM access_sessions").fetchall()
            self.assertEqual(len(rows), 1)
            self.assertRegex(rows[0][0], r"^[a-f0-9]{64}$")
        contents = limiter.path.read_bytes()
        for value in (nonce, cookie, PASSWORD, SIGNING_KEY, "127.0.0.1"):
            self.assertNotIn(value.encode(), contents)

    def test_login_attempts_are_limited_and_correct_password_cannot_skip_wait(self):
        for _ in range(ATTEMPT_LIMIT):
            with submit(self.client, "synthetic-wrong") as response:
                self.assertEqual(response.status_code, 401)
        with submit(self.client) as response:
            self.assertEqual(response.status_code, 429)
            self.assertTrue(1 <= int(response.headers["Retry-After"]) <= WINDOW_SECONDS)
            self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_new_browser_and_spoofed_forwarded_for_cannot_reset_rate_limit(self):
        for _ in range(ATTEMPT_LIMIT):
            submit(self.client, "synthetic-wrong").close()
        replacement = self.app.test_client()
        with submit(replacement, headers={"X-Forwarded-For": "203.0.113.199"}) as response:
            self.assertEqual(response.status_code, 429)

    def test_local_caller_cannot_change_budget_with_forged_cloudflare_header(self):
        with patch.dict("os.environ", {"RENDER": "", "RENDER_SERVICE_TYPE": "", "RENDER_EXTERNAL_HOSTNAME": ""}):
            app = isolated_app()
        for index in range(ATTEMPT_LIMIT):
            with submit(app.test_client(), "synthetic-wrong", headers={"CF-Connecting-IP": f"198.51.100.{index + 1}"}) as response:
                self.assertEqual(response.status_code, 401)
        with submit(app.test_client(), headers={"CF-Connecting-IP": "203.0.113.200"}) as response:
            self.assertEqual(response.status_code, 429)

    def test_exact_render_environment_uses_separate_clients_on_same_peer(self):
        with patch.dict("os.environ", RENDER_MARKERS):
            app = isolated_app()
        self.assertTrue(app.config["ACCESS_RENDER_PROXY"])
        first_headers = {"CF-Connecting-IP": "198.51.100.10"}
        for _ in range(ATTEMPT_LIMIT):
            submit(app.test_client(), "synthetic-wrong", headers=first_headers).close()
        with submit(app.test_client(), headers=first_headers) as response:
            self.assertEqual(response.status_code, 429)
        # Both requests share the same socket peer; the verified edge field is
        # what prevents one visitor exhausting every visitor's attempt budget.
        with submit(app.test_client(), headers={"CF-Connecting-IP": "198.51.100.20"}) as response:
            self.assertEqual(response.status_code, 303)

    def test_render_ignores_spoofed_xff_when_cloudflare_client_is_unchanged(self):
        with patch.dict("os.environ", RENDER_MARKERS):
            app = isolated_app()
        for index in range(ATTEMPT_LIMIT):
            headers = {"CF-Connecting-IP": "198.51.100.10", "X-Forwarded-For": f"203.0.113.{index + 1}"}
            submit(app.test_client(), "synthetic-wrong", headers=headers).close()
        with submit(app.test_client(), headers={"CF-Connecting-IP": "198.51.100.10", "X-Forwarded-For": "203.0.113.250"}) as response:
            self.assertEqual(response.status_code, 429)

    def test_render_ipv4_mapped_ipv6_shares_canonical_ipv4_budget(self):
        with patch.dict("os.environ", RENDER_MARKERS):
            app = isolated_app()
        for _ in range(ATTEMPT_LIMIT):
            submit(app.test_client(), "synthetic-wrong", headers={"CF-Connecting-IP": "198.51.100.10"}).close()
        with submit(app.test_client(), headers={"CF-Connecting-IP": "::ffff:198.51.100.10"}) as response:
            self.assertEqual(response.status_code, 429)

    def test_render_expanded_ipv6_shares_canonical_compressed_budget(self):
        with patch.dict("os.environ", RENDER_MARKERS):
            app = isolated_app()
        for _ in range(ATTEMPT_LIMIT):
            submit(app.test_client(), "synthetic-wrong", headers={"CF-Connecting-IP": "2001:db8::1234"}).close()
        with submit(app.test_client(), headers={"CF-Connecting-IP": "2001:0db8:0000:0000:0000:0000:0000:1234"}) as response:
            self.assertEqual(response.status_code, 429)

    def test_render_missing_or_malformed_edge_address_fails_closed(self):
        with patch.dict("os.environ", RENDER_MARKERS):
            app = isolated_app()
        for value in (None, "", "not-an-ip", "198.51.100.10, 203.0.113.5", "198.51.100.10:80", "[2001:db8::1]:80", "fe80::1%eth0", " 198.51.100.10", "198.51.100.10 ", "x" * 46):
            with self.subTest(value=value):
                headers = {} if value is None else {"CF-Connecting-IP": value}
                client = app.test_client()
                with submit(client, headers=headers) as response:
                    self.assertEqual(response.status_code, 503)
                    self.assertNotIn("CF-Connecting-IP", response.text)
                with client.get("/api/sources") as response:
                    self.assertEqual(response.status_code, 401)

    def test_partial_or_wrong_render_markers_do_not_trust_client_headers(self):
        for field, wrong_value in (("RENDER", "false"), ("RENDER_SERVICE_TYPE", "pserv"), ("RENDER_EXTERNAL_HOSTNAME", "another-service.onrender.com")):
            with self.subTest(field=field):
                with patch.dict("os.environ", {**RENDER_MARKERS, field: wrong_value}):
                    app = isolated_app()
                self.assertFalse(app.config["ACCESS_RENDER_PROXY"])
                # Malformed edge data is ignored outside the exact hosted mode;
                # an HTTP header named RENDER cannot enable that mode either.
                with submit(app.test_client(), headers={"CF-Connecting-IP": "not-an-ip", "RENDER": "true"}) as response:
                    self.assertEqual(response.status_code, 303)

    def test_independent_client_address_has_its_own_attempt_budget(self):
        for _ in range(ATTEMPT_LIMIT):
            submit(self.client, "synthetic-wrong").close()
        with submit(self.app.test_client(), environ_overrides={"REMOTE_ADDR": "198.51.100.20"}) as response:
            self.assertEqual(response.status_code, 303)

    def test_expired_limit_allows_login_again(self):
        for _ in range(ATTEMPT_LIMIT):
            submit(self.client, "synthetic-wrong").close()
        with patch("backend.access_limits.time.time", return_value=time.time() + WINDOW_SECONDS + 1):
            with submit(self.client) as response:
                self.assertEqual(response.status_code, 303)

    def test_successful_login_clears_attempts(self):
        for _ in range(ATTEMPT_LIMIT - 1):
            submit(self.client, "synthetic-wrong").close()
        self.unlock()
        limiter = self.app.extensions["access_limiter"]
        with closing(sqlite3.connect(limiter.path)) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM access_attempts").fetchone()[0], 0)

    def test_rate_store_contains_only_keyed_client_digest_count_and_expiry(self):
        submit(self.client, "private-wrong-password-must-not-persist").close()
        limiter = self.app.extensions["access_limiter"]
        with closing(sqlite3.connect(limiter.path)) as connection:
            rows = connection.execute("SELECT client_key, attempts, expires_at FROM access_attempts").fetchall()
            self.assertEqual(len(rows), 1)
            self.assertRegex(rows[0][0], r"^[a-f0-9]{64}$")
            self.assertEqual(rows[0][1], 1)
        contents = limiter.path.read_bytes()
        for private_value in (PASSWORD, SIGNING_KEY, "127.0.0.1", "private-wrong-password-must-not-persist"):
            self.assertNotIn(private_value.encode(), contents)

    def test_parallel_guesses_respect_one_shared_budget(self):
        def guess(_):
            with submit(self.app.test_client(), "synthetic-wrong") as response:
                return response.status_code
        with ThreadPoolExecutor(max_workers=6) as workers:
            statuses = list(workers.map(guess, range(ATTEMPT_LIMIT + 6)))
        self.assertEqual(statuses.count(401), ATTEMPT_LIMIT)
        self.assertEqual(statuses.count(429), 6)

    def test_workers_with_shared_store_enforce_same_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "attempts.sqlite3")
            first = isolated_app(ACCESS_LIMIT_DB=path).test_client()
            second = isolated_app(ACCESS_LIMIT_DB=path).test_client()
            for index in range(ATTEMPT_LIMIT):
                submit(first if index % 2 else second, "synthetic-wrong").close()
            with submit(second) as response:
                self.assertEqual(response.status_code, 429)

    def test_unavailable_rate_store_fails_closed_without_leaking_path(self):
        limiter = self.app.extensions["access_limiter"]
        with patch.object(limiter, "_connect", side_effect=OSError("private-system-path.sqlite3")):
            with submit(self.client) as response:
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("private-system-path", response.text)
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_corrupt_rate_store_fails_closed(self):
        limiter = self.app.extensions["access_limiter"]
        limiter.path.write_bytes(b"synthetic-corrupt-file")
        with submit(self.client) as response:
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("sqlite", response.text.lower())

    def test_rate_store_remains_bounded_without_evicting_active_clients(self):
        limiter = self.app.extensions["access_limiter"]
        with patch("backend.access_limits.MAX_CLIENTS", 2):
            for address in ("198.51.100.1", "198.51.100.2"):
                with submit(self.app.test_client(), "synthetic-wrong", environ_overrides={"REMOTE_ADDR": address}) as response:
                    self.assertEqual(response.status_code, 401)
            with submit(self.app.test_client(), environ_overrides={"REMOTE_ADDR": "198.51.100.3"}) as response:
                self.assertEqual(response.status_code, 503)
        with closing(sqlite3.connect(limiter.path)) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM access_attempts").fetchone()[0], 2)


if __name__ == "__main__":
    unittest.main()
