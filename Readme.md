# [Zoom/Pan Options](https://foundryvtt.com/packages/zoom-pan-options/)

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/itamarcu/ZoomPanOptions?style=for-the-badge) 
![GitHub Releases](https://img.shields.io/github/downloads/itamarcu/ZoomPanOptions/latest/total?style=for-the-badge) 
![GitHub All Releases](https://img.shields.io/github/downloads/itamarcu/ZoomPanOptions/total?style=for-the-badge&label=Downloads+total)  
![Latest Supported Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://github.com/itamarcu/ZoomPanOptions/raw/master/module.json)

FoundryVTT module to change zooming and panning through the mouse or a touchpad. It has several settings, which can be toggled individually, and stored locally (per client).

To install, browse for it in the module browser, or [directly copy the manifest link for the latest release](https://github.com/itamarcu/ZoomPanOptions/releases/latest/download/module.json).

# Features

## Zoom around cursor
- When zooming in and out, the camera will stay focused on the cursor, like in many other applications.
- This does not affect PageUp, PageDown, or Numpad +/-. Those will still zoom focused on the center of the screen.

## Middle-mouse to pan
- Holding the middle mouse button and dragging around will pan around the map, just like the right mouse button, instead of showing the "auto scroll" icon (which is useless in Foundry).
- This will mimic the default right-mouse panning, though it will ignore tokens, tiles, etc (instead of selecting them).

## Minimum/Maximum Zoom Override
- Override for the minimum and maximum zoom scale limits. 3 is the Foundry default - you can't zoom in to get a bigger than a x3 scale closeup, or zoom out to get a smaller than a x0.3 "wide shot" of the scene. For example, if you change this to 6, you'll be able to zoom in twice as close and zoom out twice as far.  A value of 10 is usually enough to fill the screen with a single token or with the entire scene

## Drag resistance mode
### Foundry Default
- This is the minimum distance you need to move your cursor for a mouse drag event to be triggered.
  When it's too high you'll feel a dead zone when making small mouse drags (e.g. short pans, small drawings).
  Recommended setting: "Scaling", which scales to be about the visual size of a tool button
- Foundry Default is ~25 constantly (25% of grid size), which can feel bad, particularly when zoomed in

### Responsive
- 0.1 constantly, very responsive to pan/draw motions but makes it hard to ping (long press)

### Scaling (default)
- Scales to always be about 1% of screen width

## Pan/Zoom Mode:
### "Mouse" mode
- Same as the Foundry behavior

### "Touchpad" mode
- Pan with two-finger drag on the touchpad.
- Zoom with two-finger pinch or Ctrl+scroll.
- Rotate with Shift+scroll and Ctrl+Shift+scroll.
  (Note: if you're using a touchpad and you want to rotate a token, I recommend the [Alternative Rotation](https://github.com/itamarcu/AlternativeRotation) module - shift-dragging a token is easier than trying to accurately scroll the right amount/speed)
- (Ctrl can be replaced with Cmd (mac) or WinKey (windows), as usual in Foundry)

### "Alternative" mode
- Pan with touchpad, or with mouse: vertical mouse scroll will pan up and down, and horizontal mouse scroll will pan left and right.
- Zoom with two-finger pinch or Ctrl+scroll.
- Rotate with Alt+Shift+scroll and Alt+Ctrl+scroll.
- (Ctrl can be replaced with Cmd (mac) or WinKey (windows), as usual in Foundry)

## Auto-detect touchpad
- Will auto-detect touchpad movements (any "scroll" event that includes both vertical and horizontal components), and treat them as if the "Touchpad" or "Alternative" mode is active.

## Pan speed multiplier
- Only used in touchpad and alternative modes. Multiplies pan speed. Defaults to 1, which should be close to the pan speed when right-click-dragging the canvas.

## Zoom speed multiplier
- Useful if your zoom is too sensitive, or not sensitive enough.
- Set to 0 for default Foundry behavior (5% zoom per mouse tick, always).
- Set to 1 for zooming based on scroll delta, which should be similar to default zoom for most common mouse types, but will feel smoother for some touchpads.
- Set to 0.1 for slower zooming, or 10 for faster zooming.
- Technically you can give this a negative value to flip your zoom directions, if you're an oddball. 

## Invert vertical scroll
- Only used in touchpad and alternative modes. If set to true, you will scroll up when dragging/scrolling down.

# Credits

Thanks to mrkwnzl#7407 for the touchpad support and testing!

Thanks to akrigline/Calego for merging with CanvasScroll and helping with libwrapper and workflows! 

Thanks to TPNils for the touchpad auto-detection help!

# [Cursor Zoom](https://github.com/itamarcu/CursorZoom)
My old foundry module, that only had the "Zoom around cursor" feature, and did not allow configuring it in the settings for each player.
If you were a user of Cursor Zoom, please uninstall it and install this module. Your players will be able to each set their own preference.
