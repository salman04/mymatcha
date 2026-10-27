import assert from 'node:assert/strict';
import test from 'node:test';
import {createServingMotion,DELIVERY_HOME,DELIVERY_DESTINATION,DELIVERY_DURATION,DELIVERY_RETURN_DURATION} from '../dist/serving-motion.js';
import {createCameraMotion} from '../dist/camera-motion.js';
import {getShopView} from '../dist/shop-view.js';
import {GLASS_RIM_Y} from '../dist/glass-size.js';
const run=(motion,seconds,options={},fps=60)=>{for(let i=0;i<Math.round(seconds*fps);i++)motion.advance(1/fps,options);};
const near=(actual,expected,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} ≈ ${expected}`);

test('delivery waits for the camera, glides on the table, and completes exactly once',()=>{
  const motion=createServingMotion();let completions=0;
  assert.equal(motion.start(()=>{completions++;}),true);
  assert.equal(motion.start(()=>{completions+=100;}),false,'Repeated Serve cannot replace the active completion');
  run(motion,1);assert.deepEqual(motion.pose,DELIVERY_HOME);
  let last={...motion.pose},peak=0,first=0,final=0;
  for(let i=0;i<Math.round((DELIVERY_DURATION-1)*60);i++){
    motion.advance(1/60);const delta=Math.hypot(motion.pose.x-last.x,motion.pose.z-last.z);
    if(delta>0&&!first)first=delta;peak=Math.max(peak,delta);final=delta;
    assert.ok(motion.pose.x<=last.x&&motion.pose.z<=last.z,'No bounce or reversed slide');
    assert.equal(motion.pose.y,0,'Coaster stays on the table');last={...motion.pose};
  }
  assert.equal(motion.phase,'served');assert.equal(motion.active,false);assert.equal(completions,1);
  assert.deepEqual(motion.pose,DELIVERY_DESTINATION);assert.ok(first<peak*.02&&final<peak*.02,'Motion eases at both ends');
  run(motion,10);assert.equal(completions,1);
});

test('delivery pauses when hidden, cancels cleanly, and supports a short reduced-motion transition',()=>{
  const motion=createServingMotion();let completions=0;motion.start(()=>completions++);
  run(motion,2);const frozen={...motion.pose};run(motion,8,{active:false});assert.deepEqual(motion.pose,frozen);
  motion.reset();run(motion,10);assert.equal(completions,0);assert.deepEqual(motion.pose,DELIVERY_HOME);assert.equal(motion.focus,null);
  assert.equal(motion.returnHome(),false);motion.start(()=>completions++,{reducedMotion:true});
  assert.equal(completions,0,'Completion happens on an animation frame, never in start');
  run(motion,.25);assert.equal(completions,1);assert.deepEqual(motion.pose,DELIVERY_DESTINATION);
  motion.returnHome({reducedMotion:true});run(motion,.25);assert.equal(motion.phase,'idle');assert.deepEqual(motion.pose,DELIVERY_HOME);
});

test('return is continuous, duplicate returns are harmless, and frame rates agree',()=>{
  const motion=createServingMotion();motion.start();run(motion,DELIVERY_DURATION);
  const start={...motion.pose};assert.equal(motion.returnHome(),true);assert.deepEqual(motion.pose,start);assert.equal(motion.returnHome(),false);
  motion.advance(1/60);assert.ok(Math.abs(motion.pose.z-start.z)<.001);
  run(motion,DELIVERY_RETURN_DURATION);assert.deepEqual(motion.pose,DELIVERY_HOME);assert.equal(motion.phase,'idle');
  const a=createServingMotion(),b=createServingMotion();a.start();b.start();run(a,3,{},30);run(b,3,{},120);
  for(const key in a.pose)near(a.pose[key],b.pose[key]);
  a.advance(NaN);a.advance(-1);assert.ok(Object.values(a.pose).every(Number.isFinite));
});

test('camera follows the whole delivery within mobile and desktop frames and restores the saved view',()=>{
  for(const [width,height] of [[320,568],[390,844],[1280,540],[1280,720]]){
    const motion=createServingMotion(),camera=createCameraMotion();camera.setMobile(width<=700);camera.setZoom(.2);
    if(width<=700)camera.panBy(-100);
    run(camera,6);const home={...camera.pose};motion.start();const before={...camera.pose};
    camera.advance(1/60,{delivery:motion.focus});assert.ok(Math.abs(camera.pose.x-before.x)<.03,'No focus jump');
    for(let i=0;i<Math.round(DELIVERY_DURATION*60);i++){
      motion.advance(1/60);camera.advance(1/60,{delivery:motion.focus});
      if(motion.elapsed<1.05)continue;
      const view=getShopView(camera.pose,width,height),distance=Math.hypot(7.8,11.5);
      for(const y of [0,GLASS_RIM_Y]){
        const x=((motion.pose.x-view.target.x)*view.zoom/view.frustum.right+1)*width/2;
        const up=((y-view.target.y)*11.5-(motion.pose.z-view.target.z)*7.8)/distance;
        const screenY=(1-up*view.zoom/view.frustum.top)*height/2;
        assert.ok(x>width*.15&&x<width*.85,'Glass stays away from horizontal edges');
        assert.ok(screenY>190&&screenY<height-70,`Glass clears the customer banner at ${width} × ${height}`);
      }
    }
    motion.returnHome();for(let i=0;i<Math.round(DELIVERY_RETURN_DURATION*60);i++){motion.advance(1/60);camera.advance(1/60,{delivery:motion.focus});}
    run(camera,10);for(const key in home)near(camera.pose[key],home[key]);
    camera.advance(1/60,{delivery:{x:1.72,y:.6,z:-1.48,zoom:2.08},reducedMotion:true});
    near(camera.pose.x,1.72);camera.advance(1/60,{reducedMotion:true});for(const key in home)near(camera.pose[key],home[key]);
  }
});
