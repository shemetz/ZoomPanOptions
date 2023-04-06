import { libWrapper } from './libwrapper-shim.js'

const MODULE_ID = 'zoom-pan-options'

let isConflictingWithLockView = false

// note: 'Default' is the old name for 'AutoDetect'
// 'DefaultMouse' is the old name for 'Mouse'

function getSetting (settingName) {
  return game.settings.get(MODULE_ID, settingName)
}

function localizeSetting (scope, str) {
  return game.i18n.localize(MODULE_ID + '.settings.' + scope + '.' + str)
}

function checkRotationRateLimit (layer) {
  const hoveredLayerThing = isNewerVersion(game.version, '10') ? layer.hover : layer._hover
  const hasTarget = layer.options?.controllableObjects ? layer.controlled.length : !!hoveredLayerThing
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
 * note:  this is not perfect which is why it's opt-in.  see issue: https://github.com/shemetz/ZoomPanOptions/issues/30
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
  const deltaY = event.wheelDelta !== undefined ? -event.wheelDelta
    // wheelDelta is undefined in firefox
    : event.deltaY
  event.delta = deltaY
  if (mode === 'Mouse' && (ctrlOrMeta || shift)) {
    return checkRotationRateLimit(layer) && checkZoomLock() && layer._onMouseWheel(event)
  }
  if (mode === 'Touchpad' && shift) {
    return checkRotationRateLimit(layer) && checkZoomLock() && layer._onMouseWheel({
      delta: deltaY,
      deltaY: deltaY, // compatibility with Foundry versions before v10.291
      shiftKey: shift && !ctrlOrMeta,
    })
  }
  if (mode === 'Alternative' && alt && (ctrlOrMeta || shift)) {
    return checkRotationRateLimit(layer) && checkZoomLock() && layer._onMouseWheel({
      delta: deltaY,
      deltaY: deltaY, // compatibility with Foundry versions before v10.291
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
  if (!checkZoomLock()) return
  const multiplier = getSetting('zoom-speed-multiplier')
  // scaleChangeRatio was originally called "dz" but that's not really descriptive.  it's usually 1.05 or 0.95.
  // default foundry behavior is 1.05 and 0.95, but I actually change it to 1.05 and 0.95238 (*105% and /105%).
  // I do this because it makes one zoom-in tick plus one zoom-out tick cancel each other; their product is 1.
  const fivePercentZoom = event.deltaY < 0 ? 1.05 : (1 / 1.05)
  const speedBasedZoom = 1.05 ** (-event.deltaY * 0.01 * multiplier)
  const scaleChangeRatio = multiplier === 0 ? fivePercentZoom : speedBasedZoom

  if (!getSetting('zoom-around-cursor')) {
    canvas.pan({ scale: scaleChangeRatio * canvas.stage.scale.x })
    return
  }

  const scale = scaleChangeRatio * canvas.stage.scale.x  // scale x and scale y are the same
  const d = canvas.dimensions
  const max = CONFIG.Canvas.maxZoom
  const min = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, max)

  if (scale > max || scale < min) {
    canvas.pan({ scale: scale > max ? max : min })
    console.log('Zoom/Pan Options |', `scale limit reached (${scale}).`)
    return
  }

  // Acquire the cursor position transformed to Canvas coordinates
  const canvasEventPos = canvas.stage.worldTransform.applyInverse({ x: event.clientX, y: event.clientY })
  const canvasPivotPos = canvas.stage.pivot
  const deltaX = canvasEventPos.x - canvasPivotPos.x
  const deltaY = canvasEventPos.y - canvasPivotPos.y
  // scaledDelta will be about 5% of the delta vector between center-screen and cursor, in world coords
  const scaledDeltaX = deltaX * (scaleChangeRatio - 1) / scaleChangeRatio
  const scaledDeltaY = deltaY * (scaleChangeRatio - 1) / scaleChangeRatio
  // new x and y will be close to the previous center screen, but pushed a bit towards cursor;  just enough to keep the
  // cursor in the exact same world coords.
  const x = canvasPivotPos.x + scaledDeltaX
  const y = canvasPivotPos.y + scaledDeltaY
  canvas.pan({ scale, x, y })
}

function panWithMultiplier (event) {
  if (!checkPanLock()) return
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

const checkZoomLock = () => {
  // LockView compatibility workaround
  if (isConflictingWithLockView) {
    const lockZoom = canvas.scene.getFlag('LockView', 'lockZoom')
    if (lockZoom) {
      return false
    }
  }
  return true
}

const checkPanLock = () => {
  if (isConflictingWithLockView) {
    const lockPan = canvas.scene.getFlag('LockView', 'lockPan')
    if (lockPan) {
      return false
    }
  }
  return true
}

/**
 * Changes from original function:
 * `pad` value and `shift` multiplier are both customizable instead of being the default of 50 and 3.
 */
function _onDragCanvasPan_override (event) {
  if (!checkPanLock()) {
    return
  }

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
    console.log(
      `Zoom/Pan Options | Migrating old setting 'pan-zoom-mode': 'Default' to 'Mouse', plus 'auto-detect-touchpad': true`)
    game.settings.set('zoom-pan-options', 'pan-zoom-mode', 'Mouse')
    game.settings.set('zoom-pan-options', 'auto-detect-touchpad', true)
  }
}

const avoidLockViewIncompatibility = () => {
  Hooks.on('libWrapper.ConflictDetected', (p1, p2, target, frozenNames) => {
    if ((p1 === MODULE_ID && p2 === 'LockView') || p2 === MODULE_ID && p1 === 'LockView') {
      if (frozenNames.includes('Canvas.prototype._onDragCanvasPan')) {
        if (!game.user.isGM) {
          if (!getSetting('disable-lock-view-compatibility-fix')) {
            isConflictingWithLockView = true
          }
        }
      }
    }
  })
  game.settings.register(MODULE_ID, 'disable-lock-view-compatibility-fix', {
    name: 'hidden setting in case I fuck up my attempt to fix that bug',
    scope: 'client',
    config: false,
    default: false,
    type: Boolean,
  })
}

Hooks.on('init', function () {
  console.log('Initializing Zoom/Pan Options')
  game.settings.register(MODULE_ID, 'zoom-around-cursor', {
    name: localizeSetting('zoom-around-cursor', 'name'),
    hint: localizeSetting('zoom-around-cursor', 'hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'middle-mouse-pan', {
    name: localizeSetting('middle-mouse-pan', 'name'),
    hint: localizeSetting('middle-mouse-pan', 'hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    onChange: disableMiddleMouseScrollIfMiddleMousePanIsActive,
  })
  game.settings.register(MODULE_ID, 'min-max-zoom-override', {
    name: localizeSetting('min-max-zoom-override', 'name'),
    hint: localizeSetting('min-max-zoom-override', 'hint'),
    scope: 'client',
    config: true,
    default: CONFIG.Canvas.maxZoom, // 3.0 is the default
    type: Number,
    onChange: value => {
      CONFIG.Canvas.maxZoom = value
    },
  })
  game.settings.register(MODULE_ID, 'drag-resistance-mode', {
    name: localizeSetting('drag-resistance-mode', 'name'),
    hint: localizeSetting('drag-resistance-mode', 'hint'),
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'Foundry Default': localizeSetting('drag-resistance-mode', 'choice_foundry'),
      'Responsive': localizeSetting('drag-resistance-mode', 'choice_responsive'),
      'Scaling': localizeSetting('drag-resistance-mode', 'choice_scaling'),
    },
    default: 'Scaling',
    onChange: updateDragResistance,
  })
  game.settings.register(MODULE_ID, 'pan-zoom-mode', {
    name: localizeSetting('pan-zoom-mode', 'name'),
    hint: localizeSetting('pan-zoom-mode', 'hint'),
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'Mouse': localizeSetting('pan-zoom-mode', 'choice_mouse'),
      'Touchpad': localizeSetting('pan-zoom-mode', 'choice_touchpad'),
      'Alternative': localizeSetting('pan-zoom-mode', 'choice_alternative'),
    },
    default: 'Mouse',
  })
  game.settings.register(MODULE_ID, 'auto-detect-touchpad', {
    name: localizeSetting('auto-detect-touchpad', 'name'),
    hint: localizeSetting('auto-detect-touchpad', 'hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'zoom-speed-multiplier', {
    name: localizeSetting('zoom-speed-multiplier', 'name'),
    hint: localizeSetting('zoom-speed-multiplier', 'hint'),
    scope: 'client',
    config: true,
    default: 0,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'pan-speed-multiplier', {
    name: localizeSetting('pan-speed-multiplier', 'name'),
    hint: localizeSetting('pan-speed-multiplier', 'hint'),
    scope: 'client',
    config: true,
    default: 1,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'invert-vertical-scroll', {
    name: localizeSetting('invert-vertical-scroll', 'name'),
    hint: localizeSetting('invert-vertical-scroll', 'hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'pad-value-when-dragging', {
    name: localizeSetting('pad-value-when-dragging', 'name'),
    hint: localizeSetting('pad-value-when-dragging', 'hint'),
    scope: 'client',
    config: true,
    default: 50,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'shift-value-when-dragging', {
    name: localizeSetting('shift-value-when-dragging', 'name'),
    hint: localizeSetting('shift-value-when-dragging', 'hint'),
    scope: 'client',
    config: true,
    default: 3,
    type: Number,
  })
  migrateOldSettings()
  avoidLockViewIncompatibility()
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
