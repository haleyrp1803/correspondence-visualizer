# Changelog

This changelog is intentionally explicit about recent commits so the project’s development trajectory can be explained step by step.

## `391174a` — Refresh Peridot documentation for publication baseline

- Updated `README.md`, `MAINTAINERS_GUIDE.md`, and `CHANGELOG.md`
- Renamed the documented project identity to **Peridot**
- Aligned the documentation with the current publishable browser baseline
- Recorded the recent publication trajectory more explicitly

## `951b450` — Replace embedded sample data with current publication dataset

- Replaced the embedded sample/fallback data in `src/App.jsx`
- Set the built-in browser/demo state to use the current intended publication dataset
- Preserved existing app behavior while changing the default embedded content
- Established the publication dataset baseline used for browser release

## `f859595` — Add itch.io HTML5 build packaging support

- Updated `vite.config.js` to use a relative base path for safer subdirectory hosting
- Added `Build_Itch_Zip.py`
- Established a repeatable build-and-package workflow for itch.io HTML5 publication
- Kept generated ZIP artifacts out of normal source commits

## `f959fac` — Use countries50m as the fixed basemap

- Replaced the earlier fixed `countries110m` basemap with `countries50m`
- Simplified the committed map baseline after experimental multi-scale atlas work was abandoned
- Preserved the rest of the map interaction and rendering flow

## `b1fdbd5` — Update maintainer handoff documentation

- Refreshed the maintainer handoff baseline used for later bounded passes
- Improved the documentation foundation for subsequent app and publication work

## `dd12281` — Normalize summary panel spacing

- Added matching top spacing above **Summary and Diagnostics**
- Restored more consistent vertical rhythm inside the **OPTIONS** stack of the left control panel

## `4fdaf73` — Rename timeline panel heading

- Renamed **Timeline and playback** to **Timeline**
- Kept timeline behavior unchanged

## `db5bb1f` — Tighten left panel organization

- Reorganized the left control panel
- Added a **Visualization Type** section
- Moved visualization-mode controls into that section
- Shifted the section order toward the current preferred arrangement
- Continued the cleanup of the panel’s top-level organization

## `ba746b1` — Simplify theme panel text

- Renamed **Map appearance** to **Theme**
- Removed explanatory theme copy that no longer matched the preferred presentation
- Kept theme behavior unchanged

## `c0fc600` — Retune active country fills for peridot and modern maps

- Retuned Peridot active-country fill
- Retuned Modern active-country fill
- Left Early Modern active-country coloring unchanged

## `56f0080` — Highlight countries containing visible nodes

- Added active-country highlighting for countries containing currently visible nodes
- Used hint matching and coordinate fallback to determine country membership
- Improved geographic context without changing core route behavior

## `5cbe9c3` — Refine early modern node hover and selected colors

- Tuned Early Modern hover state
- Tuned Early Modern selected state
- Preserved white node outlines for contrast

## `850176f` — Refine hovered and selected node states

- Strengthened hover/selected node differentiation
- Continued theme-aware node-state polish

---

# Full development history

This section is meant to preserve the full step-by-step development history for future reference.

## Apr 23, 2026

### `391174a` — Refresh Peridot documentation for publication baseline
- Refreshed the main publication-facing and maintainer-facing documentation
- Updated the documented baseline to the current publishable Peridot state

### `951b450` — Replace embedded sample data with current publication dataset
- Replaced the embedded dataset used when the app launches without uploaded files
- Set the browser/demo baseline to the intended publication dataset

### `f859595` — Add itch.io HTML5 build packaging support
- Added committed support for building and packaging an itch.io-ready HTML5 upload

### `f959fac` — Use countries50m as the fixed basemap
- Simplified the map baseline by switching to a fixed `countries50m` atlas

## Apr 21, 2026

### `b1fdbd5` — Update maintainer handoff documentation
- Refreshed the handoff documentation baseline

### `dd12281` — Normalize summary panel spacing
- Fixed spacing/rhythm around the summary panel area

### `4fdaf73` — Rename timeline panel heading
- Renamed the timeline panel heading

### `db5bb1f` — Tighten left panel organization
- Reorganized the left control panel more tightly

### `ba746b1` — Simplify theme panel text
- Simplified wording in the theme panel

### `c0fc600` — Retune active country fills for peridot and modern maps
- Adjusted active-country fill styling for Peridot and Modern themes

### `56f0080` — Highlight countries containing visible nodes
- Added country highlighting for countries that contain visible nodes

### `5cbe9c3` — Refine early modern node hover and selected colors
- Tuned node hover/selection colors specifically for the Early Modern theme

### `850176f` — Refine hovered and selected node states
- Improved hover/selected node-state styling

### `3e43dc9` — Add hovered node color feedback
- Added color feedback for hovered nodes

### `919ea5f` — Increase green layering in peridot map theme
- Strengthened the layered green look in the Peridot map theme

### `c666d29` — Add peridot default app theme
- Added the Peridot default theme to the app

### `9be5f4a` — Tighten maintainer docs audit fixes
- Cleaned up maintainer-doc audit issues

### `43403c3` — Restore detail to maintainer documentation
- Expanded/restored detail in the maintainer documentation

### `02ecb11` — Document inspector navigation feature set
- Documented the new inspector navigation behavior and features

### `5af819b` — Add inspector back navigation
- Added back-navigation capability inside the inspector

### `b3e6fe8` — Add place navigation sections to person inspector
- Added place-navigation sections inside the person inspector

### `6772c1d` — Clarify connected correspondents count label
- Improved the label wording for connected-correspondents counts

### `ab0e1fe` — Show relationship counts in connected correspondents buttons
- Added relationship counts to the connected-correspondents buttons

### `06e0b3b` — Sort connected correspondents by relationship weight
- Ordered connected correspondents by strongest relationship weight first

### `17be829` — Add connected correspondents inspector navigation section
- Added an inspector section for navigating connected correspondents

### `cfa6d63` — Add inspector selection plumbing for person and place detail targets
- Added the internal selection plumbing needed for person/place inspector targeting

## Apr 20, 2026

### `2b3c265` — Document person force layout and force-view background behavior
- Documented the person-force layout behavior and the force-view background decision

### `ffb5a30` — Hide map backdrop in force-directed person view
- Removed the geographic backdrop when the app is in force-directed person mode

### `225c7e4` — Wire person force layout into App graph builder
- Connected the person-force layout logic into the app’s graph-building flow

### `3480858` — Add pre-settled d3-force person network layout
- Added a pre-settled force-layout implementation for the person network

### `81a75d0` — Add d3-force dependency for person-network layout work
- Added the `d3-force` dependency to support force-directed person layout work

### `5a17721` — Replace README with current repository overview
- Replaced the README with a fuller repository overview

### `8241ae1` — Add screenshots and standardize image paths
- Added screenshots and normalized image path usage

### `99584a9` — Document completed export behavior fixes
- Documented the completed export-related fixes

### `5575007` — Reflect visible date range in export metadata
- Updated export metadata so it matched the currently visible timeline range

### `c9f010e` — Fix PNG export color rendering
- Corrected color rendering problems in PNG exports

### `248833a` — Document completed timeline behavior fixes
- Documented the timeline fixes once they were complete

### `1b2655e` — Preserve viewport during timeline playback interactions
- Fixed timeline behavior so playback interactions would not reset the current viewport unexpectedly

### `fd0d77a` — Add viewport timeline reset audit
- Added documentation/audit work around viewport resets during timeline interactions

### `6c41fce` — Constrain timeline end date to selected start date
- Prevented the timeline end date from being set earlier than the start date

### `099882a` — Add control panel dependency map
- Added a dependency map document for the control panel

### `a53ccbf` — Add maintainer comments for control panel architecture
- Added explanatory maintainer comments about how the control panel is structured

### `c526e6c` — Document deferred export panel extraction
- Recorded that export panel extraction work was deferred

### `4ddf444` — Document deferred PNG export issue
- Documented an unresolved PNG export problem that was being deferred

### `5bbdad8` — Extract export helpers from App
- Moved export-related helper logic out of `App.jsx`

### `897e06a` — Document step 2 timeline work and deferred follow-ups
- Recorded what was done in timeline step 2 and what remained deferred

### `383ecc0` — Extract timeline playback panel from App
- Pulled the timeline playback panel UI into supporting components/modules

### `b2dbe35` — Extract timeline playback helpers from App
- Moved timeline playback helper logic out of `App.jsx`

## Apr 17, 2026

### `dad15a4` — Update maintainer guide and add changelog
- Expanded/updated maintainer docs and added a changelog file

### `145cfc2` — Extract map interaction handlers from App
- Separated map interaction handler logic from the main app file

### `30e5b1b` — Extract interaction resolution helpers from App
- Moved interaction-resolution helpers into a separate support file

### `181a63e` — Extract map stage components from App
- Pulled map-stage UI/render components out of `App.jsx`

### `02dcfc4` — Extract pure map layout helpers from App
- Began decomposing `App.jsx` by moving pure map-layout helpers into their own module

### `7742149` — Update README to reflect current app and workflow
- Refreshed the README so it matched the app and the working process at that stage

### `c3f856f` — Add maintainer guide and project workflow charter
- Added the formal maintainer guide and workflow charter documents

### `8e07339` — Use dark navy modern node labels with white outline
- Switched modern node labels to a dark navy style with white outlining for legibility

### `0791ffd` — Strengthen modern node label typography
- Improved the typography/styling of modern-theme node labels

### `100d3fb` — Refine modern theme colors and label contrast
- Tuned the modern theme’s colors and improved label contrast

### `b7e4749` — Use clean themed canvas for force-directed person view
- Gave the force-directed person view a cleaner themed background/canvas treatment

### `f207a37` — Implement true force-directed person layout
- Added the real force-directed person-network layout

### `e4f64c6` — Remove stray project folders from repo root
- Cleaned the repository root by removing extra folders

### `80bbb97` — Adjust shared edge multiplier to 5
- Changed the relationship/edge weighting multiplier to 5

### `db38072` — Checkpoint before applying person scaling update
- Saved a stable checkpoint before changing person-view scaling

### `eb3ba4b` — Initial rebuilt app baseline
- Established the rebuilt app as the new starting point
