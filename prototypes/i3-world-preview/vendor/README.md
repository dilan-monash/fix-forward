# Locally hosted rendering dependency

Three.js **0.180.0**, MIT licence, is pinned rather than fetched at runtime. `LICENSE-three.txt` retains the upstream licence. Source: https://www.npmjs.com/package/three/v/0.180.0 and the matching jsDelivr package files.

- `three.module.js` is upstream `build/three.module.min.js`; its core import filename was changed to `./three.core.js`.
- `three.core.js` is upstream `build/three.core.min.js`.
- `OrbitControls.js` is upstream `examples/jsm/controls/OrbitControls.js`; its bare `three` import was changed to `./three.module.js`.

These are third-party generated library files. The authored, commented integration is in `../world-engine.js` and the original geometry is in `../models.js`. Do not add app logic to vendor files. `../serve.mjs` gzips and caches the library while leaving authored preview code uncached.
