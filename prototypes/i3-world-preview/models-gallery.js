/**
 * Developer visual QA only. This draws the actual production geometry into small
 * images with one WebGL context, avoiding 32 simultaneous GPU renderers.
 * It does not upload photos, run recognition or expose any application runtime.
 */
import * as THREE from './vendor/three.module.js';
import { createAppliance, MODEL_PARTS } from './models.js';
import { CATALOGUE } from './catalogue.js';
import { disposeObject } from './world-engine.js';

const status = document.querySelector('#status');
const gallery = document.querySelector('#gallery');
const report = document.querySelector('#report');
const buttons = [...document.querySelectorAll('[data-view]')];
const width = 320, height = 260, aspect = width / height;

/** Restrict this developer harness to a loopback preview even if accidentally served elsewhere. */
function localHost() {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
}

/** Fit all eight world-space bounding corners, including separated parts, into the image. */
function fitCamera(camera, bounds) {
  const centre = bounds.getCenter(new THREE.Vector3());
  camera.position.copy(centre).add(new THREE.Vector3(3.6, 2.25, 5.2));
  camera.lookAt(centre); camera.updateMatrixWorld(true);
  const projected = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  const size = projected.getSize(new THREE.Vector3());
  const halfHeight = Math.max(size.y, size.x / aspect) * .57;
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

/** Build a card with textContent so model labels never become executable markup. */
function cardFor(item, source, details, error = null) {
  const figure = document.createElement('figure');
  figure.dataset.model = item.id; figure.dataset.result = error ? 'error' : 'pass';
  if (source) {
    const img = document.createElement('img'); img.src = source;
    img.width = width; img.height = height; img.alt = `${item.name}: ${details.view === 'whole' ? 'assembled' : 'separated'} 3D model`;
    figure.append(img);
  }
  const caption = document.createElement('figcaption');
  const title = document.createElement('strong'); title.textContent = item.name;
  const meta = document.createElement('small');
  meta.textContent = error || `${details.parts} parts · ${details.triangles.toLocaleString()} triangles · ${details.view}`;
  caption.append(title, meta); figure.append(caption); return figure;
}

/** Keep material and illumination settings aligned with the real Explore viewer. */
function createStudio() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.38;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeef5fa);
  scene.add(new THREE.HemisphereLight(0xf3f8ff, 0x66765a, 2.25));
  const key = new THREE.DirectionalLight(0xffefce, 4.2);
  key.position.set(-3.5, 7.2, 5.2); key.castShadow = true;
  key.shadow.mapSize.set(512, 512); key.shadow.normalBias = .025;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -5, near: .1, far: 25 });
  key.shadow.bias = -.0001; scene.add(key);
  const rim = new THREE.DirectionalLight(0xc3e0f2, 1.6); rim.position.set(5, 4, -3); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xeef5fa, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100);
  return { renderer, scene, ground, camera };
}

/** Render serially and yield between cards so progress and mode controls remain understandable. */
async function run() {
  if (!localHost()) {
    status.textContent = 'Local review only. Open this page on the loopback preview server.';
    buttons.forEach(button => { button.disabled = true; }); return;
  }
  let studio;
  try { studio = createStudio(); }
  catch (error) {
    status.textContent = 'WebGL unavailable: the contact sheet could not render.';
    report.textContent = JSON.stringify({ passed: 0, errors: 1, message: String(error.message) }, null, 2);
    buttons.forEach(button => { button.disabled = true; }); return;
  }
  const { renderer, scene, ground, camera } = studio;
  let rendering = false;

  async function renderAll(view) {
    if (rendering) return;
    rendering = true;
    buttons.forEach(button => { button.disabled = true; button.setAttribute('aria-pressed', String(button.dataset.view === view)); });
    gallery.replaceChildren();
    const results = [];
    for (const item of CATALOGUE) {
      let model;
      try {
        model = createAppliance(item.id);
        if (view === 'separated') {
          // The exact same semantic offsets drive the user's "See the parts" control.
          for (const group of model.userData.parts.values()) group.position.copy(group.userData.exploded);
        }
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) throw new Error('Invalid model bounds');
        let triangles = 0;
        model.traverse(mesh => { if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; });
        const parts = model.userData.parts.size;
        if (parts !== MODEL_PARTS[item.id].length) throw new Error('Model part count does not match its contract');
        ground.position.y = bounds.min.y - .025; fitCamera(camera, bounds); scene.add(model);
        renderer.render(scene, camera);
        const source = renderer.domElement.toDataURL('image/png');
        const details = { id: item.id, name: item.name, view, parts, triangles,
          bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, passed: true };
        gallery.append(cardFor(item, source, details)); results.push(details);
      } catch (error) {
        const details = { id: item.id, view, passed: false, error: String(error.message) };
        results.push(details); gallery.append(cardFor(item, null, details, details.error));
      } finally {
        if (model) { scene.remove(model); disposeObject(model); }
        // Drop render-list references as well as GPU buffers before the next appliance.
        renderer.renderLists.dispose();
      }
      const passed = results.filter(result => result.passed).length;
      status.textContent = `${results.length}/${CATALOGUE.length} rendered · ${passed} passed · ${results.length - passed} errors`;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const passed = results.filter(result => result.passed).length;
    const triangles = results.reduce((sum, result) => sum + (result.triangles || 0), 0);
    status.textContent = `${view === 'whole' ? 'Whole' : 'Separated'}: ${passed}/${CATALOGUE.length} passed · ${results.length - passed} errors · ${triangles.toLocaleString()} total triangles`;
    report.textContent = JSON.stringify({ view, count: results.length, passed, errors: results.length - passed, triangles, results }, null, 2);
    rendering = false; buttons.forEach(button => { button.disabled = false; });
  }

  buttons.forEach(button => button.addEventListener('click', () => renderAll(button.dataset.view)));
  addEventListener('pagehide', () => { disposeObject(scene); renderer.dispose(); renderer.forceContextLoss(); }, { once: true });
  await renderAll('whole');
}

run();
