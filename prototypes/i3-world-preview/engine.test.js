/** Model contract checks run without a GPU; browser review verifies the rendered scene. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { createAppliance, MODEL_PARTS } from './models.js';
import { disposeObject } from './world-engine.js';

test('all eight appliances expose distinct real geometry for every catalog part', () => {
  assert.equal(Object.keys(MODEL_PARTS).length, 8);
  for (const [id, expected] of Object.entries(MODEL_PARTS)) {
    const model = createAppliance(id);
    assert.deepEqual([...model.userData.parts.keys()].sort(), [...expected].sort(), `${id} contract`);
    for (const [partId, part] of model.userData.parts) {
      let meshes = 0;
      part.traverse((object) => {
        if (!object.isMesh) return;
        meshes += 1;
        assert.ok(object.geometry.attributes.position.count > 8, `${id}/${partId} is real volume geometry`);
        assert.equal(object.material.map, null, 'model shape is not an image billboard');
      });
      assert.ok(meshes > 0, `${id}/${partId} has selectable geometry`);
      assert.equal(part.userData.applianceId, id);
      assert.ok(part.userData.exploded.toArray().every(Number.isFinite));
    }
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(!bounds.isEmpty());
    assert.ok(bounds.max.y - bounds.min.y > .6, `${id} has product height`);
    disposeObject(model);
  }
});

test('model factory rejects unknown IDs instead of silently showing the wrong appliance', () => {
  assert.throws(() => createAppliance('random-product'), /Unknown appliance/);
  assert.throws(() => createAppliance('__proto__'), /Unknown appliance/);
});

test('instances own their resources and disposal releases each allocation only once', () => {
  const one = createAppliance('kettle'), two = createAppliance('kettle');
  const materialOne = one.userData.parts.get('body').children[0].material;
  const materialTwo = two.userData.parts.get('body').children[0].material;
  assert.notEqual(materialOne, materialTwo);
  let disposed = 0;
  materialOne.addEventListener('dispose', () => { disposed += 1; });
  disposeObject(one);
  assert.equal(disposed, 1);
  assert.equal(materialTwo.emissive.getHex(), 0);
  disposeObject(two);
});
