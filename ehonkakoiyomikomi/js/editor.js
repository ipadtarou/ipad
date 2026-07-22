import { getSpeechVoices, resolveVoice } from "./voice.js";

export class EditorController {
  constructor({ canvasController, uiController, firestore, onChange }) {
    this.canvasController = canvasController;
    this.uiController = uiController;
    this.firestore = firestore;
    this.onChange = onChange;
    this.imageId = "01";
    this.objects = [];
    this.selectedObjectId = null;
    this.selectedObject = null;
    this.mode = "edit";
    this.history = [];
  }

  async loadImage(imageId) {
    this.imageId = imageId;
    const image = new Image();
    image.src = `./${imageId}.jpg`;
    await image.decode().catch(() => undefined);
    this.canvasController.setImage(image);
    this.objects = await this.firestore.loadObjects(imageId);
    this.canvasController.setObjects(this.objects);
    this.uiController.setStatus(`画像 ${imageId} を読み込みました`);
  }

  setMode(mode) {
    this.mode = mode;
    this.canvasController.clearHighlight();
    this.canvasController.clearSelection();
    this.uiController.setStatus(mode === "edit" ? "編集モード" : "閲覧モード");
  }

  selectObject(objectId) {
    this.selectedObjectId = objectId;
    this.canvasController.setSelection(objectId, true);
    const object = this.objects.find((entry) => entry.id === objectId);
    this.selectedObject = object || null;
    if (object) {
      this.uiController.fillForm(object);
      this.uiController.showPanel();
    }
  }

  async saveCurrentObject() {
    const formValues = this.uiController.getFormValues();
    const current = this.selectedObject || this.objects.find((entry) => entry.id === formValues.id);
    const nextObject = {
      ...(current || {}),
      ...formValues,
      image: this.imageId,
      x: current?.x ?? 0,
      y: current?.y ?? 0,
      w: current?.w ?? 80,
      h: current?.h ?? 60,
    };

    if (!nextObject.id) {
      nextObject.id = `obj-${Date.now()}`;
      this.objects.push(nextObject);
    } else {
      const index = this.objects.findIndex((entry) => entry.id === nextObject.id);
      if (index >= 0) {
        this.objects[index] = nextObject;
      }
    }

    this.selectedObject = nextObject;
    this.canvasController.setObjects(this.objects);
    const saveResult = await this.firestore.saveObject(this.imageId, nextObject);
    const savedToFirestore = saveResult?.savedToFirestore !== false;
    console.info("saveCurrentObject result", saveResult);
    this.uiController.setStatus(
      savedToFirestore
        ? "保存しました"
        : "保存しましたが、Firestore への書き込みに失敗しました。Firebase のルールを確認してください。"
    );
    this.selectObject(nextObject.id);
  }

  async deleteSelectedObject() {
    if (!this.selectedObjectId) {
      return;
    }

    this.objects = this.objects.filter((entry) => entry.id !== this.selectedObjectId);
    const deleteResult = await this.firestore.deleteObject(this.imageId, this.selectedObjectId);
    this.canvasController.setObjects(this.objects);
    this.uiController.hidePanel();
    this.uiController.setStatus(
      deleteResult?.savedToFirestore !== false ? "削除しました" : "削除しましたが、Firestore からの更新に失敗しました。"
    );
  }

  handleCanvasPointerDown(point) {
    if (this.mode !== "edit") {
      const object = this.canvasController.findObjectAt(point);
      if (object) {
        this.speakObject(object);
      }
      return;
    }

    this.canvasController.beginDrag(point);
    const object = this.canvasController.findObjectAt(point);
    if (object) {
      this.selectObject(object.id);
    }
  }

  handleCanvasPointerMove(point) {
    if (this.mode !== "edit") {
      return;
    }
    this.canvasController.updateDrag(point);
  }

  handleCanvasPointerUp() {
    if (this.mode !== "edit") {
      return;
    }
    this.canvasController.endDrag();
  }

  handleCanvasClick(point) {
    if (this.mode !== "edit") {
      const object = this.canvasController.findObjectAt(point);
      if (object) {
        this.speakObject(object);
      }
      return;
    }

    const object = this.canvasController.findObjectAt(point);
    if (!object) {
      this.uiController.hidePanel();
      this.selectedObjectId = null;
      this.canvasController.clearSelection();
    }
  }

  async speakObject(object) {
    const parts = [];
    if (object?.name) {
      parts.push(object.name);
    }
    if (object?.text) {
      parts.push(object.text);
    }
    const sentence = parts.join("。" );
    if (!sentence) {
      return;
    }

    const voices = await getSpeechVoices();
    const selectedVoice = resolveVoice(object?.voice || this.uiController.form.voice?.value, voices);

    this.uiController.setStatus(sentence);
    this.canvasController.highlightObject(object.id);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "ja-JP";
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.onend = () => {
      this.canvasController.clearHighlight();
      this.canvasController.render();
    };
    window.speechSynthesis.speak(utterance);
  }
}
