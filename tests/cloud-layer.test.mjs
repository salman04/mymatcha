import assert from 'node:assert/strict';
import {createCloudLayer,cloudHeight} from '../dist/cloud-layer.js';

const layer=createCloudLayer();layer.group.visible=true;layer.group.scale.set(.95,.05,.95);
const clone=layer.group.clone(true);
assert.equal(layer.group.getObjectByName('cloud-microbubbles').count,0,'No unpositioned bubble instances can flash on first fill');
const initial=layer.top.geometry.attributes.position.array.slice();
for(let i=0;i<90;i++)layer.update(1/60,{pouring:1});
assert.ok(layer.energy>.9);
assert.notDeepEqual(layer.top.geometry.attributes.position.array,initial);
assert.equal(clone.getObjectByName('cloud-liquid-surface').geometry,layer.top.geometry,'Serving clone follows the same living surface');
layer.syncClone(clone);
assert.equal(clone.getObjectByName('cloud-microbubbles').instanceMatrix,layer.group.getObjectByName('cloud-microbubbles').instanceMatrix,'Serving bubbles follow the animated surface');
for(const m of [layer.top,layer.side]){
 for(const attr of ['position','normal'])assert.ok(m.geometry.attributes[attr].array.every(Number.isFinite));
 for(let i=0;i<m.geometry.attributes.position.count;i++){
  const p=m.geometry.attributes.position;
  assert.ok(Math.hypot(p.getX(i),p.getZ(i))<=.316,'Cloud stays within the glass');
 }
}
const top=layer.top.geometry.attributes.position;
for(let i=0;i<top.count;i++)assert.ok(Math.abs((top.getY(i)-.5)*.05)<.007,'Waves are millimetres, not whipped peaks');
assert.ok(layer.top.geometry.attributes.normal.getY(0)>.8,'Surface faces upwards');
const snapshot=top.array.slice();layer.update(5,{active:false});assert.deepEqual(top.array,snapshot,'Background pause freezes motion');
for(let i=0;i<360;i++)layer.update(1/60);assert.ok(layer.energy<.001,'Pour disturbance settles gently');
layer.disturb(.8);assert.ok(layer.energy>.3);
layer.update(1/60,{reducedMotion:true});const reduced=top.array.slice();
for(let i=0;i<120;i++)layer.update(1/60,{pouring:1,reducedMotion:true});
assert.deepEqual(top.array,reduced,'Reduced motion retains static soft meniscus');
assert.equal(layer.energy,0);
for(const depth of [.005,.05,.08])for(const t of [0,1,4,20])for(const x of [0,.15,.315]){
 assert.ok(Math.abs(cloudHeight(x,0,t,1,depth))<Math.min(depth*.16,.0051)+.0013);
}
layer.reset();assert.equal(layer.group.visible,false);assert.equal(layer.energy,0);
console.log('Cloud: bounded liquid waves, soft rim, settling, impact response, shared serving geometry, pause, reduced motion and reset passed.');
