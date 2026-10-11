"""Exact public assets for the reviewed family site and its five games.

Adding a file to either prototype directory does not publish it. Every runtime
module, illustration and film asset must be named here; tests, authoring tools,
local servers, recordings and development notes remain private.
"""

FAMILY_ENTRY = "prototypes/i3-five-games/index.html"
FAMILY_FILM = "prototypes/i3-five-games/film.html"

FAMILY_FRONTEND_ASSETS = frozenset(
    {f"prototypes/i3-five-games/{name}" for name in (
        "index.html", "app.js", "routes.js", "result-reveal.js",
        "film.html", "film.js", "decide.js", "decide.css", "site-theme.css",
        "shell.css", "landing.js", "landing.css", "activities.js",
        "activities.css", "tutorial-art.js", "choices.js", "choices-engine.js",
        "choices.css", "scrapworks.js", "scrapworks.css", "scrapworks-art.js",
        "explore.js", "explore.css", "explore-icons.js",
    )}
    | {f"prototypes/i3-five-games/reference/{name}" for name in (
        "world.css", "explore.js", "explore.css", "catalogue.js",
        "catalogue-expanded.js", "catalogue-part-context.js", "models.js",
        "models-expanded-devices.js", "models-expanded-large.js", "world-engine.js",
        "action.js", "action.css", "progress.js", "fixit.js", "fixit.css",
        "fixit-3d.js", "fixit-engine.js", "fixit-party.js", "fixit-sound.js",
        "waste-models.js", "scrapworks-engine.js",
    )}
    | {f"prototypes/i3-five-games/support/{name}" for name in (
        "photo-helper.js", "photo-helper.css", "explore-catalogue.js",
        "explore-photo-helper.js", "explore-photo-helper.css",
        "explore-classifier.js", "siglip-appliance-classifier.js",
        "appliance-classifier.js", "appliance-review-policy.js",
    )}
    | {f"prototypes/i3-family-landing/{name}" for name in (
        "playroom.js", "playroom.css", "playroom-engine.js",
        "playroom-materials.js", "playroom-materials.css", "playroom-care.js",
        "playroom-care.css", "playroom-parent.js", "playroom-parent.css",
        # The playroom imports this small renderer for its illustrated card.
        "clue-lab-world.js",
    )}
    | {f"prototypes/i3-family-landing/assets/{name}" for name in (
        "pip.svg", "manrope-latin.woff2", "product-film-poster.svg",
        "fixforward-product-film.mp4", "fixforward-product-film.vtt",
        "product-film-transcript.txt", "product-film.json",
    )}
)

# Reuse the shipped Three.js bytes without duplicating large vendor files.
# Only these three exact URL aliases are supported, never a directory rewrite.
FAMILY_FRONTEND_ALIASES = {
    f"prototypes/i3-five-games/reference/vendor/{name}":
    f"prototypes/i3-world-preview/vendor/{name}"
    for name in ("three.core.js", "three.module.js", "OrbitControls.js")
}

# Explicit types keep strict nosniff and video/caption/font loading consistent
# across Windows review machines and the Linux deployment host.
FAMILY_ASSET_MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".mp4": "video/mp4",
    ".vtt": "text/vtt; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json",
}
