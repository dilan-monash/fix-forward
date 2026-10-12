"""I3 URL isolation and input boundary checks with synthetic access only.

The tests never call a hosted site or database, and do not modify archived I2
source. An authenticated visitor may open only the reviewed I3 application.
"""
import re
import unittest

from backend import PROJECT_ROOT, SHARED_FRONTEND_ASSETS, create_app


class SecurityRoutesTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "SITE_ACCESS_ENABLED": True,
            "SITE_PASSWORD": "synthetic-route-test",
            "SECRET_KEY": "synthetic-route-key-at-least-thirty-two-characters",
            "SESSION_COOKIE_SECURE": False, "DATABASE_URL": "unused-in-fake",
        })
        self.client = self.app.test_client()
        with self.client.get("/login") as page:
            token = re.search(r'name="csrf_token" value="([^"]+)"', page.get_data(as_text=True)).group(1)
        with self.client.post("/login", data={"csrf_token": token, "password": "synthetic-route-test"}) as response:
            self.assertEqual(response.status_code, 303)

    def test_legacy_and_prototype_bookmarks_return_404_without_redirects(self):
        for path in (
            "/legacy", "/legacy/", "/legacy/index.html",
            "/prototypes/i3-world-preview/index.html",
        ):
            for query in ("", "?next=https://example.com", "?view=parents&url=//example.com"):
                for method in ("GET", "HEAD"):
                    with self.subTest(path=path, query=query, method=method):
                        with self.client.open(path + query, method=method) as response:
                            self.assertEqual(response.status_code, 404)
                            self.assertNotIn("Location", response.headers)
                            self.assertEqual(response.headers["Cache-Control"], "private, no-store")

    def test_retired_application_assets_cannot_reopen_the_old_ui(self):
        retired = (
            "/styles.css", "/src/app.js", "/src/photo-helper.js", "/src/learning.js",
            "/src/explore-classifier.js", "/src/explore-photo-helper.css",
            "/prototypes/i3-world-preview/app.js", "/prototypes/i3-world-preview/world.css",
            "/prototypes/i3-world-preview/action.js", "/prototypes/i3-world-preview/explore.js",
            "/prototypes/i3-world-preview/learning.js", "/prototypes/i3-world-preview/scrapworks.js",
            "/prototypes/i3-family-preview/sorting.js", "/prototypes/i3-family-preview/sorting.css",
        )
        for path in retired:
            for suffix in ("", "?v=14900fe"):
                with self.subTest(path=path, suffix=suffix), self.client.get(path + suffix) as response:
                    self.assertEqual(response.status_code, 404)

    def test_only_the_reviewed_shared_module_closure_is_published(self):
        for file in (PROJECT_ROOT / "src").glob("*.js"):
            asset = file.relative_to(PROJECT_ROOT).as_posix()
            with self.subTest(asset=asset), self.client.head("/" + asset) as response:
                self.assertEqual(response.status_code, 200 if asset in SHARED_FRONTEND_ASSETS else 404)

    def test_encoded_paths_cannot_bypass_the_exact_allowlist(self):
        # URL-encoded unreserved characters resolve to the same retired route;
        # encoded separators, traversal and double decoding must never reveal it.
        for path in (
            "/src/%61pp.js", "/quest/%61pp.js", "/quest/%252e%252e/index.html",
            "/src/%2e%2e/backend/config.py", "/src/../backend/config.py",
            "/src/%252e%252e/backend/config.py", "/src%5capp.js",
            "/quest/index.html%00.js", "/quest/index.html;anything",
            "/prototypes/i3-world-preview%2fapp.js", "/prototypes/i3-world-preview//app.js",
            "/prototypes/i3-world-preview/index.html.bak", "/src/data.js.map",
        ):
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 404)
                self.assertNotIn(b"DATABASE_URL=", response.data)
                self.assertNotIn(b'id="quest-app"', response.data)

    def test_retired_entries_do_not_accept_writes(self):
        for path in ("/quest", "/quest/", "/quest/index.html", "/legacy", "/legacy/",
                     "/prototypes/i3-world-preview/index.html"):
            for method in ("POST", "PUT", "PATCH", "DELETE"):
                with self.subTest(path=path, method=method), self.client.open(path, method=method) as response:
                    self.assertEqual(response.status_code, 404)

    def test_retired_namespaces_and_404_styles_work_without_a_session(self):
        client = self.app.test_client()
        for path in ("/legacy", "/legacy/old.js", "/quest", "/quest/", "/quest/index.html?view=parents",
                     "/%71uest", "/%6cegacy", "/QUEST", "/Legacy/", "/quest//app.js",
                     "/prototypes/i3-world-preview/index.html"):
            for method in ("GET", "HEAD", "POST", "OPTIONS"):
                with self.subTest(path=path, method=method), client.open(path, method=method) as response:
                    self.assertEqual(response.status_code, 404)
                    self.assertNotIn("Location", response.headers)
                    self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                    if method == "GET":
                        self.assertIn(b"Page not found", response.data)
                        self.assertNotIn(b'id="preview-app"', response.data)
        with client.get("/404.css") as response:
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.mimetype, "text/css")
        # The public missing-page styling does not open any game/runtime module.
        with client.get("/prototypes/i3-five-games/app.js") as response:
            self.assertEqual(response.status_code, 303)

    def test_error_page_assets_remain_available_after_retiring_old_world(self):
        for name in ("404.html", "500.html"):
            document = (PROJECT_ROOT / name).read_text(encoding="utf-8")
            for asset in re.findall(r'<link[^>]+href="([^"]+)"', document):
                with self.subTest(document=name, asset=asset), self.client.head(asset) as response:
                    self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
