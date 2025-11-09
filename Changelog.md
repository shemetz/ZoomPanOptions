## 2.0.4 - 2025-11-10
- Fixed #72 (min/max zoom not working)

## 2.0.2 - 2025-08-20
- Added French localization
- Added clarification to settings:  initial zoom level limits the limit overrides

## 2.0.1 - 2025-07-20
- Disabled browser back/forward gestures when using touchpad mode
- Added known bugs to readme :(

## 2.0.0 - 2025-03-23
- Updated to Foundry V13+ compatibility (only)
- Removed Drag Resistance override -- now core foundry has good drag resistance :)
- Removed min/max zoom settings per scene, now they're just determined by your own settings plus the initial view scale
- Refactored a lot of code to continue working in v13 and to stay up to date
- KNOWN BUG: touchpad scroll is different in vertical and horizontal directions, which makes it hard to use the touchpad for panning (#67)
- KNOWN BUG: rotating tokens in "alternative" mode doesn't work as it's supposed to (#69)

## 1.14.4 - 2025-01-03
- Improved github workflow automation

## 1.14.3 - 2024-06-21
- Fix scene config window height bug (#62)

## 1.14.2 - 2024-06-20
- Fixed mid-click pan bug in v12 (#61)

## 1.14.1 - 2024-05-25
- Fixed compatibility with Foundry V12 (#60)
- Improved drag resistance consistency, which means pinging and panning while the cursor is over a token will be easier

## 1.13.0 - 2024-01-13
- Split setting into minimum zoom and maximum zoom (with simple migration) (#55, thanks @IHaveThatPower)
- Added per-scene zoom settings (#55, thanks @IHaveThatPower)

## 1.12.0 - 2023-11-18
- Fixed rate limit (#50)
- Added clarifications that auto-detect is buggy
- Removed libwrapper shim (it's common enough, people will just have it enabled)
- Removed old code (pre-foundry-v11)

## 1.11.0 - 2023-09-03
- Added keyboard shortcuts to flip between modes (#52, thanks @mrkwnzl)

## 1.10.0 - 2023-06-12
- Fixed compatibility with Foundry v11, particularly for middle-mouse pan, though the solution is ugly (#49)

## 1.9.0 - 2023-04-07
- Improved (and fixed) zoom precision - will now actually center exactly on the cursor!
- Fixed incompatibility with grape_juice's isometric module (#48)
- Changed speed-based zoom calculation to be a bit more consistent (my apologies if this messes with your settings!)
- Refactored zoom code to be more readable
- Added localization files to enable translations of settings

## 1.8.6 - 2022-12-06
- Fixed reversed rotation (#43)

## 1.8.5 - 2022-12-04
- Fixed compatibility with Foundry v10.291, bug broke rotation (#42)

## 1.8.4 - 2022-10-05
- Added workaround to fix incompatibility with LockView (#31)

## 1.8.3 - 2022-09-04
- Fixed bug that prevented rotating lights and measured templates
- Changed my username from "itamarcu" to "shemetz"

## 1.8.0 - 2022-08-26
- Added "Drag resistance mode" feature with new default value ("Scaling")
- Removed "Disable Zoom Rounding" option, as it's no longer needed with Foundry v10

## 1.7.2 - 2022-07-02
- FoundryVTT V10 compatibility
- "Disable Zoom Rounding" had to be changed;  please inform me if it's worse now.

## 1.7.0 - 2022-02-25
- Split "auto-detect touchpad" setting out of pan/zoom mode, and made it false by default
- Added settings to change pad and shift values when dragging at the edge of the screen (#33)

## 1.6.10 - 2022-02-08
- Updated libWrapper shim code

## 1.6.9 - 2021-12-26
- Explicitly marked libWrapper as a dependency, and updated libWrapper shim code

## 1.6.8 - 2021-12-24
- Fixed compatibility with Foundry v9.232 (#35, #37) (thank you @caewok for the contribution!)
- Marked as compatible with Foundry v9 stable

## 1.6.5 - 2021-07-06
- Fixed minimum/maximum zoom not carrying over after refreshing ([#28](https://github.com/shemetz/ZoomPanOptions/issues/28))
- Updated default min/max zoom scale to be just like the Foundry default - i.e. `3.0`.
- Fixed rotation not working on Firefox ([#29](https://github.com/shemetz/ZoomPanOptions/issues/29))

## 1.6.3 - 2021-07-06
- Added automatic detection of touchpad movements in "Default" mode
- Added "DefaultMouse" mode which prevents this automatic detection

## 1.6.1 - 2021-05-29
- Added middle mouse pan setting
- Added changelog and license to repository

## 1.5.3 - 2021-02-05
- Added invert vertical scroll setting
- Introduced new bugs and promptly fixed them

## 1.4.0 - 2020-12-05
- Added min/max zoom override setting
- Fixed compatibility with Foundry v0.7.x

## 1.3.7 - 2020-09-17
- Added ability to use alt/option/meta key
- Fixed some minor bugs
- Improved readme
- Improved file structure

## 1.3.0 - 2020-09-16
- Integrated Canvas Scroll (thanks @akrigline!)
- Reworked to use 3 modes
- Added LibWrapper as optional dependency

## 1.0.0 - 2020-09-15
- Created the module, with initial feature set
