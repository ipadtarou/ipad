import { initializeFirebase } from "./firebase.js";
import { loadObjects } from "./firestore.js";
import { getSpeechVoices, populateVoiceSelect, resolveVoice } from "./voice.js";

const canvas = document.getElementById("viewer-canvas");
const ctx = canvas.getContext("2d");
const zoomSelect = document.getElementById("zoom-select");
const voiceSelect = document.getElementById("voice-select");
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
let highlightPulse = 0;
let highlightTimer = null;
let playbackToken = 0;
let voices = [];

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
    if (isActive) {
      const pulse = Math.sin(highlightPulse) * 4 + 6;
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.fillRect((object.x - pulse) * zoom, (object.y - pulse) * zoom, (object.w + pulse * 2) * zoom, (object.h + pulse * 2) * zoom);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect((object.x - pulse) * zoom, (object.y - pulse) * zoom, (object.w + pulse * 2) * zoom, (object.h + pulse * 2) * zoom);
    } else {
      ctx.strokeStyle = object.color || "#00ff00";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(object.x * zoom, object.y * zoom, object.w * zoom, object.h * zoom);
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
  playbackToken += 1;
  const token = playbackToken;
  currentLabel.textContent = sentence;
  const selectedVoice = resolveVoice(object.voice || voiceSelect?.value, voices);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "ja-JP";
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.onend = () => {
    if (token !== playbackToken || !reading) {
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

  reading = false;
  currentLabel.textContent = "読み終わりました";
}

async function loadImage(imageId) {
  const imageObj = new Image();
  imageObj.src = `./${imageId}.jpg`;
  await imageObj.decode().catch(() => undefined);
  image = imageObj;
  objects = (await loadObjects(imageId)).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
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
  playbackToken += 1;
  stopHighlight();
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
  voices = await getSpeechVoices();
  populateVoiceSelect(voiceSelect, voices, "");
  resizeCanvas();
  await loadImage("01");
  if (voices.length > 0) {
    const utterance = new SpeechSynthesisUtterance("音声読み上げの準備ができました。");
    utterance.lang = "ja-JP";
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
    utterance.onend = () => {
      window.speechSynthesis.cancel();
    };
  }
}

canvas.addEventListener("pointerdown", async (event) => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / zoom;
  const y = (event.clientY - rect.top) / zoom;
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
      return x >= entry.x && x <= entry.x + entry.w && y >= entry.y && y <= entry.y + entry.h;
    });
  if (object) {
    reading = true;
    lastSpokenObjectId = object.id;
    startHighlight();
    await speakObject(object, { autoContinue: false });
  }
});

bootstrap();
