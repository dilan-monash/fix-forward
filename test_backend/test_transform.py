"""Unit tests for backend transformations that do not require a live database."""

from datetime import date
import unittest

from backend.transform import (
    PRODUCT_SAFETY_HOSTS,
    build_location,
    build_recall_record,
    group_repair_evidence,
    safe_http_url,
)


class TransformTests(unittest.TestCase):
    def test_recall_record_keeps_only_reviewed_structured_fields(self):
        row = {
            "product_id": 4,
            "recall_id": 55,
            "category_codes": ["vacuum-cleaner"],
            "brand": "Mistral",
            "product_name": "Barrel Cyclonic Vacuum Cleaner",
            "title": "Mistral recall",
            "published_date": date(2026, 6, 10),
            "official_url": "https://www.productsafety.gov.au/recalls/example",
            "identifiers": [
                {"type": "model", "value": "BVC 160", "normalizedValue": "BVC160"},
                {"type": "model", "value": "incomplete"},
            ],
        }
        record = build_recall_record(row)
        self.assertEqual(record["published"], "2026-06-10")
        self.assertEqual(record["identifiers"], [{"type": "model", "value": "BVC 160", "normalizedValue": "BVC160"}])

    def test_recall_url_is_restricted_to_official_host(self):
        self.assertIsNone(safe_http_url("javascript:alert(1)"))
        self.assertIsNone(safe_http_url("https://example.com/fake", PRODUCT_SAFETY_HOSTS))
        self.assertEqual(
            safe_http_url("https://www.productsafety.gov.au/recalls", PRODUCT_SAFETY_HOSTS),
            "https://www.productsafety.gov.au/recalls",
        )

    def test_repair_evidence_calculates_unclassified_records(self):
        evidence = group_repair_evidence(
            [{
                "appliance_family": "Cleaning", "appliance_category": "Vacuum cleaner",
                "category_code": "vacuum_cleaner", "geography": "Global", "sample_size": 100,
                "fixed_count": 40, "repairable_count": 20, "end_of_life_count": 10,
                "confidence_level": "category only", "limitations": "Not model-specific",
            }],
            [{"appliance_category": "Vacuum cleaner", "barrier": "Spare parts", "occurrence_count": 12, "geography": "Global"}],
        )
        self.assertEqual(evidence[0]["unclassifiedCount"], 30)
        self.assertEqual(evidence[0]["barriers"][0]["name"], "Spare parts")

    def test_location_is_explicitly_labelled_unverified(self):
        location = build_location({
            "id": 7, "location_type": "repair", "name": "Example", "facility_type": "Repair",
            "address": None, "suburb": "Brunswick", "postcode": "3056", "phone": "",
            "website": "javascript:alert(1)", "verification_status": None,
            "verification_notes": None, "source_notes": "Imported record", "source_url": None,
            "source_retrieved_at": date(2026, 8, 31),
        })
        self.assertEqual(location["verificationStatus"], "unverified")
        self.assertEqual(location["address"], "Address not provided")
        self.assertIsNone(location["url"])


if __name__ == "__main__":
    unittest.main()
