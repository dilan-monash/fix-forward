# Price validation and API suite using temporary local SQLite files and reviewed example records.
# Tests intentionally modify those temporary files to probe integrity; they do not change the project catalogue or contact Neon.

"""Price provenance/storage tests using temporary databases and standard library."""

from copy import deepcopy
from contextlib import closing
from datetime import date
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backend.price_catalogue import (
    CatalogueValidationError,
    PriceCatalogueUnavailable,
    build_database,
    load_reviewed_observations,
    read_catalogue,
    snapshot_payload,
    validate_observation,
    validate_observations,
)


# Return one complete synthetic price observation with optional field overrides for a focused case.
def example(**overrides):
    # Synthetic fixture: no claim that this product or price is a real offer.
    record = {
        "id": "test-kettle-a", "categoryCode": "kettle", "brand": "Test Brand",
        "model": "TEST-001", "productName": "Synthetic test kettle",
        "retailer": "JB Hi-Fi", "priceAud": 29.95, "currency": "AUD",
        "sourceUrl": "https://www.jbhifi.com.au/products/synthetic-test-kettle",
        "observedAt": "2020-01-01", "priceKind": "advertised",
        "availability": "not-verified", "notes": "Synthetic fixture only.",
    }
    record.update(overrides)
    return record


# Group pure validation and temporary SQLite build/read integrity checks.
class PriceCatalogueTests(unittest.TestCase):
    # Create isolated temporary paths and fixtures for this test instance.
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.database = self.root / "catalogue.sqlite"

    # Remove the temporary directory created by the test so its local database does not persist.
    def tearDown(self):
        self.temp.cleanup()

    def test_build_roundtrip_keeps_provenance_and_exact_aud_cents(self):
        record = example()
        result = build_database([record], self.database)
        self.assertEqual(read_catalogue(self.database), result)
        self.assertEqual(result["prices"], [record])
        self.assertEqual(result["meta"]["source"], "reviewed-price-snapshot")
        self.assertFalse(result["meta"]["livePrices"])
        with closing(sqlite3.connect(self.database)) as connection:
            self.assertEqual(connection.execute("SELECT price_cents FROM replacement_price_observations").fetchone()[0], 2995)

    def test_repeated_read_never_changes_file_and_missing_file_is_not_created(self):
        with self.assertRaises(PriceCatalogueUnavailable):
            read_catalogue(self.database)
        self.assertFalse(self.database.exists())
        build_database([example()], self.database)
        before = self.database.read_bytes()
        for _ in range(3):
            read_catalogue(self.database)
        self.assertEqual(self.database.read_bytes(), before)

    def test_corrupt_or_empty_file_is_explicitly_unavailable(self):
        for data in (b"", b"not-a-sqlite-database"):
            with self.subTest(data=data):
                self.database.write_bytes(data)
                with self.assertRaises(PriceCatalogueUnavailable):
                    read_catalogue(self.database)

    def test_modified_record_cannot_retain_old_reviewed_snapshot_metadata(self):
        build_database([example()], self.database)
        with closing(sqlite3.connect(self.database)) as connection:
            connection.execute("UPDATE replacement_price_observations SET price_cents=1")
            connection.commit()
        with self.assertRaises(PriceCatalogueUnavailable):
            read_catalogue(self.database)

    def test_invalid_rebuild_preserves_existing_good_database(self):
        build_database([example()], self.database)
        before = self.database.read_bytes()
        with self.assertRaises(CatalogueValidationError):
            build_database([example(priceAud=-5)], self.database)
        self.assertEqual(before, self.database.read_bytes())

    def test_price_must_be_finite_positive_aud_not_boolean_or_text(self):
        for value in (True, False, None, "29.95", 0, -1, float("nan"), float("inf"), 1.001, 100000.01):
            with self.subTest(value=value):
                with self.assertRaises(CatalogueValidationError):
                    validate_observation(example(priceAud=value))
        with self.assertRaises(CatalogueValidationError):
            validate_observation(example(currency="USD"))
        self.assertEqual(validate_observation(example(priceAud=100000))["priceAud"], 100000)

    def test_source_must_match_named_official_retailer(self):
        for url in (
            "javascript:alert(1)", "http://www.jbhifi.com.au/product",
            "https://jbhifi.com.au.evil.example/product", "https://evil.example/product",
            "https://user:password@www.jbhifi.com.au/product", "https://www.jbhifi.com.au/",
            "https://www.jbhifi.com.au:8080/product", "https://www.harveynorman.com.au/product",
        ):
            with self.subTest(url=url):
                with self.assertRaises(CatalogueValidationError):
                    validate_observation(example(sourceUrl=url))
        with self.assertRaises(CatalogueValidationError):
            validate_observation(example(retailer="Unknown market"))

    def test_amazon_needs_reviewed_direct_seller_evidence(self):
        record = example(retailer="Amazon AU", sourceUrl="https://www.amazon.com.au/dp/TEST00001")
        with self.assertRaises(CatalogueValidationError):
            validate_observation(record)
        record["notes"] = "Source review: Sold by Amazon AU. Synthetic fixture."
        self.assertEqual(validate_observation(record)["retailer"], "Amazon AU")

    def test_missing_model_unknown_category_and_bad_dates_rejected(self):
        for changes in (
            {"model": ""}, {"brand": None}, {"categoryCode": "unknown"},
            {"observedAt": "2026-02-30"}, {"observedAt": "20200101"},
            {"observedAt": "2999-01-01"}, {"availability": "probably"},
        ):
            with self.subTest(changes=changes):
                with self.assertRaises(CatalogueValidationError):
                    validate_observation(example(**changes), today=date(2026, 9, 11))

    def test_duplicate_observations_rejected_but_history_is_preserved(self):
        record = example()
        for duplicate in (deepcopy(record), example(id="different-id")):
            with self.assertRaises(CatalogueValidationError):
                validate_observations([record, duplicate])
        later = example(id="test-kettle-later", observedAt="2020-02-01", priceAud=39.95)
        result = build_database([record, later], self.database)
        self.assertEqual(len(result["prices"]), 2)
        self.assertEqual(result["meta"]["firstObservedAt"], "2020-01-01")
        self.assertEqual(result["meta"]["lastObservedAt"], "2020-02-01")

    def test_source_loader_combines_only_observation_arrays(self):
        with self.assertRaises(CatalogueValidationError):
            load_reviewed_observations(self.root)
        first = example()
        second = example(id="test-b", model="TEST-002", sourceUrl="https://www.jbhifi.com.au/products/synthetic-test-2")
        (self.root / "a-observations.json").write_text(json.dumps([first]), encoding="utf-8")
        (self.root / "b-observations.json").write_text(json.dumps([second]), encoding="utf-8")
        (self.root / "unrelated.json").write_text("not parsed", encoding="utf-8")
        self.assertCountEqual(load_reviewed_observations(self.root), [first, second])

    def test_snapshot_identity_is_stable_and_changes_with_price(self):
        first = snapshot_payload([example()])
        self.assertEqual(first, snapshot_payload([example()]))
        second = snapshot_payload([example(priceAud=30)])
        self.assertNotEqual(first["meta"]["snapshotVersion"], second["meta"]["snapshotVersion"])


HAS_WEB_DEPENDENCIES = bool(importlib.util.find_spec("flask") and importlib.util.find_spec("dotenv"))


@unittest.skipUnless(HAS_WEB_DEPENDENCIES, "Flask/python-dotenv are not installed; stdlib catalogue tests still run")
# Check price API availability independently from PostgreSQL readiness.
class PriceCatalogueApiTests(unittest.TestCase):
    # Create isolated temporary paths and fixtures for this test instance.
    def setUp(self):
        from backend import create_app
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "catalogue.sqlite"
        self.app = create_app({"TESTING": True, "SITE_ACCESS_ENABLED": False, "DATABASE_URL": "", "PRICE_CATALOGUE_PATH": self.database})
        self.client = self.app.test_client()

    # Remove the temporary directory created by the test so its local database does not persist.
    def tearDown(self):
        self.temp.cleanup()

    def test_price_snapshot_is_available_without_claiming_neon_readiness(self):
        build_database([example()], self.database)
        response = self.client.get("/api/replacement-prices")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["meta"]["storage"], "local-public-snapshot")
        self.assertEqual(response.json["prices"][0]["priceAud"], 29.95)
        self.assertEqual(self.client.get("/api/ready").status_code, 503)

    def test_missing_snapshot_returns_503_without_path_or_details(self):
        response = self.client.get("/api/replacement-prices")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"]["code"], "price_catalogue_unavailable")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertNotIn(str(self.database), response.get_data(as_text=True))

    @patch("backend.api.repository.health_check", side_effect=AssertionError("price catalogue must not query Neon"))
    def test_price_read_does_not_depend_on_neon_health(self, _health_check):
        build_database([example()], self.database)
        self.assertEqual(self.client.get("/api/replacement-prices").status_code, 200)


if __name__ == "__main__":
    unittest.main()
