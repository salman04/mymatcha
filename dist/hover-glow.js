import * as THREE from './vendor/three.module.js';

// Separate light layers preserve shared materials and the latte's custom shaders.
export function createHoverGlow(objects, linked = {}) {
  const entries = new Map();
  let selected = new Set();
  function prepare(key) {
    if (entries.has(key) || !objects[key]) return;
    const material = new THREE.MeshBasicMaterial({
      color: 0xffedc2, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      toneMapped: false
    });
    const glassMaterial = material.clone();
    const sources = [], layers = [];
    objects[key].traverse(source => {
      if (!source.isMesh || source.userData.hoverGlow) return;
      const materials = Array.isArray(source.material) ? source.material : [source.material];
      if (materials.every(m => !m.colorWrite || m.opacity === 0)) return;
      sources.push(source);
    });
    for (const source of sources) {
      const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
      // Glass and ice need just a trace of light to retain their transparency.
      const lightMaterial = sourceMaterials.some(m => m.transmission > .3) ? glassMaterial : material;
      const layer = source.isInstancedMesh
        ? new THREE.InstancedMesh(source.geometry, lightMaterial, source.instanceMatrix.count)
        : new THREE.Mesh(source.geometry, lightMaterial);
      if (source.isInstancedMesh) layer.instanceMatrix = source.instanceMatrix;
      layer.userData.hoverGlow = true;
      layer.name = 'hover-glow';
      layer.raycast = () => {};
      layer.visible = false;
      layer.renderOrder = 2;
      source.add(layer);
      layers.push({ source, layer });
    }
    entries.set(key, { material, glassMaterial, layers, strength: 0 });
  }
  return {
    set(key) {
      selected = new Set(key ? linked[key] || [key] : []);
      selected.forEach(prepare);
    },
    update(dt, reducedMotion = false) {
      for (const [key, entry] of entries) {
        const target = selected.has(key) ? 1 : 0;
        entry.strength = reducedMotion ? target : THREE.MathUtils.damp(entry.strength, target, 14, dt);
        if (Math.abs(entry.strength - target) < .002) entry.strength = target;
        entry.material.opacity = entry.strength * .19;
        entry.glassMaterial.opacity = entry.strength * .018;
        for (const { source, layer } of entry.layers) {
          layer.visible = entry.strength > 0;
          if (source.isInstancedMesh) layer.count = source.count;
        }
      }
    },
    clear() {
      selected.clear();
      for (const entry of entries.values()) {
        entry.strength = entry.material.opacity = entry.glassMaterial.opacity = 0;
        entry.layers.forEach(({ layer }) => { layer.visible = false; });
      }
    }
  };
}
