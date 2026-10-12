"""Bounded login attempts shared by workers on one application instance.

Only keyed client/session digests, attempt counts and expiries are stored. This
database is unrelated to Neon and contains no password, cookie or raw IP address. A
private temporary directory survives worker restarts on the same host; expired
rows are removed on use. Multiple application instances need a shared limiter
such as Redis before scaling horizontally.
"""

import hashlib
import hmac
import math
import os
from pathlib import Path
import sqlite3
import stat
import tempfile
import time
import weakref


ATTEMPT_LIMIT = 8
WINDOW_SECONDS = 10 * 60
MAX_CLIENTS = 10_000
MAX_SESSIONS = 10_000


class AccessLimitUnavailable(RuntimeError):
    """The access gate must fail closed when its attempt store is unavailable."""


class LoginAttemptLimiter:
    """Reserve attempts and keep revocable sessions shared by local workers."""

    def __init__(self, app, audience):
        key = app.config.get("SECRET_KEY", "")
        self.secret = (key if isinstance(key, str) else "").encode("utf-8")
        self.audience = audience
        self._temporary_directory = None
        configured_path = app.config.get("ACCESS_LIMIT_DB")
        if configured_path:
            self.path = Path(configured_path)
        elif app.testing:
            # Each synthetic app is isolated unless a test deliberately shares
            # a path to exercise the same multi-worker production behavior.
            self._temporary_directory = tempfile.TemporaryDirectory(prefix="fixforward-access-test-")
            # Explicit finalization avoids leaking test folders or noisy
            # implicit-cleanup warnings when a test app is garbage collected.
            weakref.finalize(app, self._temporary_directory.cleanup)
            self.path = Path(self._temporary_directory.name) / "attempts.sqlite3"
        else:
            # The keyed directory name avoids collisions with other releases
            # and does not reveal either the signing key or shared password.
            namespace = hmac.new(self.secret, audience.encode(), hashlib.sha256).hexdigest()[:24]
            self.path = Path(tempfile.gettempdir()) / f"fixforward-access-{namespace}" / "attempts.sqlite3"

    def client_key(self, address):
        # The access gate supplies either the direct socket address locally or
        # the validated Cloudflare address on the exact public Render service.
        # This store never reads a forwarding header or persists a raw IP.
        material = f"{self.audience}\0{address or 'unknown'}".encode("utf-8")
        return hmac.new(self.secret, material, hashlib.sha256).hexdigest()

    def _session_key(self, nonce):
        material = f"{self.audience}\0session\0{nonce}".encode("utf-8")
        return hmac.new(self.secret, material, hashlib.sha256).hexdigest()

    def _connect(self):
        """Open only a private local store and bound lock contention."""
        parent = self.path.parent
        parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        if parent.is_symlink() or self.path.is_symlink():
            raise AccessLimitUnavailable("Unsafe attempt store")
        # Windows protects the user temp directory with ACLs. On POSIX the
        # dedicated directory and file must belong to this process's user.
        if os.name != "nt":
            info = parent.stat()
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
                raise AccessLimitUnavailable("Unsafe attempt directory")
        try:
            descriptor = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            pass
        else:
            os.close(descriptor)
        if not self.path.is_file():
            raise AccessLimitUnavailable("Unsafe attempt file")
        if os.name != "nt":
            info = self.path.stat()
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
                raise AccessLimitUnavailable("Unsafe attempt file permissions")
        connection = sqlite3.connect(self.path, timeout=2, isolation_level=None)
        try:
            connection.execute("CREATE TABLE IF NOT EXISTS access_attempts (client_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at REAL NOT NULL)")
            connection.execute("CREATE TABLE IF NOT EXISTS access_sessions (session_key TEXT PRIMARY KEY, expires_at REAL NOT NULL)")
        except sqlite3.Error:
            connection.close()
            raise
        return connection

    def reserve(self, client_key):
        """Return retry seconds, or reserve one of this client's eight tries.

        BEGIN IMMEDIATE serializes workers so parallel password guesses cannot
        all pass the limit before a failure is recorded. Correct submissions
        also reserve first and clear their bucket only after verification.
        """
        connection = None
        try:
            connection = self._connect()
            now = time.time()
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM access_attempts WHERE expires_at <= ?", (now,))
            connection.execute("DELETE FROM access_sessions WHERE expires_at <= ?", (now,))
            row = connection.execute("SELECT attempts, expires_at FROM access_attempts WHERE client_key = ?", (client_key,)).fetchone()
            if row and row[0] >= ATTEMPT_LIMIT:
                connection.commit()
                return max(1, math.ceil(row[1] - now))
            if row:
                connection.execute("UPDATE access_attempts SET attempts = attempts + 1 WHERE client_key = ?", (client_key,))
            else:
                # Never evict an active bucket: eviction would let an attacker
                # reset their own limit by cycling client addresses.
                count = connection.execute("SELECT COUNT(*) FROM access_attempts").fetchone()[0]
                if count >= MAX_CLIENTS:
                    raise AccessLimitUnavailable("Attempt store is full")
                connection.execute("INSERT INTO access_attempts VALUES (?, 1, ?)", (client_key, now + WINDOW_SECONDS))
            connection.commit()
            return 0
        except (OSError, sqlite3.Error, AccessLimitUnavailable) as error:
            raise AccessLimitUnavailable("Access checks are temporarily unavailable") from error
        finally:
            if connection is not None:
                connection.close()

    def begin_session(self, client_key, nonce, expires_at):
        """Register a verified session and reset attempts in one transaction.

        Only an active registry entry makes a signed cookie usable. A restart
        with an empty store therefore invalidates old sessions rather than
        accidentally reviving a token that was locked on an earlier process.
        """
        connection = None
        try:
            connection = self._connect()
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM access_sessions WHERE expires_at <= ?", (time.time(),))
            count = connection.execute("SELECT COUNT(*) FROM access_sessions").fetchone()[0]
            if count >= MAX_SESSIONS:
                raise AccessLimitUnavailable("Session store is full")
            connection.execute("INSERT INTO access_sessions VALUES (?, ?)", (self._session_key(nonce), expires_at))
            connection.execute("DELETE FROM access_attempts WHERE client_key = ?", (client_key,))
            connection.commit()
        except (OSError, sqlite3.Error, AccessLimitUnavailable) as error:
            raise AccessLimitUnavailable("Access checks are temporarily unavailable") from error
        finally:
            if connection is not None:
                connection.close()

    def session_is_active(self, nonce):
        """Check every protected request so a copied cookie stops at logout."""
        connection = None
        try:
            connection = self._connect()
            row = connection.execute("SELECT expires_at FROM access_sessions WHERE session_key = ?", (self._session_key(nonce),)).fetchone()
            return bool(row and row[0] > time.time())
        except (OSError, sqlite3.Error, AccessLimitUnavailable) as error:
            raise AccessLimitUnavailable("Access checks are temporarily unavailable") from error
        finally:
            if connection is not None:
                connection.close()

    def revoke_session(self, nonce):
        """Remove authorization before the browser's cookie is cleared."""
        connection = None
        try:
            connection = self._connect()
            connection.execute("DELETE FROM access_sessions WHERE session_key = ?", (self._session_key(nonce),))
        except (OSError, sqlite3.Error, AccessLimitUnavailable) as error:
            raise AccessLimitUnavailable("Access checks are temporarily unavailable") from error
        finally:
            if connection is not None:
                connection.close()
