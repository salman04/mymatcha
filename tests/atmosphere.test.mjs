import assert from 'node:assert/strict';
import test from 'node:test';
import {ATMOSPHERES,createAtmosphere,loadAtmosphere,saveAtmosphere} from '../dist/atmosphere.js';
import {createPresentationFlow} from '../dist/presentation-flow.js';
import {createServingMotion,DELIVERY_DESTINATION} from '../dist/serving-motion.js';
import {createChallenge} from '../dist/challenge.js';
const advance=(controller,seconds,options={},fps=60)=>{for(let i=0;i<seconds*fps;i++)controller.advance(1/fps,options);};

test('all atmospheres settle without sudden lighting jumps or changing the source presets',()=>{
 const original=JSON.stringify(ATMOSPHERES);
 for(const key of Object.keys(ATMOSPHERES)){
  const a=createAtmosphere(),b=createAtmosphere();a.set(key);b.set(key);
  const before=a.values.sunPower;a.advance(1/60);assert.ok(Math.abs(a.values.sunPower-before)<.07);
  advance(a,15);advance(b,15,{},120);
  for(const [name,value] of Object.entries(a.values)){
   const actual=Array.isArray(value)?value:[value],expected=Array.isArray(ATMOSPHERES[key][name])?ATMOSPHERES[key][name]:[ATMOSPHERES[key][name]];
   actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-7,`${key} ${name}`));
  }
  const frozen=JSON.stringify(a.values);a.advance(.1,{active:false});assert.equal(JSON.stringify(a.values),frozen);
  a.set('morning');a.advance(.01,{reducedMotion:true});assert.equal(a.values.rain,0);assert.equal(a.values.sunPower,3.1);
 }
 assert.equal(JSON.stringify(ATMOSPHERES),original);
});

test('atmosphere preference survives reload and tolerates blocked or invalid storage',()=>{
 const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
 assert.equal(loadAtmosphere(storage),'morning');saveAtmosphere(storage,'rain');assert.equal(loadAtmosphere(storage),'rain');
 storage.value='unexpected';assert.equal(loadAtmosphere(storage),'morning');
 const blocked={getItem(){throw Error();},setItem(){throw Error();}};
 assert.equal(loadAtmosphere(blocked),'morning');assert.doesNotThrow(()=>saveAtmosphere(blocked,'night'));
});

test('customer reacts only after arrival, camera releases after reading time, then controls return once',()=>{
 const flow=createPresentationFlow(),motion=createServingMotion(),events=[];
 flow.start({onReaction:()=>events.push('reaction'),onReturn:()=>{events.push('return');motion.releaseFocus();},onComplete:()=>events.push('complete')});
 assert.equal(motion.coasterOffset,.9);motion.start(()=>flow.arrive());advance(flow,20);assert.deepEqual(events,[],'No independent arrival timer');
 advance(motion,.5);assert.ok(motion.coasterOffset>0&&motion.coasterOffset<.9,'Coaster slides underneath while the glass lifts');assert.ok(motion.lift>0,'Glass is gently set onto the coaster before sliding');advance(motion,4.4);
 assert.deepEqual(events,['reaction']);assert.deepEqual(motion.pose,DELIVERY_DESTINATION);assert.equal(motion.lift,0);assert.equal(motion.coasterOffset,0);
 advance(flow,20,{active:false});assert.deepEqual(events,['reaction'],'Hidden page pauses the reaction');
 advance(flow,5.1);assert.deepEqual(events,['reaction','return']);assert.equal(motion.focus,null);
 assert.deepEqual(motion.pose,DELIVERY_DESTINATION,'Accepted glass remains with the customer as camera returns');
 advance(flow,3.3);assert.deepEqual(events,['reaction','return','complete']);advance(flow,20);assert.equal(events.length,3);
});

test('presentation freezes Challenge throughout reaction and camera return, including a near-deadline incorrect drink',()=>{
 for(const success of [true,false]){
  let now=0;const challenge=createChallenge(10,()=>now),flow=createPresentationFlow();challenge.start();now=179900;
  assert.equal(challenge.beginPresentation(success,{score:success?100:80,stars:success?5:4}),true);
  flow.start({onComplete:()=>challenge.finishPresentation()});flow.arrive();now+=15000;
  assert.equal(challenge.tick(),100);advance(flow,5.1);assert.equal(challenge.status,'presenting');advance(flow,3.3);
  assert.equal(challenge.status,success?'passed':'running');assert.equal(challenge.tick(),100);
 }
});

test('cancelled presentation never calls stale callbacks and reduced motion retains reading time',()=>{
 const flow=createPresentationFlow(),events=[];flow.start({onComplete:()=>events.push('stale')});flow.arrive();flow.reset();advance(flow,20);assert.deepEqual(events,[]);
 flow.start({reducedMotion:true,onReturn:()=>events.push('return'),onComplete:()=>events.push('done')});flow.arrive();advance(flow,4.9);assert.deepEqual(events,[]);advance(flow,.2);assert.deepEqual(events,['return']);advance(flow,.4);assert.deepEqual(events,['return','done']);
});
