import { initializeFirebase } from "./firebase.js";
import { loadObjects, saveObject, deleteObject } from "./firestore.js";
import { CanvasController } from "./canvas.js";
import { EditorController } from "./editor.js";
import { UIController } from "./ui.js";
import { ViewerController } from "./viewer.js";

const canvas = document.getElementById("main-canvas");
const sidePanel = document.getElementById("side-panel");
const statusBar = document.getElementById("status-bar");

const canvasController = new CanvasController(canvas, {
  zoom: 1,
  onCreate: (object) => {
    editorController?.selectObject(object.id);
  },
  onTapObject: (object) => {
    if (editorController?.mode === "view") {
      editorController.speakObject(object);
    }
  },
});
const uiController = new UIController({
  canvas,
  sidePanel,
  statusBar,
  form: {
    objectId: document.getElementById("field-object-id"),
    name: document.getElementById("field-name"),
    text: document.getElementById("field-text"),
    voice: document.getElementById("field-voice"),
    color: document.getElementById("field-color"),
    visible: document.getElementById("field-visible"),
    order: document.getElementById("field-order"),
  },
});

const firestore = {
  loadObjects,
  saveObject,
  deleteObject,
};

const editorController = new EditorController({
  canvasController,
  uiController,
  firestore,
});

const viewerController = new ViewerController({ canvasController, firestore });

function resizeCanvas() {
  const width = Math.max(900, window.innerWidth * 0.6);
  const height = Math.max(600, window.innerHeight * 0.7);
  canvasController.resize(width, height);
}

function setActiveToolbarButton(action) {
  document.querySelectorAll(".toolbar button[data-action]").forEach((button) => {
    button.classList.toggle("active", button.dataset.action === action);
  });
}

window.addEventListener("resize", resizeCanvas);

async function bootstrap() {
  const firebaseStatus = await initializeFirebase();
  console.info("Firebase status:", firebaseStatus);
  resizeCanvas();
  setActiveToolbarButton("edit-mode");
  await editorController.loadImage("01");
  uiController.bindEvents({
    onSave: () => editorController.saveCurrentObject(),
    onDelete: () => editorController.deleteSelectedObject(),
    onClose: () => uiController.hidePanel(),
    onZoomChange: (zoom) => canvasController.setZoom(zoom),
  });

  canvas.addEventListener("pointerdown", (event) => {
    const point = canvasController.getCanvasPoint(event);
    editorController.handleCanvasPointerDown(point);
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = canvasController.getCanvasPoint(event);
    editorController.handleCanvasPointerMove(point);
  });

  canvas.addEventListener("pointerup", () => {
    editorController.handleCanvasPointerUp();
  });

  canvas.addEventListener("click", (event) => {
    const point = canvasController.getCanvasPoint(event);
    editorController.handleCanvasClick(point);
  });

  document.querySelectorAll(".thumb").forEach((thumb) => {
    thumb.addEventListener("click", async () => {
      document.querySelectorAll(".thumb").forEach((item) => item.classList.remove("active"));
      thumb.classList.add("active");
      const imageId = thumb.dataset.image;
      await editorController.loadImage(imageId);
    });
  });

  document.querySelector("[data-action='view-mode']").addEventListener("click", () => {
    editorController.setMode("view");
    setActiveToolbarButton("view-mode");
  });

  document.querySelector("[data-action='edit-mode']").addEventListener("click", () => {
    editorController.setMode("edit");
    setActiveToolbarButton("edit-mode");
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      uiController.hidePanel();
    }
  });
}

bootstrap();
