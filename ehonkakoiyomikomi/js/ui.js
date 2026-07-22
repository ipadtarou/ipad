import { populateVoiceSelect } from "./voice.js";

export class UIController {
  constructor({ canvas, sidePanel, statusBar, form }) {
    this.canvas = canvas;
    this.sidePanel = sidePanel;
    this.statusBar = statusBar;
    this.form = form;
  }

  setStatus(message) {
    this.statusBar.textContent = message;
  }

  showPanel() {
    this.sidePanel.classList.remove("hidden");
  }

  hidePanel() {
    this.sidePanel.classList.add("hidden");
  }

  fillForm(object) {
    this.form.objectId.value = object.id || "";
    this.form.name.value = object.name || "";
    this.form.text.value = object.text || "";
    this.form.voice.value = object.voice || "";
    this.form.color.value = object.color || "#00ff00";
    this.form.visible.checked = object.visible !== false;
    this.form.order.value = object.order || 1;
  }

  getFormValues() {
    return {
      id: this.form.objectId.value || "",
      name: this.form.name.value,
      text: this.form.text.value,
      voice: this.form.voice.value,
      color: this.form.color.value,
      visible: this.form.visible.checked,
      order: Number(this.form.order.value || 1),
    };
  }

  setVoiceOptions(voices = [], selectedValue = "") {
    populateVoiceSelect(this.form.voice, voices, selectedValue);
  }

  bindEvents({ onSave, onDelete, onClose, onZoomChange }) {
    document.querySelector("[data-action='edit-mode']").addEventListener("click", () => onZoomChange && onZoomChange(1));
    document.querySelector("[data-action='view-mode']").addEventListener("click", () => onZoomChange && onZoomChange(1));
    document.getElementById("save-object").addEventListener("click", onSave);
    document.getElementById("delete-object").addEventListener("click", onDelete);
    document.getElementById("close-panel").addEventListener("click", onClose);
    document.getElementById("zoom-select").addEventListener("change", (event) => {
      onZoomChange?.(Number(event.target.value));
    });
  }
}
