"""I3 world release routes, with synthetic access credentials and mocked API reads."""
import re
import unittest
from unittest.mock import patch

from backend import WORLD_FRONTEND_ASSETS, create_app


class WorldRoutesTests(unittest.TestCase):
    # A fresh client exercises the real shared gate; it never contacts Neon.
    def setUp(self):
        self.app = create_app({"TESTING": True, "SITE_ACCESS_ENABLED": True,
            "SITE_PASSWORD": "synthetic-world-test", "SECRET_KEY": "synthetic-key-at-least-thirty-two-characters-long",
            "SESSION_COOKIE_SECURE": False, "DATABASE_URL": "unused-in-fake"})
        self.client = self.app.test_client()

    def login(self, password="synthetic-world-test"):
        with self.client.get("/login") as page:
            token = re.search(r'name="csrf_token" value="([^"]+)"', page.get_data(as_text=True)).group(1)
        return self.client.post("/login", data={"csrf_token": token, "password": password})

    def test_world_assets_and_legacy_are_protected(self):
        for path in ("/", "/legacy", "/prototypes/i3-world-preview/app.js", "/prototypes/i3-world-preview/vendor/three.core.js"):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 303)
        with self.client.get("/api/recalls") as response:
            self.assertEqual(response.status_code, 401)

    def test_wrong_password_and_missing_csrf_cannot_open_world(self):
        with self.login("wrong") as response:
            self.assertEqual(response.status_code, 401)
        with self.client.post("/login", data={"password": "synthetic-world-test"}) as response:
            self.assertEqual(response.status_code, 400)
        with self.client.get("/") as response:
            self.assertEqual(response.status_code, 303)

    def test_login_opens_new_world_and_preserves_previous_entries(self):
        self.login().close()
        for path in ("/", "/index.html"):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)
                self.assertIn(b'id="preview-app"', response.data)
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                self.assertIn("xr-spatial-tracking=(self)", response.headers["Permissions-Policy"])
        with self.client.get("/legacy") as response:
            self.assertIn(b'src="src/app.js"', response.data)
        with self.client.get("/legacy/") as response:
            self.assertEqual(response.headers["Location"], "/legacy")
        with self.client.get("/quest") as response:
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'id="quest-app"', response.data)

    def test_exact_runtime_allowlist_excludes_tests_servers_and_traversal(self):
        self.login().close()
        for asset in WORLD_FRONTEND_ASSETS:
            with self.client.head("/" + asset) as response:
                self.assertEqual(response.status_code, 200, asset)
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        for path in ("/prototypes/i3-world-preview/serve.mjs", "/prototypes/i3-world-preview/action.test.js",
                     "/prototypes/i3-world-preview/README.md", "/prototypes/i3-world-preview/vendor/README.md",
                     "/src/../prototypes/i3-world-preview/action.test.js",
                     "/src/%2e%2e/prototypes/i3-world-preview/action.test.js",
                     "/prototypes/i3-world-preview/../../backend/config.py", "/.env", "/unknown"):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 404, path)

    @patch("backend.api.repository.sources", return_value=[])
    def test_authenticated_world_uses_original_json_api_not_preview503(self, source_rows):
        self.login().close()
        with self.client.get("/api/sources") as response:
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["sources"], [])
            self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        source_rows.assert_called_once()

    def test_unknown_api_stays_json_404_after_login(self):
        self.login().close()
        with self.client.get("/api/unknown-world-route") as response:
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json["error"]["code"], "not_found")


if __name__ == "__main__":
    unittest.main()
