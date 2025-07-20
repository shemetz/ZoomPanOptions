const MODULE_ID = 'zoom-pan-options'

let isConflictingWithLockView = false

function getSetting (settingName) {
  return game.settings.get(MODULE_ID, settingName)
}

function localizeSetting (scope, str) {
  return game.i18n.localize(MODULE_ID + '.settings.' + scope + '.' + str)
}

function localizeUi (scope, str) {
  return game.i18n.localize(MODULE_ID + '.ui.' + scope + '.' + str)
}

function localizeKeybinding (scope, str) {
  return game.i18n.localize(MODULE_ID + '.keybindings.' + scope + '.' + str)
}

function checkRotationRateLimit (layer) {
  const hoveredLayerThing = layer.hover
  const hasTarget = layer.options?.controllableObjects ? layer.controlled.length : !!hoveredLayerThing
  if (!hasTarget)
    return false
  const t = Date.now()
  const rate_limit = game.mouse.constructor.MOUSE_WHEEL_RATE_LIMIT

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
 * In foundry V13, MouseManager.#onWheel is #private so we can't override it directly :(
 * But the way it works is basically:
 *
 *   event.preventDefault();
 *   // Take no actions if the canvas is not hovered
 *   if (not hovering over canvas#board) return
 *   // Case 1 - active Ruler
 *   if (ruler.active && (ctrl || shift)) return ruler._onMouseWheel(event)
 *   // Case 2 - active Token Ruler
 *   if (draggedToken && (ctrl || shift)) return draggedToken._onMouseWheel(event)
 *   // Case 3 - rotate placeable objects
 *   if ((activeLayer.controlled.length) && (ctrl || shift)) return activeLayer._onMouseWheel(event)
 *   // Case 4 - zoom the canvas
 *   return canvas._onMouseWheel(event)
 *
 * So in V13+, ZoomPanOptions will override canvas._onMouseWheel, and will no longer handle cases 1-3 above.
 */
const canvas_onMouseWheel_override = (event) => {
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

  const layer = canvas.activeLayer

  // Case 4.1 - rotate stuff
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
      shiftKey: shift && !ctrlOrMeta,
    })
  }
  if (mode === 'Alternative' && alt && (ctrlOrMeta || shift)) {
    return checkRotationRateLimit(layer) && checkZoomLock() && layer._onMouseWheel({
      delta: deltaY,
      shiftKey: shift,
    })
  }

  // Case 4.2 - zoom the canvas
  // (written to be readable)
  if (
    mode === 'Mouse'
    || (mode === 'Touchpad' && ctrlOrMeta)
    || (mode === 'Alternative' && ctrlOrMeta)
  ) {
    return zoom(event)
  }

  // Cast 4.3 - pan the canvas horizontally (shift+scroll)
  if (mode === 'Alternative' && shift) {
    // noinspection JSSuspiciousNameCombination
    return panWithMultiplier({
      deltaX: event.deltaY,
    })
  }

  // Case 4.4 - pan the canvas in the direction of the mouse/touchpad event
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
  const max = Math.max(canvas.scene.initial.scale, getSetting('max-zoom-override'))
  const min = Math.min(canvas.scene.initial.scale, getSetting('min-zoom-override'))
  if (scale > max || scale < min) {
    console.log('Zoom/Pan Options |', `scale exceeds limit (${scale}), bounding to interval [${min}, ${max}).`)
    canvas.pan({ scale: scale > max ? max : scale < min ? min : scale })
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

const disableBrowserGesturesIfTouchpad = (panZoomMode) => {
  if (panZoomMode === 'Touchpad') {
    // disable browser back/forward gestures
    document.getElementsByTagName('BODY')[0].style.overscrollBehaviorX = 'none'
  } else if (document.getElementsByTagName('BODY')[0].style.overscrollBehaviorX === 'none') {
    document.getElementsByTagName('BODY')[0].style.overscrollBehaviorX = ''
  }
}

const handleMouseDown_forMiddleClickDrag = (mouseDownEvent) => {
  if (!getSetting('middle-mouse-pan')) return true
  if (mouseDownEvent.data.originalEvent.button !== 1) return true // buttons other than middle click - ignoring
  const mim = canvas.mouseInteractionManager

  /*
   * --- This section is awkward ---
   *
   * I'm copying a lot of code from MouseInteractionManager functions, and:
   * - replacing `this` with `mim`
   * - replacing `this.#function` with `mim_function`
   * - commenting out code that is not necessary for the "pretend middle-click-drag is right-click-drag" thing
   */

  const mim_handleRightDown = (event) => {
    if (!mim.state.between(mim.states.HOVER, mim.states.DRAG)) return

    //// Determine double vs single click
    //const isDouble = ((event.timeStamp - mim.rcTime) <= MouseInteractionManager.DOUBLE_CLICK_TIME_MS)
    //  && (Math.hypot(event.clientX - mim.lastClick.x, event.clientY - mim.lastClick.y)
    //    <= MouseInteractionManager.DOUBLE_CLICK_DISTANCE_PX);
    //mim.rcTime = isDouble ? 0 : event.timeStamp;
    mim.rcTime = event.timeStamp
    mim.lastClick.set(event.clientX, event.clientY)

    // Assign origin data
    mim_assignOriginData(event)

    // Update event data
    mim.interactionData.origin = event.getLocalPosition(mim.layer)

    //// Dispatch to double and single-click handlers
    //if ( isDouble && mim.can("clickRight2", event) ) return mim_handleClickRight2(event);
    //else return mim_handleClickRight(event);
    return mim_handleClickRight(event)
  }

  const mim_handleClickRight = (event) => {
    const action = 'clickRight'
    if (!mim.can(action, event)) return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
    mim._dragRight = true

    //// Was the right-click event handled by the callback?
    //const priorState = mim.state;
    if (mim.state === mim.states.HOVER) mim.state = mim.states.CLICKED
    canvas.currentMouseManager = mim
    //if ( mim.callback(action, event) === false ) {
    //  mim.state = priorState;
    //  canvas.currentMouseManager = null;
    //  return mim_debug(action, event, mim.handlerOutcomes.REFUSED);
    //}

    // Activate drag event handlers
    if ((mim.state === mim.states.CLICKED) && mim.can('dragRight', event)) {
      mim.state = mim.states.GRABBED
      mim_activateDragEvents()
    }
    //return mim_debug(action, event);
  }

  const mim_activateDragEvents = () => {
    mim_deactivateDragEvents()
    mim.layer.on('pointermove', mim_handlers_pointermove)
    //if ( !mim._dragRight ) {
    //  canvas.app.view.addEventListener("contextmenu", mim.#handlers.contextmenu, {capture: true});
    //}
  }

  const mim_deactivateDragEvents = () => {
    mim.layer.off('pointermove', mim_handlers_pointermove)
    //canvas.app.view.removeEventListener("contextmenu", mim.#handlers.contextmenu, {capture: true});
  }

  /**
   * based on #handlePointerMove code
   */
  const mim_handlers_pointermove = (event) => {
    if (!mim.state.between(mim.states.GRABBED, mim.states.DRAG)) return

    // Limit dragging to 60 updates per second
    const now = Date.now()
    if ((now - mim.dragTime) < canvas.app.ticker.elapsedMS) return
    mim.dragTime = now

    // Update interaction data
    const data = mim.interactionData
    data.destination = event.getLocalPosition(mim.layer, data.destination)

    // Begin a new drag event
    if (mim.state !== mim.states.DRAG) {
      const dx = event.global.x - data.screenOrigin.x
      const dy = event.global.y - data.screenOrigin.y
      const dz = Math.hypot(dx, dy)
      const r = mim.options.dragResistance ||
        foundry.canvas.interaction.MouseInteractionManager.DEFAULT_DRAG_RESISTANCE_PX
      if (dz >= r) mim_handleDragStart(event)
    }

    // Continue a drag event
    if (mim.state === mim.states.DRAG) mim_handleDragMove(event)
  }

  const mim_handleDragStart = (event) => {
    clearTimeout(mim.constructor.longPressTimeout)
    const action = mim._dragRight ? 'dragRightStart' : 'dragLeftStart'
    if (!mim.can(action, event)) {
      mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
      mim.cancel(event)
      return
    }
    mim.state = mim.states.DRAG
    if (mim.callback(action, event) === false) {
      mim.state = mim.states.GRABBED
      return mim_debug(action, event, mim.handlerOutcomes.REFUSED)
    }
    return mim_debug(action, event, mim.handlerOutcomes.ACCEPTED)
  }

  const mim_handleDragMove = (event) => {
    clearTimeout(mim.constructor.longPressTimeout)
    const action = mim._dragRight ? 'dragRightMove' : 'dragLeftMove'
    if (!mim.can(action, event)) return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
    const handled = mim.callback(action, event)
    return mim_debug(action, event, handled ? mim.handlerOutcomes.ACCEPTED : mim.handlerOutcomes.REFUSED)
  }

  const mim_assignOriginData = (event) => {
    // Set the origin point from layer local position
    mim.interactionData.origin = event.getLocalPosition(mim.layer)

    // Set screenOrigin as the screen coordinates of the origin
    mim.interactionData.screenOrigin = new PIXI.Point(event.global.x, event.global.y)
  }

  const mim_debug = (action, event, outcome = mim.handlerOutcomes.ACCEPTED) => {
    if (CONFIG.debug.mouseInteraction) {
      const name = mim.object.constructor.name
      const targetName = event.target?.constructor.name
      const { eventPhase, type, button } = event
      const state = Object.keys(mim.states)[mim.state.toString()]
      let msg = `${name} | ${action} | state:${state} | target:${targetName} | phase:${eventPhase} | type:${type} | `
        + `btn:${button} | skipped:${outcome <= -2} | allowed:${outcome > -1} | handled:${outcome > 1}`
      console.debug(msg)
    }
  }

  mim_handleRightDown(mouseDownEvent)
  // `return false` will call stopPropagation and preventDefault
  return false
}

const handleMouseUp_forMiddleClickDrag = (mouseUpEvent) => {
  if (!getSetting('middle-mouse-pan')) return true
  if (mouseUpEvent.data.originalEvent.button !== 1) return true // buttons other than middle click - ignoring
  const mim = canvas.mouseInteractionManager
  // Copying (and mildly altering) code from MouseInteractionManager functions. mostly replacing references

  const mim_handlePointerUp = (event) => {
    //clearTimeout(mim.constructor.longPressTimeout);
    //// If this is a touch hover event, treat it as a drag
    //if ( (mim.state === mim.states.HOVER) && (event.pointerType === "touch") ) {
    //  mim.state = mim.states.DRAG;
    //}

    // Save prior state
    const priorState = mim.state

    // Update event data
    mim.interactionData.destination = event.getLocalPosition(mim.layer, mim.interactionData.destination)

    if (mim.state >= mim.states.DRAG) {
      event.stopPropagation()
      if (event.type.startsWith('right') && !mim._dragRight) return
      if (mim.state === mim.states.DRAG) mim_handleDragDrop(event)
    }

    // Continue a multi-click drag workflow
    if (event.defaultPrevented) {
      mim.state = priorState
      return mim_debug('mouseUp', event, mim.handlerOutcomes.SKIPPED)
    }

    // Handle the unclick event
    mim_handleUnclick(event)

    // Cancel the workflow
    return mim_handleDragCancel(event)
  }

  const mim_handleDragDrop = (event) => {
    const action = 'dragRightDrop'
    if (!mim.can(action, event)) return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)

    // Was the drag-drop event handled by the callback?
    mim.state = mim.states.DROP
    if (mim.callback(action, event) === false) {
      mim.state = mim.states.DRAG
      return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
    }

    // Update the workflow state
    return mim_debug(action, event)
  }

  const mim_handleDragCancel = (event) => {
    mim.cancel(event)
  }

  const mim_handleUnclick = (event) => {
    // I'm just simplifying the code here
    event.stopPropagation()
  }

  const mim_debug = (action, event, outcome = mim.handlerOutcomes.ACCEPTED) => {
    if (CONFIG.debug.mouseInteraction) {
      const name = mim.object.constructor.name
      const targetName = event.target?.constructor.name
      const { eventPhase, type, button } = event
      const state = Object.keys(mim.states)[mim.state.toString()]
      let msg = `${name} | ${action} | state:${state} | target:${targetName} | phase:${eventPhase} | type:${type} | `
        + `btn:${button} | skipped:${outcome <= -2} | allowed:${outcome > -1} | handled:${outcome > 1}`
      console.debug(msg)
    }
  }

  mim_handlePointerUp(mouseUpEvent)
  // `return false` will call stopPropagation and preventDefault
  return false
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

const avoidLockViewIncompatibility = () => {
  Hooks.on('libWrapper.ConflictDetected', (p1, p2, target, frozenNames) => {
    if ((p1 === MODULE_ID && p2 === 'LockView') || p2 === MODULE_ID && p1 === 'LockView') {
      if (frozenNames.includes('foundry.canvas.Canvas.prototype._onDragCanvasPan')) {
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
  // migrating away from this...
  game.settings.register(MODULE_ID, 'min-max-zoom-override', {
    name: 'OLD min-max-zoom-override',
    scope: 'client',
    config: false,
    type: Number,
    default: null,
  })
  // ...to these two:
  game.settings.register(MODULE_ID, 'max-zoom-override', {
    name: localizeSetting('max-zoom-override', 'name'),
    hint: localizeSetting('max-zoom-override', 'hint'),
    scope: 'client',
    config: true,
    default: 3,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'min-zoom-override', {
    name: localizeSetting('min-zoom-override', 'name'),
    hint: localizeSetting('min-zoom-override', 'hint'),
    scope: 'client',
    config: true,
    default: 1 / 3,
    type: Number,
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
    onChange: disableBrowserGesturesIfTouchpad,
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
  game.settings.register(MODULE_ID, 'invert-vertical-scroll', {
    name: localizeSetting('invert-vertical-scroll', 'name'),
    hint: localizeSetting('invert-vertical-scroll', 'hint'),
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

  // Register Keybindings

  game.keybindings.register(MODULE_ID, 'toggleTouchpadMode', {
    name: localizeKeybinding('toggle-touchpad-mode', 'name'),
    editable: [],
    onDown: () => {
      // will toggle between Mouse and Touchpad
      const mode = ['Mouse', 'Alternative'].includes(game.settings.get(MODULE_ID, 'pan-zoom-mode'))
        ? 'Touchpad'
        : 'Mouse'
      game.settings.set(MODULE_ID, 'pan-zoom-mode', mode)
      ui.notifications.info(localizeKeybinding('notifications', mode))
    },
    repeat: false,
  })

  game.keybindings.register(MODULE_ID, 'toggleAlternativeMode', {
    name: localizeKeybinding('toggle-alternative-mode', 'name'),
    editable: [],
    onDown: () => {
      // will toggle between Mouse and Alternative
      const mode = ['Mouse', 'Touchpad'].includes(game.settings.get(MODULE_ID, 'pan-zoom-mode'))
        ? 'Alternative'
        : 'Mouse'
      game.settings.set(MODULE_ID, 'pan-zoom-mode', mode)
      ui.notifications.info(localizeKeybinding('notifications', mode))
    },
    repeat: false,
  })

  avoidLockViewIncompatibility()
})

Hooks.once('setup', function () {
  libWrapper.register(
    MODULE_ID,
    'foundry.canvas.Canvas.prototype._onMouseWheel',
    (event) => {
      return canvas_onMouseWheel_override(event)
    },
    'OVERRIDE',
  )
  libWrapper.register(
    MODULE_ID,
    'foundry.canvas.Canvas.prototype._onDragCanvasPan',
    _onDragCanvasPan_override,
    'OVERRIDE',
  )
  disableMiddleMouseScrollIfMiddleMousePanIsActive(getSetting('middle-mouse-pan'))
  disableBrowserGesturesIfTouchpad(getSetting('pan-zoom-mode'))
  // Canvas.maxZoom is bounded lower inside the libwrapped function, but setting it this high ensures core foundry code
  // doesn't over-constrain it
  // (e.g. for initial scene zoom)
  CONFIG.Canvas.maxZoom = 999
  CONFIG.Canvas.minZoom = 1 / 999 // TODO minZoom will probably be available in V13 testing 4 or later
  console.log('Done setting up Zoom/Pan Options.')
})

Hooks.on('canvasReady', () => {
  canvas.stage.on('mousedown', handleMouseDown_forMiddleClickDrag)
  canvas.stage.on('mouseup', handleMouseUp_forMiddleClickDrag)  // technically this isn't necessary, based on testing
})
