# [Zoom/Pan Options](https://foundryvtt.com/packages/zoom-pan-options/)

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/itamarcu/ZoomPanOptions?style=for-the-badge) 
![GitHub Releases](https://img.shields.io/github/downloads/itamarcu/ZoomPanOptions/latest/total?style=for-the-badge) 
![GitHub All Releases](https://img.shields.io/github/downloads/itamarcu/ZoomPanOptions/total?style=for-the-badge&label=Downloads+total)  

FoundryVTT module to change mouse scroll behavior. It has several settings, which can be toggled individually, and stored locally (per client).

To install, browse for it in the module browser, or [directly copy the manifest link for the latest release](https://github.com/itamarcu/ZoomPanOptions/releases/latest/download/module.json).

# Features

## Zoom around cursor
- When zooming in and out, the camera will stay focused on the cursor, like in many other applications.
- This does not affect PageUp, PageDown, or Numpad +/-. Those will still zoom focused on the center of the screen.

## Disable zoom rounding
- Disables default Foundry behavior, which rounds zoom to the nearest 1%. Will make zooming smoother, especially for touchpad users.

## Minimum/Maximum Zoom Override
- Override for the minimum and maximum zoom scale limits. 10 is the Foundry default - you can't zoom in to get a bigger than a x10 scale closeup, or zoom out to get a smaller than a x0.1 "wide shot" of the scene. For example, if you change this to 20, you'll be able to zoom in twice as close and zoom out twice as far.
 
## "Default" mode
- Same as the Foundry behavior

## "Touchpad" mode
- Pan with two-finger drag on the touchpad.
- Zoom with two-finger pinch or Ctrl+scroll.
- Rotate with Shift+scroll and Ctrl+Shift+scroll.
- (Ctrl can be replaced with Cmd (mac) or WinKey (windows), as usual in Foundry)

## "Alternative" mode
- Pan with touchpad, or with mouse: vertical mouse scroll will pan up and down, and horizontal mouse scroll will pan left and right.
- Zoom with two-finger pinch or Ctrl+scroll.
- Rotate with Alt+Shift+scroll and Alt+Ctrl+scroll.
- (Ctrl can be replaced with Cmd (mac) or WinKey (windows), as usual in Foundry)

## Pan speed multiplier
- Only used in touchpad and alternative modes. Multiplies pan speed. Defaults to 1, which should be close to the pan speed when right-click-dragging the canvas.

## Zoom speed multiplier
- Useful if your zoom is too sensitive, or not sensitive enough.
- Set to 0 for default Foundry behavior (5% zoom per mouse tick, always).
- Set to 1 for zooming based on scroll delta, which should be similar to default zoom for most common mouse types.
- Set to 0.1 for slower zooming, or 10 for faster zooming.
- Technically you can give this a negative value to flip your zoom directions, if you're an oddball. 

# Credits

Thanks to mrkwnzl#7407 for the touchpad support and testing!

Thanks to akrigline/Calego for merging with CanvasScroll and helping with libwrapper and workflows! 

# [Cursor Zoom](https://github.com/itamarcu/CursorZoom)
My old foundry module, that only had the "Zoom around cursor" feature, and did not allow configuring it in the settings for each player.
If you were a user of Cursor Zoom, please uninstall it and install this module. Your players will be able to each set their own preference.
