# Changelog
All notable changes to this project will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.9] - 2021-12-26
- Explicitly marked libWrapper as a dependency, and updated libWrapper shim code

## [1.6.8] - 2021-12-24
- Fixed compatibility with Foundry v9.232 (#35, #37) (thank you @caewok for the contribution!)
- Marked as compatible with Foundry v9 stable

## [1.6.5] - 2021-07-06
- Fixed minimum/maximum zoom not carrying over after refreshing ([#28](https://github.com/itamarcu/ZoomPanOptions/issues/28))
- Updated default min/max zoom scale to be just like the Foundry default - i.e. `3.0`.
- Fixed rotation not working on Firefox ([#29](https://github.com/itamarcu/ZoomPanOptions/issues/29))

## [1.6.3] - 2021-07-06
- Added automatic detection of touchpad movements in "Default" mode
- Added "DefaultMouse" mode which prevents this automatic detection

## [1.6.1] - 2021-05-29
- Added middle mouse pan setting
- Added changelog and license to repository

## [1.5.3] - 2021-02-05
- Added invert vertical scroll setting
- Introduced new bugs and promptly fixed them

## [1.4.0] - 2020-12-05
- Added min/max zoom override setting
- Fixed compatibility with Foundry v0.7.x

## [1.3.7] - 2020-09-17
- Added ability to use alt/option/meta key
- Fixed some minor bugs
- Improved readme
- Improved file structure

## [1.3.0] - 2020-09-16
- Integrated Canvas Scroll (thanks @akrigline!)
- Reworked to use 3 modes
- Added LibWrapper as optional dependency

## 1.0.0 - 2020-09-15
- Created the module, with initial feature set

## See also: [Unreleased]

[Unreleased]: https://github.com/itamarcu/ZoomPanOptions/compare/1.6.9...HEAD
[1.3.0]: https://github.com/itamarcu/ZoomPanOptions/compare/1.0.0...1.3.0
[1.3.7]: https://github.com/itamarcu/ZoomPanOptions/compare/1.3.0...1.3.7
[1.4.0]: https://github.com/itamarcu/ZoomPanOptions/compare/1.3.7...1.4.0
[1.5.3]: https://github.com/itamarcu/ZoomPanOptions/compare/1.4.0...1.5.3
[1.6.1]: https://github.com/itamarcu/ZoomPanOptions/compare/1.5.3...1.6.1
[1.6.3]: https://github.com/itamarcu/ZoomPanOptions/compare/1.6.1...1.6.3
[1.6.5]: https://github.com/itamarcu/ZoomPanOptions/compare/1.6.3...1.6.5
[1.6.8]: https://github.com/itamarcu/ZoomPanOptions/compare/1.6.5...1.6.8
[1.6.9]: https://github.com/itamarcu/ZoomPanOptions/compare/1.6.8...1.6.9
