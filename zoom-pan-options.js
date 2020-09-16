import { libWrapper } from './libwrapper-shim';

const MODULE_ID = 'zoom-pan-options'

function getSetting(settingName) {
  return game.settings.get(MODULE_ID, settingName)
}

// TODO Disable Alt key if touchmode is false.
function _onWheel_Override(event) {
  const touchpad = getSetting('touchpad-scroll');

  // Prevent zooming the entire browser window
  if (event.ctrlKey) {
    event.preventDefault();
  }

  // Handle wheel events for the canvas if it is ready and if it is our hover target
  let hover = document.elementFromPoint(event.clientX, event.clientY);

  if (canvas && canvas.ready && hover && hover.id === 'board') {
    event.preventDefault();
    const layer = canvas.activeLayer;
    const isOsx = window.navigator.platform === 'MacIntel';

    /* These can become options easily */
    const rotateKey = touchpad ? event.altKey : event.ctrlKey || event.metaKey ;
    const directionModifierKey = event.shiftKey; // changes pan direction
    const rotationModifierKey = event.shiftKey; // changes rotation amount
    const zoomKey = event.ctrlKey || event.metaKey;

    // Case 1 - handle rotation of objects
    // default to Alt for rotation as we are moving Shift to horizontal scroll and Ctrl is reserved for pinch zooming (OSX)
    if (layer instanceof PlaceablesLayer && (rotateKey || (rotationModifierKey && !touchpad))) {
      // return so we don't proceed
      return layer._onMouseWheel({
        ctrlKey: rotateKey, // shim alt where foundry expects ctrl for rotation
        deltaY: event.wheelDelta, // only the sign matters, use wheelDelta instead of relying on deltaY
        metaKey: event.metaKey,
        shiftKey: rotationModifierKey,
      });
    }

    // Case 2 - zoom the canvas (touchpad pinch, or normal scroll)
    if (zoomKey || !touchpad) {
      return zoom(event);
    }

    // Cast 3 - pan the canvas but flip X and Y (touchpad scroll + SHIFT and not OSX)
    if (touchpad && !isOsx && directionModifierKey) {
      return panWithTouchpad({
        deltaX: event.deltaY,
        deltaY: event.deltaX,
      });
    }

    // Case 4 - pan the canvas (touchpad scroll)
    panWithTouchpad(event);
  }
}

function _constrainView_Override({ x, y, scale }) {
  const d = canvas.dimensions;

  // Constrain the maximum zoom level
  if (Number.isNumeric(scale) && scale !== this.stage.scale.x) {
    const max = CONFIG.Canvas.maxZoom;
    const ratio = Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max);
    // override changes are just for this part:
    if (getSetting('disable-zoom-rounding')) scale = Math.clamped(scale, 1 / ratio, max);
    else scale = Math.round(Math.clamped(scale, 1 / ratio, max) * 100) / 100;
  } else {
    scale = this.stage.scale.x;
  }

  // Constrain the pivot point using the new scale
  if (Number.isNumeric(x) && x !== this.stage.pivot.x) {
    const padw = 0.4 * (window.innerWidth / scale);
    x = Math.clamped(x, -padw, d.width + padw);
  } else x = this.stage.pivot.x;
  if (Number.isNumeric(y) && x !== this.stage.pivot.y) {
    const padh = 0.4 * (window.innerHeight / scale);
    y = Math.clamped(y, -padh, d.height + padh);
  } else y = this.stage.pivot.y;

  // Return the constrained view dimensions
  return { x, y, scale };
}

/**
 * Will zoom around cursor, and based on delta.
 */
function zoom(event) {
  const multiplier = getSetting('zoom-speed-multiplier');
  let dz = -event.deltaY * 0.0005 * multiplier + 1;

  if (!getSetting('zoom-around-cursor')) {
    canvas.pan({ scale: dz * canvas.stage.scale.x });
    return;
  }

  const scale = dz * canvas.stage.scale.x;
  const d = canvas.dimensions;
  const max = CONFIG.Canvas.maxZoom;
  const min = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max);

  if (scale > max || scale < min) {
    canvas.pan({ scale: scale > max ? max : min });
    console.log('zoom-pan-options |', `scale limit reached (${scale}).`);
    return;
  }

  // Acquire the cursor position transformed to Canvas coordinates
  const t = canvas.stage.worldTransform;
  const dx = ((-t.tx + event.clientX) / canvas.stage.scale.x - canvas.stage.pivot.x) * (dz - 1);
  const dy = ((-t.ty + event.clientY) / canvas.stage.scale.y - canvas.stage.pivot.y) * (dz - 1);
  const x = canvas.stage.pivot.x + dx;
  const y = canvas.stage.pivot.y + dy;
  canvas.pan({ x, y, scale });
}

function panWithTouchpad(event) {
  const multiplier = (1 / canvas.stage.scale.x) * getSetting('pan-speed-multiplier');
  const x = canvas.stage.pivot.x + event.deltaX * multiplier;
  const y = canvas.stage.pivot.y + event.deltaY * multiplier;
  canvas.pan({ x, y });
}

Hooks.on('init', function () {
  console.log('Initializing Zoom/Pan Options');
  game.settings.register('zoom-pan-options', 'zoom-around-cursor', {
    name: 'Zoom around cursor',
    hint: 'Center zooming around cursor. Does not apply to zooming with pageup or pagedown.',
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
  });
  game.settings.register('zoom-pan-options', 'touchpad-scroll', {
    name: 'Touchpad/Scrollwheel Mode',
    hint:
      'Pan with two-finger drag (or scroll wheel, Shift + scroll for Horizontal). Zoom with two-finger pinch (or Ctrl + scroll).',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  });
  game.settings.register('zoom-pan-options', 'disable-zoom-rounding', {
    name: 'Disable zoom rounding',
    hint:
      'Disables default Foundry behavior, which rounds zoom to the nearest 1%. Will make zooming smoother, especially for touchpad users.',
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
  });
  game.settings.register('zoom-pan-options', 'zoom-speed-multiplier', {
    name: 'Zoom speed',
    hint:
      'Multiplies zoom speed, affecting scaling speed. Defaults to 1 (5% zoom per mouse tick). 0.1 or 10 might be better for some touchpads.',
    scope: 'client',
    config: true,
    default: 1,
    type: Number,
  });
  game.settings.register('zoom-pan-options', 'pan-speed-multiplier', {
    name: 'Pan speed',
    hint:
      'Only used in touchpad mode. Multiplies pan speed. Defaults to 1, which should be close to the pan speed when right-click-dragging the canvas.',
    scope: 'client',
    config: true,
    default: 1,
    type: Number,
  });
});

Hooks.once('setup', function () {
  libWrapper.register(
    MODULE_ID,
    'KeyboardManager.prototype._onWheel',
    (onwheel, event) => {
      _onWheel_Override(event)
    },
    'OVERRIDE'
  )
  libWrapper.register(
    MODULE_ID,
    'Canvas.prototype._constrainView',
    (_constrainView, obj) => {
      _constrainView_Override(obj)
    },
    'OVERRIDE' // only overrides a tiny part of the function... would be nice if foundry made it more modular
  )
  console.log('Done setting up Zoom/Pan Options.');
});
