# Backend route and JSON-contract suite using repository mocks rather than a live Neon database.
# Only an explicitly configured test app bypasses visitor access; production gate behavior is tested separately.

"""Integration tests for Flask routing using repository fakes, not Neon."""

from datetime import date
import hashlib
import unittest
from unittest.mock import patch

from backend import PROJECT_ROOT, SIGLIP_ASSET_INTEGRITY, SIGLIP_PUBLIC_ASSETS, create_app
from backend.db import DatabaseUnavailable


# Group route, public-data contract and failure/recovery cases.
class AppTests(unittest.TestCase):
    # Create a fresh internally unlocked Flask client with database calls replaced by each case as needed.
    def setUp(self):
        self.app = create_app({"TESTING": True, "SITE_ACCESS_ENABLED": False, "DATABASE_URL": "unused-in-fake"})
        self.client = self.app.test_client()

    def test_frontend_is_served_but_backend_source_is_not_public(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"FixForward", response.data)
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        self.assertEqual(response.headers["Referrer-Policy"], "strict-origin-when-cross-origin")
        self.assertIn("geolocation=(self)", response.headers["Permissions-Policy"])
        blocked = self.client.get("/backend/config.py")
        self.assertEqual(blocked.status_code, 404)
        response.close()
        blocked.close()

    # Candidate files are exact, same-origin routes with explicit binary MIME.
    # HEAD avoids copying the 70 MB ONNX body into this route test.
    def test_siglip_assets_are_exactly_allowlisted_with_browser_safe_mime(self):
        expected = {
            "model/appliance-siglip/model_manifest.json": "application/json",
            "model/appliance-siglip/text-embeddings.json": "application/json",
            "model/appliance-siglip/text-embeddings.f32": "application/octet-stream",
            "vendor/transformers/transformers.min.js": "application/javascript",
            "vendor/transformers/ort-wasm-simd-threaded.jsep.mjs": "text/javascript",
            "vendor/transformers/ort-wasm-simd-threaded.jsep.wasm": "application/wasm",
            "model/appliance-siglip/upstream/siglip2-base-patch32-256/config.json": "application/json",
            "model/appliance-siglip/upstream/siglip2-base-patch32-256/preprocessor_config.json": "application/json",
            "model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/vision_model.9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499_q4.onnx": "application/octet-stream",
        }
        self.assertEqual(SIGLIP_PUBLIC_ASSETS, set(expected))
        for path, mimetype in expected.items():
            with self.subTest(path=path):
                response = self.client.head(f"/{path}")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, mimetype)
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                response.close()
        for blocked_path in (
            "/vendor/transformers/LICENSE.txt",
            "/model/appliance-siglip/upstream/LICENSE.txt",
            "/model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/other.onnx",
        ):
            with self.subTest(blocked_path=blocked_path):
                with self.client.get(blocked_path) as response:
                    self.assertEqual(response.status_code, 404)

    def test_csp_allows_local_wasm_without_remote_model_connections_or_general_eval(self):
        with self.client.get("/") as response:
            csp = response.headers["Content-Security-Policy"]
        self.assertIn("'wasm-unsafe-eval'", csp)
        self.assertIn("connect-src 'self'", csp)
        self.assertNotIn("cdn.jsdelivr", csp)
        self.assertNotIn("huggingface.co", csp)
        self.assertNotIn(" 'unsafe-eval'", csp)

    # The browser does not redownload large local assets merely to hash them.
    # This build check binds the reviewed policy sizes and digests to the files.
    def test_vendored_siglip_runtime_and_model_match_frozen_size_and_sha256(self):
        self.assertEqual(set(SIGLIP_ASSET_INTEGRITY), SIGLIP_PUBLIC_ASSETS - {
            "model/appliance-siglip/model_manifest.json",
        })
        for relative_path, (size, digest) in SIGLIP_ASSET_INTEGRITY.items():
            with self.subTest(relative_path=relative_path):
                asset = PROJECT_ROOT / relative_path
                self.assertEqual(asset.stat().st_size, size)
                hasher = hashlib.sha256()
                with asset.open("rb") as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        hasher.update(chunk)
                self.assertEqual(hasher.hexdigest(), digest)

    def test_health_contract(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["service"], "available")
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    @patch("backend.api.repository.health_check", return_value={"ok": 1})
    def test_ready_contract(self, _health_check):
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["database"], "available")
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    @patch("backend.api.repository.reviewed_recall_products")
    @patch("backend.api.repository.recall_metadata")
    def test_recall_contract_contains_structured_identifier(self, metadata, products):
        metadata.return_value = {
            "source_version": "snapshot-1", "retrieval_date": date(2026, 9, 3),
            "coverage_start": date(2026, 4, 16), "coverage_end": date(2026, 8, 27),
            "record_count": 100, "limitations": "Limited recent RSS window",
        }
        products.return_value = [{
            "product_id": 1, "recall_id": 55, "category_codes": ["vacuum-cleaner"],
            "brand": "Mistral", "product_name": "Barrel Cyclonic Vacuum Cleaner",
            "title": "Mistral recall", "published_date": date(2026, 6, 10),
            "official_url": "https://www.productsafety.gov.au/recalls/example",
            "identifiers": [{"type": "model", "value": "BVC 160", "normalizedValue": "BVC160"}],
        }]
        response = self.client.get("/api/recalls")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["recalls"][0]["identifiers"][0]["normalizedValue"], "BVC160")
        self.assertEqual(response.json["meta"]["coverageStart"], "2026-04-16")

    @patch("backend.api.repository.health_check", side_effect=DatabaseUnavailable("hidden detail"))
    def test_database_failure_returns_generic_503(self, _health_check):
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"]["code"], "data_unavailable")
        self.assertNotIn("hidden detail", response.get_data(as_text=True))

    @patch("backend.api.repository.health_check", return_value=None)
    def test_ready_does_not_claim_success_without_query_result(self, _health_check):
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    @patch("backend.api.repository.sources", side_effect=DatabaseUnavailable("private URL"))
    def test_dataset_outage_is_not_cached_and_can_recover(self, sources):
        failed = self.client.get("/api/sources")
        self.assertEqual(failed.status_code, 503)
        self.assertEqual(failed.headers["Cache-Control"], "no-store")
        self.assertNotIn("private URL", failed.get_data(as_text=True))
        sources.side_effect = None
        sources.return_value = []
        recovered = self.client.get("/api/sources")
        self.assertEqual(recovered.status_code, 200)
        self.assertEqual(recovered.json["sources"], [])

    def test_missing_database_never_silently_uses_local_data(self):
        self.app.config["DATABASE_URL"] = ""
        for path in ("/api/ready", "/api/recalls", "/api/sources", "/api/repair-evidence", "/api/locations"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json["error"]["code"], "data_unavailable")
                self.assertEqual(response.headers["Cache-Control"], "no-store")

    @patch("backend.api.repository.relevant_locations")
    @patch("backend.api.repository.repair_barriers", return_value=[])
    @patch("backend.api.repository.repair_statistics")
    @patch("backend.api.repository.sources")
    def test_other_public_endpoint_contracts(self, sources, statistics, _barriers, locations):
        sources.return_value = [{
            "name": "Source", "url": "https://example.com", "licence": "CC",
            "retrieval_date": date(2026, 9, 3), "version": "1", "limitations": "Limited",
        }]
        statistics.return_value = [{
            "appliance_family": "Cleaning", "appliance_category": "Vacuum cleaner",
            "category_code": "vacuum_cleaner", "geography": "Global", "sample_size": 1,
            "fixed_count": 1, "repairable_count": 0, "end_of_life_count": 0,
            "confidence_level": "category", "limitations": "Not model-specific",
        }]
        locations.return_value = [{
            "id": 1, "location_type": "recycling", "name": "Site", "facility_type": "Drop-off",
            "address": "1 Road", "suburb": "Brunswick", "postcode": "3056", "phone": "03 9000 0000",
            "latitude": -37.77, "longitude": 144.96, "opening_hours": "Mo-Fr 09:00-17:00",
            "provider_type": "recycling_facility",
            "website": None, "verification_status": "unverified", "verification_notes": "",
            "source_notes": "Imported", "source_url": "https://example.com/source",
            "source_retrieved_at": date(2026, 8, 31),
        }]
        source_response = self.client.get("/api/sources")
        evidence_response = self.client.get("/api/repair-evidence")
        location_response = self.client.get("/api/locations")
        self.assertEqual(source_response.json["sources"][0]["retrievalDate"], "2026-09-03")
        self.assertEqual(evidence_response.json["evidence"][0]["fixedCount"], 1)
        self.assertEqual(location_response.json["locations"][0]["pathway"], "dispose")
        self.assertEqual(location_response.json["locations"][0]["latitude"], -37.77)
        self.assertEqual(location_response.json["locations"][0]["providerType"], "recycling_facility")


if __name__ == "__main__":
    unittest.main()
