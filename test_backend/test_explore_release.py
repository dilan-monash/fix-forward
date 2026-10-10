"""Explore I3 release wiring, using synthetic login data and no database calls."""
import hashlib
import re
import unittest
from unittest.mock import patch

from backend import SIGLIP_ASSET_INTEGRITY, create_app


class ExploreReleaseTests(unittest.TestCase):
    """Exercise the real Flask file gate without loading the inference runtime."""

    ASSETS = (
        "/model/explore-siglip/model_manifest.json",
        "/model/explore-siglip/text-embeddings.json",
        "/model/explore-siglip/text-embeddings.f32",
    )

    def setUp(self):
        self.app = create_app({
            "TESTING": True, "SITE_ACCESS_ENABLED": True,
            "SITE_PASSWORD": "synthetic-explore-test",
            "SECRET_KEY": "synthetic-explore-key-at-least-thirty-two-characters",
            "SESSION_COOKIE_SECURE": False, "DATABASE_URL": "unused-in-fake",
        })
        self.client = self.app.test_client()

    def login(self):
        # Submit the normal CSRF-protected gate; no real password is required.
        with self.client.get("/login") as page:
            token = re.search(r'name="csrf_token" value="([^"]+)"', page.get_data(as_text=True)).group(1)
        with self.client.post("/login", data={"csrf_token": token, "password": "synthetic-explore-test"}) as response:
            self.assertEqual(response.status_code, 303)

    def test_all_explore_assets_require_the_existing_site_login(self):
        for path in self.ASSETS + ("/src/explore-classifier.js", "/src/explore-photo-helper.css"):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 303, path)

    def test_authenticated_release_serves_only_pinned_explore_vectors(self):
        self.login()
        for path in self.ASSETS:
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200, path)
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                if path.endswith(".f32"):
                    self.assertEqual(response.mimetype, "application/octet-stream")
                else:
                    self.assertEqual(response.mimetype, "application/json")
                expected = SIGLIP_ASSET_INTEGRITY.get(path.lstrip("/"))
                if expected:
                    self.assertEqual(len(response.data), expected[0])
                    self.assertEqual(hashlib.sha256(response.data).hexdigest(), expected[1])
        with self.client.get(self.ASSETS[0]) as response:
            self.assertEqual(response.json["scope"], "iteration_3_preview")
            self.assertTrue(response.json["recognition_enabled"])
            self.assertTrue(response.json["experimental"])
            self.assertFalse(response.json["release_ready"])
            self.assertEqual(len(response.json["active_labels"]), 32)
            self.assertTrue(response.json["requires_user_confirmation"])

    def test_invalid_vector_bytes_are_unavailable_without_exposing_debug_details(self):
        self.login()
        path = self.ASSETS[2].lstrip("/")
        expected = SIGLIP_ASSET_INTEGRITY[path]
        # Override the expected digest, leaving the actual reviewed file untouched.
        with patch.dict(SIGLIP_ASSET_INTEGRITY, {path: (expected[0], "0" * 64)}):
            with self.client.get("/" + path) as response:
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.get_data(as_text=True), "Asset unavailable")

    def test_research_files_and_unlisted_model_paths_remain_private(self):
        self.login()
        for path in (
            "/model/explore-siglip/private.json", "/model/explore-siglip/",
            "/model/explore-siglip/../appliance-siglip/candidate-v3-policy.json",
            "/test_helpers/explore-ai-smoke.js", "/__explore-test/",
            "/docs/explore-ai32-holdout-v2.json", "/tmp/explore-ai32/dataset/manifest.json",
        ):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 404, path)


if __name__ == "__main__":
    unittest.main()
