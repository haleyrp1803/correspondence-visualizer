# Changelog

## `43403c3` — Restore detail to maintainer documentation
- Added back missing detail in `MAINTAINERS_GUIDE.md`
- Added back missing detail in `CHANGELOG.md`
- Preserved the current stable inspector-navigation documentation state

## `02ecb11` — Document inspector navigation feature set
- Updated `README.md`
- Updated `MAINTAINERS_GUIDE.md`
- Updated `CHANGELOG.md`
- Recorded the stable inspector-navigation feature set and the deferred Back-button anchoring polish

## `5af819b` — Add inspector back navigation
- Added a working inspector-internal Back button
- Added a small history model for inspector-internal navigation only
- Kept ordinary map clicks out of the Back-history model

## `b3e6fe8` — Add place navigation sections to person inspector
- Added `src/InspectorPersonPlaces.jsx`
- Added person-detail place-navigation sections:
  - **Places this person sent letters to**
  - **Places where this person received letters**
- Added place-detail navigation from those sections

## `6772c1d` — Clarify connected correspondents count label
- Changed the connected-correspondents section title to **Correspondents by letter count**
- Made the visible counts easier to interpret

## `ab0e1fe` — Show relationship counts in connected correspondents buttons
- Added visible `(count)` labels to connected-correspondent buttons
- Preserved person-detail navigation behavior

## `06e0b3b` — Sort connected correspondents by relationship weight
- Removed the earlier truncation cap
- Sorted connected correspondents strongest-first by relationship weight

## `17be829` — Add connected correspondents inspector navigation section
- Added `src/InspectorConnectedCorrespondents.jsx`
- Added person-to-person inspector navigation through explicit buttons
- Avoided brittle inline inspector rewrites by using an extracted component

## `cfa6d63` — Add inspector selection plumbing for person and place detail targets
- Added `person-detail` and `place-detail` selection plumbing
- Extended helper-layer selection resolution without yet exposing clickable inspector UI

## `2b3c265` — Document person force layout and force-view background behavior
- Updated `README.md`
- Updated `MAINTAINERS_GUIDE.md`
- Updated `CHANGELOG.md`

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

## Deferred note
- A visual-only refinement to anchor the inspector Back button directly beneath the close `×` was attempted and intentionally deferred after unstable or unsatisfactory results.
