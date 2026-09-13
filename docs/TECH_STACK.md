# Technology used in this checkout

Verified from the current code and manifests on 13 September 2026. This describes `tmp/child-quest-prototype`, the active adult/Quest project. The outer workspace contains an older copy.

| Part | Technology | Its actual job | Code evidence |
|---|---|---|---|
| Page structure | HTML5 | Entry pages, navigation, dialogs and accessible regions | [Adult entry](../index.html), [Quest entry](../quest/index.html) |
| Styling | CSS, Grid, Flexbox and media queries | Colours, spacing and tablet/phone layouts | [Adult CSS](../styles.css), [Quest CSS](../quest/quest.css), [tablet refinements](../quest/tablet-play.css) |
| Frontend behavior | Plain JavaScript with native ES modules | Events, form validation, screen updates and game rules | [Adult controller](../src/app.js), [Quest controller](../quest/app.js), [game engine](../quest/engine.js) |
| Illustration and animation | Authored SVG, CSS keyframes and transitions | Characters, scenes, badges and finite movement | [Art library](../quest/art.js), [effects](../quest/play-effects.css) |
| Touch/mouse input | Browser Pointer Events and ordinary buttons | Optional dragging plus tap/keyboard alternatives | [Drag helper](../quest/drag.js) |
| Read aloud | Browser Speech Synthesis API | Optional spoken story/clue text | [Quest controller](../quest/app.js) |
| Child progress | Browser localStorage with JSON | Save Quest progress/settings/designs on that browser | [Storage adapter](../quest/storage.js) |
| HTTP backend | Python and Flask | Website access, static files and JSON reference-data routes | [Entry point](../app.py), [Flask factory](../backend/__init__.py), [API routes](../backend/api.py) |
| Public reference database | PostgreSQL on Neon, accessed with psycopg | Read recalls, repair evidence, source information and locations | [Read-only DB layer](../backend/db.py), [repository](../backend/repository.py) |
| Reviewed price database | SQLite through Python's standard sqlite3 module | Build/read a separate local catalogue snapshot | [Price catalogue](../backend/price_catalogue.py) |
| Maps | Leaflet 1.9.4 and OpenStreetMap tiles | Adult service-location map loaded when needed | [Adult controller](../src/app.js) |
| Production serving configuration | Gunicorn and a Render deployment blueprint | Serve the Flask application using the declared build/start commands | [render.yaml](../render.yaml) |
| Local tools | Node.js and npm | Loopback preview helper, dependency installation and JavaScript checks | [package.json](../package.json), [preview helper](../test_helpers/serve-usability.mjs) |
| Tests | Node's built-in test/assert APIs, jsdom and Python unittest | Rule tests, simulated browser journeys and backend tests | [JavaScript tests](../test), [backend tests](../test_backend) |
| Data maintenance | Python, pandas, feedparser and pyshp, with SQL scripts | Clean source records, parse feeds/shapefiles and maintain reference data | [Data requirements](../requirements-data.txt), [maintenance scripts](../data/scripts) |
| Configuration | Environment variables and python-dotenv | Read private runtime settings without exposing them in browser code | [Settings](../backend/config.py), [runtime requirements](../requirements.txt) |

The frontend runs directly in the browser: `index.html` loads `src/app.js`, and `quest/index.html` loads `quest/app.js`. Imported modules connect the screens to their rules, data and artwork. Node is the local preview/test tool here; Flask is the configured production API server. [DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md) traces the complete connections.

The adult journey stores its current answers in JavaScript memory. Quest additionally saves its own progress in localStorage. Neon, SQLite and browser storage have separate roles. Browser speech may use an online voice; localStorage does not make the entire app an offline application.

Render/Neon references above describe configuration and code integration. This document does not establish that these latest local changes have been deployed or that a live database connection has been checked today.

## Where the comments are

Comments are written directly inside the source: HTML uses `<!-- ... -->`, JavaScript uses `// ...` and `/* ... */`, CSS uses `/* ... */`, and Python uses `# ...`. Open the source links above to read them next to the code. The handover document is an additional explanation, not the location of the source comments.

Both HTML entry pages explain their metadata, stylesheet/script connections, accessible attributes, navigation, dynamic content containers and dialogs. Every authored JavaScript/MJS file in `src/`, `quest/`, `test/` and `test_helpers/` has source comments. Installed dependency code in `node_modules` is maintained by its authors; temporary local verification files are not part of the product source.

For review, choose a function and explain its input, checks, result and caller. The nearby comments help follow that path, while [HANDOVER_VERIFICATION.md](HANDOVER_VERIFICATION.md) records the evidence that commenting preserved executable behavior.
