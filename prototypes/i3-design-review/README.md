# I3 design implementation prototype

This local package implements the 30 screen states supplied in
`FixForward I3 Prototype.zip`. It is an interactive review build rather than a
production release.

The root single-page application covers:

- Home and Quick Tour;
- Quest Hub, Fix-it Station, Circular Choices and Circular City;
- Lens scan, confirmation, impact, facts and care states;
- Pathway identification, recall, safety and option states;
- Finder location, results and place states; and
- About, privacy and source explanations.

Sunny's original extended Sorting Station remains available under `discover/`.
Its catalogue, game logic and browser-storage progress code were not replaced.

## Run locally

From this folder:

```powershell
python -m http.server 5503
```

Then open:

- `http://127.0.0.1:5503/`
- `http://127.0.0.1:5503/discover/`

No `.env`, Neon URL, user account or API key is needed. All new progress and
form values stay in browser `localStorage`.

## Design route map

| Supplied design | Local route |
| --- | --- |
| 01 Home | `#/home` |
| 01A Home - Quick Tour | `#/tour` |
| 02 Quest Hub | `#/quest` |
| 03 / 03A / 03B Fix-it | `#/fixit`, `#/fixit/right`, `#/fixit/retry` |
| 04 / 04A / 04B Loop Challenge | `#/loop`, `#/loop/right`, `#/loop/retry` |
| 05 / 05A / 05B / 05C Circular City | `#/city`, `#/city/play`, `#/city/upgrade`, `#/city/win` |
| 06 / 06A-06E Lens | `#/lens`, `#/lens/scan`, `#/lens/confirm`, `#/lens/impact`, `#/lens/facts`, `#/lens/care` |
| 07 / 07A / 07B Pathway | `#/pathway`, `#/pathway/not-found`, `#/pathway/safety`, `#/pathway/options`, `#/pathway/recall` |
| 08 / 08A-08C Finder | `#/finder`, `#/finder/location`, `#/finder/results`, `#/finder/place` |
| 09 About | `#/about` |
| 10 Privacy & Sources | `#/privacy` |

## Review boundary

This build uses fictional game scenarios, environmental figures, service
locations and recall examples. Camera, geolocation, external provider links,
the I2 cost-comparison API, Flask and Neon are deliberately not connected in
this static design review. Those integrations require separate implementation
and validation before release.

The implementation is local only. It has not been committed, pushed, merged
into `main` or deployed.

## Third-party code

The preserved immersive modules include Three.js under embedded MIT licence
headers. The existing Sunny prototype assets and logic remain in their original
subdirectories.
