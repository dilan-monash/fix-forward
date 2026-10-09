/**
 * Original procedural appliance models for the FixForward learning studio.
 * Every object is real geometry: no image is pretending to rotate in 3D.
 * Shapes are teaching illustrations, not manufacturer models or repair diagrams.
 */
import * as THREE from './vendor/three.module.js';

export const MODEL_PARTS = Object.freeze({
  kettle: ['body', 'lid', 'handle', 'heater', 'base'],
  fan: ['grille', 'blades', 'motor', 'base'],
  toaster: ['body', 'slots', 'lever', 'crumb-tray'],
  blender: ['jug', 'lid', 'blades', 'motor', 'base'],
  microwave: ['body', 'door', 'turntable', 'control'],
  vacuum: ['body', 'bin', 'filter', 'hose', 'nozzle'],
  hairdryer: ['body', 'motor', 'filter', 'handle', 'nozzle'],
  laptop: ['screen', 'keyboard', 'battery', 'body'],
});

// A restrained material palette makes these objects feel like a shared home.
const palette = { teal: 0x3a8f87, coral: 0xc97959, cream: 0xf1eadc, ink: 0x263b3c,
  gold: 0xd0a35b, steel: 0xb8c4c4, white: 0xf7f7ed, sage: 0x8aab96 };

/** Each mesh owns its material so highlighting one part never colours another. */
function material(colour, options = {}) {
  return new THREE.MeshStandardMaterial({ color: palette[colour] ?? colour,
    roughness: 0.34, metalness: 0.08, ...options });
}

/** Rounded extruded rectangles avoid sharp toy-block edges without asset downloads. */
export function roundedBox(width, height, depth, radius = 0.1) {
  const r = Math.min(radius, width / 3, height / 3, depth / 3);
  const x = -width / 2 + r, y = -height / 2 + r;
  const w = width - 2 * r, h = height - 2 * r;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * r,
    bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 6 });
  geometry.translate(0, 0, -depth / 2 + r);
  return geometry;
}

/** Add a mesh to its semantic part. Raycasting walks upward to this part group. */
function piece(parent, geometry, colour, position = [0, 0, 0], rotation = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(geometry, material(colour, options));
  mesh.position.set(...position); mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function box(parent, dimensions, colour, position, rotation, options) {
  return piece(parent, roundedBox(...dimensions), colour, position, rotation, options);
}

function cylinder(parent, top, bottom, height, colour, position, rotation, options) {
  return piece(parent, new THREE.CylinderGeometry(top, bottom, height, 40), colour, position, rotation, options);
}

function ring(parent, radius, tube, colour, position, rotation, options) {
  return piece(parent, new THREE.TorusGeometry(radius, tube, 8, 48), colour, position, rotation, options);
}

/** A tube following control points is used for handles, hoses and power leads. */
function tube(parent, points, width, colour) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return piece(parent, new THREE.TubeGeometry(curve, 32, width, 8, false), colour);
}

/** Semantic part IDs connect the visible mesh to the learning content and buttons. */
function part(root, id, explode = [0, 0, 0]) {
  const group = new THREE.Group(); group.name = id;
  group.userData = { partId: id, applianceId: root.userData.applianceId,
    rest: new THREE.Vector3(), exploded: new THREE.Vector3(...explode) };
  root.userData.parts.set(id, group); root.add(group); return group;
}

/** A metal water chamber, open-ended handle and separate heating plate form the kettle. */
function kettle(root) {
  const body = part(root, 'body', [0, 0.15, 0]);
  const profile = [[0, .2], [.52, .2], [.68, .38], [.7, .7], [.64, 1.22], [.44, 1.64], [.36, 1.68]];
  piece(body, new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 64), 'teal', undefined, undefined,
    { roughness: .24, metalness: .2 });
  cylinder(body, .37, .37, .05, 'steel', [0, 1.68, 0], undefined, { metalness: .75 });
  // The spout is a visible part of the chamber rather than a separate learning target.
  // An open tapered tube and recessed inner mouth read as a hollow pouring spout from every angle.
  const spoutAngle = .75;
  piece(body, new THREE.CylinderGeometry(.15, .23, .72, 40, 1, true), 'teal', [-.65, 1.27, 0], [0, 0, spoutAngle],
    { side: THREE.DoubleSide, roughness: .24, metalness: .2 });
  const spoutDirection = new THREE.Vector3(-Math.sin(spoutAngle), Math.cos(spoutAngle), 0);
  const mouthPosition = new THREE.Vector3(-.65, 1.27, 0).addScaledVector(spoutDirection, .36);
  const rim = ring(body, .15, .014, 'steel', mouthPosition.toArray(), undefined, { metalness: .8, roughness: .2 });
  rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spoutDirection);
  const innerMouth = piece(body, new THREE.CircleGeometry(.137, 40), 'ink', mouthPosition.clone().addScaledVector(spoutDirection, -.065).toArray());
  innerMouth.quaternion.copy(rim.quaternion);
  // A narrow water window with physical tick marks adds familiar product detail without tiny text.
  box(body, [.14, .67, .035], 'steel', [.46, .93, .46], [0, .78, 0]);
  box(body, [.09, .59, .043], 0x294d52, [.464, .93, .464], [0, .78, 0], { roughness: .13 });
  for (let i = 0; i < 5; i++) box(body, [.055, .012, .047], 'white', [.472, .72 + i * .105, .472], [0, .78, 0]);
  const lid = part(root, 'lid', [0, .72, 0]);
  cylinder(lid, .37, .43, .12, 'steel', [0, 1.71, 0], undefined, { metalness: .7 });
  const lidDome = piece(lid, new THREE.SphereGeometry(.36, 40, 20), 'teal', [0, 1.77, 0], undefined, { metalness: .2, roughness: .24 });
  lidDome.scale.y = .21;
  cylinder(lid, .1, .13, .13, 'ink', [0, 1.83, 0]);
  const handle = part(root, 'handle', [.65, .2, 0]);
  tube(handle, [[.47, 1.5, 0], [.94, 1.58, 0], [1.09, 1.25, 0], [1.05, .73, 0], [.59, .53, 0]], .09, 'ink');
  const heater = part(root, 'heater', [0, -.4, 0]);
  cylinder(heater, .54, .54, .09, 'steel', [0, .21, 0], undefined, { metalness: .85 });
  ring(heater, .34, .035, 'gold', [0, .26, 0], [Math.PI / 2, 0, 0]);
  const base = part(root, 'base', [0, -.8, 0]);
  cylinder(base, .58, .65, .15, 'ink', [0, .085, 0]);
  box(base, [.15, .045, .1], 'gold', [.5, .18, .24]);
  cylinder(base, .024, .024, .018, 0x8bdfda, [.35, .12, .5], [Math.PI / 2, 0, 0],
    { emissive: 0x3a9594, emissiveIntensity: .3 });
  tube(base, [[0, .07, -.56], [.2, .06, -.79], [.65, .06, -.82]], .025, 'ink');
}

/** The fan has a proper wire cage, separate motor and broad curved-looking blades. */
function fan(root) {
  const base = part(root, 'base', [0, -.35, 0]);
  cylinder(base, .62, .68, .12, 'cream', [0, .08, 0]);
  cylinder(base, .1, .13, 1.03, 'steel', [0, .64, 0], undefined, { metalness: .75 });
  const motor = part(root, 'motor', [0, 0, -.55]);
  cylinder(motor, .27, .25, .46, 'sage', [0, 1.55, -.16], [Math.PI / 2, 0, 0]);
  const blades = part(root, 'blades', [0, 0, .6]);
  const rotor = new THREE.Group(); rotor.position.set(0, 1.55, .13); blades.add(rotor);
  rotor.userData.rotor = true;
  for (let i = 0; i < 3; i++) {
    const blade = piece(rotor, new THREE.SphereGeometry(1, 20, 12), 'teal');
    const angle = i * Math.PI * 2 / 3; blade.position.set(Math.sin(angle) * .35, Math.cos(angle) * .35, 0);
    blade.scale.set(.22, .43, .038); blade.rotation.z = -angle + .25;
  }
  cylinder(rotor, .16, .16, .12, 'gold', [0, 0, .06], [Math.PI / 2, 0, 0]);
  const grille = part(root, 'grille', [0, 0, 1.0]);
  for (const r of [.3, .46, .61, .75]) ring(grille, r, .012, 'steel', [0, 1.55, .24]);
  ring(grille, .76, .04, 'cream', [0, 1.55, .15]);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    tube(grille, [[Math.sin(angle) * .16, 1.55 + Math.cos(angle) * .16, .28],
      [Math.sin(angle) * .72, 1.55 + Math.cos(angle) * .72, .21]], .013, 'steel');
  }
}

/** Toast slots are dark recessed volumes. The crumb tray is visible in exploded view. */
function toaster(root) {
  const body = part(root, 'body', [0, .15, 0]);
  box(body, [1.6, 1.1, 1.03], 'coral', [0, .66, 0]);
  for (const x of [-.57, .57]) for (const z of [-.35, .35]) cylinder(body, .07, .07, .1, 'ink', [x, .07, z]);
  const slots = part(root, 'slots', [0, .72, 0]);
  box(slots, [1.44, .06, .91], 'steel', [0, 1.18, 0], undefined, { metalness: .85 });
  for (const z of [-.23, .23]) {
    box(slots, [1.13, .035, .21], 'ink', [0, 1.22, z]);
    for (let i = 0; i < 5; i++) box(slots, [.028, .01, .17], 'gold', [-.42 + i * .21, 1.241, z]);
  }
  const lever = part(root, 'lever', [.5, 0, 0]);
  box(lever, [.06, .5, .08], 'ink', [.8, .65, 0]);
  box(lever, [.24, .095, .22], 'cream', [.88, .88, 0]);
  cylinder(lever, .13, .13, .06, 'gold', [.82, .38, .22], [0, 0, Math.PI / 2]);
  const tray = part(root, 'crumb-tray', [0, -.4, .7]);
  box(tray, [1.32, .055, .78], 'steel', [0, .16, 0], undefined, { metalness: .7 });
  box(tray, [.57, .09, .055], 'ink', [0, .18, .48]);
}

/** Transparency reveals the blending blades without making the entire body disappear. */
function blender(root) {
  const base = part(root, 'base', [0, -.25, 0]);
  cylinder(base, .37, .58, .65, 'cream', [0, .34, 0]);
  cylinder(base, .1, .1, .05, 'gold', [0, .32, .47], [Math.PI / 2, 0, 0]);
  const motor = part(root, 'motor', [.6, .05, 0]);
  cylinder(motor, .22, .22, .34, 'steel', [0, .52, 0], undefined, { metalness: .7 });
  const jug = part(root, 'jug', [0, .48, 0]);
  cylinder(jug, .48, .31, 1.05, 'white', [0, 1.17, 0], undefined, { transparent: true, opacity: .43, roughness: .12, depthWrite: false, side: THREE.DoubleSide });
  ring(jug, .47, .022, 'steel', [0, 1.7, 0], [Math.PI / 2, 0, 0]);
  tube(jug, [[.41, 1.5, 0], [.72, 1.5, 0], [.79, 1.21, 0], [.64, .99, 0], [.38, 1.0, 0]], .05, 'cream');
  for (let i = 0; i < 4; i++) box(jug, [.1, .013, .016], 'ink', [.13, 1 + i * .13, .36 + i * .025]);
  const blades = part(root, 'blades', [0, .25, .65]);
  cylinder(blades, .06, .09, .15, 'steel', [0, .79, 0]);
  for (const angle of [0, Math.PI / 2]) box(blades, [.5, .035, .1], 'steel', [0, .78, 0], [0, angle, .2], { metalness: .9 });
  const lid = part(root, 'lid', [0, 1.0, 0]);
  cylinder(lid, .46, .51, .12, 'teal', [0, 1.76, 0]);
  cylinder(lid, .14, .14, .13, 'cream', [0, 1.86, 0]);
}

/** A microwave's door, chamber and controls are external learning targets only. */
function microwave(root) {
  const body = part(root, 'body', [0, 0, -.3]);
  box(body, [2.08, 1.22, 1.22], 'cream', [0, .68, 0]);
  box(body, [1.53, .92, .06], 'ink', [-.2, .68, .64]);
  for (let i = 0; i < 7; i++) box(body, [.015, .22, .025], 'ink', [-.72 + i * .1, 1.306, .23], [Math.PI / 2, 0, 0]);
  const turntable = part(root, 'turntable', [0, -.45, .3]);
  cylinder(turntable, .5, .5, .025, 'steel', [-.2, .25, .03], undefined, { metalness: .55 });
  const door = part(root, 'door', [-.75, 0, 1.0]);
  box(door, [1.51, 1.0, .09], 'ink', [-.23, .7, .7]);
  box(door, [1.12, .69, .022], 0x536e6d, [-.32, .7, .76], undefined, { roughness: .12, metalness: .6 });
  box(door, [.06, .59, .11], 'steel', [.36, .7, .79]);
  const control = part(root, 'control', [.68, 0, .5]);
  box(control, [.37, .98, .06], 'cream', [.79, .71, .66]);
  box(control, [.28, .18, .025], 'ink', [.79, 1.02, .706]);
  for (let i = 0; i < 3; i++) box(control, [.03, .07, .01], 0xa5dace, [.72 + i * .07, 1.02, .73]);
  cylinder(control, .105, .105, .065, 'gold', [.79, .53, .73], [Math.PI / 2, 0, 0]);
}

/** The vacuum uses a curved real hose and wheels rather than a flat silhouette. */
function vacuum(root) {
  const body = part(root, 'body', [0, .1, 0]);
  const shell = piece(body, new THREE.SphereGeometry(1, 28, 20), 'teal', [0, .6, 0]); shell.scale.set(.68, .56, .84);
  for (const x of [-.62, .62]) cylinder(body, .3, .3, .12, 'ink', [x, .34, .2], [0, 0, Math.PI / 2]);
  const bin = part(root, 'bin', [0, .6, 0]);
  cylinder(bin, .37, .37, .51, 'white', [0, .86, -.05], undefined, { transparent: true, opacity: .56, roughness: .2 });
  cylinder(bin, .38, .38, .07, 'gold', [0, 1.14, -.05]);
  const filter = part(root, 'filter', [0, 1.08, 0]);
  cylinder(filter, .22, .22, .36, 'cream', [0, .84, -.05]);
  for (let i = 0; i < 8; i++) ring(filter, .22, .009, 'gold', [0, .68 + i * .043, -.05], [Math.PI / 2, 0, 0]);
  const hose = part(root, 'hose', [.7, .2, 0]);
  tube(hose, [[.3, .72, .48], [.72, 1.3, .5], [1.0, 1.5, .28], [1.1, .97, .14], [.92, .31, .68]], .072, 'ink');
  const nozzle = part(root, 'nozzle', [.4, -.12, .6]);
  box(nozzle, [.62, .15, .4], 'coral', [.9, .11, .8]);
  cylinder(nozzle, .045, .045, .54, 'steel', [.94, .4, .61], [.5, 0, 0]);
}

/** A hairdryer remains a familiar external shape; the motor is a diagrammatic insert. */
function hairdryer(root) {
  const body = part(root, 'body', [0, .2, 0]);
  cylinder(body, .37, .31, 1.03, 'coral', [0, 1.24, 0], [0, 0, Math.PI / 2]);
  const handle = part(root, 'handle', [0, -.5, 0]);
  box(handle, [.29, .86, .3], 'ink', [.13, .64, 0], [0, 0, -.22]);
  box(handle, [.025, .18, .15], 'gold', [-.03, .75, 0]);
  tube(handle, [[.22, .18, 0], [.3, .09, .1], [.56, .06, .25], [.63, .06, .48]], .024, 'ink');
  const motor = part(root, 'motor', [0, .65, 0]);
  cylinder(motor, .21, .21, .28, 'steel', [0, 1.24, 0], [0, 0, Math.PI / 2], { metalness: .75 });
  const filter = part(root, 'filter', [.7, 0, 0]);
  cylinder(filter, .29, .29, .07, 'ink', [.55, 1.24, 0], [0, 0, Math.PI / 2]);
  for (const radius of [.09, .17, .25]) ring(filter, radius, .012, 'steel', [.6, 1.24, 0], [0, Math.PI / 2, 0]);
  const nozzle = part(root, 'nozzle', [-.7, 0, 0]);
  cylinder(nozzle, .23, .32, .36, 'ink', [-.65, 1.24, 0], [0, 0, Math.PI / 2]);
}

/** The laptop opens at a fixed readable angle with individual keys and a battery layer. */
function laptop(root) {
  const body = part(root, 'body', [0, -.2, 0]);
  box(body, [1.9, .09, 1.25], 'steel', [0, .11, 0], undefined, { metalness: .7 });
  const keyboard = part(root, 'keyboard', [0, .35, .28]);
  box(keyboard, [1.75, .03, .96], 'cream', [0, .17, -.08]);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 10; col++)
    box(keyboard, [.115, .022, .09], 'ink', [-.67 + col * .149, .2, -.42 + row * .135]);
  box(keyboard, [.48, .012, .27], 'steel', [0, .195, .26]);
  const screen = part(root, 'screen', [0, .6, -.25]);
  const display = new THREE.Group(); display.position.set(0, .18, -.59); display.rotation.x = -.2; screen.add(display);
  box(display, [1.91, 1.24, .075], 'ink', [0, .62, 0]);
  box(display, [1.73, 1.03, .014], 0xaccfc2, [0, .66, .045], undefined, { roughness: .2, emissive: 0x22453a, emissiveIntensity: .1 });
  // Abstract landscape on the screen conveys a display without browser text textures.
  const sun = piece(display, new THREE.CircleGeometry(.13, 32), 'cream', [.45, .88, .057]);
  box(display, [1.68, .18, .009], 'teal', [0, .26, .06]);
  const battery = part(root, 'battery', [0, -.6, 0]);
  box(battery, [1.29, .045, .54], 'ink', [0, .07, .2]);
  for (let i = 0; i < 3; i++) box(battery, [.35, .012, .43], 'sage', [-.42 + i * .42, .098, .2]);
}

const builders = { kettle, fan, toaster, blender, microwave, vacuum, hairdryer, laptop };

/** Public factory returns a model with stable semantic groups and no network calls. */
export function createAppliance(id) {
  if (!Object.hasOwn(builders, id)) throw new Error(`Unknown appliance model: ${id}`);
  const root = new THREE.Group(); root.name = id;
  root.userData = { applianceId: id, parts: new Map(), model: true };
  builders[id](root);
  return root;
}
