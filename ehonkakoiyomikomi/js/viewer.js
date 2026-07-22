export class ViewerController {
  constructor({ canvasController, firestore }) {
    this.canvasController = canvasController;
    this.firestore = firestore;
  }

  async openImage(imageId) {
    const objects = await this.firestore.loadObjects(imageId);
    this.canvasController.setObjects(objects);
  }
}
