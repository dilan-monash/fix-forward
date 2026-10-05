# I3 design review prototype

This folder packages the two screens requested for teammate review:

- the FixForward I3 entry page; and
- Sunny's Sorting Station / discovery activities.

Sunny's game JavaScript, question catalogue and browser-storage progress logic
remain unchanged. `design-system.css` is a reversible visual layer based on the
team-supplied FixForward Quest PDF. The existing Flask backend and Neon database
are not copied, changed or simulated by this static review package.

## Run locally

From the repository root:

```powershell
python -m http.server 5501 --directory prototypes/i3-design-review
```

Then open:

- `http://127.0.0.1:5501/`
- `http://127.0.0.1:5501/discover/`

If the system Python is missing dependencies, any Python installation that
provides the standard `http.server` module is sufficient. No `.env`, database
URL, account or API key is required for these two static review pages.

## Review boundary

Review the entry-page visual system and the Kids Sorting Station interaction.
Links to the broader 3D home, Kettle Lab and other I3 routes belong to the
separate Sunny prototype and are outside this two-screen package.

Progress is stored only in the reviewer's browser using the original prototype
storage keys. This branch is for review and is not a Main release.

## Third-party code

The local rendering modules include Three.js under its embedded MIT licence
headers. The remaining prototype code and images were supplied through the
team's published Sunny I3 prototype for this review task.
