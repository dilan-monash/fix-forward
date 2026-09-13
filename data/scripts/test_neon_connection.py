# Compatibility wrapper for the read-only backend.check_database diagnostic, not a database-writing test.
# It adds the repository to Python imports and delegates to the shared diagnostic only when run as a script.

"""Compatibility entry point for the application's read-only database check.

Run: python data/scripts/test_neon_connection.py
Install requirements first: python -m pip install -r requirements.txt
"""

from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.check_database import main


if __name__ == "__main__":
    raise SystemExit(main())
