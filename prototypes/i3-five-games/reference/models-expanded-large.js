/**
 * Additional household objects for the Explore studio, built from local geometry.
 * These simplified learning models are not manufacturer diagrams or instructions
 * to open a real appliance. Each coloured assembly is a selectable learning part.
 * Refrigerator/washer geometry adapts web/immersive/parts-models.js, and heater/
 * portable-AC geometry adapts web/immersive/extra-geometry.js, recovered from the
 * user's reference project at commit 0694e329130550387bc5cbf2f428fb0dc85ec48a.
 * The adaptation keeps those layouts while mapping parts into this studio's API.
 */
import * as THREE from './vendor/three.module.js';

export const EXPANDED_PARTS_LARGE = Object.freeze({
  refrigerator: ['cabinet', 'door', 'shelves', 'compressor', 'seal', 'control'],
  food_processor: ['base', 'bowl', 'lid', 'blade', 'pusher', 'control'],
  sandwich_press: ['body', 'plates', 'hinge', 'handle', 'control'],
  portable_heater: ['body', 'heater', 'grille', 'control', 'base'],
  portable_ac: ['body', 'filter', 'fan', 'compressor', 'hose', 'control'],
  dehumidifier: ['body', 'filter', 'coils', 'fan', 'tank', 'control'],
  steam_cleaner: ['body', 'tank', 'heater', 'hose', 'nozzle', 'control'],
  washing_machine: ['cabinet', 'drum', 'door', 'drawer', 'motor', 'control'],
  clothes_dryer: ['cabinet', 'drum', 'door', 'filter', 'airflow', 'control'],
  sewing_machine: ['body', 'needle', 'bobbin', 'spool', 'handwheel', 'control'],
});

/**
 * Reuse the studio's material and semantic-part helpers, so hover, labels,
 * selection, disposal and exploded-view animation work identically on all items.
 */
export function createExpandedLargeBuilders(kit) {
  const { part, piece, box, cylinder, ring, tube } = kit;
  const front = [Math.PI / 2, 0, 0];
  const metal = { metalness: .76, roughness: .27 };
  const glass = { transparent: true, opacity: .3, roughness: .1, depthWrite: false, side: THREE.DoubleSide };

  // A ring and a marked knob read clearly without adding unreadable tiny labels.
  function dial(group, x, y, z, radius = .09, colour = 'steel') {
    cylinder(group, radius, radius, .045, colour, [x, y, z], front, metal);
    box(group, [.018, radius * .65, .012], 'ink', [x, y + radius * .35, z + .029]);
  }

  // Repeated geometry indicates airflow slots. It is decorative geometry only,
  // never a promise about the location of a real product's serviceable filter.
  function vents(group, x, y, z, width, count, spacing = .07, colour = 'ink') {
    for (let i = 0; i < count; i++) box(group, [width, .019, .018], colour, [x, y + i * spacing, z]);
  }

  function feet(group, width, depth, y = .055) {
    for (const x of [-width, width]) for (const z of [-depth, depth])
      cylinder(group, .062, .07, .08, 'ink', [x, y, z]);
  }

  // A hollow five-panel cabinet lets its shelves or drum remain a true separate
  // assembly when the outer panels move away in the digital exploded view.
  function cabinetShell(group, width, height, depth, colour, floor = .09) {
    box(group, [width, .1, depth], colour, [0, floor + .05, 0]);
    box(group, [width, .1, depth], colour, [0, floor + height - .05, 0]);
    for (const x of [-width / 2 + .05, width / 2 - .05])
      box(group, [.1, height - .1, depth], colour, [x, floor + height / 2, 0]);
    box(group, [width - .1, height - .1, .09], colour, [0, floor + height / 2, -depth / 2 + .045]);
  }

  /**
   * Adapts reference `fridge`: five-panel shell, stacked doors, oval compressor
   * and the original eight-pass rear coil. Shelves and seal are now separate parts.
   */
  function refrigerator(root) {
    const cabinet = part(root, 'cabinet', [-.65, .06, -.22]);
    cabinetShell(cabinet, 1.23, 2.17, .94, 'cream');
    feet(cabinet, .46, .34);
    box(cabinet, [1.03, .08, .82], 'white', [0, 1.53, .02]);
    // The inner side rails give shelf positions a recognisable physical scale.
    for (const x of [-.48, .48]) for (const y of [.66, 1.05, 1.42, 1.87])
      box(cabinet, [.025, .025, .74], 'steel', [x, y, .03]);
    const shelves = part(root, 'shelves', [0, .18, .75]);
    for (const y of [.63, 1.02, 1.4, 1.83]) {
      box(shelves, [.98, .03, .74], 'white', [0, y, .03], undefined, { ...glass, opacity: .63 });
      box(shelves, [1.0, .025, .026], 'steel', [0, y, .41], undefined, metal);
    }
    box(shelves, [.9, .29, .64], 0xbdd5d7, [0, .37, .05], undefined, { ...glass, opacity: .5 });
    box(shelves, [.34, .045, .05], 'white', [0, .51, .4]);
    const door = part(root, 'door', [.8, .04, .62]);
    box(door, [1.18, .67, .12], 'sage', [0, 1.91, .53], undefined, { roughness: .28, metalness: .2 });
    box(door, [1.18, 1.36, .12], 'sage', [0, .84, .53], undefined, { roughness: .28, metalness: .2 });
    for (const [y, h] of [[1.88, .37], [1.1, .64]]) {
      box(door, [.065, h, .065], 'steel', [-.4, y, .659], undefined, metal);
      for (const dy of [-h / 2 + .045, h / 2 - .045])
        box(door, [.055, .055, .075], 'steel', [-.4, y + dy, .605], undefined, metal);
    }
    const seal = part(root, 'seal', [1.1, .02, -.04]);
    for (const [y, h] of [[1.91, .63], [.84, 1.3]]) {
      for (const x of [-.54, .54]) box(seal, [.035, h, .025], 'ink', [x, y, .448]);
      for (const dy of [-h / 2, h / 2]) box(seal, [1.09, .035, .025], 'ink', [0, y + dy, .448]);
    }
    const compressor = part(root, 'compressor', [0, .02, -.82]);
    const pump = piece(compressor, new THREE.SphereGeometry(.23, 24, 14), 'ink', [.1, .33, -.48]);
    pump.scale.set(1.25, .8, .85);
    for (let i = 0; i < 8; i++) {
      const y = .63 + i * .177;
      tube(compressor, [[-.45, y, -.53], [.45, y, -.53]], .017, 'steel');
      if (i < 7) {
        const side = i % 2 ? .45 : -.45;
        tube(compressor, [[side, y, -.53], [side, y + .177, -.53]], .017, 'steel');
      }
    }
    tube(compressor, [[.1, .48, -.55], [.3, .58, -.59], [.38, .7, -.52]], .026, 'gold');
    const control = part(root, 'control', [.6, .54, .18]);
    box(control, [.32, .14, .09], 'cream', [.29, 2.04, .35]);
    dial(control, .31, 2.04, .404, .045, 'gold');
    box(control, [.045, .055, .022], 0xb6eadb, [.195, 2.04, .411], undefined,
      { emissive: 0x507f70, emissiveIntensity: .15 });
  }

  /** The processor's wide bowl, central spindle and vertical feed chute differ from a blender. */
  function food_processor(root) {
    const base = part(root, 'base', [0, -.14, -.4]);
    box(base, [1.25, .49, 1.11], 'coral', [0, .33, 0], undefined, { roughness: .27, metalness: .12 });
    cylinder(base, .43, .5, .15, 'steel', [0, .59, 0], undefined, metal);
    feet(base, .43, .37);
    const bowl = part(root, 'bowl', [-.52, .16, .32]);
    piece(bowl, new THREE.CylinderGeometry(.57, .47, .8, 48, 1, true), 'white', [0, 1.07, 0], undefined, glass);
    cylinder(bowl, .48, .48, .04, 'white', [0, .68, 0], undefined, { ...glass, opacity: .6 });
    ring(bowl, .56, .023, 'steel', [0, 1.47, 0], front, metal);
    tube(bowl, [[.51, 1.37, 0], [.81, 1.36, 0], [.85, 1.02, 0], [.79, .87, 0], [.5, .9, 0]], .06, 'ink');
    for (let i = 0; i < 4; i++) box(bowl, [.13, .012, .012], 'ink', [-.11, .85 + i * .14, .52]);
    const lid = part(root, 'lid', [0, .64, -.1]);
    cylinder(lid, .58, .6, .08, 'ink', [0, 1.5, 0]);
    box(lid, [.31, .45, .34], 'white', [-.2, 1.76, -.09], undefined, { ...glass, opacity: .45 });
    box(lid, [.35, .05, .38], 'ink', [-.2, 1.99, -.09]);
    const blade = part(root, 'blade', [0, .35, .82]);
    cylinder(blade, .07, .11, .59, 'cream', [0, 1.0, 0]);
    // Two curved extruded blades communicate the S-blade rather than sharp realism.
    for (const angle of [0, Math.PI]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.quadraticCurveTo(.22, -.2, .44, -.04);
      shape.quadraticCurveTo(.46, .08, .29, .14); shape.quadraticCurveTo(.21, .025, 0, .045);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false, curveSegments: 9 });
      piece(blade, geometry, 'steel', [0, .81, 0], [Math.PI / 2, 0, angle], metal);
    }
    const pusher = part(root, 'pusher', [0, 1.04, 0]);
    box(pusher, [.25, .38, .27], 'cream', [-.2, 1.85, -.09]);
    box(pusher, [.33, .07, .35], 'ink', [-.2, 2.06, -.09]);
    const control = part(root, 'control', [.58, .05, .6]);
    dial(control, .16, .34, .579, .12, 'steel');
    cylinder(control, .037, .037, .035, 'gold', [-.25, .34, .585], front);
  }

  /** A slightly open clamshell reveals two real ridged cooking plates and the back hinge. */
  function sandwich_press(root) {
    const body = part(root, 'body', [0, -.12, -.28]);
    box(body, [1.67, .23, 1.29], 'steel', [0, .24, 0], undefined, metal);
    box(body, [1.63, .13, 1.27], 'sage', [0, .7, -.1], [-.16, 0, 0], { roughness: .26, metalness: .25 });
    feet(body, .64, .43);
    const plates = part(root, 'plates', [0, .44, .42]);
    box(plates, [1.48, .06, 1.11], 'ink', [0, .4, -.025]);
    const upper = new THREE.Group(); upper.position.set(0, .613, -.085); upper.rotation.x = -.16; plates.add(upper);
    box(upper, [1.46, .06, 1.1], 'ink', [0, 0, 0]);
    for (let i = 0; i < 11; i++) {
      box(plates, [.035, .018, 1.02], 0x536064, [-.64 + i * .128, .44, -.025]);
      box(upper, [.035, .018, 1.02], 0x536064, [-.64 + i * .128, -.041, 0]);
    }
    const hinge = part(root, 'hinge', [0, .12, -.65]);
    for (const x of [-.57, .57]) {
      cylinder(hinge, .085, .085, .21, 'ink', [x, .5, -.61], [0, 0, Math.PI / 2]);
      box(hinge, [.08, .31, .09], 'steel', [x, .47, -.58], undefined, metal);
    }
    const handle = part(root, 'handle', [0, .05, .82]);
    tube(handle, [[-.6, .76, .32], [-.62, .77, .72], [-.4, .78, .87], [.4, .78, .87], [.62, .77, .72], [.6, .76, .32]], .056, 'ink');
    const control = part(root, 'control', [.54, .45, .13]);
    for (const [x, colour] of [[-.14, 0xcc755b], [.14, 0x6cba99]]) {
      cylinder(control, .047, .047, .012, colour, [x, .782, -.05], [-.16, 0, 0],
        { emissive: colour, emissiveIntensity: .16 });
    }
    box(control, [.1, .09, .033], 'ink', [.61, .245, .663]);
  }

  /**
   * Adapts reference `heater`: upright hollow case, two broad feet, vertical guard
   * rods, horizontal heating bars and rear fan. Nothing glows as if it is running.
   */
  function portable_heater(root) {
    const body = part(root, 'body', [-.6, .1, -.16]);
    cabinetShell(body, 1.32, 1.49, .55, 'coral', .22);
    tube(body, [[-.25, 1.69, -.13], [-.25, 1.87, -.15], [.25, 1.87, -.15], [.25, 1.69, -.13]], .035, 'ink');
    const heater = part(root, 'heater', [.54, .15, -.26]);
    for (let i = 0; i < 6; i++) tube(heater, [[-.45, .56 + i * .17, .145], [.45, .56 + i * .17, .145]], .025, 'gold');
    cylinder(heater, .075, .075, .075, 'ink', [0, 1.02, -.065], front);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const blade = piece(heater, new THREE.SphereGeometry(1, 14, 8), 'steel',
        [Math.sin(angle) * .24, 1.02 + Math.cos(angle) * .24, -.07]);
      blade.scale.set(.1, .25, .025); blade.rotation.z = -angle + .26;
    }
    const grille = part(root, 'grille', [0, .05, .82]);
    for (const y of [.36, 1.57]) box(grille, [1.18, .036, .033], 'ink', [0, y, .32]);
    for (let i = 0; i < 9; i++) tube(grille, [[-.56 + i * .14, .36, .32], [-.56 + i * .14, 1.57, .32]], .016, 'steel');
    for (const y of [.62, .97, 1.31]) box(grille, [1.14, .013, .018], 'steel', [0, y, .334], undefined, metal);
    const control = part(root, 'control', [.42, .59, .3]);
    cylinder(control, .1, .1, .07, 'ink', [0, 1.755, .02]);
    box(control, [.017, .014, .063], 'cream', [0, 1.798, .047]);
    cylinder(control, .025, .025, .024, 'gold', [.23, 1.737, .04]);
    const base = part(root, 'base', [0, -.28, 0]);
    for (const x of [-.48, .48]) box(base, [.27, .2, .71], 'ink', [x, .11, .01]);
  }

  /**
   * Adapts reference `ac_portable`: wheeled shell, five outlet slats, radial fan,
   * finned cooling unit and ribbed exhaust. The hose now follows a continuous tube.
   */
  function portable_ac(root) {
    const body = part(root, 'body', [-.66, .07, -.12]);
    cabinetShell(body, 1.15, 1.69, .87, 'cream', .16);
    box(body, [.97, .92, .085], 'cream', [0, .72, .458]);
    for (const x of [-.4, .4]) for (const z of [-.3, .3])
      cylinder(body, .085, .085, .055, 'ink', [x, .095, z], [0, 0, Math.PI / 2]);
    box(body, [.96, .42, .07], 'ink', [0, 1.5, .461]);
    for (let i = 0; i < 5; i++) box(body, [.88, .027, .11], 'steel', [0, 1.34 + i * .079, .496], [-.19, 0, 0]);
    const filter = part(root, 'filter', [0, .3, -.74]);
    box(filter, [.76, .77, .045], 'sage', [0, 1.23, -.437]);
    for (let i = 0; i < 10; i++) box(filter, [.02, .69, .025], 'steel', [-.32 + i * .071, 1.23, -.468]);
    vents(filter, 0, .92, -.477, .7, 9, .078, 'steel');
    const fan = part(root, 'fan', [.66, .24, .03]);
    ring(fan, .32, .029, 'ink', [0, 1.36, .09]);
    cylinder(fan, .075, .075, .06, 'cream', [0, 1.36, .16], front);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const blade = piece(fan, new THREE.SphereGeometry(1, 14, 8), 'steel',
        [Math.sin(angle) * .16, 1.36 + Math.cos(angle) * .16, .11]);
      blade.scale.set(.095, .17, .03); blade.rotation.z = -angle + .29;
    }
    const compressor = part(root, 'compressor', [.56, -.08, -.58]);
    cylinder(compressor, .23, .26, .49, 'ink', [.04, .52, -.05]);
    tube(compressor, [[.18, .74, -.04], [.35, .86, -.04], [.32, 1.04, -.17], [.1, 1.08, -.23]], .026, 'gold');
    box(compressor, [.73, .64, .1], 'steel', [0, 1.01, -.15], undefined, metal);
    for (let i = 0; i < 10; i++) box(compressor, [.018, .64, .045], 'ink', [-.365 + i * .081, 1.01, -.075]);
    const hose = part(root, 'hose', [.62, .06, -.32]);
    const points = [[.35, .76, -.4], [.68, .78, -.62], [.9, .93, -.62], [.98, 1.3, -.41], [.95, 1.52, -.15]];
    tube(hose, points, .17, 0x899a9e);
    const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    for (let i = 0; i < 18; i++) {
      const t = i / 17; const rib = ring(hose, .175, .014, 'steel', path.getPoint(t).toArray());
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), path.getTangent(t));
    }
    const control = part(root, 'control', [0, .53, .34]);
    box(control, [.56, .11, .038], 'ink', [0, 1.76, .469]);
    box(control, [.17, .053, .017], 0xa8d9d7, [-.1, 1.76, .496]);
    cylinder(control, .025, .025, .021, 'gold', [.15, 1.76, .5], front);
  }

  /** The dehumidifier shows the removable water tank, rear filter and cooled coil assembly. */
  function dehumidifier(root) {
    const body = part(root, 'body', [-.61, .07, -.18]);
    cabinetShell(body, 1.09, 1.56, .77, 'sage', .13);
    box(body, [.95, .63, .07], 'sage', [0, 1.16, .405]);
    box(body, [.86, .19, .04], 'ink', [0, 1.56, .399]);
    vents(body, 0, 1.51, .426, .75, 3, .053, 'steel');
    feet(body, .38, .25);
    tube(body, [[-.22, 1.64, 0], [-.22, 1.77, 0], [.22, 1.77, 0], [.22, 1.64, 0]], .035, 'ink');
    const filter = part(root, 'filter', [0, .31, -.75]);
    box(filter, [.8, .64, .035], 'cream', [0, 1.13, -.401]);
    for (let i = 0; i < 10; i++) box(filter, [.014, .56, .019], 'steel', [-.34 + i * .075, 1.13, -.425]);
    vents(filter, 0, .89, -.43, .7, 7, .079, 'steel');
    const coils = part(root, 'coils', [-.64, .3, .27]);
    for (let i = 0; i < 7; i++) {
      tube(coils, [[-.35, .83 + i * .08, -.12], [.3, .83 + i * .08, -.12], [.35, .87 + i * .08, -.12], [-.3, .87 + i * .08, -.12]], .018, 'gold');
    }
    for (let i = 0; i < 8; i++) box(coils, [.02, .63, .17], 'steel', [-.3 + i * .086, 1.12, -.13], undefined, metal);
    const fan = part(root, 'fan', [.64, .35, .08]);
    cylinder(fan, .075, .075, .16, 'ink', [0, 1.18, .16], front);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const blade = piece(fan, new THREE.SphereGeometry(1, 14, 8), 'teal', [Math.sin(a) * .14, 1.18 + Math.cos(a) * .14, .22]);
      blade.scale.set(.08, .17, .025); blade.rotation.z = -a + .28;
    }
    ring(fan, .295, .026, 'ink', [0, 1.18, .215]);
    const tank = part(root, 'tank', [0, -.05, .92]);
    box(tank, [.91, .55, .66], 'white', [0, .48, .037], undefined, { ...glass, opacity: .46 });
    box(tank, [.84, .24, .59], 0x86c7d0, [0, .347, .037], undefined, { ...glass, opacity: .63 });
    box(tank, [.94, .55, .045], 'cream', [0, .48, .391]);
    box(tank, [.17, .38, .05], 0x467c87, [.23, .45, .42], undefined, { roughness: .16 });
    for (let i = 0; i < 4; i++) box(tank, [.07, .012, .02], 'white', [.23, .32 + i * .077, .449]);
    box(tank, [.37, .048, .055], 'ink', [0, .735, .434]);
    const control = part(root, 'control', [.4, .59, .36]);
    box(control, [.52, .14, .025], 'ink', [0, 1.369, .452]);
    box(control, [.17, .055, .018], 0xb5dfd2, [-.08, 1.369, .476]);
    cylinder(control, .029, .029, .02, 'gold', [.14, 1.369, .478], front);
  }

  /** A wheeled domestic steam canister with curved hose and separate wide floor head. */
  function steam_cleaner(root) {
    const body = part(root, 'body', [-.42, .03, -.25]);
    const shell = piece(body, new THREE.SphereGeometry(1, 28, 18), 'gold', [-.19, .48, -.14]);
    shell.scale.set(.64, .4, .57);
    box(body, [1.03, .14, 1.03], 'ink', [-.19, .18, -.14]);
    for (const x of [-.69, .31]) {
      cylinder(body, .2, .2, .09, 'ink', [x, .23, -.38], [0, 0, Math.PI / 2]);
      cylinder(body, .08, .08, .099, 'steel', [x, .23, -.38], [0, 0, Math.PI / 2], metal);
    }
    tube(body, [[-.55, .74, -.12], [-.51, .97, -.12], [.13, .97, -.12], [.17, .74, -.12]], .044, 'ink');
    const tank = part(root, 'tank', [-.38, .52, .19]);
    cylinder(tank, .24, .24, .37, 'white', [-.28, .48, -.14], undefined, { ...glass, opacity: .48 });
    cylinder(tank, .12, .15, .09, 'ink', [-.28, .853, -.14]);
    for (let i = 0; i < 6; i++) box(tank, [.03, .058, .027], 'steel',
      [-.28 + Math.sin(i * Math.PI / 3) * .14, .86, -.14 + Math.cos(i * Math.PI / 3) * .14]);
    const heater = part(root, 'heater', [0, -.14, -.58]);
    cylinder(heater, .25, .27, .13, 'steel', [-.15, .28, -.08], undefined, metal);
    for (const radius of [.08, .17]) ring(heater, radius, .027, 'gold', [-.15, .356, -.08], front);
    const hose = part(root, 'hose', [.46, .21, .05]);
    tube(hose, [[.23, .5, .22], [.69, .75, .4], [.8, 1.29, .17], [.68, 1.48, .2], [.53, 1.23, .46]], .058, 'ink');
    for (let i = 0; i < 5; i++) ring(hose, .068, .015, 'steel', [.22 + i * .028, .5 + i * .018, .22 + i * .014], [0, .94, -.45]);
    box(hose, [.12, .29, .14], 'ink', [.53, 1.2, .47], [.3, 0, -.15]);
    const nozzle = part(root, 'nozzle', [.45, -.05, .69]);
    cylinder(nozzle, .035, .035, 1.04, 'steel', [.64, .69, .7], [.24, 0, .19], metal);
    box(nozzle, [.71, .12, .41], 'gold', [.74, .125, .86]);
    box(nozzle, [.74, .028, .43], 'cream', [.74, .055, .86]);
    const control = part(root, 'control', [.08, .57, .35]);
    cylinder(control, .079, .079, .045, 'ink', [.06, .853, .06]);
    box(control, [.015, .01, .064], 'white', [.06, .882, .035]);
    cylinder(control, .024, .024, .024, 'coral', [-.1, .822, .185], [.45, 0, 0]);
  }

  /** Shared drum geometry stays hollow, with perforations and lifters visible behind the door. */
  function laundryDrum(group, colour = 'steel') {
    piece(group, new THREE.CylinderGeometry(.47, .47, .55, 48, 1, true), colour, [0, .92, .04], front,
      { ...metal, side: THREE.DoubleSide });
    cylinder(group, .464, .464, .027, colour, [0, .92, -.238], front, metal);
    ring(group, .47, .028, 'steel', [0, .92, .322], undefined, metal);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      for (const radius of [.19, .32]) cylinder(group, .013, .013, .006, 'ink',
        [Math.sin(a) * radius, .92 + Math.cos(a) * radius, -.218], front);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      box(group, [.08, .046, .49], 'cream', [Math.sin(a) * .423, .92 + Math.cos(a) * .423, .047], [0, 0, -a]);
    }
  }

  // Front cabinet panels surround a circular aperture rather than hiding the
  // drum behind an opaque front wall. All meshes still belong to semantic parts.
  function laundryCabinet(group, colour) {
    cabinetShell(group, 1.48, 1.79, 1.04, colour, .1);
    box(group, [1.3, .27, .09], colour, [0, 1.72, .55]);
    box(group, [1.3, .21, .09], colour, [0, .245, .55]);
    for (const x of [-.65, .65]) box(group, [.18, 1.24, .09], colour, [x, .948, .55]);
    ring(group, .545, .084, colour, [0, .92, .549]);
    feet(group, .54, .39);
  }

  function laundryDoor(group, colour) {
    ring(group, .489, .069, colour, [0, .92, .635], undefined, metal);
    ring(group, .405, .024, 'ink', [0, .92, .657]);
    const window = piece(group, new THREE.SphereGeometry(.402, 32, 16), 0x8fbbbf, [0, .92, .64], undefined,
      { ...glass, opacity: .32, roughness: .08 });
    window.scale.z = .34;
    box(group, [.075, .27, .068], 'cream', [.442, .94, .689]);
    for (const y of [.71, 1.13]) box(group, [.065, .055, .086], 'steel', [-.479, y, .612], undefined, metal);
  }

  /**
   * Adapts reference `washer`: shell/front panel, layered round door, radial drum
   * perforations and lower horizontal motor. Drawer and clear door are added here.
   */
  function washing_machine(root) {
    const cabinet = part(root, 'cabinet', [-.66, .07, -.25]);
    laundryCabinet(cabinet, 'cream');
    box(cabinet, [.19, .13, .024], 'ink', [.49, .244, .602]);
    const drum = part(root, 'drum', [0, .05, .96]); laundryDrum(drum);
    const door = part(root, 'door', [-.84, .05, .66]); laundryDoor(door, 'steel');
    const drawer = part(root, 'drawer', [-.3, .42, .72]);
    box(drawer, [.51, .18, .045], 'cream', [-.41, 1.723, .613]);
    box(drawer, [.36, .035, .036], 'ink', [-.41, 1.746, .65]);
    box(drawer, [.46, .035, .42], 'steel', [-.41, 1.673, .385], undefined, metal);
    for (const x of [-.5, -.33]) box(drawer, [.025, .095, .37], 'white', [x, 1.718, .383]);
    const motor = part(root, 'motor', [.7, -.06, -.52]);
    cylinder(motor, .18, .18, .33, 'steel', [.33, .32, -.17], [0, 0, Math.PI / 2], metal);
    for (let i = 0; i < 7; i++) ring(motor, .187, .008, 'ink', [.185 + i * .046, .32, -.17], [0, Math.PI / 2, 0]);
    cylinder(motor, .044, .044, .24, 'gold', [.59, .32, -.17], [0, 0, Math.PI / 2], metal);
    const control = part(root, 'control', [.53, .53, .28]);
    dial(control, .02, 1.72, .624, .102, 'steel');
    box(control, [.29, .124, .019], 'ink', [.39, 1.724, .607]);
    for (let i = 0; i < 3; i++) box(control, [.025, .052, .012], 0xa7ddd5, [.32 + i * .068, 1.727, .623]);
    cylinder(control, .028, .028, .02, 'gold', [.613, 1.724, .624], front);
  }

  /** A contrasting dryer with a large dark door, lint filter and illustrated air path. */
  function clothes_dryer(root) {
    const cabinet = part(root, 'cabinet', [-.66, .08, -.25]);
    laundryCabinet(cabinet, 'sage');
    box(cabinet, [.73, .14, .021], 'ink', [0, .243, .604]);
    for (let i = 0; i < 8; i++) box(cabinet, [.036, .092, .023], 'steel', [-.3 + i * .085, .245, .622]);
    const drum = part(root, 'drum', [0, .05, 1.0]); laundryDrum(drum);
    const door = part(root, 'door', [-.86, .07, .69]); laundryDoor(door, 'ink');
    const filter = part(root, 'filter', [.61, -.1, .64]);
    box(filter, [.66, .18, .07], 'cream', [0, .399, .42]);
    for (let i = 0; i < 11; i++) box(filter, [.011, .13, .012], 'steel', [-.277 + i * .055, .402, .465]);
    for (const y of [.354, .398, .442]) box(filter, [.58, .01, .012], 'steel', [0, y, .476]);
    box(filter, [.17, .045, .035], 'ink', [0, .495, .425]);
    const airflow = part(root, 'airflow', [.71, .05, -.66]);
    tube(airflow, [[.34, .33, -.22], [.53, .49, -.33], [.52, .95, -.35], [.27, 1.34, -.35]], .089, 'coral');
    cylinder(airflow, .18, .18, .13, 'ink', [.3, .32, -.2], front);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      box(airflow, [.038, .24, .02], 'steel', [.3, .32, -.116], [0, 0, a], metal);
    }
    box(airflow, [.45, .18, .16], 'steel', [.22, 1.38, -.35], undefined, metal);
    for (let i = 0; i < 5; i++) ring(airflow, .057, .012, 'gold', [.055 + i * .082, 1.385, -.253]);
    const control = part(root, 'control', [.49, .52, .27]);
    dial(control, -.35, 1.72, .627, .108, 'steel');
    box(control, [.39, .13, .022], 'ink', [.12, 1.727, .612]);
    box(control, [.13, .05, .012], 0xa9e0d1, [.075, 1.728, .632]);
    cylinder(control, .039, .039, .019, 'gold', [.48, 1.728, .627], front);
  }

  /** An open-arm sewing machine with thread route, handwheel, presser foot and bobbin. */
  function sewing_machine(root) {
    const body = part(root, 'body', [0, .12, -.35]);
    box(body, [1.97, .21, .84], 'cream', [0, .19, 0]);
    box(body, [.53, 1.35, .6], 'cream', [.67, .94, -.03]);
    box(body, [1.74, .44, .65], 'cream', [.01, 1.53, -.02]);
    box(body, [.39, .49, .62], 'cream', [-.66, 1.25, -.02]);
    box(body, [.88, .16, .47], 'cream', [-.34, .39, -.03]);
    feet(body, .76, .28);
    // A contrasting face strip emphasises the machine's arch and open work area.
    box(body, [1.23, .066, .025], 'teal', [.025, 1.661, .326]);
    const needle = part(root, 'needle', [-.55, .08, .62]);
    cylinder(needle, .022, .022, .45, 'steel', [-.65, .895, .045], undefined, metal);
    cylinder(needle, .006, .01, .2, 'steel', [-.65, .589, .045], undefined, metal);
    box(needle, [.13, .018, .17], 'steel', [-.65, .47, .097], undefined, metal);
    box(needle, [.026, .27, .024], 'steel', [-.75, .603, .02], undefined, metal);
    box(needle, [.36, .018, .31], 'steel', [-.65, .399, .06], undefined, metal);
    for (const x of [-.72, -.61]) for (let i = 0; i < 5; i++)
      box(needle, [.033, .013, .018], 'ink', [x, .414, -.017 + i * .035]);
    const bobbin = part(root, 'bobbin', [-.36, -.08, .68]);
    cylinder(bobbin, .084, .084, .084, 'coral', [-.65, .316, .057]);
    for (const y of [.266, .366]) cylinder(bobbin, .112, .112, .015, 'steel', [-.65, y, .057], undefined, metal);
    cylinder(bobbin, .018, .018, .126, 'ink', [-.65, .314, .057]);
    const spool = part(root, 'spool', [-.11, .66, -.06]);
    cylinder(spool, .024, .024, .29, 'steel', [.23, 1.846, -.015], undefined, metal);
    cylinder(spool, .108, .108, .23, 'coral', [.23, 1.843, -.015]);
    for (const y of [1.724, 1.965]) cylinder(spool, .139, .139, .02, 'cream', [.23, y, -.015]);
    for (let i = 0; i < 8; i++) ring(spool, .109, .005, 'gold', [.23, 1.75 + i * .026, -.015], front);
    tube(spool, [[.23, 1.96, .06], [-.31, 1.85, .22], [-.56, 1.58, .336], [-.65, 1.08, .339], [-.65, .77, .05]], .004, 'coral');
    const handwheel = part(root, 'handwheel', [.66, .14, -.03]);
    cylinder(handwheel, .26, .26, .14, 'ink', [1.006, 1.43, -.035], [0, 0, Math.PI / 2]);
    cylinder(handwheel, .19, .19, .15, 'steel', [1.025, 1.43, -.035], [0, 0, Math.PI / 2], metal);
    ring(handwheel, .195, .027, 'cream', [1.11, 1.43, -.035], [0, Math.PI / 2, 0]);
    const control = part(root, 'control', [.53, .15, .64]);
    dial(control, .69, 1.34, .314, .122, 'gold');
    dial(control, .69, .983, .314, .089, 'steel');
    box(control, [.25, .17, .025], 'ink', [.27, 1.487, .328]);
    // The stitch display is graphic strokes, avoiding illegible decorative text.
    for (let i = 0; i < 4; i++) box(control, [.047, .015, .012], 'cream', [.197 + i * .046, 1.491 + (i % 2 ? -.025 : .025), .348], [0, 0, i % 2 ? .72 : -.72]);
    box(control, [.091, .061, .041], 'teal', [.34, 1.16, .351]);
  }

  return { refrigerator, food_processor, sandwich_press, portable_heater, portable_ac,
    dehumidifier, steam_cleaner, washing_machine, clothes_dryer, sewing_machine };
}
