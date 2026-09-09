import * as THREE from "three";

// how tall a label stands in world units. a planet has radius 3, so this
// keeps the caption legible without swallowing the thing it names.
const LABEL_HEIGHT = 3.2;

function makeLabelCanvas(fontSize, name) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = `${fontSize}px Aldrich, Poppins, sans-serif`;

  ctx.font = font;
  const textWidth = Math.ceil(ctx.measureText(name).width);

  // sizing the canvas to the text, rather than to a fixed width, is what
  // keeps a short label from getting the same sprite footprint as a long one
  canvas.width = textWidth + fontSize;
  canvas.height = Math.ceil(fontSize * 1.4);

  // the canvas resize above resets the 2d context, so restate the font
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);

  return canvas;
}

function addLabelToObject(obj, fontSize, nameToDisplay) {
  const canvas = makeLabelCanvas(fontSize, nameToDisplay);
  const texture = new THREE.CanvasTexture(canvas);

  // the canvas is not a power of two in either dimension
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );

  label.position.set(0, 5.4, 0);
  label.scale.set(LABEL_HEIGHT * (canvas.width / canvas.height), LABEL_HEIGHT, 1);
  label.renderOrder = 1;

  obj.add(label);
  return label;
}

export default { addLabelToObject, makeLabelCanvas };
