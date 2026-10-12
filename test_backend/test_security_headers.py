"""Host and browser-security checks with synthetic credentials and no database."""
import unittest
from unittest.mock import patch

from backend import create_app
from backend.config import Settings


class RequestBoundaryTests(unittest.TestCase):
    def setUp(self):
        settings = Settings("", "security-test", 1, "synthetic-password",
                            "synthetic-key-with-at-least-thirty-two-characters", True, "local")
        with patch.object(Settings, "from_environment", return_value=settings):
            self.app = create_app({"TESTING": True, "SITE_ACCESS_ENABLED": True})
        self.client = self.app.test_client()

    def test_unknown_hosts_and_other_iterations_are_rejected_before_login(self):
        for hostname in ("attacker.invalid", "fix-forward-iteration-2.onrender.com",
                         "fix-forward-iteration-3-r4sh.onrender.com", "fixforward.me.attacker.invalid"):
            with self.subTest(host=hostname):
                response = self.client.get("/login", base_url="https://" + hostname)
                self.assertEqual(response.status_code, 400)
                self.assertNotIn("Set-Cookie", response.headers)

    def test_forwarded_host_cannot_change_the_destination_or_cookie_domain(self):
        response = self.client.get("/film.html", base_url="https://fixforward.me",
                                   headers={"X-Forwarded-Host": "attacker.invalid",
                                            "Forwarded": "host=attacker.invalid;proto=http"})
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["Location"], "/login?next=/film.html")
        self.assertNotIn("attacker.invalid", response.get_data(as_text=True))

    def test_login_cookie_is_secure_httponly_host_only_and_same_site(self):
        response = self.client.get("/login", base_url="https://fixforward.me")
        cookie = response.headers["Set-Cookie"]
        for attribute in ("Secure", "HttpOnly", "SameSite=Lax", "Path=/"):
            self.assertIn(attribute, cookie)
        self.assertNotIn("Domain=", cookie)
        self.assertIn("max-age=31536000", response.headers["Strict-Transport-Security"])

    def test_cross_origin_requests_gain_no_cors_read_permission(self):
        response = self.client.get("/api/sources", headers={"Origin": "https://attacker.invalid"})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)
        self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")

    def test_public_main_pages_do_not_offer_a_misleading_lock_button(self):
        # Restore the public Main access setting to examine the shipped HTML.
        self.app.config["SITE_ACCESS_ENABLED"] = False
        for path in ("/", "/film.html"):
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)
                self.assertNotIn(b'href="/logout"', response.data)

    def test_external_script_permission_is_limited_to_the_pinned_map_library(self):
        with self.client.get("/login") as response:
            directives = {
                tokens[0]: tokens[1:] for directive in response.headers["Content-Security-Policy"].split(";")
                if (tokens := directive.strip().split())
            }
            external_scripts = [value for value in directives["script-src"] if value.startswith("https:")]
            self.assertEqual(external_scripts, ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"])
            self.assertNotIn("'unsafe-inline'", directives["script-src"])
            self.assertNotIn("'unsafe-eval'", directives["script-src"])
            self.assertIn("xr-spatial-tracking=()", response.headers["Permissions-Policy"])


if __name__ == "__main__":
    unittest.main()
