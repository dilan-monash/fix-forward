"""Exercise the public Main factory without credentials, cookies or real data."""
import json
import unittest
from unittest.mock import patch

from backend import create_app, PROJECT_ROOT, SIGLIP_PUBLIC_ASSETS
from backend.config import Settings
from backend.family_frontend import FAMILY_FRONTEND_ASSETS, FAMILY_FRONTEND_ALIASES


class PublicMainReleaseTests(unittest.TestCase):
    def setUp(self):
        # Use the real production access default. No .env or Neon connection is
        # loaded, and missing credentials must not lock this public release.
        settings = Settings("", "main-v3.0.0", 1, "", "", True, "local")
        with patch.object(Settings, "from_environment", return_value=settings):
            self.app = create_app()
        self.client = self.app.test_client()

    def test_anonymous_visitors_open_current_pages_without_password_or_cookie(self):
        self.assertFalse(self.app.testing)
        for host in ("fixforward.me", "www.fixforward.me", "fix-forward-main.onrender.com"):
            for path in ("/", "/index.html", "/film.html"):
                with self.subTest(host=host, path=path), self.client.get(path, base_url="https://" + host) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertNotIn("Set-Cookie", response.headers)
                    self.assertNotIn(b'href="/logout"', response.data)
                    self.assertNotIn(b'name="password"', response.data)
                    self.assertEqual(response.headers["X-Frame-Options"], "DENY")

    def test_every_reviewed_runtime_and_model_asset_is_available_anonymously(self):
        for asset in FAMILY_FRONTEND_ASSETS | FAMILY_FRONTEND_ALIASES.keys() | SIGLIP_PUBLIC_ASSETS:
            with self.subTest(asset=asset), self.client.head("/" + asset) as response:
                self.assertEqual(response.status_code, 200)
                self.assertNotIn("Set-Cookie", response.headers)
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")

    def test_retired_routes_remain_real_404s_for_all_visitors(self):
        for method in ("GET", "HEAD", "POST"):
            for path in ("/quest", "/quest/", "/quest?view=parents", "/quest/app.js",
                         "/legacy", "/legacy/index.html", "/prototypes/i3-world-preview/index.html"):
                with self.subTest(method=method, path=path), self.client.open(path, method=method) as response:
                    self.assertEqual(response.status_code, 404)
                    self.assertNotIn("Location", response.headers)

    def test_public_access_does_not_publish_private_source_or_test_files(self):
        for path in ("/.env", "/.git/config", "/backend/config.py", "/render.yaml",
                     "/prototypes/i3-five-games/serve.mjs", "/prototypes/i3-five-games/activities.test.js",
                     "/src/%2e%2e/backend/config.py", "/api/unknown-route"):
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 404)
                self.assertNotIn("Location", response.headers)
        self.assertEqual(self.client.get("/api/unknown-route").mimetype, "application/json")

    def test_public_reference_api_is_read_only_and_errors_hide_internal_details(self):
        with patch("backend.api.repository.sources", return_value=[]) as query:
            with self.client.get("/api/sources") as response:
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["sources"], [])
                self.assertNotIn("Set-Cookie", response.headers)
            query.assert_called_once()
            query.reset_mock()
            for method in ("POST", "PUT", "PATCH", "DELETE"):
                with self.subTest(method=method), self.client.open("/api/sources", method=method) as response:
                    self.assertEqual(response.status_code, 405)
            query.assert_not_called()
        with patch("backend.api.repository.sources", side_effect=RuntimeError("synthetic-private-detail")):
            with self.client.get("/api/sources") as response:
                self.assertEqual(response.status_code, 500)
                self.assertNotIn(b"synthetic-private-detail", response.data)
                self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_untrusted_hosts_and_forwarding_headers_do_not_expand_public_boundary(self):
        for host in ("attacker.invalid", "fixforward.me.attacker.invalid",
                     "fix-forward-iteration-1.onrender.com", "fix-forward-iteration-2.onrender.com",
                     "fix-forward-iteration-3-r4sh.onrender.com"):
            with self.subTest(host=host), self.client.get("/", base_url="https://" + host,
                    headers={"X-Forwarded-Host": "fixforward.me"}) as response:
                self.assertEqual(response.status_code, 400)
        with self.client.get("/", base_url="https://fixforward.me",
                headers={"X-Forwarded-Host": "attacker.invalid"}) as response:
            self.assertEqual(response.status_code, 200)
            self.assertNotIn(b"attacker.invalid", response.data)

    def test_old_login_links_cannot_lock_public_visitors_or_redirect_off_site(self):
        with patch("backend.access._authenticated", side_effect=AssertionError("Public access must not consult auth storage")):
            for method in ("GET", "POST"):
                for path in ("/login?next=https://attacker.invalid", "/logout"):
                    with self.subTest(method=method, path=path), self.client.open(path, method=method) as response:
                        self.assertEqual(response.status_code, 303)
                        self.assertIn(response.headers["Location"], ("/", "/index.html"))
                        self.assertNotIn("Set-Cookie", response.headers)
            with self.client.get("/") as response:
                self.assertEqual(response.status_code, 200)

    def test_main_metadata_retains_manual_deployment_and_release_identity(self):
        package = json.loads((PROJECT_ROOT / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((PROJECT_ROOT / "package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(package["name"], "fixforward-main")
        self.assertEqual(lock["name"], package["name"])
        self.assertEqual(lock["packages"][""]["name"], package["name"])
        deployment = (PROJECT_ROOT / "render.yaml").read_text(encoding="utf-8")
        for rule in ("name: fix-forward-main", "branch: main", 'autoDeployTrigger: "off"', "value: main-v3.0.0"):
            self.assertIn(rule, deployment)
        self.assertNotIn("name: fix-forward-iteration-3", deployment)


if __name__ == "__main__":
    unittest.main()
