# Changelog

## `c3f856f` — Add maintainer guide and project workflow charter
- Added `MAINTAINERS_GUIDE.md`
- Added `PROJECT_WORKFLOW_CHARTER.md`

## `7742149` — Update README to reflect current app and workflow
- Replaced the minimal README with a fuller repository-facing overview
- Aligned top-level project description with the current app and workflow docs

## `02dcfc4` — Extract pure map layout helpers from App
- Added `src/mapLayoutHelpers.js`
- Moved pure map/layout helper logic out of `src/App.jsx`

## `181a63e` — Extract map stage components from App
- Added `src/mapStageComponents.jsx`
- Moved map-stage-adjacent UI/chrome components out of `src/App.jsx`

## `30e5b1b` — Extract interaction resolution helpers from App
- Added `src/interactionHelpers.js`
- Moved pure interaction-resolution helpers out of `src/App.jsx`

## `145cfc2` — Extract map interaction handlers from App
- Added `src/mapInteractionHandlers.js`
- Moved top-level map interaction handler wiring out of `src/App.jsx`

## `dad15a4` — Update maintainer guide and add changelog
- Added `CHANGELOG.md`
- Refreshed maintainer-facing documentation after Step 1 work

## `b2dbe35` — Extract timeline playback helpers from App
- Added `src/timelinePlaybackHelpers.js`
- Moved pure timeline/playback derivation helpers out of `src/App.jsx`

## `383ecc0` — Extract timeline playback panel from App
- Added `src/timelinePlaybackComponents.jsx`
- Moved the timeline/playback panel UI boundary out of `src/App.jsx`

## `897e06a` — Document step 2 timeline work and deferred follow-ups
- Updated maintainer-facing docs to record that Step 2 is complete through 2B
- Recorded deferred timeline goals and the decision to defer Step 2C

## `5bbdad8` — Extract export helpers from App
- Added `src/exportHelpers.js`
- Moved pure export utilities and export row-builder helpers out of `src/App.jsx`

## Deferred work note: timeline/playback
- Step 2C (deeper timeline/playback render/handler boundary cleanup) was attempted and rolled back.
- It remains deferred for later, purpose-driven work rather than routine structural cleanup.

## Deferred work note: export
- PNG download currently renders the map as a blacked-out image.
- Investigate the SVG-to-raster export pipeline later, especially SVG serialization, background handling, and canvas/image rendering behavior.

## Explicit future timeline goals
- Preserve the user's current map zoom/pan position when interacting with timeline playback controls.
- Prevent selection of an end date earlier than the selected start date.
