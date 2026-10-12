/** Model contract checks run without a GPU; browser review verifies the rendered scene. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { createAppliance, MODEL_PARTS } from './models.js';
import { disposeObject } from './world-engine.js';
import { CATALOGUE } from './catalogue.js';
import { EXPLORE_ITEMS32 } from '../../src/explore-catalogue.js';

test('all 32 photo categories map to a complete, distinct 3D lesson', () => {
  assert.equal(CATALOGUE.length, 32);
  assert.equal(Object.keys(MODEL_PARTS).length, 32);
  assert.equal(new Set(CATALOGUE.map(item => item.id)).size, 32);
  assert.equal(new Set(EXPLORE_ITEMS32.map(item => item.worldId)).size, 32);
  assert.deepEqual(CATALOGUE.map(item => item.id).sort(), Object.keys(MODEL_PARTS).sort());
  assert.deepEqual(EXPLORE_ITEMS32.map(item => item.worldId).sort(), Object.keys(MODEL_PARTS).sort());
  for (const item of CATALOGUE) {
    assert.deepEqual(item.parts.map(part => part.id).sort(), [...MODEL_PARTS[item.id]].sort(), `${item.id} lesson/geometry contract`);
    assert.equal(new Set(item.parts.map(part => part.id)).size, item.parts.length, `${item.id} has no duplicate lesson parts`);
  }
});

test('all 32 appliances expose finite real geometry for every catalogue part within the tablet budget', () => {
  for (const [id, expected] of Object.entries(MODEL_PARTS)) {
    const model = createAppliance(id);
    let triangles = 0;
    assert.deepEqual([...model.userData.parts.keys()].sort(), [...expected].sort(), `${id} contract`);
    for (const [partId, part] of model.userData.parts) {
      let meshes = 0, solidMeshes = 0;
      part.traverse((object) => {
        if (!object.isMesh) return;
        meshes += 1;
        const position = object.geometry.attributes.position;
        assert.ok(position.count >= 3, `${id}/${partId} has a valid mesh`);
        assert.ok(position.array.every(Number.isFinite), `${id}/${partId} has no invalid vertices`);
        triangles += (object.geometry.index?.count ?? position.count) / 3;
        object.geometry.computeBoundingBox();
        const meshSize = object.geometry.boundingBox.getSize(new THREE.Vector3());
        if (meshSize.toArray().every(size => size > .001)) solidMeshes += 1;
        assert.equal(object.material.map, null, 'model shape is not an image billboard');
      });
      assert.ok(meshes > 0, `${id}/${partId} has selectable geometry`);
      // Flat screen symbols are allowed, but cannot replace the volumetric teaching part.
      assert.ok(solidMeshes > 0, `${id}/${partId} contains actual volume geometry`);
      assert.equal(part.userData.applianceId, id);
      assert.ok(part.userData.exploded.toArray().every(Number.isFinite));
      assert.ok(part.userData.anchor?.isVector3, `${id}/${partId} exposes a real 3D hotspot anchor`);
      assert.ok(part.userData.anchor.toArray().every(Number.isFinite));
    }
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(!bounds.isEmpty());
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), `${id} finite bounds`);
    assert.ok(bounds.max.y - bounds.min.y > .6, `${id} has product height`);
    assert.ok(bounds.min.y >= -.001, `${id} whole model stays above the floor`);
    assert.ok(Math.max(...bounds.getSize(new THREE.Vector3()).toArray()) <= 2.6, `${id} fits the shared camera`);
    assert.ok(triangles < 100_000, `${id} stays below the per-model triangle budget`);
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
