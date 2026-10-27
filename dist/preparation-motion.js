import { ICE_TRANSFER_DURATION } from './ice-transfer.js';
// Presentation pacing is separate from recipe quantities and the Challenge clock.
export const ACTION_DURATION = { sieve: 4.4, ice: ICE_TRANSFER_DURATION, serve: 5.6, cloud: 4 };
export const PREPARATION_RATE = { water: 12, milk: 16, foam: .085 };
export const CAMERA_PACE = { focus: 3, return: 2.6, linger: .55 };
export const MIXING_DURATION = 24;
export const MIXING_PAUSE = .8;
const smooth = (value, start, end) => {
  const p = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return p * p * (3 - 2 * p);
};

// A held tool accelerates gently, arrives before tilting, then retraces its path.
// Keeping velocity allows releases and quick tool changes without a position snap.
export function createToolMotion() {
  let phase = 0, velocity = 0;
  const pose = { lift: 0, tilt: 0, stroke: 0 };
  return {
    pose,
    reset() { phase = velocity = 0; Object.assign(pose, { lift: 0, tilt: 0, stroke: 0 }); },
    advance(seconds, active) {
      const dt = Math.max(0, Math.min(.1, Number.isFinite(seconds) ? seconds : 0));
      const target = active ? 1 : 0, omega = active ? 3.2 : 2.8;
      const offset = phase - target, change = velocity + omega * offset, decay = Math.exp(-omega * dt);
      phase = target + (offset + change * dt) * decay;
      velocity = (velocity - omega * change * dt) * decay;
      if (Math.abs(phase - target) < .00001 && Math.abs(velocity) < .00001) { phase = target; velocity = 0; }
      pose.lift = smooth(phase, 0, .78);
      pose.tilt = smooth(phase, .25, .98);
      pose.stroke = smooth(phase, .80, .98);
      return pose;
    },
  };
}
