import assert from 'node:assert/strict';
import { createToolMotion } from '../dist/preparation-motion.js';

const run = (tool, seconds, active, fps = 60) => {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) tool.advance(1 / fps, active);
  return { ...tool.pose };
};
const a = createToolMotion(), b = createToolMotion();
run(a, .5, true, 30); run(b, .5, true, 120);
for (const key in a.pose) assert.ok(Math.abs(a.pose[key] - b.pose[key]) < 1e-10, 'Pace is independent of frame rate');
assert.ok(a.pose.lift < .75 && a.pose.tilt < a.pose.lift && a.pose.stroke === 0, 'Lift gently before tilting or whisking');
run(a, 2, true);
assert.deepEqual(a.pose, { lift: 1, tilt: 1, stroke: 1 });
const previous = { ...a.pose }; a.advance(1 / 60, false);
for (const key in a.pose) assert.ok(Math.abs(a.pose[key] - previous[key]) < .01, 'Releasing never snaps a tool home');
run(a, 6, false); assert.deepEqual(a.pose, { lift: 0, tilt: 0, stroke: 0 });
for (let n = 0; n < 12; n++) { run(a, .2, true); run(a, .15, false); }
assert.ok(Object.values(a.pose).every(n => n >= 0 && n <= 1), 'Rapid reversals remain bounded');
a.reset(); assert.deepEqual(a.pose, { lift: 0, tilt: 0, stroke: 0 });
a.advance(NaN, false); assert.deepEqual(a.pose, { lift: 0, tilt: 0, stroke: 0 });
console.log('Cozy preparation: gentle staged movement, uninterrupted return, frame rates, rapid reversals and reset passed.');
