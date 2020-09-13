console.log("Zoom/Pan Options is setting up...");


function getSetting(settingName) {
  return game.settings.get("zoom-pan-options", settingName)
}

function _onWheel_Override(event) {
  const touchpad = getSetting("touchpad-scroll")
  if (event.deltaY === 0 && !touchpad)
    return

  // Prevent zooming the entire browser window
  if (event.ctrlKey) event.preventDefault();

  // Handle wheel events for the canvas if it is ready and if it is our hover target
  let hover = document.elementFromPoint(event.clientX, event.clientY);
  if (canvas && canvas.ready && hover && (hover.id === "board")) {
    event.preventDefault();
    let layer = canvas.activeLayer;
    let isCtrl = event.ctrlKey || event.metaKey, isShift = event.shiftKey;

    // Case 1 - rotate tokens or tiles
    if (layer instanceof PlaceablesLayer && (isShift || (isCtrl && !touchpad)))
      if (touchpad && isShift)
        // handle shift+drag for small increments (45° inc will have to be with the shift+arrows method)
        layer._onMouseWheel({
          deltaY: event.deltaY * getSetting('precise-rotation-multiplier'),
          isShift: false
        })
      else
        layer._onMouseWheel(event)
    // Case 2 - zoom the canvas (touchpad pinch, or normal scroll)
    else if (isCtrl || !touchpad) zoom(event)
    // Case 3 - pan the canvas (touchpad scroll)
    else pan(event);
  }
}

/**
 * Will zoom around cursor, and based on delta.
 */
function zoom(event) {
  const multiplier = getSetting("zoom-speed-multiplier")
  let dz = (-event.deltaY) * 0.05 * multiplier + 1
  if (!getSetting("zoom-around-cursor")) {
    canvas.pan({scale: dz * canvas.stage.scale.x});
    return;
  }
  const scale = dz * canvas.stage.scale.x;
  const d = canvas.dimensions;
  const max = CONFIG.Canvas.maxZoom;
  const min = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max);
  if (scale > max || scale < min) {
    canvas.pan({scale: scale > max ? max : min});
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

function pan(event) {
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
  game.settings.register("zoom-pan-options", "touchpad-scroll", {
    name: "Zoom by pinching, pan by dragging (Touchpad mode)",
    hint: "Pan with two-finger drag (or vertical/horizontal scroll)." +
      " Zoom with two-finger pinch (or Ctrl+scroll)." +
      " Precisely rotate a token with Ctrl+Shift+scroll.",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  })
  game.settings.register("zoom-pan-options", "zoom-around-cursor", {
    name: "Zoom around cursor",
    hint: "Center zooming around cursor. Does not apply to zooming with pageup or pagedown.",
    scope: "client",
    config: true,
    default: true,
    type: Boolean
  })
  game.settings.register("zoom-pan-options", "zoom-speed-multiplier", {
    name: "Zoom speed multiplier",
    hint: "Multiplies zoom speed, affecting scaling speed. Defaults to 1 (5% zoom per mouse tick). A value of 0.2 might be better for touchpads.",
    scope: "client",
    config: true,
    default: 1,
    type: number
  })
  game.settings.register("zoom-pan-options", "precise-rotation-multiplier", {
    name: "Precise rotation multiplier",
    hint: "Multiplies precise rotation. Defaults to 1. Applies to ctrl+scrolling (mouse) or shift+panning (touchpad).",
    scope: "client",
    config: true,
    default: 1,
    type: number
  })
  _onWheel_Original = KeyboardManager.prototype._onWheel
  KeyboardManager.prototype._onWheel = _onWheel_Override;
  console.log("Zoom/Pan Options is done setting up!");
});