import { GLASS_RIM_Y } from './glass-size.js?v=challenge-1';

export const ICE_CYCLE = 3;
export const ICE_GRAB = .8;
export const ICE_RELEASE = 2.13;
export const ICE_TRANSFER_DURATION = ICE_CYCLE * 3 + .2;
export const TONGS_YAW = -.4;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
const blend = (a, b, p) => a + (b - a) * p;

// Coordinates are relative to the glass. Scene pickups use the actual stored
// cubes, so the cube and the closing jaws share one path and one clock.
export function createIceTransfer({
  home = { x: 1.59, y: .515, z: -1.64 },
  pickups = Array.from({ length: 12 }, (_, i) => ({ x: 1.2 + Math.cos(i * 2.4) * .25, y: .43, z: -1.26 + Math.sin(i * 2.4) * .25 })),
} = {}) {
  const drop = { x: 0, y: GLASS_RIM_Y + .22, z: 0 };
  const source = index => pickups[index % pickups.length];
  const high = p => ({ x: p.x, y: 1.40, z: p.z });
  function path(out, from, to, progress, arc = 0) {
    const p = ease(progress);
    out.x = blend(from.x, to.x, p); out.y = blend(from.y, to.y, p) + Math.sin(p * Math.PI) * arc; out.z = blend(from.z, to.z, p);
  }
  function sample(seconds, first = 0, out = {}) {
    const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const slot = Math.min(2, Math.floor(t / ICE_CYCLE)), local = t - slot * ICE_CYCLE;
    const pickup = source(first + slot), raised = high(pickup);
    Object.assign(out, { yaw: TONGS_YAW, opening: 1, slot });
    if (t >= ICE_CYCLE * 3) { Object.assign(out, home, { opening: .75 }); return out; }
    if (local < .55) path(out, slot === 0 ? home : raised, pickup, local / .55, slot === 0 ? .24 : 0);
    else if (local < ICE_GRAB) { Object.assign(out, pickup); out.opening = 1 - ease((local - .55) / (ICE_GRAB - .55)); }
    else if (local < 1.15) { path(out, pickup, raised, (local - ICE_GRAB) / (1.15 - ICE_GRAB)); out.opening = 0; }
    else if (local < 1.9) { path(out, raised, high(drop), (local - 1.15) / .75, .08); out.opening = 0; }
    else if (local < 2.1) { path(out, high(drop), drop, (local - 1.9) / .2); out.opening = 0; }
    else if (local < 2.4) { Object.assign(out, drop); out.opening = ease((local - 2.1) / .22); }
    else { path(out, drop, slot < 2 ? high(source(first + slot + 1)) : home, (local - 2.4) / .6, slot < 2 ? .10 : .32); out.opening = slot < 2 ? 1 : blend(1, .75, ease((local - 2.4) / .6)); }
    if (slot === 0 && local < .55) out.opening = blend(.75, 1, ease(local / .55));
    return out;
  }
  function carried(seconds, first, slot, out = {}) {
    const grab = slot * ICE_CYCLE + ICE_GRAB, release = slot * ICE_CYCLE + ICE_RELEASE;
    if (seconds < grab) Object.assign(out, source(first + slot), { yaw: TONGS_YAW });
    else sample(Math.min(seconds, release), first, out);
    out.picked = seconds >= grab; out.released = seconds >= release;
    return out;
  }
  return { sample, carried };
}
