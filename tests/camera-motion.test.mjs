import assert from 'node:assert/strict';
import { ACTION_DURATION } from '../dist/preparation-motion.js';
import { createCameraMotion } from '../dist/camera-motion.js';

const run = (camera, seconds, input = {}, fps = 60) => {
  for (let i = 0; i < Math.round(seconds * fps); i++) camera.advance(1 / fps, input);
  return { ...camera.pose };
};
const near = (actual, expected, tolerance = .001) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);
const home = (c) => { near(c.pose.x, 0); near(c.pose.y, 0); near(c.pose.z, 0); near(c.pose.zoom, c.tableZoom); };

// Selecting tools or rejected actions must leave the overview intact.
for (const selected of ['water', 'milk', 'whisk', 'transfer', 'cloud', 'powder', 'sieve', 'ice']) {
  const c = createCameraMotion(); run(c, 2, { selected }); home(c);
}

// All actual pour/whisk paths focus their destination, then restore the saved zoom.
for (const kind of ['water', 'milk', 'whisk', 'serve', 'cloud', 'powder', 'sieve', 'ice']) {
  const c = createCameraMotion(); c.setZoom(.30); run(c, 4);
  const input = ['serve', 'cloud', 'powder', 'sieve', 'ice'].includes(kind) ? { action: kind } : { holding: true, selected: kind };
  const initial = { ...c.pose }; c.advance(1 / 60, input);
  assert.ok(c.pose.zoom > initial.zoom && c.pose.zoom < initial.zoom + .02, 'no starting zoom jump');
  run(c, 3, input);
  assert.ok(c.pose.zoom > initial.zoom && c.pose.zoom >= 1.9 && c.pose.zoom <= 3.35);
  if (['milk', 'serve', 'cloud', 'ice'].includes(kind)) assert.ok(c.pose.x > 2.6);
  else assert.ok(c.pose.x < .4);
  const close = { ...c.pose }; c.advance(1 / 60);
  near(c.pose.zoom, close.zoom, .002);
  run(c, 5); home(c); near(c.tableZoom, 1.44);
}

// The close-up arrives during the longer sift and before the carried ice lands.
for (const [kind, duration] of [['powder',ACTION_DURATION.sieve],['sieve',ACTION_DURATION.sieve],['ice',ACTION_DURATION.ice]]) {
  const c=createCameraMotion(),d=createCameraMotion();
  run(c,1.4,{action:kind});assert.ok(c.pose.zoom>(kind==='ice'?2:2.2),'The close-up is established during contact, not only after the action');
  if(kind==='ice')assert.ok(c.pose.x>2.6,'The short ice drop brings the glass into focus');
  run(c,duration-1.4,{action:kind});run(d,duration,{action:kind},120);
  for(const key of Object.keys(c.pose))near(c.pose[key],d.pose[key],.000001);
  run(c,5,{selected:kind});home(c);
  for(let n=0;n<4;n++){run(c,duration,{action:kind});run(c,.12,{selected:kind});}
  run(c,5);home(c);
  run(c,.5,{action:kind});c.reset();home(c);
  run(c,duration,{action:kind,reducedMotion:true});home(c);
}

// Jumping directly from chawan to glass retains the spring velocity, then
// settles on the new receiver without accumulating a manual-zoom offset.
const switcher=createCameraMotion();run(switcher,1.7,{action:'sieve'});
const prior={...switcher.pose};switcher.advance(1/60,{action:'ice'});
assert.ok(Math.abs(switcher.pose.x-prior.x)<.03);run(switcher,1.2,{action:'ice'});run(switcher,5);home(switcher);

// Timing is stable at different frame rates, and entering/leaving never bounces.
const a = createCameraMotion(), b = createCameraMotion(), whisk = { holding: true, selected: 'whisk' };
run(a, 1, whisk, 30); run(b, 1, whisk, 120);
for (const key of Object.keys(a.pose)) near(a.pose[key], b.pose[key], .000001);
let previous = a.pose.zoom;
for (let i = 0; i < 240; i++) { a.advance(1 / 60, whisk); assert.ok(a.pose.zoom >= previous - .000001); previous = a.pose.zoom; }
run(a, .7); previous = a.pose.zoom;
for (let i = 0; i < 300; i++) { a.advance(1 / 60); assert.ok(a.pose.zoom <= previous + .000001); previous = a.pose.zoom; }
home(a);

// Repeated short actions and direct target switches retain continuity without zoom drift.
const c = createCameraMotion();
for (let i = 0; i < 20; i++) { run(c, .1, whisk); run(c, .1); }
const before = { ...c.pose };
c.advance(1 / 60, { holding: true, selected: 'milk' });
assert.ok(Math.abs(c.pose.x - before.x) < .03);
run(c, 3, { holding: true, selected: 'milk' });
c.setZoom(-.15); run(c, 6); home(c); near(c.tableZoom, .99);

// End screens/new recipes clear action focus; reduced motion keeps a static overview.
run(c, 2, whisk); c.reset(); home(c);
run(c, 2, whisk); c.advance(1 / 60, { ...whisk, reducedMotion: true }); home(c);
run(c, 3, { action: 'serve', reducedMotion: true }); home(c);
c.setZoom(100); c.advance(.1, { reducedMotion: true }); near(c.pose.zoom, 1.8);
c.setZoom(-100); c.advance(.1, { reducedMotion: true }); near(c.pose.zoom, .75);
c.setZoom(NaN); c.advance(NaN); assert.ok(Object.values(c.pose).every(Number.isFinite));
console.log('Camera: focus, smooth return, saved zoom, interruptions, frame rates, reset & reduced motion passed.');
