# Child-route integration suite using the same real access gate as the adult entry and an isolated test session.
# No hosted service is used; it checks module allowlisting and that data API failure does not block serving Quest assets.

"""Quest entry/asset integration coverage with the real existing access gate.

Credentials are isolated test values, and no database or hosted service is used.
"""

import importlib.util
import re
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit


WEB_DEPENDENCIES = all(importlib.util.find_spec(name) for name in ("flask", "dotenv"))
QUEST_ENTRIES = ("/quest", "/quest/", "/quest/index.html")
QUEST_ASSETS = (
    "/quest/quest.css", "/quest/app.js", "/quest/art.js", "/quest/content.js",
    "/quest/engine.js", "/quest/storage.js", "/quest/drag.js",
    "/quest/play-effects.css", "/quest/postcard.js", "/quest/postcard-options.js",
    "/quest/progression.js", "/quest/tablet-play.css",
    "/quest/navigation.js", "/quest/narration.js", "/quest/parent-guide.js",
    "/quest/visual-play.js", "/quest/visual-play.css", "/quest/word-help.js", "/quest/word-help.css", "/quest/haptics.js", "/quest/reward-voice.js", "/quest/reward-fx.js", "/quest/sounds.js", "/quest/game-feel.css",
    "/quest/picture-help.js", "/quest/feedback.js", "/quest/clue-play.css",
    "/quest/family-guide.css", "/quest/story-audio.js", "/quest/audio/story-manifest.js",
)


@unittest.skipUnless(WEB_DEPENDENCIES, "Flask test dependencies are not installed")
# Group child-entry isolation, asset security and adult/child session compatibility checks.
class QuestRouteTests(unittest.TestCase):
    # Build a fresh protected test application and client with isolated test credentials.
    def setUp(self):
        from backend import create_app

        self.app = create_app({
            "TESTING": True,
            "SITE_ACCESS_ENABLED": True,
            "SITE_PASSWORD": "quest-isolated-test-password",
            "SECRET_KEY": "quest-isolated-test-cookie-signing-key-at-least-thirty-two",
            "SESSION_COOKIE_SECURE": False,
            "DATABASE_URL": "",
        })
        self.client = self.app.test_client()

    # Use the rendered CSRF token and actual login POST before testing authorized child routes.
    def login(self):
        with self.client.get("/login") as page:
            self.assertEqual(page.status_code, 200)
            match = re.search(r'name="csrf_token" value="([^"]+)"', page.get_data(as_text=True))
            self.assertIsNotNone(match)
        with self.client.post("/login", data={
            "csrf_token": match.group(1),
            "password": self.app.config["SITE_PASSWORD"],
        }) as response:
            self.assertEqual(response.status_code, 303)
            self.assertEqual(response.headers["Location"], "/")

    def test_quest_entries_and_each_lazy_module_remain_locked(self):
        for path in QUEST_ENTRIES + QUEST_ASSETS:
            for method in ("GET", "HEAD"):
                with self.subTest(path=path, method=method):
                    with self.client.open(path, method=method) as response:
                        self.assertEqual(response.status_code, 303)
                        login = urlsplit(response.headers["Location"])
                        self.assertEqual(login.path, "/login")
                        self.assertEqual(parse_qs(login.query), {"next": [path]} if path in QUEST_ENTRIES else {})
                        self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                        self.assertNotIn(b"quest-app", response.data)

    def test_authenticated_entries_have_the_same_isolated_child_document(self):
        self.login()
        documents = []
        for path in QUEST_ENTRIES:
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.mimetype, "text/html")
                    documents.append(response.get_data(as_text=True))
                    self.assertIn('id="quest-app"', documents[-1])
                    self.assertIn('src="/quest/app.js"', documents[-1])
                    self.assertIn('href="/quest/quest.css"', documents[-1])
                    self.assertNotIn('src="/src/app.js"', documents[-1])
                    self.assertNotIn("leaflet", documents[-1].lower())
        self.assertEqual(documents[0], documents[1])
        self.assertEqual(documents[1], documents[2])

    def test_authorized_quest_assets_keep_mime_security_and_private_caching(self):
        self.login()
        for path in QUEST_ASSETS:
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertIn(response.mimetype, ("text/css", "text/javascript", "application/javascript"))
                    self.assertGreater(len(response.data), 100)
                    self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                    self.assertIn("Cookie", response.headers["Vary"])
                    self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                    self.assertEqual(response.headers["X-Frame-Options"], "DENY")
                    self.assertIn("connect-src 'self'", response.headers["Content-Security-Policy"])

    def test_quest_navigation_keeps_adult_entry_available_in_the_same_session(self):
        self.login()
        for path in ("/", "/quest/", "/index.html", "/quest", "/src/app.js"):
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 200)
                    if path in ("/", "/index.html"):
                        text = response.get_data(as_text=True)
                        self.assertIn('src="src/app.js"', text)
                        self.assertIn('href="/quest"', text)
                        self.assertNotIn('id="quest-app"', text)

    def test_story_recording_is_protected_and_supports_tablet_audio_ranges(self):
        # Test real packaged bytes without any speech service or database. A range
        # response must match the original MP3, so UTF-8 corruption cannot pass.
        audio_folder = Path(__file__).resolve().parents[1] / "quest" / "audio"
        clips = sorted(audio_folder.glob("*.mp3"))
        self.assertTrue(clips, "At least one packaged story recording is required")
        clip = clips[0]
        original = clip.read_bytes()
        route = f"/quest/audio/{clip.name}"
        with self.client.get(route) as response:
            self.assertEqual(response.status_code, 303)
            self.assertEqual(response.headers["Location"], "/login")
        self.login()
        with self.client.get(route, headers={"Range": "bytes=0-63"}) as response:
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response.mimetype, "audio/mpeg")
            self.assertEqual(response.data, original[:64])
            self.assertEqual(response.headers["Content-Range"], f"bytes 0-63/{len(original)}")
            self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        with self.client.head(route) as response:
            self.assertEqual(response.status_code, 200)
            self.assertEqual(int(response.headers["Content-Length"]), len(original))
            self.assertEqual(response.data, b"")

    def test_quest_cannot_expand_the_public_asset_allowlist(self):
        self.login()
        blocked = (
            "/quest/.env", "/quest/audio/.env", "/quest/audio/build.py", "/quest/audio/invalid.mp3", "/quest/content.js.map", "/quest/unknown.js",
            "/quest/../backend/config.py", "/quest/%2e%2e/backend/config.py",
            "/quest/../../.env", "/quest/docs/QUEST_CONTENT_SOURCES.md",
            "/docs/QUEST_CONTENT_SOURCES.md", "/test_backend/test_quest_routes.py",
        )
        for path in blocked:
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 404)
                    self.assertNotIn(b"DATABASE_URL=", response.data)
                    self.assertNotIn(b"class QuestRouteTests", response.data)

    def test_expired_cookie_relocks_child_document_and_modules(self):
        self.login()
        with self.client.session_transaction() as saved:
            issued = saved["access_issued_at"]
        with patch("backend.access.time.time", return_value=issued + 4 * 60 * 60):
            for path in ("/quest", "/quest/content.js", "/"):
                with self.subTest(path=path):
                    with self.client.get(path) as response:
                        self.assertEqual(response.status_code, 303)
                        login = urlsplit(response.headers["Location"])
                        self.assertEqual(login.path, "/login")
                        self.assertEqual(parse_qs(login.query), {"next": [path]} if path == "/quest" else {})

    def test_quest_fails_closed_when_access_configuration_is_missing(self):
        self.app.config["SITE_PASSWORD"] = ""
        for path in ("/quest", "/quest/", "/quest/app.js"):
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 503)
                    self.assertNotIn(b"quest-app", response.data)
        with self.client.get("/api/health") as health:
            self.assertEqual(health.status_code, 200)

    def test_data_api_failure_does_not_prevent_serving_the_child_app(self):
        from backend.db import DatabaseUnavailable

        self.login()
        with patch("backend.api.repository.sources", side_effect=DatabaseUnavailable("simulated unavailable data")) as sources:
            with self.client.get("/api/sources") as unavailable:
                self.assertEqual(unavailable.status_code, 503)
                self.assertEqual(unavailable.json["error"]["code"], "data_unavailable")
            for path in QUEST_ENTRIES + QUEST_ASSETS:
                with self.subTest(path=path):
                    with self.client.get(path) as response:
                        self.assertEqual(response.status_code, 200)
            sources.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
