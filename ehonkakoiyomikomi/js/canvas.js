function createUniqueObjectId() {
  return window.crypto?.randomUUID?.() ?? `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
    this.onTapObject = options.onTapObject || null;
    this.highlightPulse = 0;
    this.highlightTimer = null;
    this.highlightedObjectId = null;
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

  setSelection(objectId, animate = false) {
    this.selectedObjectId = objectId;
    if (animate) {
      this.startHighlight(objectId);
    } else {
      this.clearHighlight();
    }
    this.render();
  }

  clearSelection() {
    this.selectedObjectId = null;
    this.clearHighlight();
    this.render();
  }

  highlightObject(objectId) {
    this.highlightedObjectId = objectId;
    this.startHighlight(objectId);
    this.render();
  }

  startHighlight(objectId) {
    this.highlightedObjectId = objectId;
    if (this.highlightTimer) {
      clearInterval(this.highlightTimer);
    }
    this.highlightPulse = 0;
    this.highlightTimer = window.setInterval(() => {
      this.highlightPulse += 0.2;
      this.render();
    }, 60);
  }

  clearHighlight() {
    this.highlightedObjectId = null;
    if (this.highlightTimer) {
      clearInterval(this.highlightTimer);
      this.highlightTimer = null;
    }
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

      const isSelected = object.id === this.selectedObjectId || object.id === this.highlightedObjectId;
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
    const isTransparent = color === "transparent";
    this.ctx.save();
    if (isSelected) {
      const pulse = Math.sin(this.highlightPulse) * 4 + 6;
      this.ctx.fillStyle = isTransparent ? "rgba(255, 255, 255, 0.12)" : "rgba(37, 99, 235, 0.12)";
      this.ctx.fillRect((x - pulse) * this.zoom, (y - pulse) * this.zoom, (w + pulse * 2) * this.zoom, (h + pulse * 2) * this.zoom);
      this.ctx.strokeStyle = isTransparent ? "#ffffff" : "#2563eb";
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash(isTransparent ? [6, 4] : [7, 4]);
      this.ctx.strokeRect((x - pulse) * this.zoom, (y - pulse) * this.zoom, (w + pulse * 2) * this.zoom, (h + pulse * 2) * this.zoom);
      this.ctx.restore();
      return;
    }

    this.ctx.strokeStyle = isTransparent ? "rgba(255, 255, 255, 0.85)" : color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash(isTransparent ? [6, 4] : []);
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
          id: createUniqueObjectId(),
          image: this.options.imageId || "01",
          name: "",
          x: preview.x,
          y: preview.y,
          w: preview.w,
          h: preview.h,
          text: "",
          voice: "",
          color: "#9df59c",
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

  handleCanvasTap(point) {
    const object = this.findObjectAt(point);
    if (object) {
      this.onTapObject?.(object);
    }
  }
}
