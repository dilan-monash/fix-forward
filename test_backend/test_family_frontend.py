"""Release routing checks using synthetic sessions and real shipped asset bytes."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest
from urllib.parse import parse_qs, urljoin, urlsplit

from backend import PROJECT_ROOT, SHARED_FRONTEND_ASSETS, create_app
from backend.family_frontend import (
    FAMILY_ASSET_MIME, FAMILY_ENTRY, FAMILY_FILM,
    FAMILY_FRONTEND_ALIASES, FAMILY_FRONTEND_ASSETS,
)


class DocumentAssets(HTMLParser):
    """Collect browser-loaded resources without treating ordinary links as assets."""
    def __init__(self):
        super().__init__()
        self.urls = []
        self.inline_script = False

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "script" and not attrs.get("src"):
            self.inline_script = True
        if tag in {"script", "img", "source", "track"} and attrs.get("src"):
            self.urls.append(attrs["src"])
        if tag == "video" and attrs.get("poster"):
            self.urls.append(attrs["poster"])
        if tag == "link" and attrs.get("rel") in {"stylesheet", "preload", "icon"}:
            self.urls.append(attrs["href"])


class FamilyFrontendTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "SITE_ACCESS_ENABLED": True,
            "SITE_PASSWORD": "synthetic-family-password",
            "SECRET_KEY": "synthetic-family-key-at-least-thirty-two-characters",
            "SESSION_COOKIE_SECURE": False, "DATABASE_URL": "unused-in-fake",
        })
        self.client = self.app.test_client()

    def login(self, destination="/"):
        with self.client.get("/login", query_string={"next": destination}) as page:
            token = re.search(r'name="csrf_token" value="([^"]+)"', page.get_data(as_text=True)).group(1)
        with self.client.post("/login", data={"csrf_token": token,
                "password": "synthetic-family-password", "next": destination}) as response:
            self.assertEqual(response.status_code, 303)
            return response.headers["Location"]

    def test_every_new_asset_and_alias_requires_the_existing_access_session(self):
        for asset in FAMILY_FRONTEND_ASSETS | FAMILY_FRONTEND_ALIASES.keys():
            with self.subTest(asset=asset), self.client.head("/" + asset) as response:
                self.assertEqual(response.status_code, 303)
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        with self.client.get("/film.html") as response:
            self.assertEqual(response.status_code, 303)
            self.assertEqual(parse_qs(urlsplit(response.headers["Location"]).query), {"next": ["/film.html"]})

    def test_authentication_opens_the_reviewed_entry_and_returns_to_the_film(self):
        self.assertEqual(self.login("/film.html"), "/film.html")
        for path in ("/", "/index.html", "/" + FAMILY_ENTRY):
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)
                self.assertIn(b'/prototypes/i3-five-games/app.js', response.data)
                self.assertIn(b'fill="#061f57"', response.data)
                self.assertIn(b'fill="#12b6f4"', response.data)
        with self.client.get("/film.html") as response:
            self.assertEqual(response.data, (PROJECT_ROOT / FAMILY_FILM).read_bytes())
        # The film is a known page, not a prefix that permits arbitrary redirects.
        for target in ("/film.html?next=//example.com", "/film.html/../logout", "//example.com/film.html"):
            with self.client.get("/login", query_string={"next": target}) as response:
                self.assertEqual(response.headers["Location"], "/")

    def test_all_named_assets_exist_and_have_explicit_browser_safe_types(self):
        self.login()
        for asset in FAMILY_FRONTEND_ASSETS | FAMILY_FRONTEND_ALIASES.keys():
            with self.subTest(asset=asset), self.client.head("/" + asset) as response:
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, FAMILY_ASSET_MIME[Path(asset).suffix].split(";")[0])
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                self.assertEqual(response.headers["Cache-Control"], "private, no-store")

    def test_only_the_three_reviewed_vendor_urls_alias_existing_bytes(self):
        self.login()
        self.assertEqual(len(FAMILY_FRONTEND_ALIASES), 3)
        for url, original in FAMILY_FRONTEND_ALIASES.items():
            with self.subTest(url=url), self.client.get("/" + url) as response:
                self.assertEqual(response.data, (PROJECT_ROOT / original).read_bytes())
        with self.client.get("/prototypes/i3-five-games/reference/vendor/README.md") as response:
            self.assertEqual(response.status_code, 404)

    def test_actual_runtime_imports_and_document_assets_resolve_after_login(self):
        self.login()
        imports = re.compile(r'''(?:^\s*(?:import|export)\b\s*(?!function\b|class\b|const\b|let\b|var\b|default\b)[^;]*?\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)["']([^"'\r\n]+)["']''', re.MULTILINE)
        loaded_urls = set()
        pending = list(FAMILY_FRONTEND_ASSETS | FAMILY_FRONTEND_ALIASES.keys())
        scanned = set()
        while pending:
            asset = pending.pop()
            if asset in scanned:
                continue
            scanned.add(asset)
            source = PROJECT_ROOT / FAMILY_FRONTEND_ALIASES.get(asset, asset)
            if source.suffix == ".js":
                references = imports.findall(source.read_text(encoding="utf-8"))
            elif source.suffix == ".html":
                parser = DocumentAssets()
                parser.feed(source.read_text(encoding="utf-8"))
                self.assertFalse(parser.inline_script, asset)
                references = parser.urls
            else:
                continue
            for reference in references:
                self.assertTrue(reference.startswith((".", "/")), (asset, reference))
                resolved = urlsplit(urljoin("/" + asset, reference)).path
                loaded_urls.add(resolved)
                if resolved.endswith((".js", ".html")):
                    pending.append(resolved.lstrip("/"))
        # This catches missing transitive imports and accidental exposure of an
        # unrelated future src file, rather than duplicating a hand-picked list.
        self.assertEqual({url.lstrip("/") for url in loaded_urls if url.startswith("/src/")},
                         set(SHARED_FRONTEND_ASSETS))
        self.assertIn("/prototypes/i3-five-games/reference/vendor/three.core.js", loaded_urls)
        for url in sorted(loaded_urls):
            with self.subTest(url=url), self.client.head(url) as response:
                self.assertEqual(response.status_code, 200)

    def test_test_files_private_sources_unused_assets_and_traversal_stay_private(self):
        self.login()
        for url in (
            "/prototypes/i3-five-games/activities.test.js", "/prototypes/i3-five-games/serve.mjs",
            "/prototypes/i3-five-games/README.md", "/backend/family_frontend.py",
            "/prototypes/i3-family-landing/film.html", "/prototypes/i3-family-landing/assets/hero-device-story.svg",
            "/prototypes/i3-family-landing/assets/discover-appliances.svg",
            "/prototypes/i3-family-landing/workshop.js", "/prototypes/i3-family-landing/clue-lab.js",
            "/prototypes/i3-five-games/reference/../../../../backend/config.py",
            "/prototypes/i3-five-games/reference/vendor/%2e%2e/%2e%2e/activities.test.js",
            "/src/%2e%2e/prototypes/i3-five-games/activities.test.js",
        ):
            with self.subTest(url=url), self.client.get(url) as response:
                self.assertEqual(response.status_code, 404)
        with self.client.post("/prototypes/i3-five-games/app.js", data="replacement") as response:
            self.assertEqual(response.status_code, 405)

    def test_authenticated_film_supports_seeking_and_expiry_locks_binary_ranges(self):
        self.login()
        asset = "prototypes/i3-family-landing/assets/fixforward-product-film.mp4"
        file = PROJECT_ROOT / asset
        size = file.stat().st_size
        with self.client.get("/" + asset, headers={"Range": "bytes=0-63"}) as response:
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response.headers["Content-Range"], f"bytes 0-63/{size}")
            with file.open("rb") as stream:
                self.assertEqual(response.data, stream.read(64))
            self.assertEqual(response.mimetype, "video/mp4")
            self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        with self.client.get("/" + asset, headers={"Range": "bytes=-32"}) as response:
            self.assertEqual(response.status_code, 206)
            self.assertEqual(len(response.data), 32)
        with self.client.get("/" + asset, headers={"Range": f"bytes={size}-"}) as response:
            self.assertEqual(response.status_code, 416)
        with self.client.session_transaction() as saved:
            saved["access_issued_at"] -= 4 * 60 * 60
        with self.client.get("/" + asset, headers={"Range": "bytes=0-63"}) as response:
            self.assertEqual(response.status_code, 303)
            self.assertNotEqual(response.mimetype, "video/mp4")

    def test_new_documents_keep_script_and_model_security_boundaries(self):
        self.login()
        for url in ("/", "/film.html"):
            with self.client.get(url) as response:
                csp = response.headers["Content-Security-Policy"]
                scripts = next(rule for rule in csp.split(";") if "script-src" in rule)
                self.assertIn("'wasm-unsafe-eval'", scripts)
                self.assertNotIn("'unsafe-inline'", scripts)
                self.assertNotIn(" 'unsafe-eval'", scripts)
                self.assertIn("connect-src 'self'", csp)
                self.assertEqual(response.headers["X-Frame-Options"], "DENY")


if __name__ == "__main__":
    unittest.main()
