import { libWrapper } from './libwrapper-shim.js'

const MODULE_ID = 'zoom-pan-options'

function getSetting (settingName) {
  return game.settings.get(MODULE_ID, settingName)
}

function checkRotationRateLimit (layer) {
  const hasTarget = layer.options?.controllableObjects ? layer.controlled.length : !!layer._hover
  if (!hasTarget)
    return false
  const t = Date.now()
  if ((t - game.keyboard._wheelTime) < game.keyboard.constructor.MOUSE_WHEEL_RATE_LIMIT)
    return false
  game.keyboard._wheelTime = t
  return true
}

/**
 * (note: return value is meaningless here)
 */
function _onWheel_Override (event) {
  const mode = getSetting('pan-zoom-mode')
  const shift = event.shiftKey
  const alt = event.altKey
  const ctrlOrMeta = event.ctrlKey || event.metaKey  // meta key (cmd on mac, winkey in windows) will behave like ctrl

  // Prevent zooming the entire browser window
  if (ctrlOrMeta) {
    event.preventDefault()
  }

  // Take no actions if the canvas is not hovered
  if (!canvas?.ready) return
  const hover = document.elementFromPoint(event.clientX, event.clientY)
  if (!hover || (hover.id !== 'board')) return
  event.preventDefault()

  const layer = canvas.activeLayer

  // Case 1 - rotate stuff
  if (layer instanceof PlaceablesLayer) {
    if (mode === 'Default' && (ctrlOrMeta || shift)) {
      return checkRotationRateLimit(layer) && layer._onMouseWheel(event)
    }
    if (mode === 'Touchpad' && shift) {
      return checkRotationRateLimit(layer) && layer._onMouseWheel({
        deltaY: event.wheelDelta, // only the sign matters, and we'll use wheelDelta instead of relying on deltaY
        shiftKey: shift && !ctrlOrMeta,
      })
    }
    if (mode === 'Alternative' && alt && (ctrlOrMeta || shift)) {
      return checkRotationRateLimit(layer) && layer._onMouseWheel({
        deltaY: event.wheelDelta, // only the sign matters, and we'll use wheelDelta instead of relying on deltaY
        shiftKey: shift,
      })
    }
  }

  // Case 2 - zoom the canvas
  // (written to be readable)
  if (
    mode === 'Default'
    || (mode === 'Touchpad' && ctrlOrMeta)
    || (mode === 'Alternative' && ctrlOrMeta)
  ) {
    return zoom(event)
  }

  // Cast 3 - pan the canvas horizontally (shift+scroll)
  if (mode === 'Alternative' && shift) {
    // noinspection JSSuspiciousNameCombination
    return panWithMultiplier({
      deltaX: event.deltaY,
    })
  }

  // Case 4 - pan the canvas in the direction of the mouse/touchpad event
  panWithMultiplier(event)
}

function _constrainView_Override ({ x, y, scale } = {}) {
  const d = canvas.dimensions

  // Constrain the maximum zoom level
  if (Number.isNumeric(scale) && scale !== canvas.stage.scale.x) {
    const max = CONFIG.Canvas.maxZoom
    const ratio = Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max)
    // override changes are just for this part:
    if (getSetting('disable-zoom-rounding')) scale = Math.clamped(scale, 1 / ratio, max)
    else scale = Math.round(Math.clamped(scale, 1 / ratio, max) * 100) / 100
  } else {
    scale = canvas.stage.scale.x
  }

  // Constrain the pivot point using the new scale
  if (Number.isNumeric(x) && x !== canvas.stage.pivot.x) {
    const padw = 0.4 * (window.innerWidth / scale)
    x = Math.clamped(x, -padw, d.width + padw)
  } else x = canvas.stage.pivot.x
  if (Number.isNumeric(y) && x !== canvas.stage.pivot.y) {
    const padh = 0.4 * (window.innerHeight / scale)
    y = Math.clamped(y, -padh, d.height + padh)
  } else y = canvas.stage.pivot.y

  // Return the constrained view dimensions
  return { x, y, scale }
}

/**
 * Will zoom around cursor, and based on delta.
 */
function zoom (event) {
  const multiplier = getSetting('zoom-speed-multiplier')
  let dz = -event.deltaY * 0.0005 * multiplier + 1
  // default foundry behavior if zoom-speed-multiplier is 0
  if (multiplier === 0) dz = event.deltaY < 0 ? 1.05 : 0.95

  if (!getSetting('zoom-around-cursor')) {
    canvas.pan({ scale: dz * canvas.stage.scale.x })
    return
  }

  const scale = dz * canvas.stage.scale.x
  const d = canvas.dimensions
  const max = CONFIG.Canvas.maxZoom
  const min = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max)

  if (scale > max || scale < min) {
    canvas.pan({ scale: scale > max ? max : min })
    console.log('Zoom/Pan Options |', `scale limit reached (${scale}).`)
    return
  }

  // Acquire the cursor position transformed to Canvas coordinates
  const t = canvas.stage.worldTransform
  const dx = ((-t.tx + event.clientX) / canvas.stage.scale.x - canvas.stage.pivot.x) * (dz - 1)
  const dy = ((-t.ty + event.clientY) / canvas.stage.scale.y - canvas.stage.pivot.y) * (dz - 1)
  const x = canvas.stage.pivot.x + dx
  const y = canvas.stage.pivot.y + dy
  canvas.pan({ x, y, scale })
}

function panWithMultiplier (event) {
  const multiplier = (1 / canvas.stage.scale.x) * getSetting('pan-speed-multiplier')
  const invertVerticalScroll = getSetting('invert-vertical-scroll') ? -1 : 1
  const x = canvas.stage.pivot.x + event.deltaX * multiplier
  const y = canvas.stage.pivot.y + event.deltaY * multiplier * invertVerticalScroll
  canvas.pan({ x, y })
}

function disableMiddleMouseScrollIfMiddleMousePanIsActive (isActive) {
  if (isActive) {
    // this will prevent middle-click from showing the scroll icon
    document.body.onmousedown__disabled = document.body.onmousedown
    document.body.onmousedown = function (e) { if (e.button === 1) return false }
  } else {
    document.body.onmousedown = document.body.onmousedown__disabled
  }
}

function _handleMouseDown_Wrapper (wrapped, ...args) {
  if (!getSetting('middle-mouse-pan')) return wrapped(...args)
  const event = args[0]
  if (event.data.originalEvent.button === 0) return wrapped(...args) // left-click
  if (event.data.originalEvent.button !== 1) return // additional buttons other than middle click - still ignoring!

  // Middle-mouse click will *only* pan;  ignoring anything else on the canvas
  const mim = canvas.mouseInteractionManager
  if (![mim.states.HOVER, mim.states.CLICKED, mim.states.DRAG].includes(mim.state)) return wrapped(...args)
  canvas.currentMouseManager = mim

  // Update event data
  event.data.object = mim.object
  event.data.origin = event.data.getLocalPosition(mim.layer)

  // piggy-backing off of the right-mouse-drag code, for lack of a better option
  const action = 'clickRight'
  if (!mim.can(action, event)) return
  event.stopPropagation()
  mim._dragRight = true

  // Upgrade hover to clicked
  if (mim.state === mim.states.HOVER) mim.state = mim.states.CLICKED
  if (CONFIG.debug.mouseInteraction) console.log(`${mim.object.constructor.name} | ${action}`)

  // Trigger callback function
  mim.callback(action, event)

  // Activate drag handlers
  if ((mim.state < mim.states.DRAG) && mim.can('dragRight', event)) {
    mim._activateDragEvents()
  }
}

Hooks.on('init', function () {
  console.log('Initializing Zoom/Pan Options')
  game.settings.register(MODULE_ID, 'zoom-around-cursor', {
    name: 'Zoom around cursor',
    hint: 'Center zooming around cursor. Does not apply to zooming with pageup or pagedown.',
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'middle-mouse-pan', {
    name: 'Middle-mouse to pan',
    hint: 'Middle mouse press will pan the canvas, instead of the default of doing nothing.',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    onChange: disableMiddleMouseScrollIfMiddleMousePanIsActive,
  })
  game.settings.register(MODULE_ID, 'disable-zoom-rounding', {
    name: 'Disable zoom rounding',
    hint:
      'Disables default Foundry behavior, which rounds zoom to the nearest 1%. Will make zooming smoother, especially for touchpad users.',
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'min-max-zoom-override', {
    name: 'Minimum/Maximum Zoom Override',
    hint: 'Override for the minimum and maximum zoom scale limits. 10 is the Foundry default (x10 and x0.1 scaling).',
    scope: 'client',
    config: true,
    default: 10,
    type: Number,
    onChange: value => {
      CONFIG.Canvas.maxZoom = value
    },
  })
  game.settings.register(MODULE_ID, 'pan-zoom-mode', {
    name: 'Pan/Zoom Mode',
    hint: `
      Default: Standard foundry behavior. Zoom with mouse scroll. Rotate with Shift+scroll and Ctrl+scroll.
||
      Touchpad: Pan with two-finger drag. Zoom with two-finger pinch or Ctrl+scroll. Rotate with Shift+scroll and Ctrl+Shift+scroll.
||
      Alternative: Pan with two-finger drag or scroll or shift+scroll. Zoom with two-finger pinch or Ctrl+scroll. Rotate with Alt+Shift+scroll and Alt+Ctrl+scroll.
    `,
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'Default': 'Default: standard foundry behavior',
      'Touchpad': 'Touchpad: drag, pinch, rotate with Shift or Ctrl+Shift',
      'Alternative': 'Alternative: can pan with Shift, rotate while holding Alt',
    },
    default: 'Default',
  })
  game.settings.register(MODULE_ID, 'zoom-speed-multiplier', {
    name: 'Zoom speed',
    hint:
      'Multiplies zoom speed, affecting scaling speed. 0.1 or 10 might be better for some touchpads. 0 for default Foundry behavior.',
    scope: 'client',
    config: true,
    default: 0,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'pan-speed-multiplier', {
    name: 'Pan speed',
    hint:
      'Multiplies pan speed. Defaults to 1, which should be close to the pan speed when right-click-dragging the canvas.',
    scope: 'client',
    config: true,
    default: 1,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'invert-vertical-scroll', {
    name: 'Invert vertical scroll',
    hint: 'If set to true, you will scroll up when dragging/scrolling down.',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  })
})

Hooks.once('setup', function () {
  libWrapper.register(
    MODULE_ID,
    'KeyboardManager.prototype._onWheel',
    (event) => {
      return _onWheel_Override(event)
    },
    'OVERRIDE',
  )
  libWrapper.register(
    MODULE_ID,
    'Canvas.prototype._constrainView',
    (obj) => {
      return _constrainView_Override(obj)
    },
    'OVERRIDE', // only overrides a tiny part of the function... would be nice if foundry made it more modular
  )
  libWrapper.register(
    MODULE_ID,
    'MouseInteractionManager.prototype._handleMouseDown',
    function (wrapped, ...args) {
      return _handleMouseDown_Wrapper.bind(this)(wrapped, ...args)
    },
    'MIXED', // only overrides if it's a middle click
  )
  disableMiddleMouseScrollIfMiddleMousePanIsActive(getSetting('middle-mouse-pan'))
  console.log('Done setting up Zoom/Pan Options.')
})
