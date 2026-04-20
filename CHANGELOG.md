# Changelog

## `ffb5a30` — Hide map backdrop in force-directed person view
- Removed the geographic map backdrop from the force-directed person view
- Kept the themed stage background visible in force mode
- Left geographic routes and geographic-anchor person mode unchanged

## `225c7e4` — Wire person force layout into App graph builder
- Wired the new person force-layout helper into `src/App.jsx`
- Replaced the old radial placeholder branch in the person force mode
- Kept the geographic-anchor person layout separate

## `3480858` — Add pre-settled d3-force person network layout
- Added `src/personForceLayoutHelpers.js`
- Introduced a bounded pre-settled `d3-force` layout helper for person-network force mode
- Kept the simulation as a layout step rather than a live continuously ticking scene

## `81a75d0` — Add d3-force dependency for person-network layout work
- Added `d3-force` to project dependencies
- Verified the project still installed and built cleanly before runtime wiring

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

## `4ddf444` — Document deferred PNG export issue
- Updated maintainer-facing docs to record the deferred PNG export issue
- Recorded the PNG export problem as a later purpose-driven export bug pass

## `c526e6c` — Document deferred export panel extraction
- Updated maintainer-facing docs to record that Step 3B was attempted and rolled back
- Recorded export panel extraction as a deferred narrow future target rather than routine cleanup

## `a53ccbf` — Add maintainer comments for control panel architecture
- Added maintainer-facing comments to `src/App.jsx`
- Marked fragile control-panel boundaries and dependency hubs directly in code comments

## `099882a` — Add control panel dependency map
- Added `CONTROL_PANEL_DEPENDENCY_MAP.md`
- Recorded the control-panel render path, fragility analysis, and safer future strategy

## `fd0d77a` — Add viewport timeline reset audit
- Added `VIEWPORT_TIMELINE_AUDIT.md`
- Recorded the likely viewport reset trigger and the safest fix strategy

## `6c41fce` — Constrain timeline end date to selected start date
- Prevented the end date from being selected earlier than the current start date
- Pulled the end date forward automatically when the start date moves past it

## `1b2655e` — Preserve viewport during timeline playback interactions
- Narrowed the viewport reset trigger so ordinary playback progression no longer recenters the map unexpectedly
- Kept the fix inside the existing working panel boundary without structural panel refactoring

## `248833a` — Document completed timeline behavior fixes
- Updated maintainer-facing docs to record the completed timeline behavior fixes
- Preserved the distinction between completed behavior work and deferred Step 2C structural cleanup

## `c9f010e` — Fix PNG export color rendering
- Updated the export rasterization pipeline so PNG output preserves the intended map colors
- Inlined computed CSS-variable values into the serialized export SVG before rasterization

## `5575007` — Reflect visible date range in export metadata
- Updated export metadata so the header reflects the effective visible date subset at export time
- Improved export accuracy for paused or partial playback states

## Deferred work note: timeline/playback
- Step 2C (deeper timeline/playback render/handler boundary cleanup) was attempted and rolled back.
- It remains deferred for later, purpose-driven work rather than routine structural cleanup.

## Deferred work note: export
- Step 3B (export panel extraction) was attempted and rolled back after triggering the same control-panel white-screen failure pattern seen in other fragile panel-boundary changes.

## Completed timeline behavior goals
- Preserve the user's current map zoom/pan position during timeline playback interactions.
- Prevent selection of an end date earlier than the selected start date.

## Completed export behavior goals
- Fix PNG export color rendering so raster output preserves the intended map colors.
- Reflect the visible date subset in export metadata rather than only the broader selected date window.

## Completed person-network behavior goals
- Replace the old radial placeholder in person force mode with a true pre-settled `d3-force` layout.
- Render force-directed person mode on a clean theme-driven background rather than over the geographic map.
