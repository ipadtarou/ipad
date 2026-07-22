export class CanvasController {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = options;
    this.zoom = options.zoom || 1;
    this.image = null;
    this.objects = [];
    this.selectedObjectId = null;
    this.dragState = null;
    this.hoveredObjectId = null;
    this.onCreate = options.onCreate || null;
  }

  setImage(image) {
    this.image = image;
    this.render();
  }

  setObjects(objects) {
    this.objects = objects;
    this.render();
  }

  setZoom(zoom) {
    this.zoom = zoom;
    this.render();
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  render() {
    if (!this.ctx) {
      return;
    }

    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    if (this.image) {
      this.ctx.save();
      this.ctx.scale(this.zoom, this.zoom);
      this.ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height);
      this.ctx.restore();
    }

    for (const object of this.objects) {
      if (!object.visible) {
        continue;
      }

      const isSelected = object.id === this.selectedObjectId;
      this.drawObject(object, isSelected);
    }

    if (this.dragState?.mode === "create") {
      const preview = this.getPreviewRect();
      this.drawRect(preview, true, "#3b82f6");
    }
  }

  drawObject(object, isSelected) {
    const { x, y, w, h, color = "#00ff00" } = object;
    this.drawRect({ x, y, w, h }, isSelected, color);
  }

  drawRect(rect, isSelected, color) {
    if (!rect) {
      return;
    }

    const { x, y, w, h } = rect;
    this.ctx.save();
    this.ctx.strokeStyle = isSelected ? "#ff0000" : color;
    this.ctx.lineWidth = isSelected ? 3 : 2;
    this.ctx.setLineDash(isSelected ? [6, 4] : []);
    this.ctx.strokeRect(x * this.zoom, y * this.zoom, w * this.zoom, h * this.zoom);
    this.ctx.restore();
  }

  getPreviewRect() {
    if (!this.dragState || this.dragState.mode !== "create") {
      return null;
    }

    const start = this.dragState.startPoint;
    const current = this.dragState.currentPoint;
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      w: Math.abs(current.x - start.x),
      h: Math.abs(current.y - start.y),
    };
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / this.zoom,
      y: (event.clientY - rect.top) / this.zoom,
    };
  }

  findObjectAt(point) {
    return this.objects
      .slice()
      .reverse()
      .find((object) => {
        if (!object.visible) {
          return false;
        }
        return point.x >= object.x && point.x <= object.x + object.w && point.y >= object.y && point.y <= object.y + object.h;
      });
  }

  beginDrag(point) {
    const object = this.findObjectAt(point);
    if (object) {
      this.dragState = {
        mode: "move",
        objectId: object.id,
        startPoint: point,
        startObject: { ...object },
      };
      this.selectedObjectId = object.id;
      this.render();
      return;
    }

    this.dragState = {
      mode: "create",
      startPoint: point,
      currentPoint: point,
    };
    this.selectedObjectId = null;
    this.render();
  }

  updateDrag(point) {
    if (!this.dragState) {
      return;
    }

    if (this.dragState.mode === "move") {
      const dx = point.x - this.dragState.startPoint.x;
      const dy = point.y - this.dragState.startPoint.y;
      const object = this.objects.find((entry) => entry.id === this.dragState.objectId);
      if (!object) {
        return;
      }

      object.x = this.dragState.startObject.x + dx;
      object.y = this.dragState.startObject.y + dy;
      this.render();
      return;
    }

    if (this.dragState.mode === "create") {
      this.dragState.currentPoint = point;
      this.render();
    }
  }

  endDrag() {
    if (this.dragState?.mode === "create") {
      const preview = this.getPreviewRect();
      if (preview && preview.w > 4 && preview.h > 4) {
        const rectObject = {
          id: `obj-${Date.now()}`,
          image: this.options.imageId || "01",
          name: "",
          x: preview.x,
          y: preview.y,
          w: preview.w,
          h: preview.h,
          text: "",
          voice: "",
          color: "#00ff00",
          order: 1,
          visible: true,
        };
        this.objects.push(rectObject);
        this.selectedObjectId = rectObject.id;
        this.onCreate?.(rectObject);
      }
    }

    this.dragState = null;
    this.render();
  }
}
