import { libWrapper } from './libwrapper-shim.js'

const MODULE_ID = 'zoom-pan-options'

// note: 'Default' is the old name for 'AutoDetect'
// 'DefaultMouse' is the old name for 'Mouse'

function getSetting (settingName) {
  return game.settings.get(MODULE_ID, settingName)
}

function checkRotationRateLimit (layer) {
  const hasTarget = layer.options?.controllableObjects ? layer.controlled.length : !!layer.hover
  if (!hasTarget)
    return false
  const t = Date.now()
  const rate_limit = isNewerVersion(game.version, '9.231')
    ? game.mouse.MOUSE_WHEEL_RATE_LIMIT
    : game.keyboard.constructor.MOUSE_WHEEL_RATE_LIMIT

  if ((t - game.keyboard._wheelTime) < rate_limit)
    return false
  game.keyboard._wheelTime = t
  return true
}

/**
 * note:  this is not perfect which is why it's opt-in.  see issue: https://github.com/itamarcu/ZoomPanOptions/issues/30
 */
function isTouchpad (event) {
  if (event.wheelDeltaY ? event.wheelDeltaY === -3 * event.deltaY : event.deltaMode === 0) {
    // https://stackoverflow.com/a/62415754/1703463
    return true
  }
  if (event.deltaX !== 0 && event.deltaY !== 0) {
    // When moving on both X & Y axis, it can't be a mouse scroll
    return true
  }
  const deltaX = String(event.deltaX).split('.')
  const deltaY = String(event.deltaY).split('.')
  // If there is a decimal point with 2 or more numbers after the point
  // That means there is precise movement => touchpad
  if ((deltaX.length > 1 && deltaX[1].length > 1) || deltaY.length > 1 && deltaY[1].length > 1) {
    return true
  }
  // Probably a mouse.
  return false
}

/**
 * (note: return value is meaningless here)
 */
function _onWheel_Override (event) {
  let mode
  const shift = event.shiftKey
  const alt = event.altKey
  const ctrlOrMeta = event.ctrlKey || event.metaKey  // meta key (cmd on mac, winkey in windows) will behave like ctrl

  // Select scrolling mode
  if (getSetting('auto-detect-touchpad')) {
    const touchpad = isTouchpad(event)
    if (!touchpad) {
      mode = 'Mouse'
    } else if (getSetting('pan-zoom-mode') === 'Alternative') {
      mode = 'Alternative'
    } else {
      mode = 'Touchpad'
    }
  } else {
    mode = getSetting('pan-zoom-mode')
  }

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
  if (mode === 'Mouse' && (ctrlOrMeta || shift)) {
    return checkRotationRateLimit(layer) && layer._onMouseWheel(event)
  }
  const deltaY = event.wheelDelta !== undefined ? event.wheelDelta
    // wheelDelta is undefined in firefox
    : event.deltaY
  if (mode === 'Touchpad' && shift) {
    return checkRotationRateLimit(layer) && layer._onMouseWheel({
      deltaY: deltaY,
      shiftKey: shift && !ctrlOrMeta,
    })
  }
  if (mode === 'Alternative' && alt && (ctrlOrMeta || shift)) {
    return checkRotationRateLimit(layer) && layer._onMouseWheel({
      deltaY: deltaY,
      shiftKey: shift,
    })
  }

  // Case 2 - zoom the canvas
  // (written to be readable)
  if (
    mode === 'Mouse'
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

/**
 * Changes from original function:
 * `pad` value and `shift` multiplier are both customizable instead of being the default of 50 and 3.
 */
function _onDragCanvasPan_override (event) {
  // Throttle panning by 200ms
  const now = Date.now()
  if (now - (this._panTime || 0) <= 200) return
  this._panTime = now

  // Shift by a few grid spaces at a time
  const { x, y } = event
  const pad = getSetting('pad-value-when-dragging')
  const shift = (this.dimensions.size * getSetting('shift-value-when-dragging')) / this.stage.scale.x

  // Shift horizontally
  let dx = 0
  if (x < pad) dx = -shift
  else if (x > window.innerWidth - pad) dx = shift

  // Shift vertically
  let dy = 0
  if (y < pad) dy = -shift
  else if (y > window.innerHeight - pad) dy = shift

  // Enact panning
  if (dx || dy) return this.animatePan({ x: this.stage.pivot.x + dx, y: this.stage.pivot.y + dy, duration: 200 })
}

const updateDragResistance = () => {
  const setting = getSetting('drag-resistance-mode')
  if (setting === 'Foundry Default') {
    canvas.mouseInteractionManager.options.dragResistance = undefined
  } else if (setting === 'Responsive') {
    canvas.mouseInteractionManager.options.dragResistance = 0.1
  } else if (setting === 'Scaling') {
    const scale = canvas.stage.scale.x
    const multiplier = 20 // feels like about 1% of width
    canvas.mouseInteractionManager.options.dragResistance = multiplier / scale
  }
}

const migrateOldSettings = () => {
  const mode = getSetting('pan-zoom-mode')
  if (mode === 'DefaultMouse') {
    console.log(`Zoom/Pan Options | Migrating old setting 'pan-zoom-mode': 'DefaultMouse' to 'Mouse'`)
    game.settings.set('zoom-pan-options', 'pan-zoom-mode', 'Mouse')
  }
  if (mode === 'Default') {
    console.log(`Zoom/Pan Options | Migrating old setting 'pan-zoom-mode': 'Default' to 'Mouse', plus 'auto-detect-touchpad': true`)
    game.settings.set('zoom-pan-options', 'pan-zoom-mode', 'Mouse')
    game.settings.set('zoom-pan-options', 'auto-detect-touchpad', true)
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
  game.settings.register(MODULE_ID, 'min-max-zoom-override', {
    name: 'Minimum/maximum zoom override',
    hint: 'Override for the minimum and maximum zoom scale limits. 3 is the Foundry default (x3 and x0.333 scaling).',
    scope: 'client',
    config: true,
    default: CONFIG.Canvas.maxZoom, // 3.0 is the default
    type: Number,
    onChange: value => {
      CONFIG.Canvas.maxZoom = value
    },
  })
  game.settings.register(MODULE_ID, 'drag-resistance-mode', {
    name: 'Drag resistance mode',
    hint: 'By default, Foundry has a "drag resistance" of 0.25 grid units (so usually ~25).' +
      ' This is the minimum distance you need to move your cursor for a mouse drag event to be triggered.' +
      ' When it\'s too high you\'ll feel a dead zone when making small mouse drags (e.g. short pans, small drawings).' +
      ' Recommended setting: "Scaling", which scales to be a bit less than the visual size of a tool button',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'Foundry Default': 'Foundry Default: ~25 constantly, can feel bad, particularly when zoomed in',
      'Responsive': 'Responsive: 0.1 constantly, makes it hard to ping (long press)',
      'Scaling': 'Scaling: scales to always be about 1% of screen width',
    },
    default: 'Scaling',
    onChange: updateDragResistance,
  })
  game.settings.register(MODULE_ID, 'pan-zoom-mode', {
    name: 'Pan/zoom mode',
    hint: `
      Mouse: Standard foundry behavior. Zoom with mouse scroll. Rotate with Shift+scroll and Ctrl+scroll.
||
      Touchpad: Pan with two-finger drag. Zoom with two-finger pinch or Ctrl+scroll. Rotate with Shift+scroll and Ctrl+Shift+scroll.
||
      Alternative: Pan with two-finger drag or scroll or shift+scroll. Zoom with two-finger pinch or Ctrl+scroll. Rotate with Alt+Shift+scroll and Alt+Ctrl+scroll.
    `,
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'Mouse': 'Mouse: standard foundry behavior',
      'Touchpad': 'Touchpad: drag, pinch, rotate with Shift or Ctrl+Shift',
      'Alternative': 'Alternative: can pan with Shift, rotate while holding Alt',
    },
    default: 'Mouse',
  })
  game.settings.register(MODULE_ID, 'auto-detect-touchpad', {
    name: 'Auto-detect touchpad',
    hint: 'Will try to auto-detect touchpads;  going with either Mouse or Touchpad depending on result (or Alternative if it was selected).',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'zoom-speed-multiplier', {
    name: 'Zoom speed',
    hint:
      'Multiplies zoom speed, affecting scaling speed. 0.1 or 10 might be better for some touchpads. 0 for default Foundry behavior (which ignores scroll "intensity", and feels worse for touchpads).',
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
  game.settings.register(MODULE_ID, 'pad-value-when-dragging', {
    name: '"pad" value when dragging something to the edge of the screen',
    hint:
      'When holding down the cursor and moving it towards the edge of the screen, the canvas will pan.  "pad" is the distance that will trigger it. Foundry default is 50px.',
    scope: 'client',
    config: true,
    default: 50,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'shift-value-when-dragging', {
    name: '"shift" value when dragging something to the edge of the screen',
    hint:
      'When holding down the cursor and moving it towards the edge of the screen, the canvas will pan.  "shift" is the panning distance in tiles. Foundry default is 3 tiles.',
    scope: 'client',
    config: true,
    default: 3,
    type: Number,
  })
  migrateOldSettings()
})

Hooks.once('setup', function () {
  const wheelPrototype = isNewerVersion(game.version, '9.231')
    ? 'MouseManager.prototype._onWheel'
    : 'KeyboardManager.prototype._onWheel'

  libWrapper.register(
    MODULE_ID,
    wheelPrototype,
    (event) => {
      return _onWheel_Override(event)
    },
    'OVERRIDE',
  )
  libWrapper.register(
    MODULE_ID,
    'Canvas.prototype._onDragCanvasPan',
    _onDragCanvasPan_override,
    'OVERRIDE', // (same as above)
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
  CONFIG.Canvas.maxZoom = getSetting('min-max-zoom-override')
  console.log('Done setting up Zoom/Pan Options.')
})

Hooks.once('ready', () => {
  Hooks.on('canvasPan', updateDragResistance)
  updateDragResistance()
})
