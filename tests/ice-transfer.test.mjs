import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createIceTransfer, ICE_GRAB, ICE_CYCLE, ICE_RELEASE, ICE_TRANSFER_DURATION } from '../dist/ice-transfer.js';
import { createIceMotion, createIceBatchCue } from '../dist/ice-motion.js';
import { createIceTongs } from '../dist/ice-tongs.js';
import { GLASS_RIM_Y } from '../dist/glass-size.js';

const transfer=createIceTransfer(),tongs=createIceTongs(new THREE.MeshStandardMaterial());
const home=transfer.sample(0),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
for(const first of [0,3,6,9]){
 let previous=transfer.sample(0,first);
 for(let time=0;time<=ICE_TRANSFER_DURATION;time+=1/120){
  const pose=transfer.sample(time,first);
  assert.ok(distance(pose,previous)<.08,'No jump when lifting, switching cubes, releasing or returning');previous=pose;
  for(let slot=0;slot<3;slot++){
   const cube=transfer.carried(time,first,slot);
   if(cube.picked&&!cube.released){
    tongs.group.position.set(pose.x,pose.y,pose.z);tongs.group.rotation.y=pose.yaw;tongs.open(pose.opening);tongs.group.updateMatrixWorld(true);
    assert.ok(distance(cube,tongs.grip.getWorldPosition(new THREE.Vector3()))<1e-10,'Carried ice stays exactly between the actual jaws');
    assert.ok(pose.opening<.07,'Ice stays held until the jaws begin opening');
   }
  }
 }
 for(let slot=0;slot<3;slot++){
  const release=slot*ICE_CYCLE+ICE_RELEASE,drop=transfer.carried(release,first,slot);
  assert.ok(drop.released&&drop.y>GLASS_RIM_Y+.15&&Math.hypot(drop.x,drop.z)<.01,'Every release is centred above the rim');
  assert.equal(transfer.carried(slot*ICE_CYCLE+ICE_GRAB-.001,first,slot).picked,false,'Stored ice waits for the jaws to close');
 }
 assert.ok(distance(home,transfer.sample(ICE_TRANSFER_DURATION,first))<1e-12,'Tongs return to their exact resting position');
}
// Visible ice has one owner: the bucket until pickup, then the tongs, then the glass.
for(const wet of [false,true]){
 const ice=createIceMotion({transfer}),cue=createIceBatchCue(),events=[];
 ice.setFill(3,wet?.8:.3,wet);cue.start(0,3,{individual:true});
 for(let frame=0;frame<Math.ceil(ICE_TRANSFER_DURATION*60);frame++){
  const wasFalling=ice.poses.map(p=>p.falling);ice.advance(1/60);
  ice.poses.slice(0,3).forEach((p,i)=>{
   assert.equal(p.visible,p.picked,'No duplicate floating cube before pickup');
   if(p.carry>0&&p.picked)assert.ok(distance(p,ice.tongs)<1e-10,'Actual scene cube follows the shared tong pose');
   if(wasFalling[i]&&!p.falling){const event=cue.landing(i);if(event)events.push({...event,frame});}
  });
  if(frame===70){const pose=structuredClone(ice.poses);ice.setFill(3,wet?.8:.3,wet);assert.deepEqual(ice.poses,pose,'Refresh does not restart a pickup');}
 }
 assert.equal(events.length,3);assert.ok(events.every(e=>e.count===1));assert.equal(new Set(events.map(e=>e.batchId)).size,3);
 assert.ok(events[1].frame-events[0].frame>150&&events[2].frame-events[1].frame>150,'Sounds follow separate actual landings');
 for(let frame=0;frame<120;frame++)ice.advance(1/60);assert.equal(cue.landing(0),null,'No duplicate impact');
 assert.ok(ice.poses.slice(0,3).every(p=>!p.falling&&p.carry===0));
 ice.setFill(6,.8,true);ice.advance(.05);ice.reset();cue.clear();
 assert.ok(distance(ice.tongs,home)<1e-12&&ice.poses.every(p=>!p.visible&&!p.picked),'Reset restores both tongs and storage visibility');
 ice.setFill(3,.8,true);ice.advance(1/60,{reducedMotion:true});
 assert.ok(ice.poses.slice(0,3).every(p=>p.visible&&!p.falling));assert.ok(distance(ice.tongs,home)<1e-12,'Reduced motion keeps the tongs parked');
}
console.log('Ice tongs: shared grip geometry, continuous three-pickup path, rim clearance, ownership, actual landing audio, reset and reduced motion passed.');
