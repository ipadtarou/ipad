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
    this.uiController.setStatus(mode === "edit" ? "編集モード" : "閲覧モード");
  }

  selectObject(objectId) {
    this.selectedObjectId = objectId;
    this.canvasController.selectedObjectId = objectId;
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
    await this.firestore.saveObject(this.imageId, nextObject);
    this.uiController.setStatus("保存しました");
    this.selectObject(nextObject.id);
  }

  async deleteSelectedObject() {
    if (!this.selectedObjectId) {
      return;
    }

    this.objects = this.objects.filter((entry) => entry.id !== this.selectedObjectId);
    await this.firestore.deleteObject(this.imageId, this.selectedObjectId);
    this.canvasController.setObjects(this.objects);
    this.uiController.hidePanel();
    this.uiController.setStatus("削除しました");
  }

  handleCanvasPointerDown(point) {
    if (this.mode !== "edit") {
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
      return;
    }

    const object = this.canvasController.findObjectAt(point);
    if (!object) {
      this.uiController.hidePanel();
      this.selectedObjectId = null;
      this.canvasController.selectedObjectId = null;
      this.canvasController.render();
    }
  }
}
