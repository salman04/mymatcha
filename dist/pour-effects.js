import * as THREE from './vendor/three.module.js';

import { ACTION_DURATION } from './preparation-motion.js';
export const POUR_DURATION = { serve: ACTION_DURATION.serve, cloud: ACTION_DURATION.cloud };
export function pourPhase(progress) {
  const smooth = (v) => { v = THREE.MathUtils.clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  return {
    lift: smooth(progress / .24) * (1 - smooth((progress - .79) / .21)),
    tilt: smooth((progress - .16) / .17) * (1 - smooth((progress - .77) / .20)),
    flow: progress > .32 && progress < .78,
    fill: THREE.MathUtils.clamp((progress - .37) / .41, 0, 1),
  };
}

// Clip a level tea surface to the chawan interior while it tips toward its rim.
export function createTiltedTea(material, radiusAtHeight) {
  const count = 96, vertices = new Float32Array((count + 2) * 3), normals = new Float32Array(vertices.length), uvs = new Float32Array((count + 2) * 2), indices = [];
  for (let i = 1; i <= count; i++) indices.push(0, i + 1, i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);mesh.visible=false;mesh.frustumCulled=false;
  function update(volume, angle) {
    mesh.visible=volume>.15;if(!mesh.visible)return;
    const s=Math.sin(angle),c=Math.cos(angle),level=.255+Math.min(volume/180,1)*.445;
    const h=Math.min(level*c,.79*s+.815*c)-.10*(1-Math.min(1,volume/15));
    const inside=(x,y,z)=>y>=.234&&y<=.82&&Math.hypot(x,z)<radiusAtHeight(y)-.006;
    let low=Infinity,high=-Infinity;
    for(let i=0;i<=200;i++){const x=-.82+i/200*1.64,y=(h-s*x)/c;if(inside(x,y,0)){low=Math.min(low,x);high=Math.max(high,x);}}
    if(!Number.isFinite(low)){mesh.visible=false;return;}
    const cx=(low+high)/2,cy=(h-s*cx)/c;
    for(let i=0;i<=count+1;i++){
      let x=cx,y=cy,z=0;
      if(i){const a=(i-1)/count*Math.PI*2,dx=Math.cos(a)*c,dy=-Math.cos(a)*s,dz=Math.sin(a);let lo=0,hi=2;
        for(let j=0;j<17;j++){const r=(lo+hi)/2;if(inside(cx+dx*r,cy+dy*r,dz*r))lo=r;else hi=r;}
        x+=dx*lo;y+=dy*lo;z=dz*lo;
      }
      vertices.set([x,y,z],i*3);normals.set([s,c,0],i*3);uvs.set([x/1.6+.5,z/1.6+.5],i*2);
    }
    for(const a of Object.values(geometry.attributes))a.needsUpdate=true;
  }
  return {mesh,update};
}

export function createPourEffects(scene, receivers) {
  // Reuse one small tube; its first ring is always exactly on the moving outlet.
  const segments = 32, sides = 12, positions = new Float32Array((segments + 1) * (sides + 1) * 3);
  const axes = ['x', 'y', 'z'];
  const normals = new Float32Array(positions.length), indices = [];
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  const material = new THREE.MeshPhysicalMaterial({ color: 0xe9f3dd, roughness: .13, clearcoat: .3, clearcoatRoughness: .1, transparent: true, opacity: .9, depthWrite: false });
  const stream = new THREE.Mesh(geometry, material);
  stream.name = 'pour-stream'; stream.visible = false; stream.frustumCulled = false; stream.renderOrder = 2; scene.add(stream);
  const ringGeometry = new THREE.TorusGeometry(1, .025, 5, 64);
  const ripples = {};
  for (const [key, receiver] of Object.entries(receivers)) {
    const group = new THREE.Group(); group.name = 'pour-ripples'; receiver.add(group);
    const waves = Array.from({ length: 6 }, () => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe4efcc, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(ringGeometry, mat); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.renderOrder = 3; group.add(mesh);
      return { mesh, age: 10, x: 0, z: 0, limit: .1, strength: 0, duration: 1.3, start: .018, opacity: .34, kind: 'pour' };
    });
    ripples[key] = { group, waves, clock: 1, cursor: 0 };
  }
  const start = new THREE.Vector3(), end = new THREE.Vector3(), control = new THREE.Vector3();
  const local = new THREE.Vector3(), direction = new THREE.Vector3(), point = new THREE.Vector3();
  const tangent = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3();
  let current = null, emitting = false, front = 0, tail = 0, strength = 0, rate = 0, impact = 0;
  const flightTime = .15;

  function reset({ preserveImpacts = false } = {}) {
    current = null; emitting = false; front = tail = strength = rate = impact = 0; stream.visible = false;
    for (const r of Object.values(ripples)) { r.clock = 1; for (const w of r.waves) { if (preserveImpacts && w.kind === 'ice') continue; w.age = 10; w.mesh.visible = false; } }
  }

  function addImpactRipples(key, contact, surface, reducedMotion = false) {
    const r = ripples[key];
    if (!r || reducedMotion || !surface.wet || !Number.isFinite(contact.x) || !Number.isFinite(contact.z) || !Number.isFinite(contact.strength)) return false;
    const limit = Math.min(.24, surface.radius - Math.hypot(contact.x, contact.z) - .014);
    if (!(limit > .075)) return false;
    // Two small surface crests, not a spray. The second follows more quietly.
    for (let i = 0; i < 2; i++) {
      const w = r.waves[r.cursor++ % r.waves.length];
      Object.assign(w, { kind: 'ice', age: -i * .16, x: contact.x, z: contact.z, limit, strength: THREE.MathUtils.clamp(contact.strength, 0, 1) * (i ? .55 : 1), duration: 1.7, start: .065, opacity: .42 });
      w.mesh.visible = false;
      w.mesh.material.color.set(surface.matcha ? 0xd9e8b2 : 0x8c9b80);
    }
    return true;
  }

  function update(dt, time, input, surfaces, reducedMotion = false) {
    dt = THREE.MathUtils.clamp(dt, 0, .05); rate = impact = 0;
    let ready = false;
    if (input) {
      const receiver = receivers[input.receiver], surface = surfaces[input.receiver];
      input.outlet.getWorldPosition(point); receiver.worldToLocal(local.copy(point));
      // Do not draw a jet through the rim or across the table while a tool is travelling.
      ready = local.y > surface.level + .06 && Math.hypot(local.x, local.z) < surface.radius * .90;
      if (ready) {
        if (!emitting || current?.kind !== input.kind) { front = tail = strength = 0; }
        current = { ...input };
        start.copy(point);
        direction.copy(input.direction).transformDirection(input.outlet.matrixWorld);
        const x = local.x + direction.x * .10, z = local.z + direction.z * .10;
        const distance = Math.hypot(x, z), limit = surface.radius * .43, scale = Math.min(1, limit / Math.max(.0001, distance));
        current.x = x * scale; current.z = z * scale;
        control.copy(start).addScaledVector(direction, .14);
        control.y = Math.min(start.y - .025, Math.max(surface.level + .04, control.y));
        material.color.set(input.color); material.opacity = input.kind === 'water' ? .72 : .97;
        material.emissive.copy(material.color);material.emissiveIntensity=input.kind==='water'?.02:input.kind==='serve'?.07:.18;
        material.roughness = input.kind === 'water' ? .08 : .23;
      }
    }
    emitting = ready;
    if (current) {
      const surface = surfaces[current.receiver], receiver = receivers[current.receiver];
      end.set(current.x, surface.level + .004, current.z); receiver.localToWorld(end);
      front = Math.min(1, front + dt / flightTime);
      if (emitting) strength = Math.min(1, strength + dt / .30);
      else tail = Math.min(1, tail + dt / flightTime);
      stream.visible = tail < front && tail < 1;
      if (stream.visible) {
        for (let i = 0; i <= segments; i++) {
          const u = tail + (front - tail) * i / segments, v = 1 - u;
          point.copy(start).multiplyScalar(v * v).addScaledVector(control, 2 * v * u).addScaledVector(end, u * u);
          tangent.copy(control).sub(start).multiplyScalar(2 * v).addScaledVector(direction.copy(end).sub(control), 2 * u).normalize();
          normal.set(-tangent.y, tangent.x, 0).normalize();
          if (normal.lengthSq() < .01) normal.set(1, 0, 0);
          binormal.crossVectors(tangent, normal).normalize();
          const pulse = reducedMotion ? 1 : 1 + .045 * Math.sin(time * 12 - u * 13);
          const radius = current.radius * (.35 + .65 * strength) * (1 - u * .24) * pulse;
          for (let j = 0; j <= sides; j++) {
            const angle = j / sides * Math.PI * 2, ca = Math.cos(angle), sa = Math.sin(angle), n = (i * (sides + 1) + j) * 3;
            for (let k = 0; k < 3; k++) {
              const axis = axes[k], value = normal[axis] * ca + binormal[axis] * sa;
              positions[n + k] = point[axis] + value * radius; normals[n + k] = value;
            }
          }
        }
        geometry.attributes.position.needsUpdate = geometry.attributes.normal.needsUpdate = true;
        impact = front >= 1 ? strength * (emitting ? 1 : 1 - tail) : 0;
        rate = emitting && front >= 1 ? strength : 0;
      } else current = null;
    }
    for (const [key, r] of Object.entries(ripples)) {
      const surface = surfaces[key]; r.clock += dt;
      if (!reducedMotion && current?.receiver === key && impact > .05 && surface.wet && r.clock >= .32) {
        r.clock = 0; const w = r.waves[r.cursor++ % r.waves.length];
        Object.assign(w, { kind: 'pour', age: 0, x: current.x, z: current.z, strength: impact, duration: 1.3, start: .018, opacity: .34, limit: Math.min(key === 'bowl' ? .31 : .16, surface.radius - Math.hypot(current.x, current.z) - .014) });
        w.mesh.material.color.set(current.kind === 'water' || current.kind === 'serve' ? 0xdbe9b3 : 0xa5ac93);
      }
      for (const w of r.waves) {
        w.age += dt; const progress = w.age / w.duration;
        if (reducedMotion || !surface.wet) w.age = 10;
        w.mesh.visible = !reducedMotion && surface.wet && progress >= 0 && progress < 1 && w.limit > .025;
        if (!w.mesh.visible) continue;
        const safeLimit = Math.min(w.limit, surface.radius - Math.hypot(w.x, w.z) - .014);
        w.mesh.position.set(w.x, surface.level + .006, w.z);
        w.mesh.scale.setScalar(w.start + Math.max(0, safeLimit - w.start) * progress);
        w.mesh.material.opacity = w.opacity * w.strength * Math.min(1, progress * 8) * Math.pow(1 - progress, 2);
      }
    }
  }
  return { stream, ripples, update, reset, addImpactRipples, get rate() { return rate; }, get impact() { return impact; }, get receiver() { return current?.receiver; }, get kind() { return current?.kind; } };
}
