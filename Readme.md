# Zoom/Pan Options

FoundryVTT module to change mouse scroll behavior. It has four settings, which can be toggled individually.

## Zoom around cursor
- When zooming in and out, the camera will zoom "around" the cursor, like in many other applications.
- This does not affect PageUp, PageDown, or Numpad +/-. Those will still zoom into or out of the center of the screen.
 
## Touchpad Scrolling (also useful for Magic Mouse)
- Vertical mouse scroll will now pan up and down (instead of zooming)
- Horizontal mouse scroll will now pan left and right
- Panning with two fingers on a touchpad should use these two and should be nicer
- Ctrl+scroll will now zoom in and out (like previous vertical scroll) (instead of precisely rotating a token)
- Pinching with two fingers on a touchpad should use this and should be nice
- Shift+scroll will now precisely rotate a token (like previous ctrl+scroll, but a bit nicer)

## Zoom speed multiplier
- Useful if your zoom is too sensitive.

## Touchpad rotation sensitivity threshold
- Prevents over-sensitive token rotation. Applies to shift+panning (touchpad).

# Credits

Thanks, mrkwnzl#7407, for the touchpad support!