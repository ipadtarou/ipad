import { initializeFirebase } from "./firebase.js";
import { loadObjects } from "./firestore.js";

const canvas = document.getElementById("viewer-canvas");
const ctx = canvas.getContext("2d");
const zoomSelect = document.getElementById("zoom-select");
const currentLabel = document.getElementById("current-label");
const startButton = document.getElementById("start-read");
const stopButton = document.getElementById("stop-read");

let image = null;
let objects = [];
let zoom = 1;
let currentIndex = 0;
let reading = false;
let readingTimer = null;
let lastSpokenObjectId = null;

function resizeCanvas() {
  const width = Math.max(700, window.innerWidth * 0.6);
  const height = Math.max(500, window.innerHeight * 0.68);
  canvas.width = width;
  canvas.height = height;
  render();
}

function render() {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image) {
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, 0, 0, image.width, image.height);
    ctx.restore();
  }

  for (const object of objects) {
    if (!object.visible) {
      continue;
    }
    const isActive = object.id === lastSpokenObjectId;
    ctx.save();
    ctx.strokeStyle = isActive ? "#2563eb" : object.color || "#00ff00";
    ctx.lineWidth = isActive ? 4 : 2;
    ctx.setLineDash(isActive ? [8, 4] : []);
    ctx.strokeRect(object.x * zoom, object.y * zoom, object.w * zoom, object.h * zoom);
    ctx.restore();
  }
}

function speakObject(object) {
  const parts = [];
  if (object.name) {
    parts.push(object.name);
  }
  if (object.text) {
    parts.push(object.text);
  }
  const sentence = parts.join("。" );
  if (!sentence) {
    return;
  }
  currentLabel.textContent = sentence;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "ja-JP";
  utterance.onend = () => {
    if (!reading) {
      return;
    }
    currentIndex += 1;
    playNext();
  };
  lastSpokenObjectId = object.id;
  render();
  window.speechSynthesis.speak(utterance);
}

function playNext() {
  if (!reading) {
    return;
  }
  const object = objects[currentIndex];
  if (!object) {
    reading = false;
    currentLabel.textContent = "読み終わりました";
    return;
  }
  speakObject(object);
}

async function loadImage(imageId) {
  const imageObj = new Image();
  imageObj.src = `./${imageId}.jpg`;
  await imageObj.decode().catch(() => undefined);
  image = imageObj;
  objects = await loadObjects(imageId);
  render();
}

startButton.addEventListener("click", async () => {
  reading = true;
  currentIndex = 0;
  await loadImage("01");
  playNext();
});

stopButton.addEventListener("click", () => {
  reading = false;
  window.speechSynthesis.cancel();
  currentLabel.textContent = "停止しました";
});

zoomSelect.addEventListener("change", (event) => {
  zoom = Number(event.target.value);
  render();
});

window.addEventListener("resize", resizeCanvas);

async function bootstrap() {
  await initializeFirebase();
  resizeCanvas();
  await loadImage("01");
}

bootstrap();
