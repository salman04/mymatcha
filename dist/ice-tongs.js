import * as THREE from './vendor/three.module.js';

export function createIceTongs(material) {
  const group = new THREE.Group(); group.name = 'ice-tongs';
  const arms = [], grip = new THREE.Object3D(); grip.name = 'ice-grip'; group.add(grip);
  function mesh(geometry, parent, x = 0, y = 0, z = 0) {
    const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z); part.castShadow = part.receiveShadow = true; parent.add(part); return part;
  }
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(.68, .08, 0); group.add(arm); arms.push(arm);
    const path = new THREE.CatmullRomCurve3([[0, 0, side * .013], [-.18, .006, side * .033], [-.44, -.025, side * .068], [-.66, -.07, side * .080]].map(p => new THREE.Vector3(...p)));
    mesh(new THREE.TubeGeometry(path, 32, .014, 8, false), arm);
    // Broad, rounded gripping plates make contact with the sides of the cube.
    const plate = new THREE.Shape();
    plate.moveTo(-.07, -.055); plate.lineTo(.07, -.055); plate.quadraticCurveTo(.09, -.055, .09, -.035); plate.lineTo(.09, .035); plate.quadraticCurveTo(.09, .055, .07, .055); plate.lineTo(-.07, .055); plate.quadraticCurveTo(-.09, .055, -.09, .035); plate.lineTo(-.09, -.035); plate.quadraticCurveTo(-.09, -.055, -.07, -.055);
    const geometry = new THREE.ExtrudeGeometry(plate, { depth: .010, bevelEnabled: true, bevelSegments: 3, bevelSize: .003, bevelThickness: .002, steps: 1, curveSegments: 8 }); geometry.translate(0, 0, -.005);
    mesh(geometry, arm, -.68, -.08, side * .080);
    for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(.015, .008, .016), arm, -.737 + i * .038, -.132, side * .076);
  }
  const hinge = mesh(new THREE.SphereGeometry(.025, 16, 12), group, .68, .08, 0); hinge.scale.set(1.25, .75, 1);
  function open(amount) { arms.forEach((arm, index) => { arm.rotation.y = (index === 0 ? -1 : 1) * Math.max(0, Math.min(1, amount)) * .17; }); }
  open(.75);
  return { group, grip, arms, open };
}
