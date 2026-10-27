import assert from 'node:assert/strict';
import test from 'node:test';
import { getShopView } from '../dist/shop-view.js';
import { createCameraMotion } from '../dist/camera-motion.js';
import { GLASS_RIM_Y, GLASS_FILL_TOP } from '../dist/glass-size.js';

const HOME = { x: 0, y: 0, z: 0, zoom: 1.14 };
const tools = [
  ['tray back', -4.8, .16, -1.8], ['tray front', -4.8, .16, 1.8],
  ['matcha tin', -4.15, 1, -.9], ['chasen', -3.2, 1.25, .3],
  ['milk jug', -3.77, .7, 1.25], ['cream jug', -2.98, .6, 1.25],
  ['chawan rim', 0, .845, .22], ['chawan foot', 0, .1, .72],
  ['glass rim', 3.28, GLASS_RIM_Y, 1.24], ['glass foot', 3.28, 0, 1.24],
  ['kettle', 3.28, 1.2, -1.23], ['ice bowl', 4.48, .45, -.02],
];
function project(view, point, width, height) {
  const dy = view.position.y - view.target.y, dz = view.position.z - view.target.z, distance = Math.hypot(dy, dz);
  const up = ((point[1] - view.target.y) * dz - (point[2] - view.target.z) * dy) / distance;
  const horizontal = (point[0] - view.target.x) * view.zoom / view.frustum.right;
  const vertical = up * view.zoom / view.frustum.top;
  return { x: (horizontal + 1) * width / 2, y: (1 - vertical) * height / 2 };
}

test('the overview shows the tool range and garden sill in an undistorted elevated barista view', () => {
  for (const [width, height] of [[1280,720], [1440,900]]) {
    const view = getShopView(HOME,width,height);
    assert.deepEqual(view.target,{x:0,y:0,z:-1});
    assert.ok(Math.abs(Math.atan2(view.position.y-view.target.y,view.position.z-view.target.z)*180/Math.PI-34.15)<.1);
    assert.ok(Math.abs(view.frustum.right/view.frustum.top-width/height)<1e-10,'portrait projection retains the actual screen aspect');
    for (const [name,...point] of tools) {
      const p = project(view,point,width,height);
      assert.ok(p.x>0&&p.x<width&&p.y>0&&p.y<height,`${name} visible at ${width}×${height}: ${JSON.stringify(p)}`);
    }
    const left=project(view,[-4.5,0,0],width,height),right=project(view,[5.5,0,0],width,height);
    assert.ok(left.x>0&&right.x<width,'the full interaction range stays in frame');
    const sill=project(view,[0,.1,-3.3],width,height),bowl=project(view,[0,.845,.22],width,height);
    assert.ok(sill.y>height*.2&&sill.y<height*.5,'the garden ends above the work surface');
    assert.ok(sill.y<bowl.y);
    const panelTop=height-(width>700?200:205)-20;
    for (const point of [[0,.1,.72], [0,.845,.22], [3.28,GLASS_RIM_Y,1.24], [-2.98,.6,1.25]]) {
      assert.ok(project(view,point,width,height).y<panelTop,'important working surfaces clear the compact controls');
    }
  }
});

test('action poses focus the actual vessel while retaining the same viewing angle', () => {
  const focus = [
    [{x:.32,y:.35,z:.50,zoom:2.35},[0,.7,.22]],
    [{x:0,y:.28,z:.47,zoom:2.5},[0,.7,.22]],
    [{x:3.05,y:.48,z:1.44,zoom:2.7},[3.28,GLASS_FILL_TOP,1.24]],
    [{x:2.70,y:.90,z:1.40,zoom:1.95},[3.28,GLASS_FILL_TOP,1.24]],
    [{x:3.1,y:.48,z:1.44,zoom:3.35},[3.28,GLASS_FILL_TOP,1.24]],
  ];
  for(const [pose,point] of focus) for(const [width,height] of [[1280,720],[390,844]]) {
    const view=getShopView(pose,width,height),p=project(view,point,width,height);
    assert.deepEqual(view.target,{x:pose.x,y:pose.y,z:pose.z}); assert.equal(view.zoom,pose.zoom);
    assert.ok(Math.abs(view.position.y-view.target.y-7.8)<1e-12); assert.ok(Math.abs(view.position.z-view.target.z-11.5)<1e-12);
    assert.ok(p.x>width*.15&&p.x<width*.85&&p.y>height*.15&&p.y<height*.65,'the active liquid remains central and above the controls');
  }
});

test('the current camera spring can enter an action and return to its saved manual overview', () => {
  const motion=createCameraMotion();motion.setZoom(.21);
  const original=getShopView(motion.reset(),1280,720);
  let previous=original;
  for(let frame=0;frame<240;frame++) {
    const view=getShopView(motion.advance(1/60,{holding:true,selected:'milk'}),1280,720);
    assert.ok(Math.abs(view.target.z-previous.target.z)<.13&&Math.abs(view.zoom-previous.zoom)<.08,'the shop framing introduces no jump during the existing smooth transition');
    previous=view;
  }
  assert.ok(previous.zoom>original.zoom);
  for(let frame=0;frame<420;frame++) previous=getShopView(motion.advance(1/60),1280,720);
  assert.deepEqual(previous,original);
  motion.setZoom(-100);assert.equal(getShopView(motion.reset(),390,844).zoom,.75);
  motion.setZoom(100);assert.equal(getShopView(motion.reset(),390,844).zoom,1.8);
});

test('ingredient close-ups keep the falling material and receiver above the workbench', () => {
  for(const kind of ['powder','sieve','ice']) for(const [width,height] of [[1280,720],[818,703],[390,844]]) {
    const motion=createCameraMotion();
    for(let i=0;i<120;i++)motion.advance(1/60,{action:kind});
    const view=getShopView(motion.pose,width,height);
    const points=kind==='ice'?[[3.28,GLASS_RIM_Y,1.24],[3.28,GLASS_FILL_TOP+.55,1.24],[3.28,.19,1.24],[4.48,1.40,-.02],[5.55,.60,-.15]]:[[0,.845,.22],[0,1.35,.22],[0,.3,.22]];
    for(const point of points){
      const p=project(view,point,width,height);
      const margin=width<=700?.05:.15;
      assert.ok(p.x>width*margin&&p.x<width*(1-margin),'Ingredient and vessel remain within the frame');
      assert.ok(p.y>(kind==='ice'?120:100)&&p.y<height-(kind==='ice'?110:270),`${kind} at ${width}×${height} clears the active controls: ${JSON.stringify(p)}`);
    }
  }
});

test('short desktop windows lift the work surfaces and malformed inputs remain finite without mutating poses', () => {
  const short=getShopView(HOME,1280,540);
  assert.ok(short.target.y<0);assert.ok(project(short,[0,.1,.72],1280,540).y<540-200-20);
  const pose={x:NaN,y:Infinity,z:-Infinity,zoom:NaN},before={...pose};
  for(const [width,height] of [[0,0],[-1,-5],[NaN,Infinity],[Number.MIN_VALUE,Number.MAX_VALUE]]) {
    const view=getShopView(pose,width,height);
    assert.ok([...Object.values(view.position),...Object.values(view.target),...Object.values(view.frustum),view.zoom].every(Number.isFinite));
    assert.ok(view.frustum.top>0&&view.frustum.bottom<0&&view.frustum.far>view.frustum.near);
  }
  assert.deepEqual(pose,before);assert.doesNotThrow(()=>getShopView(null));
});
