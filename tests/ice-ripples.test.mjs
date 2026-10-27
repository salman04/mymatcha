import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createIceMotion} from '../dist/ice-motion.js';
import {ICE_TRANSFER_DURATION} from '../dist/ice-transfer.js';
import {createPourEffects} from '../dist/pour-effects.js';

for(const wet of [false,true])for(const top of [.24,.62,.94]){
 const ice=createIceMotion(),events=[];ice.setFill(3,top,wet);
 for(let frame=0;frame<Math.ceil(ICE_TRANSFER_DURATION*60);frame++){
  const previous=ice.poses.map(p=>({...p}));ice.advance(1/60);
  for(const contact of ice.contacts){
   const p=ice.poses[contact.index];
   assert.ok(p.visible&&p.carry===0&&p.falling,'The ripple starts during entry, before the cube settles');
   assert.ok(previous[contact.index].y-.075>top&&p.y-.075<=top,'First contact uses the bottom of the falling cube');
   assert.ok(contact.strength>=.45&&contact.strength<=1&&Math.hypot(contact.x,contact.z)<.2);
   events.push(contact.index);
  }
 }
 assert.deepEqual(events,wet?[0,1,2]:[],'Exactly one contact per falling cube, and none in an empty glass');
 ice.setFill(3,.95,true);
 for(let frame=0;frame<600;frame++){ice.advance(1/60,{pouring:1,swirl:1});assert.equal(ice.contacts.length,0,'Buoyancy and later pouring never replay entry ripples');}
 ice.reset();assert.equal(ice.contacts.length,0);ice.setFill(3,.62,true);ice.advance(1/60,{reducedMotion:true});assert.equal(ice.contacts.length,0,'Reduced motion never emits deferred contact effects');
}

const scene=new THREE.Scene(),glass=new THREE.Group(),bowl=new THREE.Group();scene.add(glass,bowl);
const fx=createPourEffects(scene,{glass,bowl}),waves=fx.ripples.glass.waves;
const surfaces={glass:{level:.62,radius:.30,wet:true,matcha:false},bowl:{level:.4,radius:.7,wet:true}};
let time=0;
const step=(seconds,reduced=false)=>{for(let n=0;n<Math.ceil(seconds*60);n++){time+=1/60;fx.update(1/60,time,null,surfaces,reduced);}};
const contact={x:.035,z:-.02,strength:.8};
for(const matcha of [false,true]){
 fx.reset();surfaces.glass.matcha=matcha;
 assert.ok(fx.addImpactRipples('glass',contact,surfaces.glass));
 step(.04);assert.equal(waves.filter(w=>w.mesh.visible).length,1,'The second wave follows with a small delay');
 step(.2);const active=waves.filter(w=>w.mesh.visible);assert.equal(active.length,2);
 assert.ok(active.every(w=>w.mesh.material.opacity>0&&w.mesh.material.opacity<.3),'Both crests remain soft');
 const before=active[0].mesh.scale.x;step(.3);assert.ok(active[0].mesh.scale.x>before,'The crest spreads across the liquid');
 surfaces.glass.level=.74;step(.05);
 for(const w of active){assert.ok(Math.abs(w.mesh.position.y-.746)<1e-10,'Waves follow the liquid height');assert.ok(Math.hypot(w.x,w.z)+w.mesh.scale.x*1.025<surfaces.glass.radius,'Even the crest thickness stays inside the glass');}
 const age=active[0].age;fx.reset({preserveImpacts:true});assert.equal(active[0].age,age,'Changing tools does not cut an existing ripple short');
 step(.2);assert.ok(active[0].mesh.material.opacity<.15,'Crests gradually fade');
 step(2);assert.ok(waves.every(w=>!w.mesh.visible),'No permanent rings remain');
}
fx.addImpactRipples('glass',contact,surfaces.glass);step(.2);fx.reset();step(.2);assert.ok(waves.every(w=>!w.mesh.visible),'Reset cancels both immediate and delayed waves');
assert.equal(fx.addImpactRipples('glass',contact,{...surfaces.glass,wet:false}),false);
assert.equal(fx.addImpactRipples('glass',contact,surfaces.glass,true),false);
assert.equal(fx.addImpactRipples('glass',{...contact,x:NaN},surfaces.glass),false);
fx.addImpactRipples('glass',contact,surfaces.glass);step(.1,true);step(.2);assert.ok(waves.every(w=>!w.mesh.visible),'Restoring motion cannot replay a suppressed wave');
assert.equal(fx.rate,0);assert.equal(fx.stream.visible,false,'Ice ripples never create a pouring stream or add liquid');
assert.equal(waves.length,6,'All impacts reuse the existing bounded ripple pool');
console.log('Ice ripples: actual liquid contact, empty glass, no idle retriggers, two gentle expanding crests, milk/matcha, height and rim bounds, reset and reduced motion passed.');
