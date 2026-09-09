import * as THREE from "three";
import gsap from "gsap";
import labels from "./labels";
import { addStarField } from "./stars";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// imported rather than referenced by string, so the build fingerprints them,
// emits them into dist and serves one copy shared with the CSS backdrop
import sunTextureUrl from "./assets/sun.webp";
import earthTextureUrl from "./assets/hearth.webp";
import saturnTextureUrl from "./assets/saturn.webp";
import saturnRingsTextureUrl from "./assets/saturn-rings.webp";
import marsTextureUrl from "./assets/mars.webp";
import venusTextureUrl from "./assets/venus.webp";
import jupiterTextureUrl from "./assets/jupiter.webp";
import spaceTextureUrl from "./assets/space.webp";
import starSpriteUrl from "./assets/white-circle.png";

// the camera always sits along this direction from the sun, at whatever
// distance is needed to fit every orbit on screen (see frameOrbits)
const HOME_DIRECTION = new THREE.Vector3(30, 50, 150).normalize();
const OUTER_ORBIT = 118;

// how the system sits at rest, per layout. a portrait phone is too narrow to
// hold the outer orbits at any useful size, so rather than shrink everything
// to a 30px strip it frames the inner system and lets the outer planets drift
// through. screenY pushes it clear of the text above it.
const HOME_FRAMING = {
  wide: { fitOrbit: OUTER_ORBIT, minDistance: 155, screenY: 0 },
  narrow: { fitOrbit: 46, minDistance: 120, screenY: -0.34 },
};

const BODIES = [
  {
    id: "ABOUTME",
    label: "ABOUT ME",
    texture: earthTextureUrl,
    orbit: 30,
    spin: 0.0025,
    revolution: 0.0025,
  },
  {
    id: "EDU",
    label: "EDUCATION",
    texture: saturnTextureUrl,
    orbit: 50,
    spin: 0.0035,
    revolution: 0.0035,
    rings: saturnRingsTextureUrl,
  },
  {
    id: "BLOG",
    label: "BLOG AND PROJECTS",
    texture: marsTextureUrl,
    orbit: 70,
    spin: 0.0015,
    revolution: 0.0015,
  },
  {
    id: "WORKHISTORY",
    label: "WORK HISTORY",
    texture: venusTextureUrl,
    orbit: 90,
    spin: 0.0005,
    revolution: 0.0005,
  },
  {
    id: "CONTACTS",
    label: "CONTACTS",
    texture: jupiterTextureUrl,
    orbit: 110,
    spin: 0.0007,
    revolution: 0.0007,
  },
];

// a tap that drifts more than this is a camera drag, not a planet click
const CLICK_SLOP_PX = 8;

const WARP_SECONDS = 2.2;

// how the camera sits when a section is open. the distance comes from the
// body's own radius, because saturn plus its rings is three times the span of
// a bare planet and a fixed distance made it swallow the header. the offsets
// are fractions of the frustum, so the planet lands low and left of centre,
// clear of the text on one side and the open panel on the other.
const FOCUS_FILL = 0.17;
const FOCUS_SCREEN_X = -0.34;
const FOCUS_SCREEN_Y = -0.32;

export function createSpace({
  canvas,
  onSelect,
  reducedMotion,
  layout = "wide",
  getHomeScreenY,
}) {
  // the scene is only the navigation where there is a pointer to aim with
  const interactive = layout === "wide";
  let currentLayout = layout;
  let pickingEnabled = interactive;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    4000
  );

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // uncapped devicePixelRatio means 3x the fragments on a modern laptop for
  // no visible gain on a starfield. a phone drawing this purely as wallpaper
  // gets a tighter cap again, because it pays for it in battery.
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, interactive ? 2 : 1.5)
  );
  renderer.setSize(window.innerWidth, window.innerHeight);

  const manager = new THREE.LoadingManager();
  const textureLoader = new THREE.TextureLoader(manager);

  const bodies = [];
  const pickable = [];
  let selected = null;
  let hovered = null;
  let lastFraming = {};

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.MeshBasicMaterial({ map: textureLoader.load(sunTextureUrl) })
  );
  scene.add(sun);

  BODIES.forEach((config) => {
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(3, 32, 32),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load(config.texture),
      })
    );
    planet.position.set(config.orbit, 0, 0);
    planet.userData.sectionId = config.id;

    const orbitPivot = new THREE.Object3D();
    orbitPivot.add(planet);
    scene.add(orbitPivot);

    if (config.rings) {
      const rings = new THREE.Mesh(
        new THREE.RingGeometry(8, 10, 48),
        new THREE.MeshBasicMaterial({
          map: textureLoader.load(config.rings),
          side: THREE.DoubleSide,
          transparent: true,
        })
      );
      rings.position.copy(planet.position);
      rings.rotation.x = 0.5 * Math.PI;
      orbitPivot.add(rings);
    }

    const label = labels.addLabelToObject(planet, 96, config.label);

    bodies.push({ ...config, planet, orbitPivot, label });
    pickable.push(planet);
  });

  const pointLight = new THREE.PointLight(0xffffff, 2, 400);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const starSprite = textureLoader.load(starSpriteUrl);
  addStarField(scene, starSprite);

  const spaceTexture = textureLoader.load(spaceTextureUrl);
  // the background is drawn as a full screen quad, so the panorama gets
  // resampled by whatever the window aspect happens to be. anisotropic
  // filtering keeps the pinpoint stars from being averaged into blurs.
  spaceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  scene.background = spaceTexture;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 30;
  controls.maxDistance = 900;

  frameOrbits();

  // ---------------------------------------------------------------- picking

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownAt = null;

  function planetUnderPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    // only the planets are pickable: raycasting the whole scene also hit the
    // starfield and the label sprites, and it ran on every click anywhere in
    // the window, including clicks on the links and buttons above the canvas
    const hits = raycaster.intersectObjects(pickable, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!pickingEnabled) return;
    pointerDownAt = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!pointerDownAt) return;
    const drift = Math.hypot(
      event.clientX - pointerDownAt.x,
      event.clientY - pointerDownAt.y
    );
    pointerDownAt = null;
    if (drift > CLICK_SLOP_PX) return;

    const planet = planetUnderPointer(event);
    if (planet) onSelect(planet.userData.sectionId);
  });

  canvas.addEventListener("pointercancel", () => {
    pointerDownAt = null;
  });

  let hoverQueued = false;
  canvas.addEventListener("pointermove", (event) => {
    if (!pickingEnabled || event.pointerType !== "mouse" || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const planet = selected ? null : planetUnderPointer(event);
      hovered = planet ? planet.userData.sectionId : null;
      canvas.style.cursor = planet ? "pointer" : "grab";
    });
  });

  // ------------------------------------------------------------- the camera

  // seat the camera so the whole system fits the window. a narrow window has
  // a narrow horizontal field of view, and the two outer planets used to fall
  // off the edge of it entirely, which put two sections out of reach.
  function frameOrbits({ apply = true } = {}) {
    const framing = HOME_FRAMING[currentLayout];
    // the fit loop flies the camera around to measure, so hold the current
    // view and put it back when we only wanted the number
    const heldPosition = camera.position.clone();
    const heldTarget = controls.target.clone();
    const probe = new THREE.Vector3();
    let distance = framing.minDistance;

    for (let iteration = 0; iteration < 8; iteration++) {
      camera.position.copy(HOME_DIRECTION).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      // width only. the camera looks down on the orbital plane, so the near
      // edge of a ring sits close underneath it and would drag the whole
      // system into the far distance if it had to fit vertically too.
      let worstX = 0;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
        probe
          .set(
            Math.cos(angle) * framing.fitOrbit,
            0,
            Math.sin(angle) * framing.fitOrbit
          )
          .project(camera);
        worstX = Math.max(worstX, Math.abs(probe.x));
      }

      if (Math.abs(worstX - 0.92) < 0.02) break;
      distance *= worstX / 0.92;
    }

    distance = Math.max(distance, framing.minDistance);

    if (!apply) {
      camera.position.copy(heldPosition);
      controls.target.copy(heldTarget);
      camera.updateProjectionMatrix();
      controls.update();
      return distance;
    }

    camera.position.copy(HOME_DIRECTION).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // sliding camera and target together by the same vector translates the
    // view without turning it, which moves the system on screen and leaves
    // the angle it is seen from alone
    const shift = homeShift(distance, getHomeScreenY?.() ?? framing.screenY);
    camera.position.add(shift);
    controls.target.copy(shift);
    controls.update();

    return distance;
  }

  // the world offset that puts the sun at `screenY` of the half frustum
  function homeShift(distance, screenY) {
    if (!screenY) return new THREE.Vector3();
    const halfHeight =
      Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
    const forward = new THREE.Vector3(0, 0, 0)
      .sub(camera.position)
      .normalize();
    const right = new THREE.Vector3()
      .crossVectors(forward, camera.up)
      .normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return up.multiplyScalar(-screenY * halfHeight);
  }

  function focus(sectionId, framing = lastFraming) {
    lastFraming = framing;
    const body = bodies.find((candidate) => candidate.id === sectionId);
    if (!body) return;

    selected = body;
    // arriving somewhere ends the journey: stop the streaks now rather than
    // leaving them firing behind the planet
    endWarp();
    // up close a caption becomes a billboard across the page, and the open
    // panel already says which section this is
    refreshLabels();

    const planetPosition = new THREE.Vector3();
    body.planet.getWorldPosition(planetPosition);

    // keep whatever angle the visitor has orbited to, just close the distance
    const back = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .normalize();
    back.y = Math.max(back.y, 0.28);
    back.normalize();

    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const radius = body.rings ? 10.5 : 3.2;
    const distance = THREE.MathUtils.clamp(
      radius / (FOCUS_FILL * Math.tan(halfFov)),
      35,
      160
    );

    const halfHeight = Math.tan(halfFov) * distance;
    const halfWidth = halfHeight * camera.aspect;

    const forward = back.clone().negate();
    const right = new THREE.Vector3()
      .crossVectors(forward, camera.up)
      .normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    // aim away from the planet by exactly the screen offset we want it to sit
    // at, so the framing holds at any window size
    const screenX = framing.x ?? FOCUS_SCREEN_X;
    const screenY = framing.y ?? FOCUS_SCREEN_Y;
    const lookAt = planetPosition
      .clone()
      .addScaledVector(right, -screenX * halfWidth)
      .addScaledVector(up, -screenY * halfHeight);
    const seat = lookAt.clone().addScaledVector(back, distance);

    const duration = reducedMotion ? 0 : 1.4;

    gsap.to(camera.position, {
      x: seat.x,
      y: seat.y,
      z: seat.z,
      duration,
      ease: "power2.inOut",
      overwrite: true,
    });
    gsap.to(controls.target, {
      x: lookAt.x,
      y: lookAt.y,
      z: lookAt.z,
      duration,
      ease: "power2.inOut",
      overwrite: true,
    });
  }

  function refreshLabels() {
    // a label points at something you can click. on a phone nothing here is
    // clickable, so they would only be text strewn across the page.
    const visible = !selected && currentLayout === "wide";
    bodies.forEach((body) => {
      body.label.visible = visible;
    });
  }

  function reset() {
    selected = null;
    refreshLabels();

    const shift = homeShift(
      homeDistance,
      getHomeScreenY?.() ?? HOME_FRAMING[currentLayout].screenY
    );
    const home = HOME_DIRECTION.clone().multiplyScalar(homeDistance).add(shift);
    const duration = reducedMotion ? 0 : 1.4;

    gsap.to(camera.position, {
      x: home.x,
      y: home.y,
      z: home.z,
      duration,
      ease: "power2.inOut",
      overwrite: true,
    });
    gsap.to(controls.target, {
      x: shift.x,
      y: shift.y,
      z: shift.z,
      duration,
      ease: "power2.inOut",
      overwrite: true,
    });
  }

  let homeDistance = camera.position.length();

  // --------------------------------------------------------- the intro warp

  let warp = null;

  // the warp owns its own lifetime. it used to be torn down inside the camera
  // tween's onComplete, which a killed tween never fires: interrupt the intro
  // by opening a section and the stars streamed forever.
  function endWarp() {
    if (!warp) return;
    scene.remove(warp.points);
    warp.geometry.dispose();
    warp.points.material.dispose();
    warp = null;
  }

  function playIntro() {
    if (reducedMotion) return;

    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(600);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(600);
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-600, 600);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 1.6,
        map: starSprite,
        transparent: true,
        depthWrite: false,
      })
    );
    scene.add(points);
    warp = {
      points,
      positions,
      geometry,
      // a deadline, so the effect ends even if the tween never reports back
      until: performance.now() + WARP_SECONDS * 1000,
    };

    const start = HOME_DIRECTION.clone().multiplyScalar(homeDistance * 6);
    camera.position.copy(start);

    gsap.to(camera.position, {
      x: HOME_DIRECTION.x * homeDistance,
      y: HOME_DIRECTION.y * homeDistance,
      z: HOME_DIRECTION.z * homeDistance,
      duration: WARP_SECONDS,
      ease: "power2.inOut",
      overwrite: true,
      onComplete: endWarp,
    });
  }

  // ------------------------------------------------------------- the render

  function animate() {
    requestAnimationFrame(animate);
    // a background tab still burns a phone battery on a scene nobody sees
    if (document.hidden) return;
    controls.update();

    bodies.forEach((body) => {
      // the planet whose section is open holds still, both its orbit and its
      // spin, so the camera is not chasing a moving target while you read
      if (selected === body) return;
      // hovering a planet only pauses its orbit, as a hint that it is clickable
      if (hovered !== body.id) body.orbitPivot.rotateY(body.revolution);
      body.planet.rotateY(body.spin);
    });

    sun.rotateY(0.0005);

    if (warp && performance.now() >= warp.until) endWarp();

    if (warp) {
      const { positions, geometry } = warp;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += 14;
        if (positions[i + 2] > 600) positions[i + 2] = -600;
      }
      geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  let lastWidth = window.innerWidth;

  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    // a phone hiding or showing its toolbar fires resize on nearly every
    // scroll, and only the height changes. re-framing on those yanked the
    // camera back to the home view mid-read: scroll up quickly and the sky
    // went black while a fresh tween crawled back to the planet.
    if (width === lastWidth) return;
    lastWidth = width;

    if (selected) focus(selected.id);
    else homeDistance = frameOrbits();
  }
  window.addEventListener("resize", onResize);

  function setLayout(next) {
    currentLayout = next;
    pickingEnabled = next === "wide";
    controls.enabled = pickingEnabled;
    if (!pickingEnabled) canvas.style.cursor = "";
    refreshLabels();
    homeDistance = frameOrbits({ apply: !selected });
  }

  controls.enabled = interactive;
  refreshLabels();

  const ready = new Promise((resolve) => {
    manager.onLoad = () => resolve();
    // never let a texture that fails to arrive hold the scene back
    manager.onError = () => resolve();
    setTimeout(resolve, 8000);
  });

  animate();

  return { ready, focus, reset, playIntro, setLayout };
}
