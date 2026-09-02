# FixForward — Iteration 1

An anonymous, mobile-first e-waste decision aid for Victorian households. The V2.2 journey follows the approved order: manual family/category identification → recall status → safety warning check → repair/disposal pathway → repair-versus-replacement cost comparison when the user has a quote.

## Frontend-only status

This iteration currently contains only the frontend UI and browser-side decision rules. There is no backend, database, deployment configuration or account system. `src/data.js` contains clearly marked UI fixtures so every conditional screen can be reviewed before real data is connected. A disabled API adapter is included for later backend connection; while disabled it makes zero network requests.

## Preview locally

Use VS Code Live Server, or run any static file server from this directory. For example:

```sh
python -m http.server 4173
```

Open `http://127.0.0.1:4173`. This command only serves static frontend files for local preview; it is not the FixForward backend.

## Test

```sh
npm test
npm run check
```

The automated suite covers appliance validation, the recall UI fixture, no-match and unavailable-data fallbacks, all safety decision branches, invalid/missing/equal cost cases, no-location fallbacks, privacy controls, accessibility markup and responsive rules.

To exercise the frontend data-error state, open `http://127.0.0.1:4173/?mock-data-error=1`. To exercise the category-level recall screen, select **Heating and simple cooking → Kettle**. Iteration 1 does not collect brand or model.

## Privacy and scope

- Journey answers, appliance details, costs and area selection live only in JavaScript memory and clear on refresh or Restart.
- No login is required, and no user profile is created or stored.
- The frontend makes no network request for journey data. There are no cookies, analytics, localStorage records, user tables or accounts.
- There is no image upload, image recognition, barcode scanning, automatic diagnosis, DIY repair guidance, climate comparison, login or geolocation.
- Recall results are screening results. Users must verify identifying details on the official ACCC notice.

## Code map

- `index.html` — application shell, progress and privacy/source dialog
- `styles.css` — responsive design system and accessibility states
- `src/app.js` — UI state machine and screen transitions
- `src/logic.js` — pure validation, recall, safety, cost and location rules
- `src/data.js` — temporary frontend-only fixture data and six-family mapping
- `src/config.js` — one-switch backend connection configuration (disabled by default)
- `src/data-service.js` — public-data API adapter with automatic static fallback
- `API_CONTRACT.md` — response shapes required from the future backend
- `test/` — acceptance-oriented frontend logic and static UI tests

## Data limitations

The included recall fixture mirrors the official ACCC KitchenAid 1.7 L kettle notice published 21 February 2018 solely to exercise the Recall UI. The location fixtures route users to search directories instead of claiming a provider is open or accepts a product. These fixtures must be replaced by the future backend data adapter before production use.

## Connect the future backend

1. Implement the four read-only endpoints in `API_CONTRACT.md`.
2. Set `baseUrl` in `src/config.js` if the API is not same-origin.
3. Change `enabled` from `false` to `true`.

If the backend is unavailable or returns an invalid response, the UI automatically continues with static fixtures. The adapter never sends appliance details, safety answers, costs, area selections or profile information.
