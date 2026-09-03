"""
Shared helpers for import provenance.

Every loader that writes a data_import_runs row should hash the exact
downloaded snapshot with sha256_file and store that digest in checksum.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime
from typing import Any


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checksum_label(path: str) -> str:
    """sha256(<basename>)=<hex> — the format stored on data_import_runs."""
    import os

    return f"sha256({os.path.basename(path)})={sha256_file(path)}"


def upsert_import_run(
    cur: Any,
    *,
    data_source_id: int,
    retrieved_at: date | datetime | str,
    record_count: int,
    source_version: str | None,
    source_file_url: str | None,
    checksum: str | None,
    limitations: str | None,
    coverage_start: str | None = None,
    coverage_end: str | None = None,
) -> None:
    cur.execute(
        """
        INSERT INTO data_import_runs (
            data_source_id, retrieved_at, coverage_start, coverage_end,
            record_count, source_version, source_file_url, checksum,
            import_status, limitations
        ) VALUES (
            %s, %s::timestamptz, %s, %s, %s, %s, %s, %s, 'succeeded', %s
        )
        ON CONFLICT (data_source_id, retrieved_at) DO UPDATE SET
            coverage_start = EXCLUDED.coverage_start,
            coverage_end = EXCLUDED.coverage_end,
            record_count = EXCLUDED.record_count,
            source_version = EXCLUDED.source_version,
            source_file_url = EXCLUDED.source_file_url,
            checksum = EXCLUDED.checksum,
            limitations = EXCLUDED.limitations;
        """,
        (
            data_source_id,
            retrieved_at,
            coverage_start,
            coverage_end,
            record_count,
            source_version,
            source_file_url,
            checksum,
            limitations,
        ),
    )
