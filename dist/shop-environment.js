import * as THREE from 'three';

const TAU = Math.PI * 2;

function seededRandom(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function grainNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const u = tx * tx * (3 - tx * 2), v = ty * ty * (3 - ty * 2);
  const hash = (a, b) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  };
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function timberSurface() {
  const width = 512, height = 1024, color = new Uint8Array(width * height * 4);
  const normal = new Uint8Array(color.length), roughness = new Uint8Array(color.length), relief = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / (width - 1), v = y / (height - 1), index = (y * width + x) * 4;
    const knot = Math.exp(-((u - .72) ** 2 * 290 + (v - .39) ** 2 * 100));
    const flow = (grainNoise(u * 5, v * 4) - .5) * .034 + (grainNoise(u * 13, v * 2) - .5) * .009 + knot * .023;
    const across = u + flow;
    const broad = grainNoise(across * 26, v * 2.5), fine = grainNoise(across * 89, v * 5.2), fiber = grainNoise(across * 355, v * 19);
    const latewood = Math.pow(Math.max(0, (grainNoise(across * 49, v * 3.5) - .54) / .46), 2);
    const tone = (broad - .5) * 19 + (fine - .5) * 10 + (fiber - .5) * 2.3 - latewood * 15 - knot * 11;
    color[index] = 128 + tone; color[index + 1] = 86 + tone * .8; color[index + 2] = 55 + tone * .59; color[index + 3] = 255;
    relief[y * width + x] = (fine - .5) * .033 + (fiber - .5) * .009 - latewood * .036;
    const r = 196 + latewood * 12 - (fine - .5) * 8;
    roughness[index] = roughness[index + 1] = roughness[index + 2] = r; roughness[index + 3] = 255;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = relief[y * width + Math.max(0, x - 1)], right = relief[y * width + Math.min(width - 1, x + 1)];
    const top = relief[Math.max(0, y - 1) * width + x], bottom = relief[Math.min(height - 1, y + 1) * width + x];
    const dx = (left - right) * 1.5, dy = (top - bottom) * 1.5, length = Math.hypot(dx, dy, 1), index = (y * width + x) * 4;
    normal[index] = (dx / length * .5 + .5) * 255; normal[index + 1] = (dy / length * .5 + .5) * 255;
    normal[index + 2] = (.5 / length + .5) * 255; normal[index + 3] = 255;
  }
  const texture = (data, srgb = false) => {
    const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  };
  return { map: texture(color, true), normalMap: texture(normal), roughnessMap: texture(roughness) };
}

function timberGeometry(width, height, depth, axis = 'x', bevel = .012) {
  const b = Math.min(bevel, width * .15, height * .15, depth * .15);
  const x = width / 2 - b, y = height / 2 - b;
  const outline = new THREE.Shape();
  outline.moveTo(-x, -y); outline.lineTo(x, -y); outline.lineTo(x, y); outline.lineTo(-x, y); outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: depth - b * 2, steps: 1, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2 + b);
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    // The source timber grain runs along V. Keep it lengthwise on both the
    // front and reveal faces, with a consistent physical scale across boards.
    if (axis === 'y') {
      const across = Math.abs(n.getZ(i)) > .6 ? p.getX(i) : p.getZ(i);
      uv.setXY(i, across * 1.7 + .42, p.getY(i) * .18 + .5);
    } else {
      const across = Math.abs(n.getY(i)) > .6 ? p.getZ(i) : p.getY(i);
      uv.setXY(i, across * 1.7 + .31, p.getX(i) * .075 + .5);
    }
  }
  return geometry;
}

function petalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.044);
  shape.bezierCurveTo(-.035, -.022, -.044, .014, -.024, .032);
  shape.quadraticCurveTo(-.011, .046, 0, .032);
  shape.quadraticCurveTo(.012, .046, .025, .032);
  shape.bezierCurveTo(.044, .013, .034, -.023, 0, -.044);
  const geometry = new THREE.ShapeGeometry(shape, 9), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, .005 * (x / .04) ** 2 - .004 * (1 - (y / .05) ** 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A real timber window and plaster surround, with a distant garden backplate.
 * Prep coordinates and picking remain entirely owned by the matcha scene.
 */
export function buildShopEnvironment(scene, materials, { gardenUrl = './assets/sakura-garden.jpg' } = {}) {
  const group = new THREE.Group(); group.name = 'matcha-shop-environment'; scene.add(group);
  const frame = new THREE.Group(); frame.name = 'timber-window'; group.add(frame);
  const geometries = new Set(), ownMaterials = new Set(), woodSurface = timberSurface();
  const timber = materials.wood?.clone() || new THREE.MeshStandardMaterial({ color: 0x9b6d41, roughness: .82 });
  Object.assign(timber, woodSurface); timber.color.set(0xffffff); timber.roughness = .84;
  if (timber.normalScale) timber.normalScale.set(.30, .30);
  if ('clearcoat' in timber) timber.clearcoat = .08;
  const recess = timber.clone(); recess.color.set(0xb4a08a); recess.roughness = .9;
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe9dfcd, roughness: 1, normalMap: materials.table?.normalMap || null, normalScale: new THREE.Vector2(.13, .13), roughnessMap: materials.table?.roughnessMap || null });
  const joinery = new THREE.MeshStandardMaterial({ color: 0x67503b, roughness: .95 });
  [timber, recess, plaster, joinery].forEach(material => ownMaterials.add(material));

  function add(geometry, material, parent, name, x, y, z) {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z);
    // The existing preparation lighting stays clear of a large beam-shaped
    // shadow. Bevels, grain, reveals and ambient light supply the window depth.
    // VSM also submits receiveShadow meshes into its depth pass. Keep both
    // flags off so a high beam cannot paint a dark bar across the worktop.
    mesh.castShadow = mesh.receiveShadow = false; parent.add(mesh); return mesh;
  }
  function board(name, width, height, depth, x, y, z, axis = 'x', material = timber) {
    return add(timberGeometry(width, height, depth, axis), material, frame, name, x, y, z);
  }
  function wall(name, width, height, x, y) {
    return add(new THREE.BoxGeometry(width, height, .4), plaster, frame, name, x, y, -3.48);
  }

  // The opening is deliberately uninterrupted: no mullions over the workspace.
  wall('plaster-left', 4.0, 6.2, -7.56, 2.2);
  wall('plaster-right', 4.0, 6.2, 7.56, 2.2);
  wall('plaster-above', 11.12, 1.1, 0, 5.46);
  wall('plaster-below', 19.12, 1.0, 0, -.55);
  for (const side of [-1, 1]) {
    board(side < 0 ? 'left-post' : 'right-post', .34, 4.61, .4, side * 5.47, 2.505, -3.32, 'y');
    board('inner-reveal', .064, 4.57, .068, side * 5.267, 2.50, -3.55, 'y', recess);
    board('outer-casing', .056, 4.65, .065, side * 5.668, 2.50, -3.075, 'y');
    // Small inset tenon ends give the joinery a handmade scale.
    add(new THREE.BoxGeometry(.075, .024, .003), joinery, frame, 'timber-tenon', side * 5.47, .31, -3.118);
    add(new THREE.BoxGeometry(.075, .024, .003), joinery, frame, 'timber-tenon', side * 5.47, 4.68, -3.118);
  }
  board('top-beam', 11.28, .24, .42, 0, 4.88, -3.32);
  board('top-inner-rebate', 10.58, .058, .067, 0, 4.728, -3.55, 'x', recess);
  board('window-sill', 11.32, .16, .57, 0, .12, -3.265);
  board('sill-front-nosing', 11.40, .055, .075, 0, .062, -2.967);
  board('sill-rear-bead', 10.54, .041, .055, 0, .213, -3.485, 'x', recess);
  board('back-counter-trim', 12.15, .135, .155, 0, -.035, -2.992);

  const gardenMaterial = new THREE.MeshBasicMaterial({ color: 0xb1ba9c, toneMapped: false }); ownMaterials.add(gardenMaterial);
  // The visible rays pass below countertop height behind the low window sill.
  // This shorter backplate keeps blossom canopy and fence in that visible band.
  const garden = add(new THREE.PlaneGeometry(14, 3.5), gardenMaterial, group, 'sakura-garden-view', 0, -.5, -5.6);
  garden.receiveShadow = false;
  const posts = frame.children.filter(mesh => mesh.name === 'left-post' || mesh.name === 'right-post');
  const reveals = frame.children.filter(mesh => mesh.name === 'inner-reveal');
  const casings = frame.children.filter(mesh => mesh.name === 'outer-casing');
  const sideWalls = frame.children.filter(mesh => mesh.name === 'plaster-left' || mesh.name === 'plaster-right');
  const upperTenons = frame.children.filter(mesh => mesh.name === 'timber-tenon' && mesh.position.y > 1);
  const topBeam = frame.getObjectByName('top-beam'), topRebate = frame.getObjectByName('top-inner-rebate'), topWall = frame.getObjectByName('plaster-above');
  let gardenTexture = null, gardenStatus = gardenUrl ? 'loading' : 'fallback', disposed = false, gardenHeight = 3.5;
  function fitGardenTexture() {
    if (!gardenTexture) return;
    const image = gardenTexture.image, imageAspect = image?.width > 0 && image?.height > 0 ? image.width / image.height : 1672 / 941;
    // Cover the garden's projected rectangle, including its foreshortening at
    // the barista camera angle, instead of stretching blossom/fence details.
    const projectedAspect = 14 / (gardenHeight * .828);
    if (projectedAspect > imageAspect) {
      const repeatY = imageAspect / projectedAspect;
      gardenTexture.repeat.set(1, repeatY); gardenTexture.offset.set(0, Math.min(.40, 1 - repeatY));
    } else {
      const repeatX = projectedAspect / imageAspect;
      gardenTexture.repeat.set(repeatX, 1); gardenTexture.offset.set((1 - repeatX) * .5, 0);
    }
    gardenTexture.updateMatrix();
  }
  function resize(width = 1280, height = 720) {
    if (disposed) return;
    const w = Number.isFinite(width) && width > 0 ? width : 1280, h = Number.isFinite(height) && height > 0 ? height : 720;
    const aspect = Math.max(.15, Math.min(5, w / h));
    const narrow = Math.max(0, 1 / aspect - 1 / 1.1), openingTop = 4.76 + narrow * 7.12;
    for (const post of posts) { post.scale.y = (openingTop + .05 - .20) / 4.61; post.position.y = (openingTop + .05 + .20) * .5; }
    for (const reveal of reveals) { reveal.scale.y = (openingTop + .025 - .215) / 4.57; reveal.position.y = (openingTop + .025 + .215) * .5; }
    for (const casing of casings) { casing.scale.y = (openingTop + .065 - .175) / 4.65; casing.position.y = (openingTop + .065 + .175) * .5; }
    for (const wall of sideWalls) { wall.scale.y = (openingTop + .54 + .90) / 6.2; wall.position.y = (openingTop + .54 - .90) * .5; }
    for (const tenon of upperTenons) tenon.position.y = openingTop - .08;
    topBeam.position.y = openingTop + .12; topRebate.position.y = openingTop - .032; topWall.position.y = openingTop + .70;
    // Keep the lower edge behind the sill. At tall screen ratios, extend the
    // same mesh upward far enough to cover the camera's visible ray bundle.
    gardenHeight = Math.max(3.5, (6.6 / aspect / 1.14 - 2.58) / .828 + 2.35);
    garden.scale.y = gardenHeight / 3.5; garden.position.y = -2.25 + gardenHeight * .5;
    fitGardenTexture();
  }
  resize();
  if (gardenUrl) {
    new THREE.TextureLoader().load(gardenUrl, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      gardenTexture = texture; gardenMaterial.map = texture; gardenMaterial.color.set(0xffffff); gardenMaterial.needsUpdate = true; gardenStatus = 'ready'; fitGardenTexture();
    }, undefined, () => { if (!disposed) gardenStatus = 'fallback'; });
  }

  const count = 28, random = seededRandom(5117), seed = new Float32Array(count * 6);
  const petalMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffd9df, roughness: .73, metalness: 0, side: THREE.DoubleSide, sheen: .3, sheenColor: new THREE.Color(0xffc5d1), sheenRoughness: .8 });
  ownMaterials.add(petalMaterial);
  const petals = new THREE.InstancedMesh(petalGeometry(), petalMaterial, count); geometries.add(petals.geometry);
  petals.name = 'outdoor-sakura-petals'; petals.castShadow = petals.receiveShadow = false; petals.frustumCulled = false;
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(petals);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const index = i * 6;
    seed[index] = -4.78 + random() * 9.56;
    seed[index + 1] = -5.14 + random() * 1.34;
    seed[index + 2] = random();
    seed[index + 3] = .72 + random() * .66;
    seed[index + 4] = random() * TAU;
    seed[index + 5] = .78 + random() * .44;
    color.setHSL(.958 + random() * .025, .45 + random() * .12, .84 + random() * .1); petals.setColorAt(i, color);
  }
  let elapsed = 0;
  function posePetals() {
    for (let i = 0; i < count; i++) {
      const index = i * 6, phase = seed[index + 4], speed = seed[index + 5];
      const life = (seed[index + 2] + elapsed * .025 * speed) % 1;
      const x = seed[index] + Math.sin(elapsed * .21 + phase) * .15 + Math.sin(elapsed * .53 + phase) * .035;
      const z = seed[index + 1] + Math.sin(elapsed * .17 + phase) * .065;
      dummy.position.set(x, .30 + (1 - life) * 4.20, z);
      dummy.rotation.set(phase + elapsed * .31 * speed, phase * .6 + Math.sin(elapsed * .3 + phase) * .42, phase * .4 + elapsed * .13);
      dummy.scale.setScalar(seed[index + 3]); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  }
  posePetals();

  return {
    group, frame, garden, petals, resize,
    get gardenTexture() { return gardenTexture; },
    get gardenStatus() { return gardenStatus; },
    update(dt, { active = true, reducedMotion = false } = {}) {
      if (disposed || !active || reducedMotion || !Number.isFinite(dt) || dt <= 0) return;
      elapsed += Math.min(dt, .05) * .75; posePetals();
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent(); gardenTexture?.dispose();
      for (const texture of Object.values(woodSurface)) texture.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of ownMaterials) material.dispose();
    }
  };
}
