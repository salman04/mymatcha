import { CAMERA_PACE } from './preparation-motion.js';
// Preparation camera, independent of rendering and recipe state.
const HOME_ZOOM = 1.14;
const FOCUS = {
  powder: { x: 0, y: .42, z: .44, zoom: 2.50, maxZoom: 2.60 },
  sieve: { x: 0, y: .42, z: .44, zoom: 2.50, maxZoom: 2.60 },
  ice: { x: 3.85, y: .75, z: .80, zoom: 2.15, maxZoom: 2.25 },
  water: { x: .32, y: .35, z: .50, zoom: 2.35, maxZoom: 2.55 },
  whisk: { x: 0, y: .28, z: .47, zoom: 2.50, maxZoom: 2.60 },
  milk: { x: 3.78, y: .70, z: 1.20, zoom: 2.25, maxZoom: 2.55 },
  serve: { x: 2.70, y: .90, z: 1.40, zoom: 1.95, maxZoom: 2.05 },
  cloud: { x: 3.10, y: .48, z: 1.44, zoom: 2.60, maxZoom: 3.35 },
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function createCameraMotion() {
  let tableZoom = HOME_ZOOM, focus = null, linger = 0, mobile = false, mobileX = 1.35, panTime = 0;
  const home = () => ({x: mobile ? mobileX : 0, y:0, z:0, zoom:tableZoom});
  const pose = { x: 0, y: 0, z: 0, zoom: tableZoom };
  const velocity = { x: 0, y: 0, z: 0, zoom: 0 };

  function reset() {
    focus = null; linger = 0; panTime = 0;
    Object.assign(pose, home());
    for (const key in velocity) velocity[key] = 0;
    return pose;
  }

  function advance(dt, { holding = false, selected, action, delivery = null, reducedMotion = false } = {}) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    // A selection alone never moves the camera; only a valid, active action does.
    const requested = ['powder', 'sieve', 'ice', 'serve', 'cloud'].includes(action) ? action
      : holding && ['water', 'milk', 'whisk'].includes(selected) ? selected : null;
    const deliveryTarget=delivery&&['x','y','z','zoom'].every(key=>Number.isFinite(delivery[key]))
      ? {...delivery,zoom:clamp(delivery.zoom,1.5,2.3)}:null;
    if (reducedMotion) {
      reset();
      if(deliveryTarget)Object.assign(pose,deliveryTarget);
      return pose;
    }
    if(deliveryTarget){focus=null;linger=0;panTime=0;}
    else if (requested) { focus = requested; linger = CAMERA_PACE.linger; panTime = 0; }
    else {
      linger = Math.max(0, linger - dt);
      if (linger === 0) focus = null;
    }
    const target = deliveryTarget || (focus ? { ...FOCUS[focus], zoom: clamp(FOCUS[focus].zoom * tableZoom / HOME_ZOOM, 1.5, FOCUS[focus].maxZoom) }
      : home());
    // Analytic critically damped spring: gentle acceleration, no bounce or per-frame drift.
    // Keep one spring strength until a swipe settles, avoiding a damping jump.
    const omega = deliveryTarget ? 3.8 : focus ? CAMERA_PACE.focus : panTime>0 ? 9 : CAMERA_PACE.return, decay = Math.exp(-omega * dt);
    for (const key in pose) {
      const offset = pose[key] - target[key], change = velocity[key] + omega * offset;
      pose[key] = target[key] + (offset + change * dt) * decay;
      velocity[key] = (velocity[key] - omega * change * dt) * decay;
      if (Math.abs(pose[key] - target[key]) < .00001 && Math.abs(velocity[key]) < .00001) {
        pose[key] = target[key]; velocity[key] = 0;
      }
    }
    if(mobile&&!focus&&!deliveryTarget){
      const bounded=clamp(pose.x,-3.65,3.85);if(bounded!==pose.x){pose.x=bounded;velocity.x=0;}
      if(Object.keys(pose).every(key=>pose[key]===target[key]))panTime=0;
    }
    return pose;
  }

  return {
    pose, advance, reset,
    setMobile(enabled){if(mobile!==enabled){mobile=enabled;reset();}},
    panBy(delta){if(mobile&&Number.isFinite(delta)){mobileX=clamp(mobileX+delta,-3.65,3.85);focus=null;linger=0;panTime=.4;}},
    center(){if(mobile){mobileX=1.35;focus=null;linger=0;panTime=.4;}},
    get tableX(){return mobile?mobileX:0;},
    setZoom(delta) { if (Number.isFinite(delta)) tableZoom = clamp(tableZoom + delta, .75, 1.8); },
    get tableZoom() { return tableZoom; },
  };
}
