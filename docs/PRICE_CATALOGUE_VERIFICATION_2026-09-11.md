# Favicon, price catalogue and usability verification

Reviewed locally on 11 September 2026. This report extends the [earlier usability review](USABILITY_REVIEW_2026-09-11.md); it is an expert walkthrough and automated verification, not a study with recruited parents or proof that every possible defect has been found.

## What changed

FixForward now has its own F favicon and page titles such as `Home | FixForward`, `Your appliance | FixForward`, `Find repair services | FixForward` and `Compare repair and replacement costs | FixForward`. Home and Start again restore the Home title.

The cost page includes a real, locally built SQLite catalogue containing **28 recorded AUD retail observations across all 19 supported appliance types**: 22 from The Good Guys and 6 from Harvey Norman. Every observation identifies the brand, model, type, price, retailer, source page, review date and limitations. A JB Hi-Fi candidate was excluded because its seller could not be verified. A verified direct retailer example replaced it.

This is an initial dated sample, not complete market coverage, a live feed or a historical price trend. All initial review dates are 11 September 2026. Some retrieved retailer pages were cached; the source notes retain those qualifications. Conflicting prices and expired offers found during research were excluded. The database can retain later observations, but the interface shows the latest recorded observation for each retailer/model pair.

The price database is separate from the application's PostgreSQL recall, repair and location data. Flask reads the price database without modifying it. A static preview uses an explicitly labelled saved copy. Showing prices does not prove Neon is connected.

## Problems found and fixed

| Issue or household-user difficulty | Change |
|---|---|
| Browser tab showed a generic icon. | Added the existing FixForward F mark as an SVG favicon to the application and error pages; added the Flask asset route. |
| Returning Home could leave the previous page title. | Landing rendering now sets the Home title directly; each journey screen has a relevant title. |
| A person without a replacement price reached a dead end. | Added recorded retail examples beneath the manual comparison, covering every supported appliance type. |
| Entering a model could imply an exact product was found. | Exact price matching requires the complete normalised brand and model. Partial models and different brands remain clearly labelled examples. |
| Another product of the same type might be mistaken for an equivalent replacement. | Cards distinguish same model, same brand/different model and same type. Wording asks users to compare size, capacity and features. |
| A price example could be mistaken for advice to replace. | Prices remain optional planning information; safety uncertainty stays visible and users explicitly choose a price to use. |
| Selecting a price could overwrite a repair quote or leave stale results. | Only the replacement field changes; the repair quote is preserved and the old comparison is invalidated. |
| A manual edit could still look retailer-sourced. | Editing the replacement amount removes the recorded-price annotation. Changing the appliance resets dependent catalogue selection. |
| Old or unavailable offers could look usable now. | Older-than-90-day and out-of-stock records are labelled and cannot be inserted using the price button. All other records still require checking current prices and stock. |
| Long source-review notes made the cards harder to scan. | Put detailed limitations in an expandable section; retain price, product, match level, source date and action on the card. |
| A failed price request could look like a working database. | The UI explicitly labels saved price records. Failed recall/location requests remain unavailable and never use the price database as a substitute. |
| Problem descriptions produced little useful follow-up. | Added fault-group-specific details to prepare for a repairer. This remains a summary, never a diagnosis or invented repair quote. |
| About the information still claimed model replacement prices were unavailable. | Updated the explanation and added all 28 retailer source records plus the three inspection-fee examples. |
| It was unclear where to put the database URL. | Prepared a private local `.env` with a blank `DATABASE_URL=` and updated the read-only diagnostic instructions. The URL belongs in server configuration, not a webpage field. |
| Deployment might omit a generated price database. | Render's build command regenerates the SQLite database and public JavaScript copy. The specific public SQLite artifact is allowed in Git; private environment and temporary files remain ignored. |
| Existing setup and Git handoff documents described an older candidate. | Updated README, cost design and branch-copy instructions; provided a clean import/GitHub handoff that preserves team history and remote-only files. |

The original uncertainty behaviour is retained: “Not sure” users can explore repair contacts, repair-versus-replacement costs and recycling. Serious warnings and possible recalls still take priority over ordinary cost planning. See the earlier report for the original 32 findings and fixes.

## Verification results

| Check | Result |
|---|---|
| `npm.cmd run check` | **123 tests passed, 0 failed**, including syntax checks. |
| JavaScript breakdown | 39 decision/validation tests, 9 public-data tests, 35 DOM journey tests, 8 price-catalogue tests and 32 interface contract checks. |
| Standard-library Python suites | **22 passed; 3 Flask integration tests skipped** because Flask/python-dotenv are missing. |
| Python compilation | Passed for backend, app, catalogue builder and backend tests. |
| Catalogue build and read-back | 28 rows, 19 categories; SQLite integrity and generated snapshot agreement verified. |
| Catalogue snapshot identity | `b9e9255efde38359fb1232e693a6edbfcce0360d589c047dc2ec52b3019f1b2f` |
| SVG asset | Local fixture server returned HTTP 200, `image/svg+xml`, valid SVG. HTML links and Flask allowlist inspected. |
| Real Chrome walkthrough | Passed the specific scenarios below. |
| Live PostgreSQL diagnostic | Exit 1: `SETUP NEEDED: Python dependencies are missing.` No live connection was attempted. |
| GitHub/deployment | No upload, commit, push, merge or deployment performed. This downloaded folder has no `.git`; repository URL and destination branch are still needed. |

Python command used:

```powershell
.\.venv\bin\python.exe -m unittest test_backend.test_transform test_backend.test_database_diagnostic test_backend.test_price_catalogue -v
```

The complete Flask suite is not claimed to pass. The local Python environment lacks Flask, python-dotenv and psycopg. A previous dependency-install attempt was not completed. The full Flask application and live Neon routes still need verification once dependencies and the private connection setting are available.

## Browser evidence

The isolated localhost fixture server used conspicuous synthetic recall/service labels. It was used to test navigation, never as evidence of a database connection or real recall coverage.

1. Opened Compare costs, selected Kettle / Philips / HD9395/90 and answered one question “Not sure”, the other two “No”. The result exposed repair, cost and recycling paths while retaining uncertainty advice.
2. Opened repair-versus-replacement planning. The Philips model was labelled “Same brand and model”; the Russell Hobbs kettle was labelled “Same appliance type”.
3. Entered a synthetic AUD 40 repair quote, explicitly selected the recorded AUD 59 Philips price and compared. The repair quote remained 40, replacement became 59, the source annotation remained visible and the difference was AUD 19.
4. Checked narrow layouts using requested viewport widths of 390 and 320. Browser zoom produced measured CSS widths of 433 and 355 respectively. Content widths stayed within the viewport; cards stacked in one column and the narrowest use-price buttons measured 45 CSS pixels high. These are desktop responsive checks, not physical-phone testing.
5. Inspected the final application on the user's actual `http://127.0.0.1:5500/index.html` static preview. Home loaded with its correct title. About the information showed 28 retail sources and correctly labelled recall, repair and location data unavailable/limited.
6. On that actual preview, chose “I’m not able to check this safely” and opened cost exploration. Two kettle cards, two price actions and collapsed price-detail sections rendered; the saved-catalogue notice and uncertainty warning remained visible. The cost page title was correct.

Temporary browser viewport overrides were reset. No personal location, user answers or database credentials were saved during these checks.

## Database and GitHub next steps

Open the private local `.env` in the project root. Put the read-only Neon/PostgreSQL URL immediately after `DATABASE_URL=`, save and restart Flask. Fresh clones should copy `.env.example` first. Use the [database connection guide](DATABASE_CONNECTION_CHECK.md) to install the missing dependencies, run the read-only diagnostic and test the actual Flask origin at port 5000. A static Live Server page on port 5500 cannot run the Flask API.

The public price database already exists at `data/catalogue/replacement-prices.sqlite` and needs no URL. Its [maintenance guide](PRICE_CATALOGUE.md) explains the schema, build and optional PostgreSQL migration. No hosted database was created or altered.

The changes are prepared locally. The exact GitHub repository URL and target branch are required to import and push them safely without replacing a teammate's work. See [GitHub update handoff](GITHUB_UPDATE.md).

Source evidence: [main observations](../data/catalogue/SOURCES.md), [additional observations](../data/catalogue/ADDITIONAL_SOURCES.md).
