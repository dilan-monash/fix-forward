# Technology used in this checkout

Verified from the code and manifests on 13 September 2026, when the active adult/Quest project was the Iteration 2 `tmp/child-quest-prototype` checkout. The same application now continues on the `iteration-3` branch; rows added or corrected after that date say so.

| Part | Technology | Its actual job | Code evidence |
|---|---|---|---|
| Page structure | HTML5 | Entry pages, navigation, dialogs and accessible regions | [Adult entry](../index.html), [Quest entry](../quest/index.html) |
| Styling | CSS, Grid, Flexbox and media queries | Colours, spacing and tablet/phone layouts | [Adult CSS](../styles.css), [Quest CSS](../quest/quest.css), [tablet refinements](../quest/tablet-play.css) |
| Frontend behavior | Plain JavaScript with native ES modules | Events, form validation, screen updates and game rules | [Adult controller](../src/app.js), [Quest controller](../quest/app.js), [game engine](../quest/engine.js) |
| Adult photo suggestion (disabled candidate reviewed 9 October 2026) | `@huggingface/transformers` 3.8.1, ONNX Runtime Web/WASM, a pinned Google SigLIP 2 q4 vision model and local text embeddings | Browser-local appliance-type candidate with about 92.5 MB of self-hosted same-origin first-use assets. Candidate v2 failed its pre-registered gate, so manual selection stays available and both release flags remain false. A future accepted suggestion would require explicit confirmation; no fault diagnosis is implemented. | [Photo UI](../src/photo-helper.js), [SigLIP integration](../src/siglip-appliance-classifier.js), [disabled manifest](../model/appliance-siglip/model_manifest.json), [validation evidence](APPLIANCE_MODEL_VALIDATION.md) |
| Illustration and animation | Authored SVG, CSS keyframes and transitions | Characters, scenes, badges and finite movement | [Art library](../quest/art.js), [effects](../quest/play-effects.css) |
| Touch/mouse input | Browser Pointer Events and ordinary buttons | Optional dragging plus tap/keyboard alternatives | [Drag helper](../quest/drag.js) |
| Read aloud | Browser Speech Synthesis API | Optional spoken story/clue text | [Quest controller](../quest/app.js) |
| Child progress | Browser localStorage with JSON | Save Quest progress/settings/designs on that browser | [Storage adapter](../quest/storage.js) |
| HTTP backend | Python and Flask | Website access, static files and JSON reference-data routes | [Entry point](../app.py), [Flask factory](../backend/__init__.py), [API routes](../backend/api.py) |
| Public reference database | PostgreSQL on Neon, accessed with psycopg | Read recalls, repair evidence, source information and locations | [Read-only DB layer](../backend/db.py), [repository](../backend/repository.py) |
| Reviewed price database | SQLite through Python's standard sqlite3 module | Build/read a separate local catalogue snapshot | [Price catalogue](../backend/price_catalogue.py) |
| Maps | Leaflet 1.9.4 and OpenStreetMap tiles | Adult service-location map loaded when needed | [Adult controller](../src/app.js) |
| Production serving configuration | Gunicorn and a Render deployment blueprint | Serve the Flask application using the declared build/start commands | [render.yaml](../render.yaml) |
| Local tools (requirement corrected 9 October 2026) | Node.js `^22.22.2`, `^24.15.0` or `26+`, and npm | Loopback preview helper, dependency installation and JavaScript checks; Node 20 cannot run the complete locked test dependency stack | [package.json](../package.json), [preview helper](../test_helpers/serve-usability.mjs) |
| Tests | Node's built-in test/assert APIs, jsdom and Python unittest | Rule tests, simulated browser journeys and backend tests | [JavaScript tests](../test), [backend tests](../test_backend) |
| Data maintenance | Python, pandas, feedparser and pyshp, with SQL scripts | Clean source records, parse feeds/shapefiles and maintain reference data | [Data requirements](../requirements-data.txt), [maintenance scripts](../data/scripts) |
| Configuration | Environment variables and python-dotenv | Read private runtime settings without exposing them in browser code | [Settings](../backend/config.py), [runtime requirements](../requirements.txt) |

The frontend runs directly in the browser: `index.html` loads `src/app.js`, and `quest/index.html` loads `quest/app.js`. Imported modules connect the screens to their rules, data and artwork. Node is the local preview/test tool here; Flask is the configured production API server. [DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md) traces the complete connections.

The adult journey stores its current answers in JavaScript memory. Quest additionally saves its own progress in localStorage. Neon, SQLite and browser storage have separate roles. Browser speech may use an online voice; localStorage does not make the entire app an offline application.

The earlier TensorFlow.js MobileNet export is retained only as failed diagnostic evidence after generated random-noise inputs passed its old rule. The current SigLIP 2 work uses fixed upstream weights, authored prompts/text vectors and rejection policies; it is not a fine-tuned household-photo model. Candidate v1 failed with one wrong accept and 27.027% coverage. Candidate v2 reached 43 accepted-correct results from 81 positives (53.086%) and rejected every tested true-OOD image, but the whole gate failed because six enabled classes had no accepted-correct example. These are local Node results for the pinned browser artifacts, not physical-tablet/browser performance evidence or a public accuracy claim. See [the validation report](APPLIANCE_MODEL_VALIDATION.md).

Render/Neon references above describe configuration and code integration. This document does not establish that these latest local changes have been deployed or that a live database connection has been checked today.

## Where the comments are

Comments are written directly inside the source: HTML uses `<!-- ... -->`, JavaScript uses `// ...` and `/* ... */`, CSS uses `/* ... */`, and Python uses `# ...`. Open the source links above to read them next to the code. The handover document is an additional explanation, not the location of the source comments.

Both HTML entry pages explain their metadata, stylesheet/script connections, accessible attributes, navigation, dynamic content containers and dialogs. Every authored JavaScript/MJS file in `src/`, `quest/`, `test/` and `test_helpers/` has source comments. Installed dependency code in `node_modules` is maintained by its authors; temporary local verification files are not part of the product source.

For review, choose a function and explain its input, checks, result and caller. The nearby comments help follow that path, while [HANDOVER_VERIFICATION.md](HANDOVER_VERIFICATION.md) records the evidence that commenting preserved executable behavior.
