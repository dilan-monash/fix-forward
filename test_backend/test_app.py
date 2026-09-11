"""Integration tests for Flask routing using repository fakes, not Neon."""

from datetime import date
import unittest
from unittest.mock import patch

from backend import create_app
from backend.db import DatabaseUnavailable


class AppTests(unittest.TestCase):
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
