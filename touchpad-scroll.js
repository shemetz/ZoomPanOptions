console.log("TouchpadScroll is setting up...");


let _onWheel_Original = null

function _onWheel_Override(event) {
  if (!game.settings.get("touchpad-scroll", "touchpad-scroll"))
    return _onWheel_Original(event)

  // Prevent zooming the entire browser window
  if (event.ctrlKey) event.preventDefault();

  // Handle wheel events for the canvas if it is ready and if it is our hover target
  let hover = document.elementFromPoint(event.clientX, event.clientY);
  if (canvas && canvas.ready && hover && (hover.id === "board")) {
    event.preventDefault();
    let layer = canvas.activeLayer;
    let isCtrl = event.ctrlKey || event.metaKey,
      isShift = event.shiftKey;

    // Case 1 - rotate tokens or tiles
    if (layer instanceof PlaceablesLayer && isShift) layer._onMouseWheel(event); // TODO - handle ctrl+shift for small increments
    // Case 2 - zoom the canvas
    else if (isCtrl) canvas._onZoom(event) // TODO - write
    // Case 3 - pan the canvas
    else canvas._onPan(event); // TODO - write
  }
}

function _onPan(event) {
  if (event.deltaY !== 0) {
    let dy = event.deltaY * 3;
    const x = null;
    const y = canvas.stage.pivot.y + dy;
    const scale = null;
    canvas.pan({x, y, scale});
  }

  if (event.deltaX !== 0) {
    let dx = event.deltaX * 3;
    const x = canvas.stage.pivot.x + dx;
    const y = null;
    const scale = null;
    canvas.pan({x, y, scale});
  }
}

Hooks.on("init", function () {
  game.settings.register("touchpad-scroll", "touchpad-scroll", {
    name: "Zoom by pinching, pan by dragging",
    hint: "Pan with two-finger drag on laptop touchpads (or scroll)." +
      " Zoom with two-finger pinch (or Ctrl+scroll)" +
      " Finely rotate a token with Ctrl+Shift+scroll",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });
  // TODO - either this, or game.keyboard
  _onWheel_Original = KeyboardManager.prototype._onWheel
  KeyboardManager.prototype._onWheel = _onWheel_Override;
  Canvas.prototype._onZoom = Canvas.prototype._onMouseWheel
  Canvas.prototype._onPan = _onPan
  console.log("TouchpadScroll is done setting up!");
});