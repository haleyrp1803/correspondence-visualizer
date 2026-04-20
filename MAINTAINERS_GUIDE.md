# Maintainer's Guide

## Purpose

This document is the architectural reference for the correspondence visualizer app. It should stay aligned with the committed source of truth in the repository and with the workflow rules in `PROJECT_WORKFLOW_CHARTER.md`.

This guide is updated on committed architectural changes. It is not meant to track every temporary experiment or failed checkpoint.

---

## Repository shape

Current live app surface:

- `src/App.jsx`
- `src/index.css`
- `src/main.jsx`

Extracted support modules now present in `src/`:

- `src/mapLayoutHelpers.js`
- `src/mapStageComponents.jsx`
- `src/interactionHelpers.js`
- `src/mapInteractionHandlers.js`
- `src/timelinePlaybackHelpers.js`
- `src/timelinePlaybackComponents.jsx`
- `src/exportHelpers.js`

Maintainer/workflow documents at repo root:

- `README.md`
- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`
- `CHANGELOG.md`

---

## Architectural summary

The app is a Vite/React/Tailwind correspondence visualizer with two main analytical modes:

- **Geographic view**: places as nodes, routes between places as edges
- **Person view**: people as nodes, correspondence relationships as edges

The app includes:

- CSV ingestion and normalization
- graph derivation
- interactive SVG-based rendering
- timeline filtering and playback
- right-panel inspection workflow
- theme presets and visual controls
- export tools for image and tabular outputs

The main maintenance challenge remains structural concentration in `src/App.jsx`, but that concentration has been reduced in bounded passes.

---

## Current module responsibilities

### `src/App.jsx`
Still the main orchestration file. It owns top-level state, derived data wiring, high-level prop passing, and workspace composition.

### `src/mapLayoutHelpers.js`
Pure map/layout helper logic extracted from `App.jsx`.

### `src/mapStageComponents.jsx`
Map-stage-adjacent UI/chrome components extracted from `App.jsx`.

### `src/interactionHelpers.js`
Pure interaction-resolution helpers extracted from `App.jsx`.

### `src/mapInteractionHandlers.js`
Top-level map interaction handlers extracted from `App.jsx`.

### `src/timelinePlaybackHelpers.js`
Pure timeline/playback derivation helpers extracted from `App.jsx`.

### `src/timelinePlaybackComponents.jsx`
Timeline/playback panel UI boundary extracted from `App.jsx`.

### `src/exportHelpers.js`
Pure export utilities and export row-builder helpers extracted from `App.jsx`.

---

## What was accomplished in Step 1

### Issue 1: map interaction risk reduction

Completed in bounded passes:

1. pure map/layout helper extraction
2. map-stage component boundary cleanup
3. interaction helper and handler extraction

Committed results:

- `02dcfc4` — Extract pure map layout helpers from App
- `181a63e` — Extract map stage components from App
- `30e5b1b` — Extract interaction resolution helpers from App
- `145cfc2` — Extract map interaction handlers from App

### Architectural effect
Map-related responsibilities are now less concentrated in `App.jsx`. The subsystem is still interaction-heavy and fragile, but the code is clearer and easier to navigate than before Step 1.

---

## What was accomplished in Step 2

### Issue 2: timeline/playback risk reduction

Completed through:

1. pure timeline/playback helper extraction
2. timeline/playback panel UI boundary cleanup

Committed results:

- `b2dbe35` — Extract timeline playback helpers from App
- `383ecc0` — Extract timeline playback panel from App

### Deferred substep
**Step 2C** was attempted and rolled back after repeated instability at the render/handler boundary. It is intentionally deferred for later work.

### Architectural effect
Timeline/playback logic is now partly decomposed, but the remaining render/handler boundary is fragile and should not be casually reworked.

---

## What was accomplished in Step 3 so far

### Issue 3: export subsystem separation

Completed through:

1. pure export helper extraction

Committed result:

- `5bbdad8` — Extract export helpers from App

### Architectural effect
Export-related utility logic and export row builders are now less concentrated in `App.jsx`, while runtime export handlers still remain in the main orchestration file.

---

## Deferred timeline work

These items should be treated as explicit future goals, not forgotten ideas:

1. **Preserve user map position during timeline interaction**
   - Timeline actions such as play/pause should not unexpectedly reset the current zoom/pan view.
   - Example failure mode already observed: when the user moves around the map during playback and then pauses, the map snaps back to an earlier/original view.

2. **Constrain timeline date selection**
   - The end date should never be selectable earlier than the currently selected start date.

3. **Revisit Step 2C later, but only narrowly**
   - Return only when there is a concrete bug, feature need, or a much narrower safe target than the failed attempts.
   - Do not resume Step 2C as casual cleanup.

---

## Deferred export work

1. **PNG export renders as a blacked-out image**
   - PNG download currently renders the map as a blacked-out image.
   - Investigate the SVG-to-raster export pipeline later, especially SVG serialization, background handling, and canvas/image rendering behavior.

---

## Current fragile zones

These areas should still be treated as high-risk:

- map viewport centering/reset behavior
- dense map hover/click interaction
- selection persistence across filters
- playback/timeline state coupling
- export rendering/state coupling
- broad orchestration work in `src/App.jsx`

Additional notes:
- the timeline/playback render/handler boundary is now a known fragile zone because Step 2C failed twice and was rolled back.
- the PNG export pipeline is now a known fragile zone because raster output is rendering as a blacked-out image.

---

## Recommended next subsystem order

The next safest architectural target is:

1. **Issue 3: export panel / handler boundary cleanup**
2. **Issue 4: broader `App.jsx` bottleneck reduction**

Timeline/playback Step 2C should come later, and only with a concrete purpose and narrower scope.

---

## Workflow reminder

Use this guide together with `PROJECT_WORKFLOW_CHARTER.md`.

In practice, that means:

- one source of truth per pass
- bounded passes
- explicit acceptance tests
- checkpoint before high-risk work
- stop structural cleanup when a boundary proves fragile
- document committed architectural changes here

---

## Current stable checkpoints

- `checkpoint-pre-step-1c` → `181a63e`
- `checkpoint-between-step-1-and-step-2` → `dad15a4`
- `checkpoint-pre-step-2c` → `383ecc0`

These are restore points, not substitutes for the current `main` branch state.
