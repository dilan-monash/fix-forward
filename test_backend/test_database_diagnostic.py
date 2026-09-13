# Diagnostic-output suite driven by fake Flask clients and response objects; no database or web server is started.
# Assertions cover honest readiness/count reporting and ensure output omits connection details.

"""Diagnostic behavior tests without a live database or installed web server."""

from contextlib import redirect_stdout
from io import StringIO
import unittest
from unittest.mock import MagicMock, patch

from backend import check_database


# Create a configurable fake app/client so diagnostic control flow can be tested without Flask requests.
def fake_app(responses=None, database_url="postgresql://private-user:private-pass@private-host/database"):
    app = MagicMock()
    app.config = {"DATABASE_URL": database_url}
    client = app.test_client.return_value.__enter__.return_value
    if responses is not None:
        client.get.side_effect = responses
    return app, client


# Build the minimum response interface used by the diagnostic: status code and JSON payload.
def response(payload, status=200):
    result = MagicMock()
    result.status_code = status
    result.get_json.return_value = payload
    return result


# Supply valid readiness and dataset responses as a baseline that individual cases can alter.
def passing_responses():
    return [
        response({"database": "available"}),
        response({"recalls": [{"secret": "row-contents"}]}),
        response({"sources": [{}]}),
        response({"evidence": [{}]}),
        response({"locations": [{}]}),
    ]


# Group diagnostic setup, short-circuit, malformed-payload and output-safety checks.
class DatabaseDiagnosticTests(unittest.TestCase):
    # Run the diagnostic against a supplied fake and capture its exit code and printed report.
    def run_main(self, app):
        output = StringIO()
        with patch.object(check_database, "create_app", return_value=app), redirect_stdout(output):
            code = check_database.main()
        return code, output.getvalue()

    def test_missing_configuration_makes_no_database_request(self):
        app, client = fake_app(database_url="")
        code, output = self.run_main(app)
        self.assertEqual(code, 1)
        self.assertIn("NOT CONNECTED", output)
        client.get.assert_not_called()

    def test_failed_connection_stops_repeated_slow_attempts(self):
        app, client = fake_app([response({"error": {"message": "private-host"}}, 503)])
        code, output = self.run_main(app)
        self.assertEqual(code, 1)
        self.assertEqual(client.get.call_count, 1)
        self.assertNotIn("private-host", output)
        self.assertNotIn("private-pass", output)

    def test_connected_database_with_broken_dataset_is_not_reported_ready(self):
        results = passing_responses()
        results[2] = response({"error": {"code": "data_unavailable"}}, 503)
        app, _client = fake_app(results)
        code, output = self.run_main(app)
        self.assertEqual(code, 1)
        self.assertIn("FAIL: /api/sources", output)

    def test_empty_import_is_reported_separately(self):
        results = passing_responses()
        results[-1] = response({"locations": []})
        app, _client = fake_app(results)
        code, output = self.run_main(app)
        self.assertEqual(code, 2)
        self.assertIn("CONNECTED, BUT DATA INCOMPLETE", output)

    def test_valid_endpoints_return_counts_without_secrets_or_rows(self):
        app, client = fake_app(passing_responses())
        code, output = self.run_main(app)
        self.assertEqual(code, 0)
        self.assertEqual(client.get.call_count, 5)
        self.assertIn("/api/recalls (HTTP 200, 1 rows)", output)
        for secret in ("private-user", "private-pass", "private-host", "row-contents"):
            self.assertNotIn(secret, output)

    def test_success_http_with_wrong_payload_shape_fails(self):
        results = passing_responses()
        results[-1] = response({"locations": "not-an-array"})
        app, _client = fake_app(results)
        code, output = self.run_main(app)
        self.assertEqual(code, 1)
        self.assertIn("FAIL: /api/locations", output)


if __name__ == "__main__":
    unittest.main()
