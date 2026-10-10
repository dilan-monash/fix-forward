/**
 * Lightweight 3D teaching models for everyday electronic devices.
 * These are representative shapes, not manufacturer drawings or opening guides.
 * Each named group becomes one selectable lesson and one moving exploded part.
 * The phone, headphones, television, toothbrush and drill adapt the user's
 * web/immersive/parts-models.js; printer adapts web/immersive/extra-geometry.js,
 * recovered from FixForward reference commit 0694e329130550387bc5cbf2f428fb0dc85ec48a.
 * Shared frame, shell, circuit, cell and motor geometry below is ported from that
 * source to this viewer's mesh helpers and palette. Tablet, console, straightener
 * and rotary shaver are new builds. No second engine or remote model is loaded.
 */
import * as THREE from './vendor/three.module.js';

export const EXPANDED_PARTS_DEVICES = Object.freeze({
  smartphone: ['screen', 'case', 'battery', 'board', 'camera', 'port'],
  tablet: ['screen', 'case', 'battery', 'board', 'speaker', 'port'],
  television: ['screen', 'frame', 'board', 'power', 'speakers', 'stand'],
  headphones: ['headband', 'cushions', 'drivers', 'controls', 'battery'],
  games_console: ['case', 'board', 'fan', 'storage', 'ports', 'controller'],
  printer: ['body', 'paper', 'rollers', 'cartridge', 'control'],
  straightener: ['arms', 'plates', 'hinge', 'control', 'lead'],
  shaver: ['body', 'head', 'motor', 'battery', 'control'],
  electric_toothbrush: ['handle', 'head', 'motor', 'battery', 'charger'],
  cordless_drill: ['body', 'chuck', 'motor', 'gearbox', 'trigger', 'battery'],
});

/** Receive the shared modelling helpers so colour, highlights and picking stay consistent. */
export function createExpandedDeviceBuilders(kit) {
  const { part, piece, box, cylinder, ring, tube } = kit;
  const metal = { metalness: .78, roughness: .25 };
  const glass = { metalness: .3, roughness: .12 };

  /** Reference board layout, adapted to our helpers; this is not a real wiring diagram. */
  function circuit(group, width, height, at) {
    box(group, [width, height, .035], 'teal', at);
    const [x, y, z] = at;
    for (const [dx, dy] of [[-.22, -.2], [.22, .2], [.23, -.22]]) {
      box(group, [width * .25, height * .22, .033], 'ink', [x + dx * width, y + dy * height, z + .026]);
    }
    for (let i = 0; i < 4; i++) box(group, [.018, height * .7, .008], 'gold', [x + width * (-.3 + i * .2), y, z + .022]);
  }

  /** The reference's open frame/shell lets separated internals read clearly in exploded view. */
  function frame(group, width, height, depth, at, colour) {
    const [x, y, z] = at;
    for (const side of [-1, 1]) {
      box(group, [.06, height, depth], colour, [x + side * width / 2, y, z]);
      box(group, [width, .06, depth], colour, [x, y + side * height / 2, z]);
    }
  }

  function openShell(group, width, height, depth, at, colour) {
    const [x, y, z] = at;
    frame(group, width, height, depth, at, colour);
    box(group, [width, height, .05], colour, [x, y, z - depth / 2]);
  }

  /** Reference battery geometry includes its terminal and raised + mark, not a brand label. */
  function cell(group, dimensions, at) {
    const [w, h, d] = dimensions, [x, y, z] = at;
    box(group, dimensions, 'gold', at);
    box(group, [w * .3, .035, d * .6], 'ink', [x, y + h / 2 + .015, z]);
    box(group, [.1, .025, .01], 'ink', [x, y, z + d / 2 + .003]);
    box(group, [.025, .1, .01], 'ink', [x, y, z + d / 2 + .006]);
  }

  /** Source motor construction: cylindrical housing, copper end and separate output shaft. */
  function motorUnit(group, at, radius, length, axis = 'y') {
    const rotation = axis === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0];
    const direction = axis === 'x' ? 0 : 1;
    // The drill points left: its output shaft must face the chuck, not the rear cover.
    const sign = axis === 'x' ? -1 : 1;
    cylinder(group, radius, radius, length, 'steel', at, rotation, metal);
    const end = [...at]; end[direction] += sign * length / 2;
    cylinder(group, radius * .68, radius * .68, .04, 'gold', end, rotation);
    const tip = [...end]; tip[direction] += sign * .1;
    cylinder(group, radius * .15, radius * .15, .2, 'ink', tip, rotation);
  }

  /** The screen is layered glass; a few raised symbols make it readable without embedded image files. */
  function display(group, width, height, at, colour = 0x355f65) {
    box(group, [width, height, .04], colour, at, undefined, glass);
    const [x, y, z] = at;
    box(group, [width * .58, height * .035, .006], 0x9bc8c2, [x - width * .07, y + height * .3, z + .024]);
    for (let i = 0; i < 3; i++) {
      box(group, [width * .16, height * .13, .009], ['coral', 'gold', 'sage'][i],
        [x - width * .25 + i * width * .25, y - height * .18, z + .026]);
    }
  }

  /** Thin upright phone: front glass, rear camera lenses, hidden cell and board. */
  function smartphone(root) {
    const shell = part(root, 'case', [0, 0, -.62]);
    box(shell, [.94, 1.84, .05], 'sage', [0, .99, -.092]);
    frame(shell, .94, 1.84, .15, [0, .99, 0], 'steel');
    box(shell, [.035, .22, .055], 'ink', [.512, 1.31, 0]);
    const screen = part(root, 'screen', [0, .12, .65]);
    box(screen, [.93, 1.79, .025], 'ink', [0, .99, .089]);
    display(screen, .83, 1.59, [0, .99, .116]);
    box(screen, [.2, .035, .016], 'ink', [0, 1.78, .139]);
    box(screen, [.3, .012, .012], 'cream', [0, .21, .139]);
    const battery = part(root, 'battery', [-.76, -.04, 0]);
    cell(battery, [.65, 1.08, .07], [-.05, .79, -.005]);
    const board = part(root, 'board', [.74, .08, 0]);
    circuit(board, .72, .37, [0, 1.57, -.01]);
    const camera = part(root, 'camera', [-.3, .55, -.48]);
    box(camera, [.38, .56, .07], 'ink', [-.23, 1.55, -.13]);
    for (const y of [1.43, 1.67]) {
      ring(camera, .089, .018, 'steel', [-.23, y, -.176], undefined, metal);
      cylinder(camera, .074, .074, .025, 0x162c40, [-.23, y, -.178], [Math.PI / 2, 0, 0], glass);
    }
    const port = part(root, 'port', [0, -.32, .36]);
    box(port, [.23, .025, .08], 'ink', [0, .034, 0]);
    for (const x of [-.33, -.25, .25, .33]) box(port, [.035, .016, .05], 'ink', [x, .035, 0]);
  }

  /** A landscape tablet has a wider screen and separate edge speaker strips. */
  function tablet(root) {
    const shell = part(root, 'case', [0, 0, -.62]);
    box(shell, [2.05, 1.48, .14], 'steel', [0, .78, 0], undefined, metal);
    box(shell, [1.98, 1.4, .032], 'coral', [0, .78, -.086]);
    cylinder(shell, .065, .065, .025, 'ink', [-.86, 1.37, -.116], [Math.PI / 2, 0, 0]);
    const screen = part(root, 'screen', [0, .08, .7]);
    box(screen, [1.98, 1.39, .028], 'ink', [0, .78, .09]);
    display(screen, 1.79, 1.2, [0, .78, .115]);
    cylinder(screen, .02, .02, .01, 'steel', [0, 1.432, .122], [Math.PI / 2, 0, 0]);
    const battery = part(root, 'battery', [-.72, -.2, 0]);
    for (const x of [-.38, .25]) box(battery, [.58, 1.05, .055], 'ink', [x, .74, 0]);
    box(battery, [.7, .16, .01], 'gold', [-.06, .75, .033]);
    const board = part(root, 'board', [0, .62, -.16]);
    circuit(board, 1.68, .2, [0, 1.35, -.005]);
    const speaker = part(root, 'speaker', [.64, .08, 0]);
    for (const x of [-.975, .975]) {
      box(speaker, [.08, .72, .08], 'ink', [x, .77, .01]);
      for (let i = 0; i < 7; i++) box(speaker, [.024, .032, .035], 'steel', [x + Math.sign(x) * .055, .52 + i * .08, .01]);
    }
    const port = part(root, 'port', [.5, -.35, .32]);
    box(port, [.024, .19, .075], 'ink', [1.037, .37, .01]);
  }

  /** Television feet and wide panel distinguish it from the tablet and laptop. */
  function television(root) {
    const frame = part(root, 'frame', [0, .07, -.6]);
    openShell(frame, 2.24, 1.32, .18, [0, 1.01, 0], 'ink');
    box(frame, [1.23, .67, .13], 'ink', [0, .97, -.14]);
    const screen = part(root, 'screen', [0, .1, .62]);
    box(screen, [2.17, 1.21, .025], 0x2b5760, [0, 1.04, .112], undefined, glass);
    // Screen artwork is intentionally flat; the panel, chassis, feet and internals are full 3D.
    piece(screen, new THREE.CircleGeometry(.15, 32), 'gold', [.64, 1.3, .13]);
    for (const [x, h, w, colour] of [[-.64, .33, .58, 'sage'], [.02, .49, .74, 'teal'], [.65, .24, .67, 'sage']]) {
      const peak = new THREE.Shape(); peak.moveTo(-w / 2, 0); peak.lineTo(0, h); peak.lineTo(w / 2, 0); peak.closePath();
      piece(screen, new THREE.ShapeGeometry(peak), colour, [x, .56, .14]);
    }
    const board = part(root, 'board', [-.68, .05, -.72]);
    circuit(board, .75, .53, [-.35, 1.03, -.07]);
    const power = part(root, 'power', [.72, .08, -.7]);
    circuit(power, .48, .53, [.46, 1.03, -.075]);
    // The original supply board's transformer remains a separate visible gold block.
    box(power, [.18, .18, .1], 'gold', [.46, 1.09, -.007]);
    const speakers = part(root, 'speakers', [0, -.34, .42]);
    for (const x of [-.69, .69]) {
      box(speakers, [.54, .095, .16], 'ink', [x, .361, .016]);
      for (let i = 0; i < 7; i++) box(speakers, [.027, .045, .017], 'steel', [x - .21 + i * .07, .359, .103]);
    }
    const stand = part(root, 'stand', [0, -.43, 0]);
    for (const x of [-.73, .73]) {
      // Two splayed rods retain the reference television's characteristic supported silhouette.
      tube(stand, [[x * .85, .36, 0], [x, .077, .2]], .04, 'steel');
      box(stand, [.39, .055, .62], 'ink', [x, .047, .025]);
    }
  }

  /** Open over-ear headphones with padded arc, hollow cushions and real driver cones. */
  function headphones(root) {
    const headband = part(root, 'headband', [0, .65, 0]);
    // Port of the source half-torus headband, enlarged for the existing studio camera.
    piece(headband, new THREE.TorusGeometry(.72, .08, 8, 40, Math.PI), 'teal', [0, 1.21, 0]);
    for (const x of [-.72, .72]) tube(headband, [[x, 1.22, 0], [x, .91, 0], [x * .96, .65, 0]], .065, 'teal');
    tube(headband, [[-.58, 1.57, 0], [-.37, 1.83, 0], [0, 1.91, 0], [.37, 1.83, 0], [.58, 1.57, 0]], .073, 'ink');
    const cushions = part(root, 'cushions', [0, -.24, .57]);
    const drivers = part(root, 'drivers', [0, .05, -.6]);
    for (const x of [-.69, .69]) {
      const shell = cylinder(drivers, .32, .32, .2, 'teal', [x, .72, 0], [0, 0, Math.PI / 2]);
      shell.scale.z = 1.22;
      const cone = cylinder(drivers, .225, .21, .035, 'steel', [x - Math.sign(x) * .12, .72, 0], [0, 0, Math.PI / 2]);
      cone.scale.z = 1.17;
      const cushion = ring(cushions, .235, .082, 'ink', [x - Math.sign(x) * .18, .72, 0], [0, Math.PI / 2, 0]);
      cushion.scale.y = 1.24;
      box(headband, [.065, .39, .08], 'steel', [x, 1.08, -.05], undefined, metal);
    }
    const controls = part(root, 'controls', [.6, .1, .45]);
    for (const y of [.56, .72, .87]) box(controls, [.03, .068, .09], 'gold', [.807, y, .16]);
    const battery = part(root, 'battery', [-.65, 0, -.2]);
    cell(battery, [.1, .33, .18], [-.72, .72, 0]);
    // Reference electronics in the opposite cup are included in the controls lesson.
    circuit(controls, .12, .25, [.71, .71, .02]);
  }

  /** A generic game console includes a separate handheld controller, cooling and storage. */
  function games_console(root) {
    const shell = part(root, 'case', [0, .1, -.63]);
    box(shell, [.7, 1.65, .83], 'ink', [-.35, .91, -.18]);
    for (const x of [-.72, .02]) box(shell, [.09, 1.74, .91], 'cream', [x, .91, -.16], [0, 0, x < 0 ? -.03 : .03]);
    box(shell, [.9, .09, 1.0], 'ink', [-.35, .055, -.16]);
    for (let i = 0; i < 8; i++) box(shell, [.035, .045, .4], 'steel', [-.58 + i * .065, 1.752, -.12]);
    const board = part(root, 'board', [-.78, .15, 0]);
    circuit(board, .48, .76, [-.34, .81, -.1]);
    const fan = part(root, 'fan', [0, .74, -.06]);
    ring(fan, .2, .025, 'steel', [-.35, 1.44, -.08]);
    cylinder(fan, .048, .048, .09, 'gold', [-.35, 1.44, -.08], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      box(fan, [.095, .15, .027], 'ink', [-.35 + Math.sin(angle) * .1, 1.44 + Math.cos(angle) * .1, -.08], [0, 0, -angle + .45]);
    }
    const storage = part(root, 'storage', [.69, .2, -.3]);
    box(storage, [.34, .54, .12], 'steel', [-.3, .63, -.14], undefined, metal);
    box(storage, [.25, .24, .01], 'ink', [-.3, .64, -.071]);
    const ports = part(root, 'ports', [.4, -.05, .67]);
    box(ports, [.09, .6, .04], 'steel', [-.11, .62, .258]);
    for (const y of [.4, .58]) box(ports, [.055, .09, .018], 'ink', [-.11, y, .285]);
    box(ports, [.2, .023, .02], 'gold', [-.4, 1.51, .25]);
    const controller = part(root, 'controller', [.48, -.15, .7]);
    box(controller, [.96, .35, .34], 'sage', [.48, .42, .69]);
    for (const x of [.08, .88]) box(controller, [.26, .43, .3], 'sage', [x, .31, .74], [0, 0, x < .4 ? -.32 : .32]);
    for (const x of [.33, .61]) cylinder(controller, .085, .09, .06, 'ink', [x, .4, .895], [Math.PI / 2, 0, 0]);
    box(controller, [.18, .055, .025], 'ink', [.13, .49, .88]);
    box(controller, [.055, .18, .025], 'ink', [.13, .49, .88]);
    for (const [dx, dy, colour] of [[0, .06, 'gold'], [0, -.06, 'teal'], [-.06, 0, 'coral'], [.06, 0, 'steel']]) {
      cylinder(controller, .024, .024, .035, colour, [.81 + dx, .49 + dy, .889], [Math.PI / 2, 0, 0]);
    }
  }

  /** Printer paper path remains visible: upright input, roller, cartridge and output tray. */
  function printer(root) {
    const body = part(root, 'body', [0, .06, -.62]);
    // Port the source's hollow case and raised front fascia; internals separate cleanly.
    openShell(body, 1.82, .71, 1.04, [0, .48, -.03], 'cream');
    box(body, [1.82, .36, .06], 'cream', [0, .69, .515]);
    box(body, [1.91, .14, 1.09], 'teal', [0, .88, -.03]);
    box(body, [1.35, .22, .04], 'ink', [0, .35, .515]);
    box(body, [1.36, .046, .49], 'steel', [0, .205, .73]);
    for (const x of [-.65, .65]) box(body, [.08, .04, .46], 'ink', [x, .245, .73]);
    const paper = part(root, 'paper', [0, .6, .35]);
    box(paper, [1.16, .94, .026], 'white', [0, 1.14, -.57], [-.17, 0, 0]);
    box(paper, [1.14, .91, .015], 'cream', [.025, 1.1, -.59], [-.17, 0, 0]);
    box(paper, [1.05, .018, .68], 'white', [0, .28, .72], [.02, 0, 0]);
    for (let i = 0; i < 4; i++) box(paper, [.48 - i * .055, .004, .02], 'teal', [-.16, .295, .73 + i * .056]);
    const rollers = part(root, 'rollers', [-.75, .15, .42]);
    // Preserve the reference's two transverse feed rollers instead of a single decorative bar.
    for (const z of [-.14, .23]) {
      cylinder(rollers, .065, .065, 1.22, 'steel', [0, .41, z], [0, 0, Math.PI / 2], metal);
      for (const x of [-.42, -.14, .14, .42]) cylinder(rollers, .105, .105, .17, 'ink', [x, .41, z], [0, 0, Math.PI / 2]);
    }
    const cartridge = part(root, 'cartridge', [.73, .44, .1]);
    // The carriage rail and head are adapted from extra-geometry.js and travel with the ink lesson.
    cylinder(cartridge, .025, .025, 1.45, 'steel', [0, .68, -.11], [0, 0, Math.PI / 2], metal);
    box(cartridge, [.7, .16, .31], 'ink', [0, .54, .035]);
    for (const [x, colour] of [[-.27, 'ink'], [-.09, 'teal'], [.09, 'coral'], [.27, 'gold']]) {
      box(cartridge, [.16, .33, .25], 'ink', [x, .66, .08]);
      box(cartridge, [.13, .035, .2], colour, [x, .84, .08]);
    }
    const control = part(root, 'control', [.48, .1, .64]);
    circuit(control, .22, .4, [-.72, .59, -.04]);
    box(control, [.43, .24, .034], 'ink', [.59, .677, .516]);
    box(control, [.24, .12, .015], 0x92c8c2, [.53, .7, .54], undefined, glass);
    cylinder(control, .034, .034, .026, 'gold', [.74, .66, .546], [Math.PI / 2, 0, 0]);
  }

  /** Partly open hair straightener: two long arms meet at a genuine hinge cylinder. */
  function straightener(root) {
    const arms = part(root, 'arms', [0, .15, -.47]);
    const plates = part(root, 'plates', [0, .18, .53]);
    for (const side of [-1, 1]) {
      const angle = -side * .16;
      box(arms, [.25, 1.59, .32], side < 0 ? 'coral' : 'ink', [side * .18, .98, 0], [0, 0, angle]);
      box(plates, [.058, .95, .23], 'steel', [side * .148, 1.28, .013], [0, 0, angle], metal);
    }
    const hinge = part(root, 'hinge', [.55, -.16, 0]);
    cylinder(hinge, .14, .14, .37, 'steel', [0, .22, 0], [Math.PI / 2, 0, 0], metal);
    cylinder(hinge, .065, .065, .028, 'gold', [0, .22, .204], [Math.PI / 2, 0, 0]);
    const control = part(root, 'control', [-.54, .05, .36]);
    box(control, [.13, .2, .03], 'ink', [-.1, .68, .177], [0, 0, .16]);
    for (const y of [.63, .7]) cylinder(control, .023, .023, .013, 'gold', [-.1, y, .204], [Math.PI / 2, 0, 0]);
    const lead = part(root, 'lead', [.3, -.27, .39]);
    tube(lead, [[0, .16, -.05], [.15, .07, -.27], [.59, .07, -.35], [.81, .09, .02], [.68, .1, .42]], .023, 'ink');
    box(lead, [.15, .1, .2], 'ink', [.68, .1, .47]);
    for (const x of [.64, .72]) box(lead, [.018, .021, .13], 'steel', [x, .1, .615], undefined, metal);
  }

  /** Rotary shaver with three circular foil heads, sealed handle and internal motor. */
  function shaver(root) {
    const body = part(root, 'body', [0, .04, -.64]);
    const profile = [[0, .12], [.19, .12], [.24, .24], [.22, .8], [.31, 1.18], [.29, 1.36], [0, 1.39]];
    piece(body, new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 40), 'teal');
    for (const x of [-.18, .18]) tube(body, [[x, .32, .15], [x, .64, .16], [x * 1.12, .94, .2]], .017, 'ink');
    const head = part(root, 'head', [0, .67, .13]);
    box(head, [.77, .57, .33], 'ink', [0, 1.57, 0]);
    for (const [x, y] of [[-.18, 1.68], [.18, 1.68], [0, 1.42]]) {
      cylinder(head, .167, .167, .055, 'steel', [x, y, .21], [Math.PI / 2, 0, 0], metal);
      ring(head, .107, .016, 'ink', [x, y, .244]);
      cylinder(head, .065, .065, .025, 'steel', [x, y, .253], [Math.PI / 2, 0, 0], metal);
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        box(head, [.015, .035, .008], 'ink', [x + Math.sin(angle) * .138, y + Math.cos(angle) * .138, .243], [0, 0, -angle]);
      }
    }
    const motor = part(root, 'motor', [.65, .12, .05]);
    cylinder(motor, .13, .13, .35, 'steel', [0, 1.04, 0], undefined, metal);
    cylinder(motor, .032, .032, .18, 'gold', [0, 1.29, 0]);
    const battery = part(root, 'battery', [-.65, -.08, .05]);
    cylinder(battery, .11, .11, .5, 'gold', [0, .46, 0]);
    const control = part(root, 'control', [0, .03, .6]);
    cylinder(control, .077, .077, .022, 'ink', [0, .92, .26], [Math.PI / 2, 0, 0]);
    box(control, [.09, .035, .02], 'gold', [0, .69, .224]);
  }

  /** Rechargeable toothbrush: slender neck, bristle bundles and a separate charging base. */
  function electric_toothbrush(root) {
    const handle = part(root, 'handle', [0, .08, -.6]);
    // The reference's rounded rectangular handle and narrow stem are retained at studio scale.
    box(handle, [.32, 1.08, .24], 'cream', [0, .86, 0]);
    const grip = piece(handle, new THREE.SphereGeometry(.18, 24, 16), 'teal', [0, .34, 0]);
    grip.scale.y = .7;
    cylinder(handle, .06, .06, .018, 'teal', [0, 1.12, .134], [Math.PI / 2, 0, 0]);
    box(handle, [.05, .02, .016], 'gold', [0, .93, .133]);
    const head = part(root, 'head', [0, .65, 0]);
    cylinder(head, .058, .085, .34, 'white', [0, 1.55, 0]);
    box(head, [.19, .34, .12], 'white', [0, 1.87, 0]);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      cylinder(head, .021, .024, .1, (row + col) % 2 ? 'teal' : 'white', [-.06 + col * .06, 1.76 + row * .071, .1], [Math.PI / 2, 0, 0]);
    }
    const motor = part(root, 'motor', [.53, .12, 0]);
    motorUnit(motor, [0, 1.1, 0], .09, .26);
    const battery = part(root, 'battery', [-.53, -.04, 0]);
    cell(battery, [.15, .5, .1], [0, .63, 0]);
    const charger = part(root, 'charger', [0, -.4, .35]);
    cylinder(charger, .32, .36, .16, 'teal', [0, .1, 0]);
    cylinder(charger, .075, .075, .2, 'steel', [0, .22, 0]);
    tube(charger, [[0, .07, -.32], [.17, .06, -.53], [.49, .055, -.53]], .018, 'ink');
  }

  /** Cordless drill geometry follows its real silhouette: chuck, motor barrel, grip and battery. */
  function cordless_drill(root) {
    const body = part(root, 'body', [0, .15, -.65]);
    box(body, [1.16, .52, .51], 'teal', [.17, 1.4, 0]);
    box(body, [.3, .89, .37], 'teal', [.38, .85, 0], [0, 0, -.17]);
    box(body, [.18, .56, .385], 'ink', [.5, .7, 0], [0, 0, -.17]);
    for (let i = 0; i < 5; i++) box(body, [.025, .19, .017], 'ink', [.42 + i * .064, 1.42, .264]);
    const chuck = part(root, 'chuck', [-.69, .08, 0]);
    cylinder(chuck, .15, .21, .36, 'ink', [-.81, 1.4, 0], [0, 0, Math.PI / 2]);
    cylinder(chuck, .055, .055, .13, 'steel', [-1.04, 1.4, 0], [0, 0, Math.PI / 2], metal);
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      box(chuck, [.21, .018, .022], 'steel', [-.77, 1.4 + Math.sin(angle) * .184, Math.cos(angle) * .184], [angle, 0, 0]);
    }
    const motor = part(root, 'motor', [.77, .45, 0]);
    motorUnit(motor, [.24, 1.4, 0], .18, .43, 'x');
    const gearbox = part(root, 'gearbox', [-.15, .69, .15]);
    cylinder(gearbox, .235, .235, .28, 'steel', [-.44, 1.4, 0], [0, 0, Math.PI / 2], metal);
    ring(gearbox, .236, .016, 'gold', [-.59, 1.4, 0], [0, Math.PI / 2, 0]);
    const trigger = part(root, 'trigger', [-.39, -.1, .43]);
    box(trigger, [.19, .19, .35], 'ink', [.04, 1.13, 0], [0, 0, -.1]);
    cylinder(trigger, .038, .038, .024, 'gold', [-.04, 1.24, .215], [Math.PI / 2, 0, 0]);
    const battery = part(root, 'battery', [0, -.5, .15]);
    // The original broad battery pack and terminal are kept, with an added charge indicator.
    cell(battery, [.8, .3, .62], [.41, .19, 0]);
    for (let i = 0; i < 3; i++) box(battery, [.06, .027, .01], 'sage', [.31 + i * .1, .21, .318]);
  }

  return { smartphone, tablet, television, headphones, games_console, printer,
    straightener, shaver, electric_toothbrush, cordless_drill };
}
