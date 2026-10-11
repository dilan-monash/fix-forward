/** Original procedural 3D models of everyday things for Fix-it Station's Bin day:
 * a banana peel, a drink can, a broken mug, a battery, a cardboard box, a teddy,
 * a foam cup and an apple core. Like models.js, every shape is real geometry with
 * no downloads, and each model names the parts a story clue can make glow. */
import * as THREE from './vendor/three.module.js';

export const WASTE_PARTS = Object.freeze({
  banana: ['peel', 'stem'],
  can: ['body', 'tab'],
  mug: ['body', 'handle', 'crack'],
  battery: ['body', 'terminal'],
  box: ['body', 'flaps'],
  teddy: ['body', 'head', 'seam'],
  cup: ['cup'],
  apple: ['core', 'stem'],
});

/** Each mesh owns its material so a glowing part never colours another. */
const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .05, ...options });
function add(parent, geometry, color, position = [0, 0, 0], rotation, options) {
  const mesh = new THREE.Mesh(geometry, material(color, options)); mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function part(root, id) {
  const group = new THREE.Group(); group.name = id; group.userData = { partId: id };
  root.userData.parts.set(id, group); root.add(group); return group;
}
const lathe = (points, segments = 48) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
const tube = (points, radius, segments = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 8, false);

/** Four peel strips droop from the stem like an opened banana. */
function banana(root) {
  const peel = part(root, 'peel'), stem = part(root, 'stem');
  for (let k = 0; k < 4; k++) {
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 20), pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = pos.getY(i) + .5, angle = s * 2.25, width = .4 * (1 - .62 * s) + .02;
      pos.setXYZ(i, pos.getX(i) * width, .98 - .56 * (1 - Math.cos(angle)), .07 + .56 * Math.sin(angle));
    }
    geometry.computeVertexNormals();
    const strip = new THREE.Mesh(geometry, material(0xf3cf3c, { side: THREE.DoubleSide, roughness: .6 }));
    strip.rotation.y = k * Math.PI / 2 + .3; strip.castShadow = true; peel.add(strip);
    // Brown ripe tips.
    const tip = add(peel, new THREE.SphereGeometry(.035, 10, 8), 0x5a3d1e, [0, 0, 0]);
    const s = 1, angle = s * 2.25; tip.position.set(Math.sin(strip.rotation.y) * (.07 + .56 * Math.sin(angle)), .98 - .56 * (1 - Math.cos(angle)), Math.cos(strip.rotation.y) * (.07 + .56 * Math.sin(angle)));
  }
  add(peel, new THREE.CylinderGeometry(.13, .11, .2, 20), 0xf0dc8a, [0, .95, 0]);
  add(stem, new THREE.CylinderGeometry(.06, .08, .32, 12), 0x7b8a2e, [0, 1.2, 0], [0, 0, .18]);
  add(stem, new THREE.CylinderGeometry(.075, .075, .05, 12), 0x4a3a1d, [-.03, 1.36, 0]);
}

/** An aluminium drink can with a ring-pull tab. */
function can(root) {
  const body = part(root, 'body'), tab = part(root, 'tab');
  add(body, new THREE.CylinderGeometry(.42, .42, 1.1, 48), 0xe0463a, [0, .66, 0], undefined, { roughness: .32, metalness: .35 });
  add(body, new THREE.CylinderGeometry(.425, .425, .2, 48), 0xffffff, [0, .74, 0], undefined, { roughness: .3, metalness: .2 });
  add(body, new THREE.CylinderGeometry(.36, .42, .1, 48), 0xc9d1d6, [0, .06, 0], undefined, { roughness: .2, metalness: .85 });
  add(body, new THREE.CylinderGeometry(.34, .42, .12, 48), 0xc9d1d6, [0, 1.27, 0], undefined, { roughness: .2, metalness: .85 });
  add(body, new THREE.TorusGeometry(.34, .025, 8, 48), 0xb4bcc2, [0, 1.33, 0], [Math.PI / 2, 0, 0], { metalness: .9, roughness: .2 });
  add(tab, new THREE.BoxGeometry(.2, .025, .1), 0xaab3b9, [.06, 1.35, 0], undefined, { metalness: .9, roughness: .25 });
  add(tab, new THREE.TorusGeometry(.055, .018, 8, 20), 0xaab3b9, [.16, 1.35, 0], [Math.PI / 2, 0, 0], { metalness: .9, roughness: .25 });
}

/** A mug with a jagged crack and a chip lying beside it. */
function mug(root) {
  const body = part(root, 'body'), handle = part(root, 'handle'), crack = part(root, 'crack');
  add(body, lathe([[0, 0], [.46, 0], [.5, .06], [.52, 1.0], [.46, 1.0], [.44, .1], [0, .1]]), 0xf2f0ea, [0, 0, 0], undefined, { side: THREE.DoubleSide, roughness: .25 });
  add(body, new THREE.CylinderGeometry(.525, .525, .16, 48, 1, true), 0x3f8fd8, [0, .72, 0], undefined, { side: THREE.DoubleSide, roughness: .3 });
  add(handle, new THREE.TorusGeometry(.24, .065, 12, 24, Math.PI * 1.1), 0xf2f0ea, [.52, .52, 0], [0, 0, -Math.PI * .55], { roughness: .25 });
  // The crack zig-zags down the front, slightly outside the surface so it reads clearly.
  const zig = [[.08, 1.0], [-.04, .82], [.1, .66], [-.06, .48], [.08, .3], [-.02, .1]].map(([a, y]) => [Math.sin(a - .4) * .535, y, Math.cos(a - .4) * .535]);
  add(crack, tube(zig, .028), 0x7a2a1d, [0, 0, 0], undefined, { roughness: .8 });
  const chip = add(crack, new THREE.TetrahedronGeometry(.16), 0xf2f0ea, [-.45, .08, .6], [.4, .8, .2], { roughness: .25 });
  chip.scale.set(1, .5, 1);
}

/** An AA battery: black body, copper top and a positive terminal. */
function battery(root) {
  const body = part(root, 'body'), terminal = part(root, 'terminal');
  add(body, new THREE.CylinderGeometry(.3, .3, .95, 40), 0x23292e, [0, .5, 0], undefined, { roughness: .35, metalness: .3 });
  add(body, new THREE.CylinderGeometry(.302, .302, .42, 40), 0xd88a2c, [0, 1.16, 0], undefined, { roughness: .3, metalness: .55 });
  add(body, new THREE.CylinderGeometry(.302, .302, .05, 40), 0xf4f1e8, [0, .96, 0], undefined, { roughness: .4 });
  add(body, new THREE.CylinderGeometry(.27, .3, .04, 40), 0xb8c0c4, [0, .01, 0], undefined, { metalness: .85, roughness: .2 });
  add(terminal, new THREE.CylinderGeometry(.1, .12, .1, 24), 0xc6cdd1, [0, 1.42, 0], undefined, { metalness: .9, roughness: .2 });
}

/** A cardboard box with its top flaps open and a strip of tape. */
function box(root) {
  const body = part(root, 'body'), flaps = part(root, 'flaps');
  const brown = 0xc49a6c, w = 1.3, h = .9, d = 1.0;
  add(body, new THREE.BoxGeometry(w, h, d), brown, [0, h / 2, 0], undefined, { roughness: .85 });
  add(body, new THREE.BoxGeometry(w * .94, .02, d * .94), 0x8a6640, [0, h - .005, 0], undefined, { roughness: .9 });
  add(body, new THREE.BoxGeometry(.18, h * .7, .01), 0xe9d9b6, [0, h * .5, d / 2 + .006], undefined, { roughness: .5 });
  // Flaps hinge on the top edges and fold outwards.
  for (const [axis, sign, length, span] of [['x', 1, d / 2, w], ['x', -1, d / 2, w], ['z', 1, w / 2, d], ['z', -1, w / 2, d]]) {
    const hinge = new THREE.Group(); flaps.add(hinge);
    if (axis === 'x') { hinge.position.set(0, h, sign * d / 2); hinge.rotation.x = sign * 1.95; }
    else { hinge.position.set(sign * w / 2, h, 0); hinge.rotation.z = -sign * 1.95; }
    const flap = add(hinge, axis === 'x' ? new THREE.BoxGeometry(span, .02, length) : new THREE.BoxGeometry(length, .02, span), brown, [0, 0, 0], undefined, { roughness: .85 });
    if (axis === 'x') flap.position.z = sign * length / 2; else flap.position.x = sign * length / 2;
  }
}

/** A teddy bear with a torn tummy seam and stuffing poking out. */
function teddy(root) {
  const body = part(root, 'body'), head = part(root, 'head'), seam = part(root, 'seam');
  const fur = 0xb07a4a, light = 0xe7c79b;
  const torso = add(body, new THREE.SphereGeometry(.5, 32, 24), fur, [0, .62, 0], undefined, { roughness: .95 }); torso.scale.set(1, 1.12, .9);
  add(body, new THREE.SphereGeometry(.3, 24, 16), light, [0, .6, .3], undefined, { roughness: .95 }).scale.set(1, 1.2, .5);
  for (const x of [-1, 1]) {
    add(body, new THREE.CapsuleGeometry(.14, .38, 8, 16), fur, [x * .52, .78, .05], [0, 0, x * .9], { roughness: .95 });
    add(body, new THREE.CapsuleGeometry(.17, .22, 8, 16), fur, [x * .26, .14, .22], [Math.PI / 2.3, 0, 0], { roughness: .95 });
    add(body, new THREE.SphereGeometry(.12, 16, 12), light, [x * .26, .1, .43], undefined, { roughness: .95 }).scale.set(1, 1, .4);
  }
  add(head, new THREE.SphereGeometry(.38, 32, 24), fur, [0, 1.42, 0], undefined, { roughness: .95 });
  for (const x of [-1, 1]) {
    add(head, new THREE.SphereGeometry(.13, 16, 12), fur, [x * .28, 1.72, -.02], undefined, { roughness: .95 });
    add(head, new THREE.SphereGeometry(.07, 12, 10), light, [x * .28, 1.72, .07], undefined, { roughness: .95 });
    add(head, new THREE.SphereGeometry(.045, 12, 10), 0x16201f, [x * .13, 1.5, .33], undefined, { roughness: .2 });
  }
  add(head, new THREE.SphereGeometry(.16, 20, 14), light, [0, 1.33, .3], undefined, { roughness: .95 }).scale.set(1, .8, .7);
  add(head, new THREE.SphereGeometry(.055, 12, 10), 0x2a1a12, [0, 1.38, .41], undefined, { roughness: .3 });
  // The torn seam: a dark stitch line with fluffy stuffing spilling from it.
  add(seam, tube([[-.18, .78, .44], [-.08, .7, .47], [.04, .76, .47], [.16, .68, .44]], .02), 0x4a2c1a, [0, 0, 0]);
  for (const [x, y, z, r] of [[-.04, .72, .5, .085], [.06, .7, .5, .07], [.0, .64, .5, .065], [.1, .76, .48, .06]]) add(seam, new THREE.IcosahedronGeometry(r, 1), 0xfbfaf6, [x, y, z], undefined, { roughness: 1 });
}

/** A ridged foam cup with a little dent. */
function cup(root) {
  const shell = part(root, 'cup');
  add(shell, lathe([[0, 0], [.32, 0], [.34, .04], [.5, 1.1], [.54, 1.14], [.5, 1.16], [.47, 1.12], [.31, .08], [0, .08]]), 0xf6f3ea, [0, 0, 0], undefined, { side: THREE.DoubleSide, roughness: .95 });
  for (let i = 1; i < 6; i++) { const y = i * .18, r = .34 + (y / 1.1) * .16 + .006; add(shell, new THREE.TorusGeometry(r, .008, 6, 48), 0xe2dccd, [0, y, 0], [Math.PI / 2, 0, 0], { roughness: 1 }); }
  add(shell, new THREE.CylinderGeometry(.44, .44, .01, 40), 0x8a5a3a, [0, .9, 0], undefined, { roughness: .4 });
}

/** An apple core: red skin at both ends, pale fruit and seeds in the middle. */
function apple(root) {
  const core = part(root, 'core'), stem = part(root, 'stem');
  add(core, lathe([[0, 0], [.34, .02], [.44, .12], [.4, .24], [.24, .4], [.19, .6], [.21, .8], [.34, .95], [.44, 1.06], [.4, 1.16], [.22, 1.22], [0, 1.2]]), 0xf3e7c4, [0, 0, 0], undefined, { roughness: .7 });
  add(core, lathe([[0, -.005], [.345, .015], [.445, .12], [.41, .22], [.37, .25]]), 0xc8302c, [0, 0, 0], undefined, { side: THREE.DoubleSide, roughness: .35 });
  add(core, lathe([[.36, .96], [.445, 1.06], [.405, 1.16], [.225, 1.225], [0, 1.205]]), 0xc8302c, [0, 0, 0], undefined, { side: THREE.DoubleSide, roughness: .35 });
  for (const [x, z, ry] of [[.17, .06, .3], [-.15, .1, -.4], [.02, -.18, 1.2]]) add(core, new THREE.SphereGeometry(.05, 12, 8), 0x3b2412, [x, .62, z], [0, ry, 0], { roughness: .3 }).scale.set(.7, 1.3, .5);
  add(stem, new THREE.CylinderGeometry(.025, .035, .26, 8), 0x5a3a1e, [.03, 1.33, 0], [0, 0, -.25]);
  const leaf = add(stem, new THREE.SphereGeometry(.12, 16, 8), 0x4c9a3a, [.15, 1.4, 0], [0, 0, -.8], { roughness: .6 }); leaf.scale.set(1, .35, .55);
}

const builders = { banana, can, mug, battery, box, teddy, cup, apple };
export const isWasteItem = id => Object.hasOwn(builders, id);

/** Public factory: a model with named parts, matching createAppliance in models.js. */
export function createWasteItem(id) {
  if (!isWasteItem(id)) throw new Error(`Unknown waste model: ${id}`);
  const root = new THREE.Group(); root.name = id;
  root.userData = { applianceId: id, parts: new Map(), model: true };
  builders[id](root);
  root.updateMatrixWorld(true);
  return root;
}
