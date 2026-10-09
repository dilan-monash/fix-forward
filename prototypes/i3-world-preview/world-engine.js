/**
 * Shared Three.js scene for the homepage and FF Lens.
 * DOM buttons call this public API; raycasting takes taps back to the same UI.
 * Rendering is local, with no uploaded camera images or remote model service.
 */
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createAppliance, MODEL_PARTS, roundedBox } from './models.js';

const NAMES = { kettle: 'Kettle', fan: 'Fan', toaster: 'Toaster', blender: 'Blender',
  microwave: 'Microwave', vacuum: 'Vacuum', hairdryer: 'Hairdryer', laptop: 'Laptop' };

/** Release GPU allocations when a route closes. Materials can be shared by scene objects. */
export function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!mat) continue;
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach((value) => value.dispose()); geometries.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
}

/** Scene furniture is deliberately non-interactive; only actual appliance meshes select. */
function furniture(parent, dimensions, colour, position, options = {}) {
  const object = new THREE.Mesh(roundedBox(...dimensions, .05),
    new THREE.MeshStandardMaterial({ color: colour, roughness: .7, ...options }));
  object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}

/** Small canvas labels are textures inside the real scene, never a substitute for models. */
function label(text, width = 1.4) {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 94;
  const context = canvas.getContext('2d'); context.clearRect(0, 0, 400, 94);
  context.fillStyle = '#203e35'; context.font = '600 32px Arial'; context.textAlign = 'center';
  context.fillText(text, 200, 56);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false }));
  sprite.scale.set(width, width * 94 / 400, 1); return sprite;
}

/** A sculptural plant, rug and cabinet details provide depth without large texture files. */
function addRoomDetails(room) {
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, .025, 64),
    new THREE.MeshStandardMaterial({ color: 0xb5c6ae, roughness: 1 }));
  rug.position.set(1.4, .026, 1.35); rug.scale.z = .67; rug.receiveShadow = true; room.add(rug);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.36, .27, .65, 32),
    new THREE.MeshStandardMaterial({ color: 0xc18665, roughness: .8 }));
  pot.position.set(-5.12, .33, -.93); pot.castShadow = true; room.add(pot);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x638b59 : 0x396d52, roughness: .7 }));
    const angle = i * 2.4;
    leaf.scale.set(.13, .67, .13); leaf.position.set(-5.12 + Math.sin(angle) * .24, 1.0 + i * .06, -.93 + Math.cos(angle) * .24);
    leaf.rotation.set(Math.cos(angle) * .42, 0, Math.sin(angle) * .42); leaf.castShadow = true; room.add(leaf);
  }
  // Decorative window planes and mullions catch shadows and make the space read as a room.
  furniture(room, [2.1, 2.25, .04], 0xe7f2eb, [3.95, 3.0, -2.79]);
  for (const x of [2.92, 3.95, 4.98]) furniture(room, [.06, 2.3, .08], 0xf7f3e7, [x, 3, -2.72]);
  furniture(room, [2.1, .06, .08], 0xf7f3e7, [3.95, 3, -2.71]);
  // One framed abstract print adds visual warmth without childlike mascots.
  furniture(room, [1.2, 1.15, .09], 0xd3b98d, [-4.04, 3.1, -2.71]);
  furniture(room, [1.05, 1.0, .035], 0xf6ead8, [-4.04, 3.1, -2.64]);
  const artCircle = new THREE.Mesh(new THREE.CircleGeometry(.28, 32), new THREE.MeshBasicMaterial({ color: 0xca8465 }));
  artCircle.position.set(-4.03, 3.17, -2.611); room.add(artCircle);
}

/** Build one navigable room with eight selectable appliances spread across work surfaces. */
function buildRoom() {
  const room = new THREE.Group(); room.name = 'Learning home';
  furniture(room, [11.8, .14, 7.6], 0xe6ddc9, [0, -.09, .25]);
  furniture(room, [11.8, 4.8, .15], 0xb3c4b3, [0, 2.35, -2.9]);
  furniture(room, [.15, 4.8, 5.4], 0xc8d2bf, [-5.83, 2.35, -.2]);
  // The kitchen counter supports four appliances. Warm timber edges remain clearly visible.
  furniture(room, [6.95, .16, 1.76], 0xbf9368, [-1.37, 1.13, -1.34]);
  furniture(room, [6.65, 1.05, 1.55], 0xf2eedf, [-1.37, .53, -1.38]);
  for (let i = 0; i < 5; i++) {
    const x = -3.9 + i * 1.23;
    furniture(room, [.018, .87, .025], 0xd1d4c4, [x, .56, -.594]);
    furniture(room, [.34, .035, .04], 0x9c8c6f, [x + .52, .9, -.565]);
  }
  // A desk, side table and storage stand make the right half a living/study area.
  furniture(room, [2.9, .13, 1.56], 0xd2b68a, [3.7, 1.09, -1.63]);
  for (const x of [2.45, 4.94]) furniture(room, [.12, 1.06, 1.25], 0x55755e, [x, .52, -1.6]);
  furniture(room, [1.54, .11, 1.32], 0xcfa783, [2.9, .63, 1.45]);
  furniture(room, [.15, .59, .15], 0x6a7c63, [2.9, .29, 1.45]);
  addRoomDetails(room);
  const locations = {
    microwave: [-3.75, 1.22, -1.29, .72, .05], kettle: [-2.2, 1.22, -1.21, .7, .1],
    toaster: [-.65, 1.22, -1.2, .76, -.07], blender: [.93, 1.22, -1.31, .68, .05],
    laptop: [3.73, 1.18, -1.55, .86, .0], fan: [2.89, .71, 1.45, .67, -.3],
    vacuum: [.52, .08, 1.32, .75, -.12], hairdryer: [4.72, 1.21, -.91, .55, -.55],
  };
  const appliances = [];
  for (const [id, [x, y, z, scale, rotation]] of Object.entries(locations)) {
    const model = createAppliance(id); model.position.set(x, y, z); model.scale.setScalar(scale); model.rotation.y = rotation;
    room.add(model); appliances.push(model);
    const name = label(NAMES[id], id === 'hairdryer' ? 1.0 : 1.3);
    name.position.set(x, y - .08, z + .76); room.add(name);
  }
  return { room, appliances };
}

/**
 * Create the renderer and expose small intent-based methods to the frontend.
 * The caller owns headings, learning text and accessible buttons; this owns pixels.
 */
export async function createWorld(canvas, options = {}) {
  const { mode = 'explore', onSelectAppliance = () => {}, onSelectPart = () => {}, onStatus = () => {} } = options;
  let activeId = Object.hasOwn(MODEL_PARTS, options.appliance) ? options.appliance : 'kettle';
  let disposed = false, overview = mode === 'hero', exploded = false, selectedPart = null;
  let walking = false, walkYaw = 0, walkPitch = -.05;
  let visible = true, rotating = false, dirtyUntil = performance.now() + 1500;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (error) {
    onStatus({ type: 'error', message: 'This browser could not start 3D. You can still explore every part using the buttons.' });
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.38;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeef5fa);
  const camera = new THREE.PerspectiveCamera(36, 1, .03, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .075;
  controls.minPolarAngle = .2; controls.maxPolarAngle = Math.PI / 2 - .025;
  controls.minDistance = 2.0; controls.maxDistance = 18; controls.enablePan = true;
  controls.autoRotate = false;
  canvas.style.touchAction = 'none';
  const aborter = new AbortController();

  // A wide key light plus hemisphere fill gives metal edges, contact shadows and soft depth.
  scene.add(new THREE.HemisphereLight(0xf3f8ff, 0x66765a, 2.25));
  const key = new THREE.DirectionalLight(0xffefce, 4.2); key.position.set(-3.5, 7.2, 5.2); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); key.shadow.normalBias = .025;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: .1, far: 25 });
  key.shadow.bias = -.0001; scene.add(key);
  const rim = new THREE.DirectionalLight(0xc3e0f2, 1.6); rim.position.set(5, 4, -3); scene.add(rim);
  const { room, appliances } = buildRoom(); scene.add(room);
  const stage = new THREE.Group(); scene.add(stage);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, .14, 80),
    new THREE.MeshStandardMaterial({ color: 0xe0eaf1, roughness: .8 }));
  plinth.position.y = -.095; plinth.receiveShadow = true; stage.add(plinth);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0xeef5fa, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.17; floor.receiveShadow = true; stage.add(floor);
  const accent = new THREE.Mesh(new THREE.TorusGeometry(1.78, .012, 6, 80), new THREE.MeshBasicMaterial({ color: 0xb5a36f }));
  accent.rotation.x = Math.PI / 2; accent.position.y = -.018; stage.add(accent);
  let focused = createAppliance(activeId); stage.add(focused);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const fromPosition = new THREE.Vector3(), targetPosition = new THREE.Vector3();
  const fromTarget = new THREE.Vector3(), targetTarget = new THREE.Vector3();
  let transition = null, pointerStart = null, hoverPart = null;
  const activePointers = new Set();
  const roomRotors = [];
  room.traverse((object) => { if (object.userData.rotor) roomRotors.push(object); });

  /** Mark a short render window after an interaction instead of continuously burning GPU. */
  function invalidate(duration = 1000) { dirtyUntil = Math.max(dirtyUntil, performance.now() + duration); }
  controls.addEventListener('change', () => invalidate(160));
  controls.addEventListener('start', () => { transition = null; });

  /** Camera transitions establish where the selected appliance sits in the larger home. */
  function cameraTo(position, target, instant = false) {
    fromPosition.copy(camera.position); targetPosition.set(...position);
    fromTarget.copy(controls.target); targetTarget.set(...target);
    if (instant || reducedMotion.matches) {
      camera.position.copy(targetPosition); controls.target.copy(targetTarget);
      if (walking) camera.lookAt(controls.target); else controls.update();
      transition = null;
    } else transition = { start: performance.now(), duration: 820 };
    invalidate(1200);
  }

  /** Reset means the selected product view; Room is a separate explicit navigation action. */
  function resetView(instant = false) {
    walking = false; controls.enabled = true;
    overview = false; room.visible = false; stage.visible = true; focused.rotation.y = -.24;
    scene.background.setHex(0xeef5fa);
    controls.minDistance = 2.1; controls.maxDistance = 7;
    if (exploded) fitExplodedView();
    else cameraTo([2.8, 2.25, 4.2], [0, 1, 0], instant);
  }

  /** The whole room remains available so exploration is spatial, not just a product carousel. */
  function showRoom(instant = false) {
    if (renderer.xr.isPresenting) return;
    walking = false; controls.enabled = true;
    overview = true; room.visible = true; stage.visible = false;
    controls.minDistance = 5; controls.maxDistance = 18;
    cameraTo([8.4, 6.1, 10.2], [0, 1.2, -.4], instant);
    invalidate();
    onStatus({ type: 'room-overview', message: 'The whole home. Tap an appliance, or enter the room to look around.' });
  }

  /** Step into the same real scene at eye height; movement is on-screen, not camera AR. */
  function enterRoom() {
    if (disposed || renderer.xr.isPresenting) return false;
    walking = true; overview = true; room.visible = true; stage.visible = false;
    controls.enabled = false; walkYaw = 0; walkPitch = -.05;
    const start = new THREE.Vector3(0, 1.55, 3.32);
    const look = walkTarget(start);
    cameraTo(start.toArray(), look.toArray());
    onStatus({ type: 'walk-entered', message: 'You are inside the 3D room. Drag to look; use the arrows to move. Tap an appliance to explore it.' });
    return true;
  }

  /** A target one metre ahead makes the viewpoint independent of the old orbit centre. */
  function walkTarget(position) {
    return new THREE.Vector3(position.x + Math.sin(walkYaw) * Math.cos(walkPitch),
      position.y + Math.sin(walkPitch), position.z - Math.cos(walkYaw) * Math.cos(walkPitch));
  }

  /** Floor bounds and cabinet/table footprints prevent walking through the furnishings. */
  function canStandAt(x, z) {
    if (x < -5.3 || x > 5.3 || z < -2.4 || z > 3.65) return false;
    const footprints = [
      { minX: -4.97, maxX: 2.22, minZ: -2.35, maxZ: -.33 },
      { minX: 2.15, maxX: 5.3, minZ: -2.48, maxZ: -.6 },
      { minX: 1.92, maxX: 3.87, minZ: .53, maxZ: 2.36 },
    ];
    return !footprints.some((area) => x > area.minX && x < area.maxX && z > area.minZ && z < area.maxZ);
  }

  /** Intent-based movement keeps touch buttons usable without needing a keyboard or joystick. */
  function walk(direction) {
    if (!walking || !['forward', 'back', 'left', 'right'].includes(direction)) return false;
    // Complete a previous short step first so repeated taps do not lose distance.
    const position = transition ? targetPosition.clone() : camera.position.clone();
    if (direction === 'left' || direction === 'right') walkYaw += (direction === 'right' ? 1 : -1) * Math.PI / 6;
    else {
      const sign = direction === 'forward' ? 1 : -1;
      const x = position.x + Math.sin(walkYaw) * .65 * sign;
      const z = position.z - Math.cos(walkYaw) * .65 * sign;
      if (!canStandAt(x, z)) {
        onStatus({ type: 'walk-blocked', message: 'There is furniture ahead. Turn left or right to find a clear path.' });
        return false;
      }
      position.set(x, 1.55, z);
    }
    cameraTo(position.toArray(), walkTarget(position).toArray());
    if (transition) transition.duration = 280;
    onStatus({ type: 'walk-step', message: 'Drag to look around. Tap an appliance when you find one you want to explore.' });
    return true;
  }

  /** Only known catalog IDs can replace the object; old GPU resources are released immediately. */
  function setAppliance(id) {
    if (!Object.hasOwn(MODEL_PARTS, id) || disposed || renderer.xr.isPresenting) return false;
    if (id !== activeId) {
      stage.remove(focused); disposeObject(focused); focused = createAppliance(id); stage.add(focused); activeId = id;
    }
    exploded = false; selectedPart = null; hoverPart = null; setSelectedPart(null); resetView();
    return true;
  }

  /** Selected parts gain a warm glow; we never recolour the entire appliance or background. */
  function setSelectedPart(id) {
    if (id !== null && !focused.userData.parts.has(id)) return false;
    selectedPart = id;
    applyHighlight();
    invalidate(); return true;
  }

  /** A faint hover preview is distinct from the stronger persistent selected-part glow. */
  function applyHighlight() {
    focused.traverse((object) => {
      if (!object.isMesh || !object.material.emissive) return;
      const part = findPart(object);
      const chosen = selectedPart !== null && part?.partId === selectedPart;
      const hovering = hoverPart !== null && part?.partId === hoverPart;
      object.material.emissive.setHex(chosen || hovering ? 0xd09c38 : 0x000000);
      object.material.emissiveIntensity = chosen ? .32 : hovering ? .13 : 0;
    });
  }

  /** Exploded view separates diagram layers; it is never a real disassembly instruction. */
  function setExploded(value) {
    if (overview || renderer.xr.isPresenting) return;
    exploded = Boolean(value); invalidate(2200);
    if (exploded) fitExplodedView();
    else cameraTo([2.8, 2.25, 4.2], [0, 1, 0]);
  }

  /** Fit the entire separated model; lift lower layers so the floor never hides a selected part. */
  function fitExplodedView() {
    const positions = [...focused.userData.parts.values()].map((group) => [group, group.position.clone()]);
    const previousY = focused.position.y;
    focused.position.y = 1.02;
    for (const [group] of positions) group.position.copy(group.userData.exploded);
    focused.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(focused);
    const centre = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.07;
    const direction = new THREE.Vector3(2.8, 1.25, 4.2).normalize().multiplyScalar(distance);
    const destination = centre.clone().add(direction);
    for (const [group, position] of positions) group.position.copy(position);
    focused.position.y = previousY; focused.updateMatrixWorld(true);
    controls.maxDistance = Math.max(7, distance + 1);
    cameraTo(destination.toArray(), centre.toArray());
  }

  /** Optional rotation is off while reading. The home has only a subtle ambient movement. */
  function setRotation(value) { rotating = Boolean(value); invalidate(); }

  /** Follow mesh ancestors to the catalog identifiers instead of relying on mesh names. */
  function findPart(object) {
    for (let node = object; node; node = node.parent) if (node.userData.partId) return node.userData;
    return null;
  }

  /** Translate a client tap to a ray through the canvas into the actual visible mesh. */
  function hitAt(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(overview ? appliances : [focused], true);
    return hits.map((hit) => findPart(hit.object)).find(Boolean) || null;
  }

  /** A drag or pinch orbits the scene; only a short stationary tap chooses a part. */
  canvas.addEventListener('pointerdown', (event) => {
    activePointers.add(event.pointerId);
    pointerStart = activePointers.size === 1
      ? { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId } : null;
    invalidate();
  }, { signal: aborter.signal });
  canvas.addEventListener('pointerup', (event) => {
    activePointers.delete(event.pointerId);
    if (!pointerStart || event.pointerId !== pointerStart.id || renderer.xr.isPresenting) return;
    const isTap = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 9 && performance.now() - pointerStart.time < 700;
    pointerStart = null; if (!isTap) return;
    const hit = hitAt(event); if (!hit) return;
    if (overview) {
      if (mode !== 'hero') setAppliance(hit.applianceId);
      onSelectAppliance(hit.applianceId);
    } else { setSelectedPart(hit.partId); onSelectPart({ applianceId: activeId, partId: hit.partId }); }
  }, { signal: aborter.signal });
  canvas.addEventListener('pointercancel', (event) => { activePointers.delete(event.pointerId); pointerStart = null; }, { signal: aborter.signal });
  canvas.addEventListener('pointermove', (event) => {
    if (walking && pointerStart?.id === event.pointerId && (event.buttons || event.pointerType === 'touch')) {
      const previousX = pointerStart.previousX ?? pointerStart.x;
      const previousY = pointerStart.previousY ?? pointerStart.y;
      walkYaw -= (event.clientX - previousX) * .006;
      walkPitch = THREE.MathUtils.clamp(walkPitch + (event.clientY - previousY) * .004, -.62, .5);
      pointerStart.previousX = event.clientX; pointerStart.previousY = event.clientY;
      transition = null; controls.target.copy(walkTarget(camera.position)); camera.lookAt(controls.target); invalidate();
      return;
    }
    if (event.pointerType !== 'mouse' || event.buttons || renderer.xr.isPresenting) return;
    const hit = hitAt(event); canvas.style.cursor = hit ? 'pointer' : 'grab';
    if (!overview && hoverPart !== hit?.partId) {
      hoverPart = hit?.partId || null;
      applyHighlight();
      invalidate(100);
    }
  }, { signal: aborter.signal });

  /** Resize to the visible canvas, capping resolution so tablet GPUs stay responsive. */
  function resize() {
    if (disposed || renderer.xr.isPresenting) return;
    const bounds = canvas.getBoundingClientRect(); const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) invalidate(); });
  visibilityObserver.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); }, { signal: aborter.signal });

  // WebXR is an optional real camera experience, not a renamed desktop 3D viewer.
  let isARSupported = false, arStarting = false, arSession = null, hitTestSource = null, xrReference = null, arObject = null;
  const reticle = new THREE.Mesh(new THREE.RingGeometry(.075, .09, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf7d371, side: THREE.DoubleSide }));
  reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);

  /** Restore the local studio when the operating system ends the camera session. */
  function endAR() {
    const source = hitTestSource; hitTestSource = null; xrReference = null; arSession = null; reticle.visible = false;
    try { source?.cancel(); } catch { /* The browser may already have cancelled its session resources. */ }
    if (disposed) return;
    if (arObject) { scene.remove(arObject); disposeObject(arObject); arObject = null; }
    scene.background = new THREE.Color(0xeef5fa); controls.enabled = true; resetView(true); resize();
    onStatus({ type: 'ar-ended', message: 'You are back in the 3D studio.' });
  }

  /** User action starts a permissioned WebXR session and requests real surface hit testing. */
  async function enterAR() {
    if (disposed || !isARSupported || !navigator.xr) {
      onStatus({ type: 'ar-unavailable', message: 'Camera AR is not supported here. The full 3D studio still works.' }); return false;
    }
    if (arSession || arStarting) return false; // Double taps must not create competing camera sessions.
    arStarting = true;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor'] });
      arSession = session;
      if (disposed) { await session.end(); return false; }
      session.addEventListener('end', endAR, { once: true });
      walking = false; room.visible = false; stage.visible = false; scene.background = null; controls.enabled = false;
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session);
      if (disposed || arSession !== session) { try { await session.end(); } catch {} return false; }
      const [viewerSpace, referenceSpace] = await Promise.all([
        session.requestReferenceSpace('viewer'), session.requestReferenceSpace('local'),
      ]);
      const source = await session.requestHitTestSource({ space: viewerSpace });
      // A route can close during permission/device setup; release late results instead of attaching them.
      if (disposed || arSession !== session) {
        try { source.cancel(); await session.end(); } catch {} return false;
      }
      xrReference = referenceSpace; hitTestSource = source;
      arObject = new THREE.Group(); arObject.matrixAutoUpdate = false; arObject.visible = false;
      const model = createAppliance(activeId); model.scale.setScalar(.22); arObject.add(model); scene.add(arObject);
      session.addEventListener('select', () => {
        if (!reticle.visible || !arObject) return;
        arObject.matrix.copy(reticle.matrix); arObject.visible = true;
        onStatus({ type: 'ar-placed', message: 'Placed. Walk around your learning model; tap another surface to move it.' });
      });
      onStatus({ type: 'ar-searching', message: 'Move your device slowly to find a surface, then tap to place the model.' });
      return true;
    } catch (error) {
      if (arSession) { try { await arSession.end(); } catch {} }
      endAR();
      if (disposed) return false;
      onStatus({ type: 'ar-unavailable', message: error?.name === 'NotAllowedError'
        ? 'Camera AR permission was declined. You can continue in the 3D studio.'
        : 'Camera AR could not start on this device. Continue exploring in 3D.' });
      return false;
    } finally { arStarting = false; }
  }

  let lastTime = 0;
  /** One frame loop services ordinary animation and XR. Still/off-screen views skip rendering. */
  function render(time, frame) {
    if (disposed) return;
    const delta = Math.min((time - lastTime) / 1000 || .016, .05); lastTime = time;
    if (renderer.xr.isPresenting) {
      if (frame && hitTestSource && xrReference) {
        const hits = frame.getHitTestResults(hitTestSource); reticle.visible = hits.length > 0;
        if (hits.length) {
          const pose = hits[0].getPose(xrReference);
          if (pose) reticle.matrix.fromArray(pose.transform.matrix);
        }
      }
      renderer.render(scene, camera); return;
    }
    if (!visible || document.hidden) return;
    const ambient = mode === 'hero' && !reducedMotion.matches;
    if (!ambient && !rotating && !transition && time > dirtyUntil) return;
    if (transition) {
      const progress = Math.min(1, (time - transition.start) / transition.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(fromPosition, targetPosition, eased); controls.target.lerpVectors(fromTarget, targetTarget, eased);
      if (progress === 1) transition = null;
    }
    if (!overview) {
      if (rotating && !reducedMotion.matches) focused.rotation.y += delta * .28;
      const liftedY = exploded ? 1.02 : 0;
      focused.position.y = reducedMotion.matches ? liftedY : THREE.MathUtils.lerp(focused.position.y, liftedY, 1 - Math.exp(-delta * 7));
      for (const group of focused.userData.parts.values()) {
        const target = exploded ? group.userData.exploded : group.userData.rest;
        if (reducedMotion.matches) group.position.copy(target);
        else group.position.lerp(target, 1 - Math.exp(-delta * 7));
      }
    }
    if (ambient) {
      for (const rotor of roomRotors) rotor.rotation.z += delta * .45;
    }
    if (walking) camera.lookAt(controls.target); else controls.update(delta);
    renderer.render(scene, camera);
  }

  resize(); overview ? showRoom(true) : resetView(true);
  renderer.setAnimationLoop(render);
  onStatus({ type: 'ready', message: 'Drag to look around. Tap an appliance or part to explore.' });
  try { isARSupported = Boolean(window.isSecureContext && navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); }
  catch { isARSupported = false; }
  if (!disposed) onStatus({ type: isARSupported ? 'ar-available' : 'ar-unavailable', message: isARSupported
    ? 'Camera AR is available on this device.' : 'Camera AR needs a compatible device and browser. The 3D studio works here.' });

  /** Route cleanup ends rendering, DOM listeners, observers and any permissioned XR session. */
  function dispose() {
    if (disposed) return; disposed = true;
    aborter.abort(); resizeObserver.disconnect(); visibilityObserver.disconnect(); controls.dispose();
    renderer.setAnimationLoop(null); arSession?.end().catch(() => {});
    try { hitTestSource?.cancel(); } catch { /* The XR session might have already released this source. */ }
    hitTestSource = null; disposeObject(scene); renderer.dispose(); renderer.forceContextLoss();
  }
  return { setAppliance, setSelectedPart, selectPart: setSelectedPart, setExploded, setRotation,
    showRoom, enterRoom, walk, get isWalking() { return walking; }, resetView, enterAR, isARSupported, dispose };
}
