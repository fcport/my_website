import "./style.css";
import * as THREE from "three";

function makeLabelCanvas(labelWidth, fontSize, name) {
  const borderSize = 2;
  const canvas = document.createElement("canvas");
  // canvas.style.font(`${fontSize}px Aldrich`);
  const ctx = canvas.getContext("2d");
  const font = `${fontSize}px Aldrich, Poppins`;
  ctx.font = font;
  // measure how long the name will be
  const textWidth = ctx.measureText(name).width;

  const doubleBorderSize = borderSize * 2;
  const width = labelWidth + doubleBorderSize;
  const height = fontSize + doubleBorderSize;
  ctx.canvas.width = width;
  ctx.canvas.height = height;

  // need to set font sagain after resizing canvas

  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  ctx.fillStyle = "transparent";

  // scale to fit but don't stretch
  const scaleFactor = Math.min(1, labelWidth / textWidth);
  ctx.translate(width / 2, height / 2);
  ctx.scale(scaleFactor, 1);
  ctx.fillStyle = "white";
  ctx.fillText(name, 0, 0);

  return ctx.canvas;
}

function addLabelToObject(obj, labelSizeWidth, size, nameToDisplay) {
  const canvas = makeLabelCanvas(labelSizeWidth, size, nameToDisplay);
  const texture = new THREE.CanvasTexture(canvas);

  // because our canvas is likely not a power of 2
  // in both dimensions set the filtering appropriately.
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const labelMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  // const root = new THREE.Object3D();
  // root.position.x = obj.position.x;

  const label = new THREE.Sprite(labelMaterial);
  label.position.x = 0;
  label.position.y = 7;
  label.position.z = 0;

  //if units are meters then 0.01 here makes size
  // of the label into centimeters.
  const labelBaseScale = 0.01;
  label.scale.x = canvas.width * labelBaseScale;
  label.scale.y = canvas.height * labelBaseScale;

  obj.add(label);
}

export default { addLabelToObject, makeLabelCanvas };
