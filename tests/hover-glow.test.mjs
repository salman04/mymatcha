import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createHoverGlow } from '../dist/hover-glow.js';
import { preparationAction, toolForObject } from '../dist/object-interactions.js';

test('all powder entry points require sifting, while pouring keeps its original actions', () => {
  for (const key of ['powder', 'scoop', 'sieve']) {
    assert.equal(toolForObject(key), 'sieve');
    assert.equal(preparationAction(key), 'sieve');
  }
  assert.equal(toolForObject('bowl'), 'transfer');
  assert.equal(toolForObject('holder'), 'whisk');
  for (const milk of ['fresh', 'almond', 'oat']) assert.equal(toolForObject(`milk-${milk}`), 'milk');
  for (const key of ['ice', 'water', 'whisk', 'serve', 'cloud']) assert.equal(preparationAction(key), key);
});

test('linked tools fade together without modifying shared materials or intercepting rays', () => {
  const material = new THREE.MeshStandardMaterial({ color: 0x507332 });
  const originalShader = material.onBeforeCompile;
  const geometry = new THREE.SphereGeometry(.2);
  const scoop = new THREE.Mesh(geometry, material), sieve = new THREE.Mesh(geometry, material);
  const unrelated = new THREE.Mesh(geometry, material);
  const glow = createHoverGlow({ scoop, sieve, unrelated }, { scoop: ['scoop', 'sieve'] });
  glow.set('scoop'); glow.update(.05);
  const a = scoop.getObjectByName('hover-glow'), b = sieve.getObjectByName('hover-glow');
  assert.ok(a.visible && b.visible);
  assert.ok(a.material.opacity > 0 && a.material.opacity < .19);
  assert.equal(a.geometry, geometry);
  assert.equal(scoop.material, unrelated.material);
  assert.equal(material.opacity, 1);
  assert.equal(material.onBeforeCompile, originalShader);
  assert.equal(unrelated.children.length, 0);
  const hits = []; a.raycast(new THREE.Raycaster(), hits); assert.equal(hits.length, 0);
  glow.set(null);
  for (let i = 0; i < 60; i++) glow.update(1 / 60);
  assert.equal(a.visible, false); assert.equal(b.material.opacity, 0);
  glow.set('scoop'); glow.update(.1);
  assert.equal(scoop.children.length, 1, 'repeated hovering reuses the same overlay');
  glow.clear(); assert.equal(a.visible, false); assert.equal(b.visible, false);
});

test('invisible hit areas stay invisible; instanced grains and moving props remain attached', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(.1,.1,.1);
  const grains = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(), 5);
  const hitArea = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ opacity: 0, colorWrite: false }));
  root.add(grains, hitArea);
  const glow = createHoverGlow({ root }); glow.set('root'); glow.update(.1, true);
  const layer = grains.getObjectByName('hover-glow');
  assert.equal(hitArea.children.length, 0);
  assert.equal(layer.instanceMatrix, grains.instanceMatrix);
  grains.count = 2; glow.update(.1, true); assert.equal(layer.count, 2);
  root.position.set(2,3,4); root.rotation.z = .4; root.updateMatrixWorld(true);
  assert.ok(layer.matrixWorld.equals(grains.matrixWorld));
  assert.equal(layer.material.opacity, .19);
  glow.set(null); glow.update(0, true); assert.equal(layer.visible, false);
  glow.set('root'); glow.update(.1, true); glow.clear();
  const result = root.clone(true);
  assert.equal(result.getObjectByName('hover-glow').visible, false, 'serving cannot clone an active glow');
});

test('glass and ice keep a restrained highlight without changing their transparency', () => {
  const material = new THREE.MeshPhysicalMaterial({ transmission: .94, opacity: .34, transparent: true });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(.2), material);
  const glow = createHoverGlow({ glass }); glow.set('glass'); glow.update(1, true);
  assert.equal(glass.getObjectByName('hover-glow').material.opacity, .018);
  assert.equal(material.transmission, .94); assert.equal(material.opacity, .34);
  glow.clear(); assert.equal(glass.getObjectByName('hover-glow').material.opacity, 0);
});
