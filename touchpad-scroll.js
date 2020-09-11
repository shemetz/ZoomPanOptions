console.log("CursorZoom is setting up...");

let cursorZoomEnabled = false

/**
 * Will now zoom around cursor.
 */
function _onMouseWheel_Override(event) {
    let dz = (event.deltaY < 0) ? 1.05 : 0.95;
    if (!cursorZoomEnabled) {
        this.pan({scale: dz * canvas.stage.scale.x});
        return;
    }
    const scale = dz * canvas.stage.scale.x;
    const d = canvas.dimensions;
    const max = CONFIG.Canvas.maxZoom;
    const min = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max);
    if (scale > max || scale < min) {
        this.pan({scale: scale > max ? max : min});
        console.log(`CursorZoom | scale limit reached (${scale}).`)
        return
    }
    // Acquire the cursor position transformed to Canvas coordinates
    const t = canvas.stage.worldTransform;
    const dx = ((-t.tx + event.clientX) / canvas.stage.scale.x - canvas.stage.pivot.x) * (dz - 1);
    const dy = ((-t.ty + event.clientY) / canvas.stage.scale.y - canvas.stage.pivot.y) * (dz - 1);
    const x = canvas.stage.pivot.x + dx;
    const y = canvas.stage.pivot.y + dy;
    canvas.pan({x, y, scale});
}

Hooks.on("init", function () {
    Canvas.prototype._onMouseWheel = _onMouseWheel_Override;
    cursorZoomEnabled = true
    console.log("CursorZoom is done setting up!");
});