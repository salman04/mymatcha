import assert from 'node:assert/strict';
import test from 'node:test';
import {createTableGesture} from '../dist/table-gesture.js';
import {createCameraMotion} from '../dist/camera-motion.js';
import {getShopView} from '../dist/shop-view.js';

test('tap, horizontal swipe and deliberate hold are distinct, including on tools',()=>{
 const calls=[],g=createTableGesture({onTap:x=>calls.push(['tap',x]),onPan:x=>calls.push(['pan',x]),onHold:x=>calls.push(['hold',x]),onRelease:()=>calls.push(['release'])});
 const start=(hit='water',holdable=true)=>g.start({id:1,x:100,y:300,time:0,hit,holdable});
 start();g.move(1,104,302);g.end(1);assert.deepEqual(calls,[['tap','water']]);calls.length=0;
 start();g.move(1,140,302);g.advance(1000);g.end(1);assert.deepEqual(calls,[['pan',40]],'Swipe starting on a pitcher cannot pour');calls.length=0;
 start();g.advance(359);assert.equal(calls.length,0);g.advance(360);g.move(1,180,310);g.advance(1000);g.end(1);assert.deepEqual(calls,[['hold','water'],['release']],'Once a deliberate hold starts, stirring/held pouring owns movement');calls.length=0;
 start('sieve',false);g.advance(1000);assert.equal(calls.length,0);g.end(1);assert.deepEqual(calls,[['tap','sieve']]);calls.length=0;
 start();g.move(1,101,340);g.end(1);assert.equal(calls.length,0,'Vertical scrolling cannot accidentally add an ingredient');
 start(null,false);g.move(1,80,300);g.end(1);assert.deepEqual(calls,[['pan',-20]],'Empty table is draggable');calls.length=0;
 start();g.advance(400);g.cancel();g.end(1);assert.deepEqual(calls,[['hold','water'],['release']]);calls.length=0;
 start();assert.equal(g.start({id:2,x:0,y:0,time:0}),false);g.move(2,900,0);g.end(2);assert.equal(calls.length,0);g.cancel();g.advance(500);assert.equal(g.active,false);
});

test('mobile begins close to both vessels and all tool areas remain reachable',()=>{
 const camera=createCameraMotion();camera.setMobile(true);
 for(const [w,h] of [[320,568],[390,844],[430,932],[700,700]]){
  const view=getShopView(camera.pose,w,h),span=2*view.frustum.right/view.zoom;
  assert.equal(view.target.x,1.35);assert.ok(span<6,'Counter is substantially closer than the desktop overview');
  for(const x of [-.85,3.65])assert.ok(Math.abs(x-view.target.x)<span/2,'Both vessels fit at the initial zoom');
 }
 camera.panBy(-100);for(let i=0;i<240;i++)camera.advance(1/60);assert.equal(camera.pose.x,-3.65);
 let v=getShopView(camera.pose,390,844);assert.ok(v.target.x-v.frustum.right/v.zoom< -4.8);
 const previous={...camera.pose};camera.panBy(100);camera.advance(1/60);assert.ok(camera.pose.x>previous.x&&camera.pose.x<previous.x+.1,'Pan starts smoothly');
 for(let i=0;i<300;i++)camera.advance(1/60);assert.equal(camera.pose.x,3.85);
 v=getShopView(camera.pose,390,844);assert.ok(v.target.x+v.frustum.right/v.zoom>5.55,'Ice bucket and tongs stay reachable');
 for(let i=0;i<200;i++)camera.advance(1/60,{action:'sieve'});assert.ok(camera.pose.x<.01);
 for(let i=0;i<600;i++)camera.advance(1/60);assert.equal(camera.pose.x,3.85,'After preparation return to the saved browsing position');
 camera.center();for(let i=0;i<300;i++)camera.advance(1/60);assert.equal(camera.pose.x,1.35);
 camera.panBy(-2);camera.advance(1/60,{reducedMotion:true});assert.ok(Math.abs(camera.pose.x+.65)<1e-12,'Reduced motion supports immediate navigation');
 camera.setMobile(false);assert.deepEqual(camera.pose,{x:0,y:0,z:0,zoom:1.14});camera.panBy(3);assert.equal(camera.tableX,0,'Desktop has no mobile pan');
});
