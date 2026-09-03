"""Integration tests for Flask routing using repository fakes, not Neon."""

from datetime import date
import unittest
from unittest.mock import patch

from backend import create_app
from backend.db import DatabaseUnavailable


class AppTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "DATABASE_URL": "unused-in-fake"})
        self.client = self.app.test_client()

    def test_frontend_is_served_but_backend_source_is_not_public(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"FixForward", response.data)
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        blocked = self.client.get("/backend/config.py")
        self.assertEqual(blocked.status_code, 404)
        response.close()
        blocked.close()

    @patch("backend.api.repository.health_check", return_value={"ok": 1})
    def test_health_contract(self, _health_check):
        response = self.client.get("/api/health")
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
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"]["code"], "data_unavailable")
        self.assertNotIn("hidden detail", response.get_data(as_text=True))

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
            "address": "1 Road", "suburb": "Brunswick", "postcode": "3056", "phone": "",
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


if __name__ == "__main__":
    unittest.main()
