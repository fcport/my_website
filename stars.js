import * as THREE from "three";

// one Points cloud instead of 300 individual sphere meshes: same look, one
// draw call instead of three hundred. the sprite map is what keeps them round
// -- an unmapped point renders as a square.
function addStarField(scene, map, count = 400, spread = 220) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) {
    positions[i] = THREE.MathUtils.randFloatSpread(spread);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      map,
      transparent: true,
      alphaTest: 0.25,
      depthWrite: false,
    })
  );

  scene.add(stars);
  return stars;
}

export { addStarField };
