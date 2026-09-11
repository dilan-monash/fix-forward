"""Access gate integration tests with isolated cookies and repository fakes."""

import importlib.util
import re
import unittest
from unittest.mock import patch


WEB_DEPENDENCIES = all(importlib.util.find_spec(name) for name in ("flask", "dotenv"))


@unittest.skipUnless(WEB_DEPENDENCIES, "Flask test dependencies are not installed")
class AccessTests(unittest.TestCase):
    def setUp(self):
        from backend import create_app

        self.app = create_app({
            "TESTING": True,
            "SITE_ACCESS_ENABLED": True,
            "SITE_PASSWORD": "fixforward",
            "SECRET_KEY": "isolated-test-key-with-at-least-thirty-two-characters",
            "SESSION_COOKIE_SECURE": False,
            "DATABASE_URL": "unused-in-fake",
        })
        self.client = self.app.test_client()

    def token(self, path="/login"):
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        token = re.search(r'name="csrf_token" value="([^"]+)"', response.get_data(as_text=True))
        self.assertIsNotNone(token)
        response.close()
        return token.group(1)

    def login(self, password="fixforward"):
        return self.client.post("/login", data={"csrf_token": self.token(), "password": password})

    def test_direct_frontend_and_unknown_routes_require_login(self):
        for path in ("/", "/index.html", "/styles.css", "/src/app.js", "/src/price-snapshot.js",
                     "/404.html", "/500.html", "/backend/config.py", "/.env", "/unknown"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 303)
                self.assertEqual(response.headers["Location"], "/login")
                self.assertNotIn(b"type=\"module\"", response.data)

    @patch("backend.api.repository.health_check")
    def test_api_is_locked_before_any_database_call(self, health_check):
        for path in ("/api/ready", "/api/recalls", "/api/sources", "/api/repair-evidence",
                     "/api/locations", "/api/replacement-prices", "/api/unknown"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json["error"]["code"], "access_required")
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        health_check.assert_not_called()

    def test_only_minimal_access_assets_and_liveness_are_public(self):
        for path in ("/api/health", "/favicon.svg", "/access.css", "/login"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()
        self.assertEqual(self.client.get("/api/health/").status_code, 401)
        self.assertEqual(self.client.get("/backend/access.css").status_code, 303)

    def test_login_has_semantic_form_and_no_password_value_or_app_script(self):
        response = self.client.get("/login")
        html = response.get_data(as_text=True)
        self.assertIn('<label for="website-password">Website password</label>', html)
        self.assertIn('autocomplete="current-password"', html)
        self.assertIn('method="post"', html)
        self.assertNotIn('value="fixforward"', html)
        self.assertNotIn(self.app.config["SECRET_KEY"], html)
        self.assertNotIn("src/app.js", html)
        self.assertNotIn("DATABASE_URL", html)

    def test_wrong_and_whitespace_changed_passwords_stay_locked(self):
        for password in ("incorrect-private-input", " fixforward", "fixforward ", "", "FIXFORWARD"):
            with self.subTest(password=password):
                response = self.login(password)
                self.assertEqual(response.status_code, 401)
                self.assertIn(b"That password did not work", response.data)
                self.assertIn(b'aria-invalid="true"', response.data)
                self.assertNotIn(b"incorrect-private-input", response.data)
                self.assertEqual(self.client.get("/api/ready").status_code, 401)

    def test_missing_or_wrong_csrf_cannot_log_in(self):
        self.token()
        for token in (None, "wrong-token", "invalid-\u00e9-token"):
            data = {"password": "fixforward"}
            if token is not None:
                data["csrf_token"] = token
            response = self.client.post("/login", data=data)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.client.get("/api/ready").status_code, 401)

    def test_background_locked_requests_preserve_pending_login_form(self):
        token = self.token()
        self.assertEqual(self.client.get("/api/sources").status_code, 401)
        self.assertEqual(self.client.get("/src/app.js").status_code, 303)
        response = self.client.post("/login", data={"csrf_token": token, "password": "fixforward"})
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["Location"], "/")
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        page.close()

    def test_expired_authorization_cleanup_preserves_pending_login_form(self):
        self.login()
        with self.client.session_transaction() as stored:
            stored["access_issued_at"] -= 4 * 60 * 60
        token = self.token()
        self.assertEqual(self.client.get("/api/sources").status_code, 401)
        with self.client.session_transaction() as stored:
            self.assertNotIn("access_marker", stored)
            self.assertNotIn("access_issued_at", stored)
        response = self.client.post("/login", data={"csrf_token": token, "password": "fixforward"})
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["Location"], "/")

    @patch("backend.api.repository.sources", return_value=[])
    def test_success_opens_frontend_and_api_with_private_cache_policy(self, sources):
        result = self.login()
        self.assertEqual(result.status_code, 303)
        self.assertEqual(result.headers["Location"], "/")
        for path in ("/", "/src/app.js", "/src/price-snapshot.js", "/api/sources"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                self.assertIn("Cookie", response.headers["Vary"])
                response.close()
        sources.assert_called_once()

    def test_backend_source_and_traversal_remain_unavailable_after_login(self):
        self.login()
        for path in ("/backend/config.py", "/.env", "/backend/templates/access.html",
                     "/src/../backend/config.py", "/src/../../outside.js"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 404)
            response.close()

    def test_cookie_is_secure_http_only_and_same_site_in_production_setting(self):
        self.app.config["SESSION_COOKIE_SECURE"] = True
        response = self.login()
        cookie = response.headers["Set-Cookie"]
        self.assertIn("Secure", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Path=/", cookie)
        self.assertNotIn("fixforward;", cookie)
        with self.client.session_transaction() as stored:
            self.assertNotIn("password", stored)
            self.assertNotIn("fixforward", stored.values())
            self.assertTrue(stored["_permanent"])

    def test_authentication_has_absolute_four_hour_expiry(self):
        self.login()
        with self.client.session_transaction() as stored:
            issued = stored["access_issued_at"]
        with patch("backend.access.time.time", return_value=issued + 4 * 60 * 60):
            response = self.client.get("/api/sources")
        self.assertEqual(response.status_code, 401)

    def test_changing_password_invalidates_an_existing_session(self):
        self.login()
        self.app.config["SITE_PASSWORD"] = "different-shared-password"
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_tampering_with_signed_cookie_cannot_open_website(self):
        self.login()
        cookie_name = self.app.config["SESSION_COOKIE_NAME"]
        current = self.client.get_cookie(cookie_name).value
        parts = current.rsplit(".", 1)
        signature = parts[1]
        parts[1] = ("A" if signature[0] != "A" else "B") + signature[1:]
        self.client.set_cookie(cookie_name, ".".join(parts))
        self.assertEqual(self.client.get("/").status_code, 303)
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_logout_requires_confirmation_post_and_valid_csrf(self):
        self.login()
        token = self.token("/logout")
        response = self.client.post("/logout", data={"csrf_token": "wrong"})
        self.assertEqual(response.status_code, 400)
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        page.close()
        response = self.client.post("/logout", data={"csrf_token": token})
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["Location"], "/login")
        self.assertEqual(self.client.get("/src/app.js").status_code, 303)
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_missing_credentials_fail_closed_and_leave_health_available(self):
        for setting, value in (("SITE_PASSWORD", ""), ("SECRET_KEY", ""), ("SECRET_KEY", "too-short")):
            with self.subTest(setting=setting, value=value):
                original = self.app.config[setting]
                self.app.config[setting] = value
                for path in ("/", "/login", "/src/app.js"):
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 503)
                    self.assertIn(b"cannot open the website", response.data)
                    self.assertNotIn(b"SITE_PASSWORD", response.data)
                self.assertEqual(self.client.get("/api/sources").status_code, 503)
                self.assertEqual(self.client.get("/api/health").status_code, 200)
                self.app.config[setting] = original

    def test_access_cannot_be_disabled_on_a_production_app(self):
        self.app.config.update(TESTING=False, SITE_ACCESS_ENABLED=False)
        self.assertEqual(self.client.get("/").status_code, 303)
        self.assertEqual(self.client.get("/api/sources").status_code, 401)

    def test_explicit_internal_test_bypass_preserves_diagnostic_access(self):
        self.app.config.update(TESTING=True, SITE_ACCESS_ENABLED=False)
        with patch("backend.api.repository.health_check", return_value={"ok": 1}):
            self.assertEqual(self.client.get("/api/ready").status_code, 200)

    def test_login_does_not_redirect_to_untrusted_next_url(self):
        token = self.token("/login?next=https://example.com")
        response = self.client.post("/login?next=//example.com", data={"csrf_token": token, "password": "fixforward"})
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["Location"], "/")

    def test_oversized_login_request_is_rejected(self):
        token = self.token()
        response = self.client.post("/login", data={"csrf_token": token, "password": "x" * 20000})
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.get("/api/sources").status_code, 401)


if __name__ == "__main__":
    unittest.main()
