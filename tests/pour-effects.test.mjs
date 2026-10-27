import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createPourEffects, createTiltedTea, pourPhase, POUR_DURATION } from '../dist/pour-effects.js';

const scene = new THREE.Scene(), bowl = new THREE.Group(), glass = new THREE.Group(), vessel = new THREE.Group(), outlet = new THREE.Object3D();
scene.add(bowl, glass, vessel); glass.position.set(3.28, 0, 1.24);
vessel.add(outlet); outlet.position.set(-.2, .4, .05); vessel.position.set(.25, 1, 0); vessel.rotation.z = .8;
const fx = createPourEffects(scene, { bowl, glass });
const surfaces = { bowl: { level: .4, radius: .7, wet: true }, glass: { level: .45, radius: .315, wet: true } };
const input = { kind: 'water', outlet, receiver: 'bowl', direction: new THREE.Vector3(-1, 0, 0), color: 0xc8e1d3, radius: .02 };
let time = 0;
const advance = (seconds, flow = input, reduced = false) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) { time += 1 / 60; fx.update(1 / 60, time, flow, surfaces, reduced); }
};
function ringCenter(index) {
  const result = new THREE.Vector3(), p = fx.stream.geometry.attributes.position;
  for (let i = 0; i < 12; i++) result.add(new THREE.Vector3().fromBufferAttribute(p, index * 13 + i));
  return result.divideScalar(12);
}
const near = (a, b, epsilon = .00001) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≈ ${b}`);

advance(.05); assert.equal(fx.rate, 0, 'no ingredient flow before the jet reaches the surface');
advance(.4); near(fx.rate, 1); assert.equal(fx.receiver, 'bowl');
assert.ok(ringCenter(0).distanceTo(outlet.getWorldPosition(new THREE.Vector3())) < .00001);
near(ringCenter(32).y, surfaces.bowl.level + .004);
const attr=fx.stream.geometry.attributes,ids=fx.stream.geometry.index;
const triangle=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(attr.position,ids.getX(i)));
const faceNormal=triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0]));
assert.ok(faceNormal.dot(new THREE.Vector3().fromBufferAttribute(attr.normal,ids.getX(0)))>0,'outward winding agrees with lighting normals');
let previousY = Infinity;
for (let i = 0; i <= 32; i++) { assert.ok(ringCenter(i).y < previousY); previousY = ringCenter(i).y; }

// The mouth follows both translation and tilt without leaving a gap.
for (const angle of [.4, .7, 1.1]) {
  vessel.rotation.z = angle; vessel.position.x += .02; advance(.1);
  assert.ok(ringCenter(0).distanceTo(outlet.getWorldPosition(new THREE.Vector3())) < .00001);
}
surfaces.bowl.level = .56; advance(.1);
near(ringCenter(32).y, .564);
assert.ok(fx.ripples.bowl.waves.some(w => w.mesh.visible && w.mesh.material.opacity > .01));
for (const w of fx.ripples.bowl.waves.filter(w => w.mesh.visible)) {
  near(w.mesh.position.y, .566);
  assert.ok(Math.hypot(w.x, w.z) + w.mesh.scale.x < surfaces.bowl.radius);
}

// Release leaves a short falling tail at the last outlet position, then clears it.
const lastStart = ringCenter(0); advance(1 / 60, null);
assert.equal(fx.rate, 0); assert.ok(fx.stream.visible); assert.ok(ringCenter(0).y < lastStart.y);
vessel.position.set(20, 5, 20); advance(.06, null);
assert.ok(ringCenter(0).x < 1, 'tail does not follow a returning vessel across the table');
advance(1.6, null); assert.equal(fx.stream.visible, false); assert.ok(fx.ripples.bowl.waves.every(w => !w.mesh.visible));
advance(.3, input); assert.equal(fx.stream.visible, false, 'no stream outside the receiving rim');

// Glass surface / cloud height and reduced motion use the same attachment and safe bounds.
vessel.rotation.set(0, 0, 0); outlet.position.set(0, 0, 0); vessel.position.set(3.18, 1.2, 1.20);
const milk = { ...input, kind: 'milk', receiver: 'glass', direction: new THREE.Vector3(.5, -.5, 0) };
advance(.5, milk); near(ringCenter(32).y, .454);
assert.ok(fx.ripples.glass.waves.some(w => w.mesh.visible));
surfaces.glass.level = .65; advance(.1, { ...milk, kind: 'cloud' }); advance(.2, { ...milk, kind: 'cloud' });
near(ringCenter(32).y, .654);
for (const w of fx.ripples.glass.waves.filter(w => w.mesh.visible)) assert.ok(Math.hypot(w.x, w.z) + w.mesh.scale.x < .315);
advance(.2, milk, true); assert.ok(fx.stream.visible); assert.ok(Object.values(fx.ripples).every(r => r.waves.every(w => !w.mesh.visible)));
fx.reset(); assert.equal(fx.rate, 0); assert.equal(fx.impact, 0); assert.equal(fx.stream.visible, false);

const innerRadius=y=>{const contour=[[.232,0],[.247,.475],[.32,.633],[.46,.724],[.65,.779],[.82,.793]];for(let i=1;i<contour.length;i++)if(y<=contour[i][0]){const[a,r]=contour[i-1],[b,s]=contour[i];return r+(s-r)*(y-a)/(b-a)-.014;}return .779;};
const tea=createTiltedTea(new THREE.MeshStandardMaterial(),innerRadius);
for(const angle of [0,-.2,-.5,-.95]){
  tea.update(40,angle);assert.ok(tea.mesh.visible);
  const p=tea.mesh.geometry.attributes.position,up=new THREE.Vector3(Math.sin(angle),Math.cos(angle),0),q=new THREE.Vector3().fromBufferAttribute(p,0),height=q.dot(up);
  for(let i=1;i<p.count;i++){q.fromBufferAttribute(p,i);near(q.dot(up),height);assert.ok(Math.hypot(q.x,q.z)<=innerRadius(q.y)+.0001);}
}
tea.update(0,-.95);assert.equal(tea.mesh.visible,false);

// Pour timelines arrive before opening, finish filling before returning, and preserve durations.
for (const type of ['serve', 'cloud']) {
  assert.ok(POUR_DURATION[type] > 1);
  near(pourPhase(0).lift, 0); near(pourPhase(0).tilt, 0);
  assert.equal(pourPhase(.1).flow, false); near(pourPhase(.4).lift, 1); assert.equal(pourPhase(.5).flow, true);
  near(pourPhase(.79).fill, 1); assert.equal(pourPhase(.8).flow, false); near(pourPhase(1).lift, 0); near(pourPhase(1).tilt, 0);
}
console.log('Pour effects: moving outlets, falling curve, contact/flow timing, surface height, contained ripples, draining, reset and reduced motion passed.');
