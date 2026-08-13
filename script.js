const viewer = document.querySelector(".viewer");
const cube = document.querySelector("#cube");
const sizeInput = document.querySelector("#size");
const zoomInput = document.querySelector("#zoom");
const reset = document.querySelector("#reset");

let rotX = -18;
let rotY = -32;
let dragging = false;
let lastX = 0;
let lastY = 0;

function render() {
  cube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

function setSize(value) {
  document.documentElement.style.setProperty("--cube-size", `${value}px`);
  document.documentElement.style.setProperty("--depth", `${value / 2}px`);
}

function setZoom(value) {
  viewer.style.setProperty("--zoom", `${value}px`);
}

sizeInput.addEventListener("input", e => setSize(Number(e.target.value)));
zoomInput.addEventListener("input", e => setZoom(Number(e.target.value)));

viewer.addEventListener("pointerdown", e => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  viewer.classList.add("dragging");
  viewer.setPointerCapture(e.pointerId);
});

viewer.addEventListener("pointermove", e => {
  if (!dragging) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;

  rotY += dx * 0.55;
  rotX -= dy * 0.55;

  // Evita virar completamente de cabeça para baixo.
  rotX = Math.max(-89, Math.min(89, rotX));

  lastX = e.clientX;
  lastY = e.clientY;

  render();
});

function stopDrag() {
  dragging = false;
  viewer.classList.remove("dragging");
}

viewer.addEventListener("pointerup", stopDrag);
viewer.addEventListener("pointercancel", stopDrag);
viewer.addEventListener("wheel", e => {
  e.preventDefault();
  const current = Number(zoomInput.value);
  const next = Math.max(500, Math.min(1400, current + (e.deltaY > 0 ? 55 : -55)));
  zoomInput.value = next;
  setZoom(next);
}, { passive: false });

reset.addEventListener("click", () => {
  rotX = -18;
  rotY = -32;
  sizeInput.value = 300;
  zoomInput.value = 850;
  setSize(300);
  setZoom(850);
  render();
});

setSize(300);
setZoom(850);
render();
