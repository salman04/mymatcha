import assert from 'node:assert/strict';
import {createIceMotion,createIceBatchCue} from '../dist/ice-motion.js';
import {ICE_TRANSFER_DURATION} from '../dist/ice-transfer.js';
import {newRecipe,ORDERS,rateOrder} from '../dist/recipe.js';
import {GLASS_FILL_TOP,GLASS_RIM_Y} from '../dist/glass-size.js';
const step=(ice,seconds,options={})=>{for(let t=0;t<seconds;t+=1/60)ice.advance(1/60,options);};
const snapshot=ice=>ice.poses.map(p=>({...p}));
// A handful travels from the dish first, then releases separate cubes. A fill
// refresh must not restart the carry, and reset must cancel the entire trip.
const carried=createIceMotion();carried.setFill(3,.3,false);
step(carried,.6);assert.ok(carried.poses.slice(0,3).every(p=>p.carry>0&&p.falling&&p.x>.4));
const inFlight=snapshot(carried);carried.setFill(3,.3,false);assert.deepEqual(snapshot(carried),inFlight);
step(carried,2);assert.ok(carried.poses[0].carry===0&&carried.poses[1].carry>0,'Cubes are released one by one by the tongs');
step(carried,ICE_TRANSFER_DURATION-2.6);assert.ok(carried.poses.slice(0,3).every(p=>p.carry===0&&!p.falling),'All three land before the action finishes');
carried.setFill(6,.3,false);carried.reset();step(carried,5);assert.ok(carried.poses.every(p=>!p.visible&&p.carry===0));
const ice=createIceMotion();
ice.setFill(6,.216,false);step(ice,ICE_TRANSFER_DURATION+1);
assert.equal(ice.poses.filter(p=>p.visible).length,6);
assert.ok(ice.poses.every(p=>p.y>=.19&&p.y<.35&&!p.falling),'Dry cubes rest at the base, with room to stack');
const dry=snapshot(ice);step(ice,5,{pouring:1});
assert.ok(ice.poses.every((p,i)=>Math.abs(p.y-dry[i].y)<.001),'Dry cubes must not bob');
const settled=snapshot(ice);ice.setFill(6,.62,true);assert.deepEqual(snapshot(ice),settled,'Changing fill never teleports a settled cube');
// Increase the liquid over a real pour, not just one fixed endpoint.
ice.setFill(6,.22,true);step(ice,2);
const before=ice.poses.map(p=>p.y);
for(let frame=0;frame<240;frame++){
 ice.setFill(6,.22+frame/239*.4,true);ice.advance(1/60,{pouring:1});
 ice.poses.forEach(p=>{
  assert.ok(Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite));
  assert.ok(Math.hypot(p.x,p.z)<.193&&p.y>=.19&&p.y<.68,'Ice stays in the glass while pouring');
 });
}
step(ice,3);
assert.ok(ice.poses.every((p,i)=>!p.visible||p.y>before[i]+.2&&Math.abs(p.y-.586)<.025),'Cubes rise to the liquid surface');
const start=snapshot(ice);step(ice,5,{swirl:1});
assert.ok(ice.poses.some((p,i)=>Math.hypot(p.x-start[i].x,p.z-start[i].z)>.07),'Mixing visibly carries ice along the surface');
assert.ok(ice.poses.some((p,i)=>Math.abs(p.rx-start[i].rx)>.025),'Cubes rock independently');
for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
 const a=ice.poses[i],b=ice.poses[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.15,'Full glass keeps cubes separated');
}
// Refreshes and result-camera changes must retain the same motion state.
const continuing=snapshot(ice);ice.setFill(6,.62,true);assert.deepEqual(snapshot(ice),continuing);
step(ice,8,{reducedMotion:true,pouring:1,swirl:1});
const still=snapshot(ice);step(ice,3,{reducedMotion:true,pouring:1,swirl:1});
assert.ok(ice.poses.every((p,i)=>Math.hypot(p.x-still[i].x,p.y-still[i].y,p.z-still[i].z)<.001),'Reduced motion settles without idle drift');
ice.reset();assert.ok(ice.poses.every(p=>!p.visible));
ice.setFill(0,.6,true);step(ice,15,{swirl:1});assert.ok(ice.poses.every(p=>!p.visible),'Hot drinks have no ghost ice');
ice.setFill(1,.6,true);step(ice,4);assert.equal(ice.poses.filter(p=>p.visible).length,1);
assert.ok(Math.abs(ice.poses[0].y-.562)<.025,'A cube added after pouring settles on the surface');
const s={...newRecipe(),glass:{water:60,milk:120,powder:2,foam:.7,cream:0,ice:4,first:'milk'}};
const recipe=JSON.stringify(s),rating=rateOrder(s,ORDERS[0]);ice.setFill(s.glass.ice,.55,true);step(ice,20,{swirl:1});
assert.equal(JSON.stringify(s),recipe);assert.deepEqual(rateOrder(s,ORDERS[0]),rating);
const prior=snapshot(ice);ice.advance(NaN);ice.advance(-1);assert.deepEqual(snapshot(ice),prior);
ice.advance(3600,{pouring:1});assert.ok(ice.poses.every(p=>Number.isFinite(p.y)&&p.y<.7),'Tab resume cannot launch the ice');

// The taller glass must carry floating cubes beyond the previous .68 ceiling.
const tallIce=createIceMotion();tallIce.setFill(6,.62,true);step(tallIce,ICE_TRANSFER_DURATION+1);
const tallBefore=tallIce.poses.map(p=>p.y);
assert.equal(GLASS_FILL_TOP,.97);assert.equal(GLASS_RIM_Y,1.015);
for(let frame=0;frame<300;frame++){
 tallIce.setFill(6,.62+frame/299*(GLASS_FILL_TOP-.62),true);tallIce.advance(1/60,{pouring:1});
 for(const p of tallIce.poses){
  assert.ok(Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite));
  assert.ok(Math.hypot(p.x,p.z)<.193&&p.y>=.19&&p.y<GLASS_RIM_Y,'Floating cube centres stay inside the taller glass');
 }
}
step(tallIce,4,{swirl:1});
assert.ok(tallIce.poses.every((p,i)=>!p.visible||p.y>tallBefore[i]+.3&&Math.abs(p.y-(GLASS_FILL_TOP-.034))<.03),'All six cubes follow the new full-height surface');
for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
 const a=tallIce.poses[i],b=tallIce.poses[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.15,'Six cubes remain separated at the new maximum fill');
}
const tallContinuing=snapshot(tallIce);tallIce.setFill(6,GLASS_FILL_TOP,true);assert.deepEqual(snapshot(tallIce),tallContinuing,'A full-height refresh retains motion continuity');
step(tallIce,8,{reducedMotion:true,pouring:1,swirl:1});const tallStill=snapshot(tallIce);step(tallIce,3,{reducedMotion:true,pouring:1,swirl:1});
assert.ok(tallIce.poses.every((p,i)=>Math.hypot(p.x-tallStill[i].x,p.y-tallStill[i].y,p.z-tallStill[i].z)<.001),'Reduced motion settles at the taller fill level');
tallIce.reset();tallIce.setFill(3,GLASS_FILL_TOP,true);step(tallIce,ICE_TRANSFER_DURATION+1);
assert.ok(tallIce.poses.filter(p=>p.visible).every(p=>!p.falling&&Math.abs(p.y-(GLASS_FILL_TOP-.034))<.03),'A late three-cube batch lands on a full-height drink');

// A three-cube scoop produces a single cue at the first actual landing. The
// other cubes and later idle buoyancy never retrigger the same batch's sample.
const batchIce=createIceMotion(),cue=createIceBatchCue(),events=[];
const advanceBatch=(seconds,options={})=>{
 for(let t=0;t<seconds;t+=1/60){
  const falling=batchIce.poses.map(p=>p.falling);
  batchIce.advance(1/60,options);
  batchIce.poses.forEach((p,index)=>{if(falling[index]&&!p.falling){const event=cue.landing(index);if(event)events.push({...event,time:t,index});}});
 }
};
cue.start(0,3);batchIce.setFill(3,.3,false);advanceBatch(.1);assert.equal(events.length,0,'No cue during the fall');
advanceBatch(3);assert.equal(events.length,1);assert.equal(events[0].count,3);assert.ok(events[0].time>.1,'Cue follows physical contact');
advanceBatch(5);batchIce.setFill(3,.6,true);advanceBatch(2,{pouring:1});assert.equal(events.length,1,'Idle motion and refresh do not replay the batch');
cue.start(3,3);batchIce.setFill(6,.6,true);advanceBatch(3);assert.equal(events.length,2);assert.equal(events[1].count,3);assert.notEqual(events[0].batchId,events[1].batchId,'Next handful is a new batch');
batchIce.reset();cue.start(0,3);batchIce.setFill(3,.4,true);cue.clear();advanceBatch(3);assert.equal(events.length,2,'Clearing on hide, reset or result cancels the pending cue');
batchIce.reset();cue.start(0,3);batchIce.setFill(3,.3,false);advanceBatch(.1);
cue.start(3,3);batchIce.setFill(6,.3,false);advanceBatch(3);assert.equal(events.length,3);assert.ok(events[2].count===3&&events[2].index>=3&&events[2].time>.1,'An older falling cube cannot consume a fresh handful cue');
batchIce.reset();cue.start(0,3);batchIce.setFill(3,.5,true);advanceBatch(1/60,{reducedMotion:true});assert.equal(events.length,4,'Reduced motion still produces one batch cue at contact');
console.log('Ice motion passed: dry rest, smooth filling to the taller .97 surface, buoyancy, independent drift/rock, separation, reduced motion, result continuity, reset, late ice, unchanged ratings, and one contact cue per three-cube batch.');


// Twelve cubes have room to stack and float in separate layers.
const dozen=createIceMotion();
for(const count of [3,6,9,12]){dozen.setFill(count,.34,false);step(dozen,ICE_TRANSFER_DURATION+1);assert.equal(dozen.poses.filter(p=>p.visible).length,count);}
assert.ok(dozen.poses.every(p=>p.y>=.19&&p.y<.52&&!p.falling));
for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){const a=dozen.poses[i],b=dozen.poses[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.14,'Twelve dry cubes stay separated');}
const dryDozen=snapshot(dozen);dozen.setFill(12,GLASS_FILL_TOP,true);assert.deepEqual(snapshot(dozen),dryDozen,'New fill does not teleport ice');
step(dozen,10,{swirl:1,pouring:1});
assert.ok(dozen.poses.every(p=>p.y>.7&&p.y<GLASS_RIM_Y&&Math.hypot(p.x,p.z)<.193));
for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){const a=dozen.poses[i],b=dozen.poses[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.145,'Twelve floating cubes stay separated');}
dozen.setFill(99,GLASS_FILL_TOP,true);assert.equal(dozen.poses.filter(p=>p.visible).length,12);
step(dozen,12,{reducedMotion:true});const quietDozen=snapshot(dozen);step(dozen,4,{reducedMotion:true});assert.ok(dozen.poses.every((p,i)=>Math.hypot(p.x-quietDozen[i].x,p.y-quietDozen[i].y,p.z-quietDozen[i].z)<.001));
dozen.reset();assert.ok(dozen.poses.every(p=>!p.visible));
for(const first of [0,3,6,9]){cue.start(first);assert.equal(cue.landing(first).count,3);assert.equal(cue.landing(first+1),null);}
console.log('Twelve-cube motion: four batches, dry stacking, layered buoyancy, separation, capacity clamp, reduced motion and reset passed.');
