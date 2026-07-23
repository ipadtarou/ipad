import { initializeFirebase } from "./firebase.js";
import { loadObjects } from "./firestore.js";
import { getSpeechVoices, resolveVoice } from "./voice.js";

const canvas = document.getElementById("viewer-canvas");
const ctx = canvas.getContext("2d");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const pageIndicator = document.getElementById("page-indicator");

const imageIds = ["01"];
let currentPageIndex = 0;
let image = null;
let objects = [];
let imageScale = 1;
let imageOffsetX = 0;
let imageOffsetY = 0;
let currentIndex = 0;
let reading = false;
let lastSpokenObjectId = null;
let highlightPulse = 0;
let highlightTimer = null;
let playbackToken = 0;
let voices = [];

function resizeCanvas() {
  const area = canvas.parentElement;
  const width = Math.floor(area.clientWidth);
  const height = Math.floor(area.clientHeight);
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
    imageScale = Math.min(canvas.width / image.width, canvas.height / image.height);
    imageOffsetX = (canvas.width - image.width * imageScale) / 2;
    imageOffsetY = (canvas.height - image.height * imageScale) / 2;
    ctx.save();
    ctx.translate(imageOffsetX, imageOffsetY);
    ctx.scale(imageScale, imageScale);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  for (const object of objects) {
    if (!object.visible) {
      continue;
    }
    const isActive = object.id === lastSpokenObjectId;
    const isTransparent = object.color === "transparent";
    ctx.save();
    const x = object.x * imageScale + imageOffsetX;
    const y = object.y * imageScale + imageOffsetY;
    const w = object.w * imageScale;
    const h = object.h * imageScale;
    if (isActive) {
      const pulse = Math.sin(highlightPulse) * 4 + 6;
      ctx.fillStyle = isTransparent ? "rgba(255, 255, 255, 0.18)" : "rgba(37, 99, 235, 0.12)";
      ctx.fillRect(x - pulse, y - pulse, w + pulse * 2, h + pulse * 2);
      ctx.strokeStyle = isTransparent ? "#ffffff" : "#2563eb";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(x - pulse, y - pulse, w + pulse * 2, h + pulse * 2);
    } else {
      ctx.strokeStyle = isTransparent ? "rgba(255, 255, 255, 0.85)" : object.color || "#9df59c";
      ctx.lineWidth = 2;
      ctx.setLineDash(isTransparent ? [6, 4] : []);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }
}

function startHighlight() {
  if (highlightTimer) {
    clearInterval(highlightTimer);
  }
  highlightPulse = 0;
  highlightTimer = window.setInterval(() => {
    highlightPulse += 0.2;
    render();
  }, 60);
}

function stopHighlight() {
  if (highlightTimer) {
    clearInterval(highlightTimer);
    highlightTimer = null;
  }
}

function buildSpeechSentence(object) {
  const parts = [];
  if (object?.name) {
    parts.push(object.name);
  }
  if (object?.text) {
    parts.push(object.text);
  }
  return parts.join("。" );
}

async function speakObject(object, { autoContinue = false } = {}) {
  const sentence = buildSpeechSentence(object);
  if (!sentence) {
    if (autoContinue) {
      currentIndex += 1;
      playNext();
    }
    return;
  }
  reading = true;
  playbackToken += 1;
  const token = playbackToken;
  const selectedVoice = resolveVoice(object.voice || null, voices);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "ja-JP";
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.onend = () => {
    if (token !== playbackToken) {
      return;
    }
    if (autoContinue) {
      currentIndex += 1;
      playNext();
    }
  };
  lastSpokenObjectId = object.id;
  startHighlight();
  render();
  window.speechSynthesis.speak(utterance);
}

function playNext() {
  if (!reading) {
    return;
  }

  let index = currentIndex;
  while (index < objects.length) {
    const object = objects[index];
    if (object && object.visible !== false && buildSpeechSentence(object)) {
      currentIndex = index;
      speakObject(object, { autoContinue: true });
      return;
    }
    index += 1;
  }

}

async function loadImage(imageId) {
  const imageObj = new Image();
  imageObj.src = `./${imageId}.jpg`;
  await imageObj.decode().catch(() => undefined);
  image = imageObj;
  objects = (await loadObjects(imageId)).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  render();
  updatePageIndicator();
}

function updatePageIndicator() {
  pageIndicator.textContent = `${imageIds[currentPageIndex]} (${currentPageIndex + 1}/${imageIds.length})`;
  prevPageButton.disabled = currentPageIndex === 0;
  nextPageButton.disabled = currentPageIndex === imageIds.length - 1;
}

function goToPage(index) {
  if (index < 0 || index >= imageIds.length) {
    return;
  }
  currentPageIndex = index;
  currentIndex = 0;
  lastSpokenObjectId = null;
  stopHighlight();
  loadImage(imageIds[currentPageIndex]);
}

window.addEventListener("resize", resizeCanvas);

async function bootstrap() {
  await initializeFirebase();
  voices = await getSpeechVoices();
  resizeCanvas();
  await loadImage(imageIds[currentPageIndex]);
}

canvas.addEventListener("click", async (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const object = objects
    .slice()
    .reverse()
    .find((entry) => {
      if (!entry.visible) {
        return false;
      }
      if (!buildSpeechSentence(entry)) {
        return false;
      }
      const imageX = (x - imageOffsetX) / imageScale;
      const imageY = (y - imageOffsetY) / imageScale;
      return imageX >= entry.x && imageX <= entry.x + entry.w && imageY >= entry.y && imageY <= entry.y + entry.h;
    });
  if (object) {
    reading = true;
    lastSpokenObjectId = object.id;
    startHighlight();
    await speakObject(object, { autoContinue: false });
  }
});

prevPageButton.addEventListener("click", () => goToPage(currentPageIndex - 1));
nextPageButton.addEventListener("click", () => goToPage(currentPageIndex + 1));

bootstrap();
