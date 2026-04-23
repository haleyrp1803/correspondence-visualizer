# Maintainer's Guide

## Purpose

This guide is the architectural handoff document for **Peridot**. It should stay aligned with the committed repository state and with the workflow rules in `PROJECT_WORKFLOW_CHARTER.md`.

It is meant to let a future maintainer understand:

- what the app currently is
- what the important recent commits changed
- what the main fragile zones still are
- what baseline should be used for future bounded passes

---

## Current source of truth

Source-of-truth working folder:

`C:\Users\haley\OneDrive\Desktop\CorrespondenceVisualizer\`

Current clean baseline:

- `951b450` — **Replace embedded sample data with current publication dataset**

Important recent stable points:

- `f859595` — **Add itch.io HTML5 build packaging support**
- `f959fac` — **Use countries50m as the fixed basemap**
- `b1fdbd5` — **Update maintainer handoff documentation**
- `dd12281` — **Normalize summary panel spacing**
- `checkpoint-map-theme-c0fc600` — historical theme checkpoint

The app is now called **Peridot**. Older history may still use the earlier working title **Correspondence Visualizer**.

---

## Current architecture summary

Peridot is a Vite/React/Tailwind correspondence visualizer with two main analytical modes:

- **Geographic view**
- **Person view**

The app currently includes:

- CSV ingestion and normalization
- embedded publication/demo sample data
- graph derivation and aggregation
- interactive SVG-based rendering
- timeline range filtering and playback
- right-panel inspection and linked-record browsing
- theme presets and theme-driven chroming
- export utilities for image and CSV outputs
- itch.io HTML5 build packaging support

The main structural concentration point remains `src/App.jsx`, although multiple helper and panel-adjacent modules have already been extracted.

---

## Current repository shape

Core app files:

- `src/App.jsx`
- `src/index.css`
- `src/main.jsx`

Extracted support modules in `src/`:

- `src/mapLayoutHelpers.js`
- `src/mapStageComponents.jsx`
- `src/interactionHelpers.js`
- `src/mapInteractionHandlers.js`
- `src/timelinePlaybackHelpers.js`
- `src/timelinePlaybackComponents.jsx`
- `src/exportHelpers.js`
- `src/personForceLayoutHelpers.js`
- `src/InspectorConnectedCorrespondents.jsx`
- `src/InspectorPersonPlaces.jsx`
- `src/InspectorBackButton.jsx`

Root-level documentation/workflow files:

- `README.md`
- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`
- `CHANGELOG.md`
- `CONTROL_PANEL_DEPENDENCY_MAP.md`
- `VIEWPORT_TIMELINE_AUDIT.md`

Build/publication helpers:

- `vite.config.js`
- `Build_Itch_Zip.py`

---

## Current committed product baseline

### Basemap

The fixed default basemap is now **`countries50m`**.

This was chosen after a multi-scale atlas experiment proved more complex and less visually satisfying than a stable fixed default. The committed baseline deliberately prefers the simpler stable map state.

### Publication dataset

The embedded sample/fallback data inside `src/App.jsx` now represents the intended **publication/demo dataset**.

This means the app can launch in a meaningful browser-ready state without requiring users to upload files before anything useful appears.

### Itch.io publication support

The project now includes committed support for generating an itch.io-ready HTML5 package:

- `vite.config.js` uses a relative base path
- `Build_Itch_Zip.py` builds the production app and packages the contents of `dist/` into an upload ZIP with `index.html` at the archive root

Generated ZIPs and upload folders are artifacts and should stay out of Git history.

---

## Current functional state

### Visualization modes

- geographic route view
- person-network view

### Person-network layouts

- geographic-anchor layout
- pre-settled force-directed layout

### Inspector capabilities

- hover and click inspection
- linked records browsing
- internal navigation between people and places
- Back button support for inspector-internal navigation

### Timeline capabilities

- full-range vs filtered-range date behavior
- playback controls
- timeline panel UI extracted into supporting components/helpers

### Export capabilities

- SVG export
- PNG export
- nodes CSV export
- edges/routes CSV export

---

## Current theme and panel state

The default full-app theme is **Peridot-inspired**.

Other retained presets still function as map-focused alternatives:

- Early modern map
- Modern map

Important current control-panel state:

- current top-level left-panel grouping uses **DATA** and **OPTIONS**
- key sections include:
  1. Data Inputs
  2. Visualization Type
  3. Display Controls
  4. Timeline
  5. Theme
  6. Export
  7. Summary and Diagnostics

The current panel state reflects recent organization and spacing cleanup already committed before the publication passes.

---

## Recent development trajectory (step by step)

This section is intentionally explicit so a future maintainer can explain how the current state emerged.

### `dd12281` — Normalize summary panel spacing

This stabilized the vertical rhythm in the left control panel and cleaned up spacing above **Summary and Diagnostics**.

### `b1fdbd5` — Update maintainer handoff documentation

This refreshed the documentation baseline used for later bounded passes and made later handoff work safer.

### `f959fac` — Use countries50m as the fixed basemap

This is the key map-baseline simplification commit.

A more complicated atlas-scale experiment was attempted during development but was intentionally abandoned. The final retained decision was to remove that complexity and use a fixed `countries50m` default.

### `f859595` — Add itch.io HTML5 build packaging support

This is the key publication/deployment commit.

It made the app easier to package and publish as a browser-playable HTML5 upload by:

- using a relative base path in Vite
- adding `Build_Itch_Zip.py`

### `951b450` — Replace embedded sample data with current publication dataset

This is the key publication-content commit.

It replaced the embedded sample data in `src/App.jsx` so the built app now launches with the intended browser/demo dataset.

This is the current clean baseline because it combines:

- the stable fixed basemap
- the committed packaging support
- the publication-ready embedded data

---

## Current fragile zones

These areas still deserve narrow, explicit passes:

- map viewport centering/reset behavior
- dense map hover/click interaction
- selection persistence across filters
- timeline/playback state coupling
- export rendering/state coupling
- broad orchestration work in `src/App.jsx`
- control-panel render boundaries
- inspector-open interactions after map clicks

### Additional caution

Generated helper scripts and backup files should be removed after use.

Examples of things that should not linger in the repo folder:

- temporary Python patch scripts
- temporary PowerShell patch scripts
- `itch_upload/`
- backup `.jsx` files made during local patching

---

## Workflow reminders

Future work should continue to follow the user’s established workflow:

- one bounded pass at a time
- classify each pass as **behavior**, **visual**, **structural**, or **documentation**
- one explicit acceptance test per pass
- prefer local/small edits when safe
- use checkpoints before higher-risk changes
- only ask for the sync ritual after an actual checkpoint or commit
- prefer direct file delivery and exact Windows PowerShell commands
- prefer `.txt` delivery for generated scripts when `.js` downloads are unreliable
- when runtime issues appear after interaction, check the **F12 browser console early**

---

## Fresh-chat handoff note

A future chat should start from:

- source of truth folder: `C:\Users\haley\OneDrive\Desktop\CorrespondenceVisualizer\`
- clean baseline: `951b450`

A future chat should also be told that:

- the app is now called **Peridot**
- the current fixed basemap is `countries50m`
- the current embedded dataset is the intended publication/demo dataset
- itch.io packaging support is already committed
- the user wants documentation to reflect the commit trajectory clearly and meticulously
