# Read-only database wrapper suite using a fake psycopg module and connection/cursor objects.
# It checks transaction options, timeout ordering and sanitized failures without a real database connection.

"""Pooler compatibility and failure handling without a live database."""

import sys
from types import ModuleType
import unittest
from unittest.mock import MagicMock, call, patch, sentinel

from flask import Flask

from backend.db import DatabaseUnavailable, fetch_all


# Group pooler-compatible query ordering and failure-path checks.
class DatabaseAccessTests(unittest.TestCase):
    # Prepare mock context managers and an isolated Flask configuration for one query-wrapper case.
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            DATABASE_URL="postgresql://fixture:private-value@fixture-pooler/database",
            DB_CONNECT_TIMEOUT=7,
        )
        self.connection = MagicMock()
        self.connection.__enter__.return_value = self.connection
        self.connection.read_only = False
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.cursor.__enter__.return_value = self.cursor
        self.cursor.fetchall.return_value = [{"ok": 1}]

        # Model PgBouncer's rejection at the driver boundary. No credentials or
        # running PostgreSQL instance are needed for this regression check.
        # Stand in for psycopg.connect and record supplied options without opening a socket.
        def connect(_url, **kwargs):
            if "options" in kwargs:
                raise RuntimeError("unsupported startup parameter in options")
            return self.connection

        self.driver = ModuleType("psycopg")
        self.driver.connect = MagicMock(side_effect=connect)
        self.rows = ModuleType("psycopg.rows")
        self.rows.dict_row = sentinel.dict_row
        modules = patch.dict(sys.modules, {"psycopg": self.driver, "psycopg.rows": self.rows})
        modules.start()
        self.addCleanup(modules.stop)

    def test_pooled_read_applies_transaction_timeout_before_parameterised_query(self):
        query = "SELECT %s AS ok"
        params = (1,)
        read_only_at_execute = []
        self.cursor.execute.side_effect = lambda *_args: read_only_at_execute.append(
            self.connection.read_only
        )

        with self.app.app_context():
            result = fetch_all(query, params)

        self.assertEqual(result, [{"ok": 1}])
        self.driver.connect.assert_called_once_with(
            self.app.config["DATABASE_URL"],
            connect_timeout=7,
            row_factory=sentinel.dict_row,
        )
        self.assertEqual(self.cursor.execute.call_args_list, [
            call("SET LOCAL statement_timeout = '10s'"),
            call(query, params),
        ])
        self.assertIs(self.cursor.execute.call_args_list[1].args[1], params)
        self.assertEqual(read_only_at_execute, [True, True])
        self.cursor.fetchall.assert_called_once_with()

    def test_timeout_setup_failure_prevents_unbounded_query(self):
        failure = RuntimeError("private-value from server")
        self.cursor.execute.side_effect = failure

        with self.app.app_context(), self.assertRaises(DatabaseUnavailable) as caught:
            fetch_all("SELECT 1 AS ok")

        self.cursor.execute.assert_called_once_with("SET LOCAL statement_timeout = '10s'")
        self.cursor.fetchall.assert_not_called()
        self.assertIs(caught.exception.__cause__, failure)
        self.assertEqual(str(caught.exception), "The public database could not be read")
        # The connection context receives the error, allowing rollback before
        # its server connection returns to the pool.
        self.assertIs(self.connection.__exit__.call_args.args[1], failure)

    def test_query_failure_remains_generic_and_rolls_back(self):
        failure = RuntimeError("private-value from query")
        self.cursor.execute.side_effect = [None, failure]

        with self.app.app_context(), self.assertRaises(DatabaseUnavailable) as caught:
            fetch_all("SELECT %s AS ok", (1,))

        self.assertEqual(self.cursor.execute.call_count, 2)
        self.cursor.fetchall.assert_not_called()
        self.assertIs(caught.exception.__cause__, failure)
        self.assertNotIn("private-value", str(caught.exception))
        self.assertIs(self.connection.__exit__.call_args.args[1], failure)

    def test_connect_failure_remains_generic_and_does_not_execute_sql(self):
        failure = RuntimeError("private-value from connection")
        self.driver.connect.side_effect = failure

        with self.app.app_context(), self.assertRaises(DatabaseUnavailable) as caught:
            fetch_all("SELECT 1 AS ok")

        self.connection.cursor.assert_not_called()
        self.assertIs(caught.exception.__cause__, failure)
        self.assertNotIn("private-value", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
