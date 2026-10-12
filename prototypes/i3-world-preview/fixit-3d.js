/** Fix-it Station 3D workshop. Owns the pixels only: the belt, turntable, four
 * stations, the Bin corner, 3D dragging and every reward animation. The UI in
 * fixit.js owns words, buttons and rules, and calls this small API.
 * Appliances are the same original procedural models used in Explore; everyday
 * things come from waste-models.js. Nothing here shows real disassembly; parts
 * only glow to point at a story clue. */
import * as THREE from './vendor/three.module.js';
import { createAppliance } from './models.js';
import { createWasteItem, isWasteItem } from './waste-models.js';

const COLOURS = { repair: 0x1e8e5a, reuse: 0x176dc4, ewaste: 0x6a4f9a, adult: 0xd88a1f };
const LIDS = { recycle: 0xf2c12e, compost: 0x8cc63f, bin: 0xd8392b };
const BIN_IDS = Object.keys(LIDS);
const GLOW = { fault: 0xff4d3d, danger: 0xffa31a, ok: 0x3ad17a, fixed: 0x3ad17a };
const ease = {
  out: t => 1 - (1 - t) ** 3,
  inOut: t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  back: t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};

/** Canvas text becomes a crisp sign texture; no font files or images are loaded. */
function signTexture(text, { bg = '#ffffff', fg = '#16283c', width = 512, height = 128, size = 58 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; const r = height * .28;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(4, 4, width - 8, height - 8, r) : ctx.rect(4, 4, width - 8, height - 8); ctx.fill();
  ctx.fillStyle = fg; ctx.font = `800 ${size}px "Segoe UI", system-ui, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
const canvasTexture = draw => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; draw(canvas.getContext('2d')); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture; };
const heartTexture = () => canvasTexture(ctx => {
  ctx.fillStyle = '#e5547a'; ctx.scale(2, 2);
  ctx.beginPath(); ctx.moveTo(64, 112); ctx.bezierCurveTo(8, 72, 8, 24, 40, 20); ctx.bezierCurveTo(54, 18, 62, 28, 64, 38);
  ctx.bezierCurveTo(66, 28, 74, 18, 88, 20); ctx.bezierCurveTo(120, 24, 120, 72, 64, 112); ctx.fill();
});
/** Three chasing arrows: the recycling loop. */
function loopArrows(ctx, colour, radius = 78, width = 26) {
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = width; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a0 = k * Math.PI * 2 / 3 - Math.PI / 2 + .25, a1 = a0 + Math.PI * 2 / 3 - .7;
    ctx.beginPath(); ctx.arc(128, 128, radius, a0, a1); ctx.stroke();
    const tip = [128 + Math.cos(a1 + .25) * radius, 128 + Math.sin(a1 + .25) * radius], back = a1 + .25 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(tip[0] + Math.cos(back + Math.PI / 2) * 24, tip[1] + Math.sin(back + Math.PI / 2) * 24);
    ctx.lineTo(tip[0] + Math.cos(back) * 26, tip[1] + Math.sin(back) * 26); ctx.lineTo(tip[0] - Math.cos(back) * 26, tip[1] - Math.sin(back) * 26); ctx.closePath(); ctx.fill();
  }
}
/** A white bin sticker with a simple picture: arrows, a leaf, or a bin. */
function stickerTexture(kind) {
  return canvasTexture(ctx => {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(8, 8, 240, 240, 46) : ctx.rect(8, 8, 240, 240); ctx.fill();
    if (kind === 'recycle') loopArrows(ctx, '#2f8a3e', 70, 22);
    else if (kind === 'compost') {
      ctx.fillStyle = '#4c9a2a'; ctx.beginPath(); ctx.moveTo(70, 190); ctx.bezierCurveTo(50, 90, 130, 50, 200, 56); ctx.bezierCurveTo(206, 130, 160, 200, 70, 190); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(72, 188); ctx.quadraticCurveTo(120, 130, 186, 72); ctx.stroke();
    } else {
      ctx.fillStyle = '#59636c'; ctx.fillRect(78, 92, 100, 116); ctx.fillRect(66, 72, 124, 14); ctx.fillRect(108, 58, 40, 14);
      ctx.fillStyle = '#ffffff'; for (const x of [98, 122, 146]) ctx.fillRect(x, 108, 10, 84);
    }
  });
}
function stripeTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#3b4a57'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#566676'; for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 12, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(6, 1);
  return texture;
}

const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .05, ...options });
function mesh(geometry, material, position, parent, { shadow = true, rotation } = {}) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const box = (w, h, d, color, position, parent, options) => mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' || typeof color === 'string' ? mat(color) : color, position, parent, options);
// Signboards are coloured but blank: station names are crisp HTML labels placed
// above them, which stay readable at any size and work with screen readers.
function sign(text, color, parent, y = 2.55, width = 2.5) {
  const board = mesh(new THREE.BoxGeometry(width, width / 4.2, .08), mat(color, { roughness: .4 }), [0, y, .02], parent);
  board.name = `sign:${text}`;
  for (const x of [-width / 2 + .18, width / 2 - .18]) box(.07, y, .07, 0x5a6b78, [x, y / 2, -.05], parent);
  return board;
}

/** Build one station as a group facing +z. `spots` are local places where
 * accepted items rest; `entry` is where a flying item aims first. */
function buildStation(id) {
  const g = new THREE.Group(); g.name = id;
  const colour = COLOURS[id];
  const base = box(2.8, .12, 2.1, new THREE.Color(colour).lerp(new THREE.Color(0xffffff), .72).getHex(), [0, .06, 0], g);
  const data = { group: g, base, spots: [], used: 0, entry: new THREE.Vector3(0, 1.6, .2), parts: {} };
  if (id === 'repair') {
    box(2.3, .85, .8, 0xc9a273, [0, .48, -.35], g); box(2.4, .08, .9, 0x8a6a49, [0, .94, -.35], g);
    const stripes = 6; for (let i = 0; i < stripes; i++) box(2.5 / stripes, .08, .9, i % 2 ? 0xffffff : colour, [-1.25 + (i + .5) * 2.5 / stripes, 2.05, -.05], g, { rotation: [-.35, 0, 0] });
    // Jo the repairer: a friendly figure behind the counter.
    const jo = new THREE.Group(); jo.position.set(.85, .95, -.85); g.add(jo);
    mesh(new THREE.CapsuleGeometry(.22, .45, 6, 16), mat(0x2f6f9f), [0, .45, 0], jo);
    const head = mesh(new THREE.SphereGeometry(.2, 24, 16), mat(0xe8b48c), [0, 1.02, 0], jo);
    mesh(new THREE.SphereGeometry(.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0x3b2a22), [0, 1.06, -.01], jo);
    for (const x of [-.07, .07]) mesh(new THREE.SphereGeometry(.025, 8, 8), mat(0x16283c), [x, 1.04, .18], jo, { shadow: false });
    data.parts.head = head; data.parts.jo = jo;
    // Tools on the counter.
    const wrench = new THREE.Group(); wrench.position.set(-.9, 1.0, -.15); wrench.rotation.set(-Math.PI / 2, 0, .5); g.add(wrench);
    box(.08, .5, .03, 0x9aa7b0, [0, 0, 0], wrench, { shadow: false }); mesh(new THREE.TorusGeometry(.09, .03, 8, 16, Math.PI * 1.5), mat(0x9aa7b0, { metalness: .6 }), [0, .3, 0], wrench, { shadow: false });
    data.parts.tool = wrench;
    data.spots = [[-.35, .98, -.3], [.25, .98, -.3], [-.35, .98, .25]];
    data.entry.set(0, 2.0, .3);
    data.sign = sign('REPAIR CAFÉ', colour, g, 2.75);
  } else if (id === 'reuse') {
    const wood = 0xd9b98a;
    for (const x of [-1.1, 1.1]) box(.1, 2.1, .7, wood, [x, 1.05, -.45], g);
    for (const y of [.18, .9, 1.62]) box(2.3, .08, .7, wood, [0, y, -.45], g);
    box(2.3, 2.1, .05, 0xf3e6cf, [0, 1.05, -.8], g, { shadow: false });
    const heart = mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ map: heartTexture(), transparent: true }), [0, 2.2, -.4], g, { shadow: false });
    data.parts.heart = heart;
    data.spots = [[-.55, .22, -.4], [.55, .22, -.4], [-.55, .94, -.4], [.55, .94, -.4], [0, 1.66, -.4]];
    data.entry.set(0, 2.2, .3);
    data.sign = sign('REUSE & SHARE', colour, g, 2.75);
  } else if (id === 'ewaste') {
    const bin = new THREE.Group(); bin.position.set(-.45, 0, -.3); g.add(bin);
    mesh(new THREE.CylinderGeometry(.62, .54, 1.55, 32), mat(colour), [0, .9, 0], bin);
    const lid = mesh(new THREE.CylinderGeometry(.66, .66, .1, 32), mat(0x4e3a75), [0, 1.72, 0], bin);
    mesh(new THREE.BoxGeometry(.7, .02, .14), mat(0x16283c), [0, 1.78, 0], bin, { shadow: false });
    mesh(new THREE.PlaneGeometry(.9, .32), new THREE.MeshBasicMaterial({ map: signTexture('E-WASTE', { bg: '#ffffff', fg: '#4e3a75', size: 64 }), transparent: true }), [0, 1.0, .63], bin, { shadow: false });
    data.parts.lid = lid; data.parts.bin = bin;
    // Recovery crates: metal, plastic, glass.
    data.crates = [['METAL', 0xb87333], ['PLASTIC', 0x3fa7d6], ['GLASS', 0x7fd6b5]].map(([label, c], i) => {
      const crate = new THREE.Group(); crate.position.set(.75, 0, -.75 + i * .52); g.add(crate);
      box(.62, .4, .46, 0xe9e4da, [0, .32, 0], crate);
      box(.56, .06, .4, c, [0, .5, 0], crate, { shadow: false });
      mesh(new THREE.PlaneGeometry(.6, .15), new THREE.MeshBasicMaterial({ map: signTexture(label, { bg: '#16283c', fg: '#ffffff', size: 56 }), transparent: true }), [0, .32, .235], crate, { shadow: false });
      return { group: crate, colour: c };
    });
    data.entry.set(-.45, 2.4, -.3);
    data.sign = sign('E-WASTE DROP-OFF', colour, g, 2.75, 2.7);
  } else if (id === 'adult') {
    box(2.2, .8, .9, 0xf4e2c4, [0, .46, -.3], g); box(2.3, .07, 1.0, 0xd88a1f, [0, .9, -.3], g);
    // Bell and stop sign: "stop and tell an adult".
    const bell = new THREE.Group(); bell.position.set(.75, .95, -.45); g.add(bell);
    mesh(new THREE.SphereGeometry(.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4c431, { metalness: .5, roughness: .3 }), [0, 0, 0], bell);
    mesh(new THREE.CylinderGeometry(.2, .2, .03, 24), mat(0x8a6a49), [0, 0, 0], bell, { shadow: false });
    data.parts.bell = bell;
    const stop = new THREE.Group(); stop.position.set(-1.05, 0, -.75); g.add(stop);
    box(.06, 1.9, .06, 0x5a6b78, [0, .95, 0], stop);
    mesh(new THREE.CylinderGeometry(.34, .34, .05, 8), mat(0xd9342b), [0, 1.95, .04], stop, { rotation: [Math.PI / 2, 0, Math.PI / 8] });
    mesh(new THREE.PlaneGeometry(.5, .16), new THREE.MeshBasicMaterial({ map: signTexture('STOP', { bg: '#d9342b', fg: '#ffffff', size: 76 }), transparent: true }), [0, 1.95, .075], stop, { shadow: false });
    data.parts.stop = stop;
    data.spots = [[-.3, .94, -.25], [.25, .94, .1], [-.55, .94, .2]];
    data.entry.set(0, 2.0, .3);
    data.sign = sign('ASK AN ADULT', colour, g, 2.75);
  }
  return data;
}
/** A kerbside wheelie bin: dark body, coloured lid hinged at the back, wheels and
 * a picture sticker. A glow ring on the floor lights up while an item hovers. */
function buildWheelieBin(id) {
  const g = new THREE.Group(); g.name = id;
  const ring = mesh(new THREE.CircleGeometry(.85, 40), new THREE.MeshBasicMaterial({ color: LIDS[id], transparent: true, opacity: 0, depthWrite: false }), [0, .012, 0], g, { shadow: false, rotation: [-Math.PI / 2, 0, 0] });
  const body = mesh(new THREE.CylinderGeometry(.64, .52, 1.3, 4, 1), mat(0x34424c, { roughness: .6 }), [0, .73, 0], g, { rotation: [0, Math.PI / 4, 0] });
  box(.96, .07, .96, 0x2b363e, [0, 1.4, 0], g);
  const lid = new THREE.Group(); lid.position.set(0, 1.44, -.48); g.add(lid);
  const lidMesh = box(1.02, .08, 1.02, mat(LIDS[id], { roughness: .4 }), [0, 0, .51], lid);
  box(.6, .06, .08, 0x2b363e, [0, .02, -.02], lid);
  for (const x of [-.38, .38]) mesh(new THREE.CylinderGeometry(.14, .14, .09, 18), mat(0x1d2429), [x, .14, -.42], g, { rotation: [0, 0, Math.PI / 2] });
  mesh(new THREE.PlaneGeometry(.46, .46), new THREE.MeshBasicMaterial({ map: stickerTexture(id), transparent: true }), [0, .86, .44], g, { shadow: false, rotation: [-.05, 0, 0] });
  return { group: g, ring, body, lid, lidMesh, entry: new THREE.Vector3(0, 2.15, .15), lidTarget: 0, animating: false };
}

/** Station and bin positions for wide screens and for tall (phone) screens. */
const LAYOUTS = {
  wide: { turntable: [-.6, 1.8], stations: { repair: [-4.8, -2.2], reuse: [-1.6, -2.6], ewaste: [1.6, -2.6], adult: [4.8, -2.2] }, bins: { recycle: [2.35, 2.0], compost: [3.95, 2.0], bin: [5.55, 2.0] }, cameraDir: [0, .8, 1], target: [0, .8, -.4] },
  tall: { turntable: [0, 4.6], stations: { repair: [-1.65, -4.1], reuse: [1.65, -4.1], ewaste: [-1.65, -.85], adult: [1.65, -.85] }, bins: { recycle: [-2.1, 2.05], compost: [0, 2.05], bin: [2.1, 2.05] }, cameraDir: [0, 1.25, 1], target: [0, .6, 0] },
};

/** Create the workshop. Throws if WebGL is unavailable; the UI then uses its 2D view. */
export function createFixitScene(canvas, { onDrop = () => {}, onHover = () => {}, onDragStart = () => {}, onMiss = () => {}, onLayout = () => {}, reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe7f1fa);
  scene.fog = new THREE.Fog(0xe7f1fa, 22, 48);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb3a0, 1.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6); sun.position.set(-6, 12, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun);

  // Room: warm floor, a pale wall with a banner, and soft wall shapes.
  const floor = mesh(new THREE.PlaneGeometry(80, 80), mat(0xf4ede0, { roughness: .95 }), [0, 0, 0], scene, { shadow: false, rotation: [-Math.PI / 2, 0, 0] });
  floor.receiveShadow = true;
  mesh(new THREE.PlaneGeometry(80, 30), mat(0xdde9f2, { roughness: 1 }), [0, 15, -6.5], scene, { shadow: false });
  mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: signTexture("PIP'S FIX-IT WORKSHOP", { bg: '#16283c', fg: '#f4c431', width: 1024, height: 192, size: 92 }), transparent: true }), [0, 5.4, -6.4], scene, { shadow: false });
  for (const [x, y, c] of [[-7, 4, 0xcfe6ff], [7.5, 3.4, 0xfff0b8], [-3.5, 6.8, 0xd6f2df]]) mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: c }), [x, y, -6.45], scene, { shadow: false });
  // A green mat marks the Bin corner on the floor.
  const binMat = mesh(new THREE.PlaneGeometry(5.2, 1.9), mat(0xd8ead2, { roughness: 1 }), [0, .006, 0], scene, { shadow: false, rotation: [-Math.PI / 2, 0, 0] });

  // Turntable and conveyor belt.
  const turntable = new THREE.Group(); scene.add(turntable);
  const deck = mesh(new THREE.CylinderGeometry(1.35, 1.45, .2, 64), mat(0xffffff, { roughness: .4 }), [0, .1, 0], turntable);
  const deckRing = mesh(new THREE.TorusGeometry(1.36, .045, 8, 64), new THREE.MeshBasicMaterial({ color: 0xf4c431 }), [0, .2, 0], turntable, { shadow: false, rotation: [Math.PI / 2, 0, 0] });
  const beltTexture = stripeTexture();
  const belt = new THREE.Group(); scene.add(belt);
  mesh(new THREE.BoxGeometry(9, .18, 1.6), new THREE.MeshStandardMaterial({ map: beltTexture, roughness: .8 }), [0, .09, 0], belt);
  for (const z of [-.86, .86]) box(9, .26, .12, 0xb8c4cc, [0, .13, z], belt);

  const stations = Object.fromEntries(Object.keys(COLOURS).map(id => { const s = buildStation(id); scene.add(s.group); return [id, s]; }));
  const bins = Object.fromEntries(BIN_IDS.map(id => { const b = buildWheelieBin(id); scene.add(b.group); return [id, b]; }));

  let layoutName = null, layout = LAYOUTS.wide;
  const turntablePos = new THREE.Vector3();
  function applyLayout(name) {
    layoutName = name; layout = LAYOUTS[name];
    turntablePos.set(layout.turntable[0], .2, layout.turntable[1]);
    turntable.position.set(layout.turntable[0], 0, layout.turntable[1]);
    belt.position.set(layout.turntable[0] - 5.8, 0, layout.turntable[1]);
    for (const [id, [x, z]] of Object.entries(layout.stations)) stations[id].group.position.set(x, 0, z);
    for (const [id, [x, z]] of Object.entries(layout.bins)) bins[id].group.position.set(x, 0, z);
    const xs = Object.values(layout.bins).map(([x]) => x), z = Object.values(layout.bins)[0][1];
    binMat.position.set((Math.min(...xs) + Math.max(...xs)) / 2, .006, z);
    if (current && state !== 'flying') current.root.position.set(turntablePos.x, current.root.position.y, turntablePos.z);
  }

  // Fit the camera so every station, bin and the turntable are on screen.
  const keyPoints = () => {
    const points = [];
    for (const s of Object.values(stations)) for (const [dx, dy, dz] of [[-1.45, 0, 1.1], [1.45, 0, 1.1], [-1.45, 3.1, -.9], [1.45, 3.1, -.9]]) points.push(new THREE.Vector3(s.group.position.x + dx, dy, s.group.position.z + dz));
    for (const [dx, dz] of [[-1.5, 1.5], [1.5, 1.5]]) points.push(new THREE.Vector3(turntablePos.x + dx, 0, turntablePos.z + dz));
    for (const b of Object.values(bins)) for (const [dx, dy, dz] of [[-.6, 0, .7], [.6, 0, .7], [0, 2.35, 0]]) points.push(new THREE.Vector3(b.group.position.x + dx, dy, b.group.position.z + dz));
    return points;
  };
  /** Find the closest camera distance that keeps every key point on screen, then
   * re-centre on the scene's projected box so no large empty band is left. */
  function fitCamera() {
    const dir = new THREE.Vector3(...layout.cameraDir).normalize(), target = new THREE.Vector3(...layout.target);
    const points = keyPoints();
    const place = d => { camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const bounds = () => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of points) { const v = p.clone().project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } return { x0, x1, y0, y1 }; };
    let d = 20;
    for (let pass = 0; pass < 3; pass++) {
      let lo = 3, hi = 70;
      for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; place(mid); const b = bounds(); if (b.x0 >= -.96 && b.x1 <= .96 && b.y0 >= -.93 && b.y1 <= .93) hi = mid; else lo = mid; }
      d = hi; place(d);
      // Shift the look-at point so the projected box is centred on screen.
      const b = bounds(), halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d, halfW = halfH * camera.aspect;
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      target.addScaledVector(up, (b.y0 + b.y1) / 2 * halfH).addScaledVector(right, (b.x0 + b.x1) / 2 * halfW);
    }
    place(d);
  }
  let width = 1, height = 1;
  function screenOf(vector) { const v = vector.clone().project(camera); return { x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height }; }
  const above = (group, y) => group.position.clone().add(new THREE.Vector3(0, y, 0));
  function reportLayout() {
    const out = { targets: {}, item: screenOf(current ? current.root.position.clone().add(new THREE.Vector3(0, .7, 0)) : turntablePos.clone().add(new THREE.Vector3(0, .7, 0))) };
    // Station names sit on their blank signboards; bin names float above the lids.
    for (const [id, s] of Object.entries(stations)) out.targets[id] = { label: screenOf(above(s.group, 2.75)) };
    for (const [id, b] of Object.entries(bins)) out.targets[id] = { label: screenOf(above(b.group, 1.95)) };
    onLayout(out);
  }

  // Screen-space drop zones: dropping anywhere on a station's picture (its sign
  // included) or a bin counts, which suits small fingers on a tablet.
  let zones = [];
  function computeZones() {
    const zone = (id, group, corners, drop, front) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [dx, dy, dz] of corners) { const p = screenOf(group.position.clone().add(new THREE.Vector3(dx, dy, dz))); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return { id, x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, drop: group.position.clone().add(new THREE.Vector3(...drop)), front };
    };
    zones = [
      ...BIN_IDS.map(id => zone(id, bins[id].group, [[-.55, 0, .55], [.55, 0, .55], [-.55, 0, -.55], [.55, 0, -.55], [-.55, 2.2, 0], [.55, 2.2, 0]], [0, 0, .25], true)),
      ...Object.keys(stations).map(id => zone(id, stations[id].group, [[-1.4, 0, 1.05], [1.4, 0, 1.05], [-1.4, 0, -1.05], [1.4, 0, -1.05], [-1.3, 3.5, -.8], [1.3, 3.5, -.8]], [0, 0, .55], false)),
    ];
  }
  function zoneAt(x, y) {
    // Bins stand in front of the stations, so a point on a bin picks the bin.
    const front = zones.find(z => z.front && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
    if (front) return front;
    let best = null, bestD = Infinity;
    for (const z of zones) { if (x < z.x0 - 14 || x > z.x1 + 14 || y < z.y0 - 14 || y > z.y1 + 14) continue; const d = Math.hypot(x - z.cx, y - z.cy); if (d < bestD) { best = z; bestD = d; } }
    return best;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); camera.aspect = width / height;
    const wanted = camera.aspect < 1.05 ? 'tall' : 'wide';
    if (wanted !== layoutName) applyLayout(wanted);
    fitCamera(); computeZones(); reportLayout(); needsRender = true;
  }

  // ---- Animation helpers ----
  const tweens = new Set(), particles = [];
  let needsRender = true, last = performance.now(), visible = true, disposed = false, frame = 0, clock = 0;
  function tween(duration, update, easing = ease.inOut) {
    return new Promise(resolve => {
      if (reducedMotion || duration <= 0) { update(1, 1); needsRender = true; resolve(); return; }
      tweens.add({ start: performance.now(), duration, update, easing, resolve });
    });
  }
  const wait = ms => tween(ms, () => {});
  function burst(origin, { count = 18, colours = [0xf4c431, 0x3ad17a, 0x176dc4, 0xe5547a], speed = 3.2, size = .09, life = 1.3, shape = 'confetti', gravity = 7 } = {}) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const geometry = shape === 'spark' ? new THREE.OctahedronGeometry(size) : shape === 'puff' ? new THREE.IcosahedronGeometry(size, 1) : new THREE.PlaneGeometry(size * 1.6, size);
      const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colours[i % colours.length], side: THREE.DoubleSide, transparent: true }));
      m.position.copy(origin); scene.add(m);
      const angle = Math.random() * Math.PI * 2, up = .6 + Math.random() * .8;
      particles.push({ m, v: new THREE.Vector3(Math.cos(angle) * speed * (.4 + Math.random() * .6), speed * up, Math.sin(angle) * speed * (.4 + Math.random() * .6)), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), age: 0, life, gravity, grow: shape === 'puff' ? 1.8 : 0 });
    }
  }
  /** A picture (heart, recycling loop) that floats up, spins and fades. */
  function floatSprite(texture, origin, { rise = 1.6, size = .7, spin = 0, duration = 1300 } = {}) {
    if (reducedMotion) { texture.dispose(); return; }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.scale.setScalar(size); sprite.position.copy(origin); scene.add(sprite);
    const from = origin.clone();
    tween(duration, t => { sprite.position.set(from.x, from.y + t * rise, from.z); sprite.material.opacity = 1 - t * t; sprite.scale.setScalar(size * (.6 + t * .6)); sprite.material.rotation = spin * t; }, ease.out)
      .then(() => { scene.remove(sprite); sprite.material.map.dispose(); sprite.material.dispose(); });
  }
  function arc(object, to, { duration = 800, height = 1.6, scaleTo, spin = 0 } = {}) {
    const from = object.position.clone(), s0 = object.scale.x, r0 = object.rotation.y;
    return tween(duration, t => {
      object.position.lerpVectors(from, to, t); object.position.y += Math.sin(Math.PI * t) * height;
      if (scaleTo !== undefined) object.scale.setScalar(s0 + (scaleTo - s0) * t);
      object.rotation.y = r0 + spin * t;
    }, ease.inOut);
  }
  const wiggle = (object, axis = 'z', amount = .35, duration = 700) => { const r0 = object.rotation[axis]; return tween(duration, t => { object.rotation[axis] = r0 + Math.sin(t * Math.PI * 6) * amount * (1 - t); }, x => x); };
  const bump = (object, duration = 420, amount = .12) => { const s0 = object.scale.x; return tween(duration, t => { object.scale.setScalar(s0 * (1 + Math.sin(t * Math.PI) * amount)); }, x => x); };
  /** Briefly light a station's floor in a colour, then fade back. */
  function flashBase(s, colour, duration = 900) {
    s.base.material.emissive.set(colour);
    return tween(duration, t => { s.base.material.emissiveIntensity = .9 * (1 - t); }, x => x).then(() => { if (hover !== s.group.name) { s.base.material.emissive.set(0); s.base.material.emissiveIntensity = 0; } });
  }

  // ---- The current item ----
  let current = null, state = 'empty', dragging = null, hover = null, glowPhase = 0;
  function setGlow(item, colour) {
    item.glowColour = new THREE.Color(colour);
    for (const m of item.glow) { m.material.emissive = item.glowColour.clone(); m.material.emissiveIntensity = .9; }
  }
  /** Tint the whole item (not its glowing clue part) towards a colour: red for "no". */
  function tint(item, colour, amount) {
    const to = new THREE.Color(colour);
    item.root.traverse(o => {
      if (!o.isMesh || !o.material?.emissive || item.glow.includes(o)) return;
      o.userData.emissive0 ??= o.material.emissive.clone();
      o.material.emissive.copy(o.userData.emissive0).lerp(to, amount);
    });
  }
  /** Shake "no-no" with a red flush, so a wrong try is unmistakable. */
  async function noNo(item) {
    const r0 = item.root.rotation.y;
    await tween(620, t => { item.root.rotation.y = r0 + Math.sin(t * Math.PI * 4) * .5 * (1 - t); tint(item, 0xff2a1a, Math.sin(t * Math.PI) * .8); }, x => x);
    tint(item, 0x000000, 0);
  }
  function showItem(storyItem) {
    if (current) { scene.remove(current.root); disposeTree(current.root); current = null; }
    const model = isWasteItem(storyItem.model) ? createWasteItem(storyItem.model) : createAppliance(storyItem.model);
    const box3 = new THREE.Box3().setFromObject(model), size = box3.getSize(new THREE.Vector3()), centre = box3.getCenter(new THREE.Vector3());
    const scale = 2.25 / Math.max(size.x, size.y, size.z);
    model.position.set(-centre.x, -box3.min.y, -centre.z);
    const holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(scale);
    const root = new THREE.Group(); root.add(holder); scene.add(root);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const glow = [];
    model.userData.parts.get(storyItem.part)?.traverse(o => { if (o.isMesh) glow.push(o); });
    // A soft glow for "it's fine" clues, and for parts that cover most of the item
    // (a whole banana peel), so the item still looks like itself.
    let meshes = 0; root.traverse(o => { if (o.isMesh) meshes++; });
    const glowScale = (storyItem.tone === 'ok' ? .5 : 1) * (glow.length > meshes * .5 ? .55 : 1);
    current = { root, holder, model, story: storyItem, glow, glowColour: null, scale, glowScale };
    setGlow(current, GLOW[storyItem.tone] ?? GLOW.fault);
    const start = new THREE.Vector3(turntablePos.x - 9, turntablePos.y, turntablePos.z);
    root.position.copy(start); root.rotation.y = .5;
    state = 'arriving';
    return tween(1600, t => { root.position.lerpVectors(start, turntablePos, t); beltTexture.offset.x = -t * 3; }, ease.back).then(() => {
      if (!current || current.root !== root) return;
      state = 'waiting'; burst(turntablePos.clone().add(new THREE.Vector3(0, .4, 0)), { count: 10, shape: 'spark', speed: 2, colours: [0xf4c431, 0xffffff] }); reportLayout();
    });
  }
  function stationWorld(id, local) { return stations[id].group.localToWorld(new THREE.Vector3(...local)); }

  /** Move the item into a station or bin with that place's own celebration.
   * `onLand` runs the moment the item arrives, for the UI's fireworks. */
  async function accept(id, { onLand = () => {} } = {}) {
    if (!current) return;
    const item = current; state = 'flying'; current = null; endDrag();
    setHover(null);
    if (bins[id]) return acceptBin(id, item, onLand);
    const s = stations[id];
    const entry = s.group.localToWorld(s.entry.clone());
    if (id === 'ewaste') {
      await arc(item.root, entry, { duration: 850, height: 1.4, scaleTo: .55, spin: Math.PI });
      s.parts.lid.position.y += .25;
      await tween(380, t => { item.root.position.y = entry.y - t * 1.2; item.root.scale.setScalar(.55 * (1 - t)); }, ease.out);
      s.parts.lid.position.y -= .25; bump(s.parts.bin, 380, .08);
      scene.remove(item.root); disposeTree(item.root);
      onLand(); flashBase(s, 0x3ad17a);
      // Recovered materials fly from the bin to their crates.
      if (!reducedMotion) {
        const top = s.parts.bin.localToWorld(new THREE.Vector3(0, 1.9, 0));
        await Promise.all(s.crates.flatMap((crate, i) => [0, 1].map(k => {
          const chip = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .16), mat(crate.colour, { roughness: .3, metalness: i === 0 ? .6 : .1 }));
          chip.position.copy(top); scene.add(chip);
          const to = crate.group.localToWorld(new THREE.Vector3(0, .58, 0));
          return wait(i * 140 + k * 220).then(() => arc(chip, to, { duration: 650, height: 1.1, spin: 6 })).then(() => { bump(crate.group, 300, .15); scene.remove(chip); chip.geometry.dispose(); chip.material.dispose(); });
        })));
      }
      return;
    }
    const spot = s.spots[s.used % s.spots.length]; s.used++;
    if (s.placed?.[spot.join()]) { scene.remove(s.placed[spot.join()]); disposeTree(s.placed[spot.join()]); }
    const target = stationWorld(id, spot);
    await arc(item.root, entry, { duration: 600, height: 1.2, scaleTo: .5, spin: Math.PI });
    await arc(item.root, target, { duration: 450, height: .2, scaleTo: id === 'reuse' ? .4 : .44 });
    // Re-parent so the item stays put if the layout changes.
    s.group.attach(item.root); (s.placed ||= {})[spot.join()] = item.root;
    onLand(); flashBase(s, 0x3ad17a); bump(s.group, 420, .05);
    if (id === 'repair') {
      burst(target.clone().add(new THREE.Vector3(0, .5, 0)), { count: 16, shape: 'spark', colours: [0xf4c431, 0xffffff, 0x3ad17a], speed: 2.4 });
      wiggle(s.parts.tool, 'z', .6, 700);
      const head = s.parts.head, y0 = head.position.y; tween(600, t => { head.position.y = y0 + Math.sin(t * Math.PI * 2) * .05; }, x => x);
      const from = item.glowColour.clone(), to = new THREE.Color(GLOW.fixed);
      await tween(700, t => { const c = from.clone().lerp(to, t); for (const m of item.glow) m.material.emissive.copy(c); });
      await tween(650, t => { item.root.rotation.y = Math.PI + t * Math.PI * 2; }, ease.inOut);
      for (const m of item.glow) m.material.emissiveIntensity = .25;
    } else if (id === 'reuse') {
      floatSprite(heartTexture(), target.clone().add(new THREE.Vector3(0, .6, .2)));
      bump(s.parts.heart, 500, .35);
      burst(target.clone().add(new THREE.Vector3(0, .6, .2)), { count: 12, colours: [0xe5547a, 0xf4c431, 0x176dc4] });
      for (const m of item.glow) m.material.emissiveIntensity = .15;
      await wait(500);
    } else if (id === 'adult') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffc56b, transparent: true, opacity: .38, roughness: .1 }));
      s.group.add(dome); dome.position.copy(s.group.worldToLocal(target.clone())); dome.scale.setScalar(.01);
      item.root.userData.dome = dome;
      await tween(420, t => dome.scale.setScalar(Math.max(.01, t)), ease.back);
      wiggle(s.parts.bell, 'z', .45, 800); wiggle(s.parts.stop, 'z', .12, 700);
      await wait(500);
    }
  }
  /** Lid opens, the item drops in, the lid closes, then the bin's own reward:
   * a spinning recycling loop, a sprouting plant, or a small dusty puff. */
  async function acceptBin(id, item, onLand) {
    const b = bins[id], top = b.group.localToWorld(b.entry.clone()), s0 = item.root.scale.x * .55;
    b.animating = true;
    const r0 = b.lid.rotation.x; tween(260, t => { b.lid.rotation.x = r0 + (-1.9 - r0) * t; }, ease.out);
    await arc(item.root, top, { duration: 700, height: 1.3, scaleTo: s0, spin: Math.PI });
    await tween(320, t => { item.root.position.y = top.y - t * 1.4; item.root.scale.setScalar(s0 * (1 - t * .9)); }, ease.inOut);
    scene.remove(item.root); disposeTree(item.root);
    await tween(180, t => { b.lid.rotation.x = -1.9 * (1 - t); }, ease.out);
    bump(b.group, 320, .1); onLand();
    const lidTop = b.group.localToWorld(new THREE.Vector3(0, 1.6, .2));
    b.ring.material.opacity = .7; tween(900, t => { b.ring.material.opacity = .7 * (1 - t); }, x => x);
    if (id === 'recycle') {
      floatSprite(canvasTexture(ctx => loopArrows(ctx, '#e1a400')), lidTop.clone().add(new THREE.Vector3(0, .3, 0)), { rise: 1.4, size: 1.1, spin: Math.PI * 2, duration: 1400 });
      burst(lidTop, { count: 14, shape: 'spark', colours: [0xf2c12e, 0xffffff, 0x3ad17a], speed: 2.6 });
    } else if (id === 'compost') {
      // A little plant sprouts on the lid: food becomes soil for new growth.
      const plant = new THREE.Group(); plant.position.copy(b.group.worldToLocal(lidTop.clone())); plant.position.y = 1.5; b.group.add(plant);
      mesh(new THREE.CylinderGeometry(.035, .045, .5, 8), mat(0x3f8a2a), [0, .25, 0], plant);
      for (const side of [-1, 1]) { const leaf = mesh(new THREE.SphereGeometry(.18, 16, 8), mat(0x6cc04a, { roughness: .5 }), [side * .17, .42, 0], plant, { rotation: [0, 0, side * -.6] }); leaf.scale.set(1, .35, .6); }
      plant.scale.setScalar(.01);
      burst(lidTop, { count: 14, colours: [0x8cc63f, 0x4c9a2a, 0xc9e88a], speed: 2.2 });
      await tween(520, t => plant.scale.setScalar(Math.max(.01, t)), ease.back);
      await wait(700);
      await tween(300, t => plant.scale.setScalar(Math.max(.01, 1 - t)));
      b.group.remove(plant); disposeTree(plant);
    } else {
      burst(lidTop, { count: 9, shape: 'puff', colours: [0xbfc6cc, 0xd9dee2, 0xa6aeb5], speed: 1.2, size: .12, life: .9, gravity: -1 });
      await wait(400);
    }
    b.animating = false;
  }
  /** Bounce back from a wrong station or bin, then wait again. */
  async function reject(id) {
    if (!current) return;
    const item = current; state = 'flying'; endDrag(); setHover(null);
    const home = turntablePos.clone();
    if (bins[id]) {
      const b = bins[id], top = b.group.localToWorld(b.entry.clone());
      b.animating = true;
      const r0 = b.lid.rotation.x; tween(260, t => { b.lid.rotation.x = r0 + (-1.5 - r0) * t; }, ease.out);
      b.lidMesh.material.emissive.set(0xff2a1a); b.lidMesh.material.emissiveIntensity = .7;
      await arc(item.root, top, { duration: 560, height: 1.0, scaleTo: item.root.scale.x * .8 });
      await tween(160, t => { b.lid.rotation.x = -1.5 * (1 - t); }, ease.out);
      wiggle(b.group, 'z', .12, 500);
      burst(top, { count: 6, shape: 'puff', colours: [0xbfc6cc, 0xd9dee2], speed: 1.4, size: .1, life: .7, gravity: -1 });
      await arc(item.root, home, { duration: 760, height: 1.9, scaleTo: 1, spin: Math.PI * 2 });
      b.lidMesh.material.emissive.set(0); b.lidMesh.material.emissiveIntensity = 0; b.animating = false;
    } else {
      const s = stations[id], front = s.group.localToWorld(new THREE.Vector3(0, .3, 1.1));
      flashBase(s, 0xff3b2a, 1100);
      await arc(item.root, home.clone().lerp(front, .78), { duration: 420, height: 1.2 });
      wiggle(s.sign, 'z', .16, 520);
      await arc(item.root, home, { duration: 520, height: 1.0, spin: Math.PI * 2 });
    }
    if (current === item) { item.root.position.copy(home); await noNo(item); }
    if (current === item) state = 'waiting';
  }

  // ---- 3D drag and drop ----
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1), hit = new THREE.Vector3();
  function local(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top, rect }; }
  function toNdc(event) { const { x, y, rect } = local(event); ndc.set(x / rect.width * 2 - 1, -(y / rect.height) * 2 + 1); raycaster.setFromCamera(ndc, camera); }
  function setHover(id) {
    if (hover === id) return;
    for (const [sid, s] of Object.entries(stations)) { s.base.material.emissive.set(sid === id ? COLOURS[sid] : 0x000000); s.base.material.emissiveIntensity = sid === id ? .55 : 0; }
    for (const [bid, b] of Object.entries(bins)) { b.ring.material.opacity = bid === id ? .6 : 0; b.lidTarget = bid === id ? -.6 : 0; }
    hover = id; onHover(id); needsRender = true;
  }
  function endDrag() { if (dragging) { try { canvas.releasePointerCapture(dragging.pointerId); } catch { /* already released */ } } dragging = null; canvas.style.cursor = ''; }
  const listeners = new AbortController(), on = { signal: listeners.signal };
  canvas.addEventListener('pointerdown', event => {
    if (state !== 'waiting' || !current || dragging || event.button > 0) return;
    toNdc(event);
    // Grab the item itself, its turntable, or anywhere close to it on screen.
    const { x, y } = local(event), centre = screenOf(current.root.position.clone().add(new THREE.Vector3(0, .8, 0)));
    const near = Math.hypot(x - centre.x, y - centre.y) < Math.max(80, Math.min(width, height) * .15);
    if (!near && !raycaster.intersectObject(current.root, true).length && !raycaster.intersectObject(deck, false).length) return;
    event.preventDefault();
    dragging = { pointerId: event.pointerId, lift: 1.15 }; canvas.setPointerCapture?.(event.pointerId); canvas.style.cursor = 'grabbing';
    state = 'dragging'; onDragStart();
  }, on);
  canvas.addEventListener('pointermove', event => {
    if (!dragging) { if (state === 'waiting' && current) { toNdc(event); canvas.style.cursor = raycaster.intersectObject(current.root, true).length ? 'grab' : ''; } return; }
    if (event.pointerId !== dragging.pointerId) return;
    toNdc(event);
    const { x, y } = local(event), zone = zoneAt(x, y);
    let point = raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : dragging.target?.clone();
    if (!point) return;
    point.x = THREE.MathUtils.clamp(point.x, -7.5, 7.5); point.z = THREE.MathUtils.clamp(point.z, -5.5, 6);
    // Over a place, the item is pulled towards it, so a near miss still lands.
    if (zone) point.lerp(zone.drop, .6);
    dragging.target = point; dragging.lift = zone ? (zone.front ? 2.2 : 1.7) : 1.15;
    setHover(zone ? zone.id : null);
  }, on);
  const release = event => {
    if (!dragging || (event && event.pointerId !== undefined && event.pointerId !== dragging.pointerId)) return;
    const target = hover; endDrag();
    if (target) { state = 'deciding'; onDrop(target); }
    else { state = 'returning'; onMiss(); arc(current.root, turntablePos.clone(), { duration: 450, height: .4 }).then(() => { if (current) state = 'waiting'; }); }
  };
  canvas.addEventListener('pointerup', release, on);
  canvas.addEventListener('pointercancel', release, on);
  canvas.addEventListener('lostpointercapture', event => { if (dragging && event.pointerId === dragging.pointerId) release(event); }, on);

  // ---- Frame loop: runs while visible; idle spin and glow pulse stop under reduced motion. ----
  function tick(now) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    if (!visible) return;
    for (const t of [...tweens]) {
      const k = Math.min(1, (now - t.start) / t.duration); t.update(t.easing(k), k);
      if (k >= 1) { tweens.delete(t); t.resolve(); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; p.v.y -= p.gravity * dt; p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; p.m.material.opacity = Math.max(0, 1 - p.age / p.life);
      if (p.grow) p.m.scale.setScalar(1 + p.age * p.grow);
      if (p.age >= p.life) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); particles.splice(i, 1); }
    }
    // Hovered bins open their lids a little, as if saying "in here?".
    let lidsMoving = false;
    for (const b of Object.values(bins)) if (!b.animating) { const d = b.lidTarget - b.lid.rotation.x; if (Math.abs(d) > .002) { b.lid.rotation.x += d * (reducedMotion ? 1 : .25); lidsMoving = true; } }
    if (current) {
      if (state === 'dragging' && dragging?.target) {
        const r = current.root.position; r.x += (dragging.target.x - r.x) * .35; r.z += (dragging.target.z - r.z) * .35; r.y += (dragging.lift - r.y) * .3;
        current.root.rotation.z = THREE.MathUtils.clamp((dragging.target.x - r.x) * -.25, -.3, .3);
      } else if (state === 'dragging') current.root.position.y += (1.15 - current.root.position.y) * .3;
      else if (state === 'waiting' && !reducedMotion) { current.root.rotation.y += dt * .55; current.root.rotation.z *= .85; }
      if (!reducedMotion && current.glow.length) { glowPhase += dt * 4; const k = (.55 + Math.sin(glowPhase) * .45) * current.glowScale; for (const m of current.glow) m.material.emissiveIntensity = k; }
    }
    // The turntable's ring pulses while an item waits to be picked up.
    deckRing.scale.setScalar(state === 'waiting' && !reducedMotion ? 1 + Math.sin(clock * 4) * .035 : 1);
    // Mirror the state on the canvas so tests and the tour recorder can wait for it,
    // and keep the item's screen anchor current whenever it moves or settles.
    const changed = canvas.dataset.state !== state;
    if (changed) canvas.dataset.state = state;
    const busy = tweens.size || particles.length || current || lidsMoving;
    if (busy || needsRender) { renderer.render(scene, camera); needsRender = false; }
    if (changed || (current && tweens.size) || state === 'dragging') reportLayout();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  resize(); frame = requestAnimationFrame(tick);

  function disposeTree(root) {
    root.traverse(o => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) { m.map?.dispose?.(); m.dispose?.(); } });
  }
  return {
    showItem, accept, reject,
    /** Preview a station or bin when its button is hovered or focused. */
    preview: id => { if (state === 'waiting' || state === 'empty') setHover(id); },
    get busy() { return state !== 'waiting'; },
    setVisible: value => { visible = value; needsRender = true; },
    /** Clear items left on shelves and counters before a new round. */
    resetStations: () => {
      for (const s of Object.values(stations)) { for (const placed of Object.values(s.placed || {})) { if (placed.userData.dome) { s.group.remove(placed.userData.dome); disposeTree(placed.userData.dome); } s.group.remove(placed); disposeTree(placed); } s.placed = {}; s.used = 0; }
      needsRender = true;
    },
    dispose: () => { disposed = true; cancelAnimationFrame(frame); listeners.abort(); observer.disconnect(); tweens.clear(); scene.traverse(o => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) { m.map?.dispose?.(); m.dispose?.(); } }); renderer.dispose(); },
  };
}
