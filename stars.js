import * as THREE from "three";

function addStars(scene) {
  const geometry = new THREE.SphereGeometry(0.25);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const star = new THREE.Mesh(geometry, material);
  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(200));
  star.position.set(x, y, z);
  scene.add(star);
}

export { addStars };
