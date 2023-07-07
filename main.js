import "./style.css";
import * as THREE from "three";
import gsap from "gsap";
import labelsFunctions from "./labels";
import { addStars } from "./stars";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene,
  camera,
  renderer,
  controls,
  sun,
  aboutMe,
  projects,
  blog,
  workHistory,
  saturnRings,
  aboutMeObj,
  projectsObj,
  blogObj,
  workHistoryObj,
  vertices,
  starBox,
  stars;

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let currentIntersections = [];
let currentClicked;

let readyClicked = false;
const manager = new THREE.LoadingManager();
manager.onProgress = function (url, itemsLoaded, itemsTotal) {
  const loader = document.querySelector("#progress");
  loader.value = (100 * itemsLoaded) / itemsTotal;
};

manager.onLoad = function () {
  console.log("Loading complete!");
  const loader = document.querySelector(".loading");
  loader.remove();
};

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );

  //the object that draws
  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"),
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  // I want to start the view from a slightly higher point
  camera.position.setX(800);
  camera.position.setY(650);
  camera.position.setZ(1500);
  // camera.rotation.z = Math.PI / 2;

  renderer.render(scene, camera);
  createStarsBeginning();

  const geometrySunCenter = new THREE.SphereGeometry(10);
  const geometryAboutMe = new THREE.SphereGeometry(3);
  const geometryProjects = new THREE.SphereGeometry(3);
  const geometrySaturnRings = new THREE.RingGeometry(8, 10, 32);
  const geometryBlog = new THREE.SphereGeometry(3);
  const geometryWorkHistory = new THREE.SphereGeometry(3);

  const sunTexture = new THREE.TextureLoader(manager).load("./assets/sun.jpg");
  const aboutMeTexture = new THREE.TextureLoader(manager).load(
    "./assets/hearth.jpg"
  );
  // const aboutMeTextureNormal = new THREE.TextureLoader().load(
  //   "./assets/hearth-normal.tif"
  // );
  const projectsTexture = new THREE.TextureLoader(manager).load(
    "./assets/saturn.jpg"
  );
  const blogTexture = new THREE.TextureLoader(manager).load(
    "./assets/mars.jpg"
  );
  const workHistoryTexture = new THREE.TextureLoader(manager).load(
    "./assets/venus.jpg"
  );
  const saturnRingsTexture = new THREE.TextureLoader(manager).load(
    "./assets/saturn-rings.png"
  );

  const materialSun = new THREE.MeshBasicMaterial({
    map: sunTexture,
  });

  const materialAboutMe = new THREE.MeshStandardMaterial({
    map: aboutMeTexture,
    // normalMap: aboutMeTextureNormal,
  });

  const materialProjects = new THREE.MeshStandardMaterial({
    map: projectsTexture,
  });

  const materialBlog = new THREE.MeshStandardMaterial({
    map: blogTexture,
  });

  const materialWorkHistory = new THREE.MeshStandardMaterial({
    map: workHistoryTexture,
  });

  const materialSaturnRings = new THREE.MeshBasicMaterial({
    map: saturnRingsTexture,
    side: THREE.DoubleSide,
  });

  sun = new THREE.Mesh(geometrySunCenter, materialSun);
  aboutMe = new THREE.Mesh(geometryAboutMe, materialAboutMe);
  projects = new THREE.Mesh(geometryProjects, materialProjects);
  blog = new THREE.Mesh(geometryBlog, materialBlog);
  workHistory = new THREE.Mesh(geometryWorkHistory, materialWorkHistory);
  saturnRings = new THREE.Mesh(geometrySaturnRings, materialSaturnRings);

  sun.position.set(0, 0, 0);
  aboutMe.position.set(30, 0, 0);
  projects.position.set(50, 0, 0);
  blog.position.set(70, 0, 0);
  workHistory.position.set(90, 0, 0);
  saturnRings.position.set(50, 0, 0);
  //set ring to horizontal ring
  saturnRings.rotation.x = 0.5 * Math.PI;

  // window.addEventListener("load", () => {

  // });

  aboutMeObj = new THREE.Object3D();
  projectsObj = new THREE.Object3D();
  blogObj = new THREE.Object3D();
  workHistoryObj = new THREE.Object3D();

  scene.add(sun, aboutMeObj, projectsObj, blogObj, workHistoryObj);
  aboutMeObj.add(aboutMe);
  projectsObj.add(projects, saturnRings);
  blogObj.add(blog);
  workHistoryObj.add(workHistory);

  aboutMe.onMouseHover = function () {
    return "About Me";
  };
  projects.onMouseHover = function () {
    return "Projects";
  };
  blog.onMouseHover = function () {
    return "Blog";
  };
  workHistory.onMouseHover = function () {
    return "Work History";
  };

  aboutMe.onClick = function () {
    openSection("ABOUTME");
  };

  projects.onClick = function () {
    openSection("PROJECTS");
  };
  blog.onClick = function () {
    openSection("BLOG");
  };
  workHistory.onClick = function () {
    openSection("WORKHISTORY");
  };

  const pointLight = new THREE.PointLight(0xffffff, 2, 300);
  //the sun shall be the point of light
  pointLight.position.set(0, 0, 0);

  //lights to illumate objects
  scene.add(pointLight);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;

  Array(300)
    .fill()
    .forEach((_) => addStars(scene));

  const spaceTextue = new THREE.TextureLoader(manager).load(
    "./assets/space.jpg"
  );
  scene.background = spaceTextue;
  animate();

  window.addEventListener("click", onDocumentMouseDown);
  window.addEventListener("mousemove", onDocumentMouseMove);
}
init();

function createStarsBeginning() {
  starBox = new THREE.BufferGeometry();
  vertices = {
    positions: [],
  };
  for (let i = 0; i < 3000; i++) {
    vertices.positions.push(Math.random() * 1000 + 400);
  }
  starBox.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(vertices.positions), 3)
  );

  let starImage = new THREE.TextureLoader(manager).load(
    "./assets/white-circle.png"
  );
  let starMaterial = new THREE.PointsMaterial({
    size: 2,
    map: starImage,
    color: 0xffffff,
    sizeAttenuation: true,
  });

  stars = new THREE.Points(starBox, starMaterial);

  scene.add(stars);
}

function onDocumentMouseDown(event) {
  event.preventDefault();

  // calculate pointer position in normalized device coordinates
  // (-1 to +1) for both components
  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children);

  if (
    intersects.length > 0 &&
    !currentClicked &&
    intersects[0].object.onClick
  ) {
    intersects[0].object.onClick.call(intersects[0]);
    currentClicked = intersects[0].object;
  }
}
function onDocumentMouseMove(event) {
  event.preventDefault();

  // calculate pointer position in normalized device coordinates
  // (-1 to +1) for both components
  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  currentIntersections = raycaster.intersectObjects(scene.children);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);

  [aboutMeObj, projectsObj, blogObj, workHistoryObj]
    .filter((el) =>
      currentIntersections && currentIntersections.length > 0 && !currentClicked
        ? scene.getObjectById(currentIntersections[0].object.id).parent.id !==
          el.id
        : true
    )
    .forEach((el) => {
      switch (el) {
        case aboutMeObj:
          aboutMeObj.rotateY(0.0025);
          break;
        case projectsObj:
          projectsObj.rotateY(0.0035);
          break;
        case blogObj:
          blogObj.rotateY(0.0015);
          break;
        case workHistoryObj:
          workHistoryObj.rotateY(0.002);
          break;
        default:
          break;
      }
    });

  if (!!currentClicked) {
    makeCameraFollowObject(currentClicked);
  }
  saturnRings.rotateZ(0.002);
  sun.rotateY(0.00015);

  aboutMe.rotateY(0.0025);
  projects.rotateY(0.0035);
  blog.rotateY(0.0015);
  workHistory.rotateY(0.005);

  if (readyClicked && !travelFinished) {
    for (let i = 0; i < vertices.positions.length; i += 3) {
      if (
        vertices.positions[i] > 900 ||
        vertices.positions[i + 1] > 800 ||
        vertices.positions[i + 2] > 1500
      ) {
        vertices.positions[i] = Math.random() * 800 + 400;
        vertices.positions[i + 1] = Math.random() * 600 + 300;
        vertices.positions[i + 2] = Math.random() * 1500 + 750;
      }
      vertices.positions[i] += 2;
      vertices.positions[i + 1] += 4;
      vertices.positions[i + 2] += 4;
    }

    starBox.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices.positions), 3)
    );
  }
}

const size = new THREE.Vector3();
const center = new THREE.Vector3();
const box = new THREE.Box3();

function makeCameraFollowObject(object) {
  const fitOffset = 1.2;
  box.makeEmpty();
  box.expandByObject(object);

  box.getSize(size);
  box.getCenter(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

  const direction = controls.target
    .clone()
    .sub(camera.position)
    .normalize()
    .multiplyScalar(15);

  direction.y += 10;

  controls.maxDistance = distance * 10;
  controls.target.copy(center);

  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  gsap.fromTo(camera.position, camera.position, direction).duration(2);
}

let currentSection;
function openSection(section) {
  currentSection = section;
  document.querySelector(`#${section}`).classList.remove("hide");
  document.querySelector(`#back`).classList.remove("hide");

  document.querySelector("header").classList.add("hide");
  document.querySelector("main").classList.add("height-full");
}

function back() {
  controls.reset();
  currentClicked = null;
  // coordinatesToReach = null;
  document.querySelector(`#${currentSection}`).classList.add("hide");
  document.querySelector(`#back`).classList.add("hide");
  document.querySelector("header").classList.remove("hide");
  document.querySelector("main").classList.remove("height-full");

  const homeVector = new THREE.Vector3(30, 50, 150);
  gsap.to(camera.position, homeVector).duration(2);
}

let travelFinished = false;
function ready() {
  console.log("ready to launch");
  labelsFunctions.addLabelToObject(aboutMe, 2000, 300, "ABOUT ME");
  labelsFunctions.addLabelToObject(projects, 2000, 300, "PROJECTS");
  labelsFunctions.addLabelToObject(blog, 2000, 300, "BLOG");
  labelsFunctions.addLabelToObject(workHistory, 2000, 300, "WORK HISTORY");
  document.querySelector(`#ready`).classList.add("hide");
  const body = document.querySelector(`.hyperspace`);
  body.style.opacity = "0";
  body.addEventListener(
    "transitionend",
    () => {
      // After the transition to opacity 1 is complete, instantly set opacity back to 0
      body.style.opacity = "1";
    },
    { once: true }
  );

  readyClicked = true;
  setTimeout(() => {
    controls.enabled = true;
    camera.position.setZ(150);
    camera.position.setX(30);
    camera.position.setY(50);
    document.querySelector(`#instruction`).innerHTML =
      "Click on any planet to know more about the selected section 🚀";
  }, 3500);
  setTimeout(() => {
    travelFinished = true;
    scene.remove(stars);
  }, 4000);
}

document.getElementById("back").addEventListener("click", () => back());
document.getElementById("ready").addEventListener("click", () => ready());
window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// addEventListener("load", (event) => {
//   console.log("loaded");
// });

// onload = (event) => {};
