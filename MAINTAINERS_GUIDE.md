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
- `CONTROL_PANEL_DEPENDENCY_MAP.md`
- `VIEWPORT_TIMELINE_AUDIT.md`

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
Still the main orchestration file. It owns top-level state, derived data wiring, high-level prop passing, workspace composition, and some export metadata assembly.

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
Timeline/playback panel UI boundary extracted from `App.jsx`. This file now also includes the behavior-level end-date constraint fix.

### `src/exportHelpers.js`
Pure export utilities and export row-builder helpers extracted from `App.jsx`. This file now also handles CSS-variable inlining for SVG-to-PNG export so rasterized PNG output preserves the intended map colors.

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

Completed structurally through:

1. pure timeline/playback helper extraction
2. timeline/playback panel UI boundary cleanup

Committed structural results:

- `b2dbe35` — Extract timeline playback helpers from App
- `383ecc0` — Extract timeline playback panel from App

### Deferred structural substep
**Step 2C** was attempted and rolled back after repeated instability at the render/handler boundary. It remains intentionally deferred for later, narrower, purpose-driven work.

### Completed behavior follow-ups
Two important timeline behaviors were later completed successfully **without** crossing the fragile panel-extraction boundary:

- `6c41fce` — Constrain timeline end date to selected start date
- `1b2655e` — Preserve viewport during timeline playback interactions

### Architectural effect
Timeline/playback logic is now partly decomposed, but the remaining render/handler boundary is fragile and should not be casually reworked. However, purpose-driven behavior changes inside the existing working boundary have proven safe.

---

## What was accomplished in Step 3 so far

### Issue 3: export subsystem separation

Completed structurally through:

1. pure export helper extraction

Committed structural result:

- `5bbdad8` — Extract export helpers from App

### Deferred structural substep
**Step 3B** was attempted and rolled back after triggering the same control-panel white-screen failure pattern seen in other fragile panel extractions. It is intentionally deferred for later work.

### Completed behavior follow-ups
Two important export behaviors were later completed successfully **without** crossing the fragile panel-extraction boundary:

- `c9f010e` — Fix PNG export color rendering
- `5575007` — Reflect visible date range in export metadata

### Architectural effect
Export-related utility logic and export row builders are now less concentrated in `App.jsx`, while runtime export handlers and export panel rendering remain in the main orchestration file. The PNG rasterization pipeline now renders the intended map colors, and export metadata better reflects the map state actually visible at export time.

---

## Maintainer-facing audit artifacts

### `CONTROL_PANEL_DEPENDENCY_MAP.md`
Maps the control-panel render path, dependency surface, fragility patterns, and safer future strategy. This should be consulted before any future panel-boundary refactor.

### `VIEWPORT_TIMELINE_AUDIT.md`
Documents the likely cause of the timeline-triggered viewport reset behavior and the reasoning behind the eventual narrow fix that preserved the current map position during playback interaction.

---

## Completed timeline behavior goals

These were previously deferred and are now implemented:

1. **Preserve user map position during timeline interaction**
   - Timeline actions such as play/pause/progression no longer unexpectedly recenter the map.
   - This was resolved by narrowing the reset-trigger logic rather than restructuring panel code.

2. **Constrain timeline date selection**
   - The end date can no longer be selected earlier than the current start date.
   - If the start date is moved past the current end date, the end date is pulled forward to match.

---

## Completed export behavior goals

These were previously deferred and are now implemented:

1. **Fix black PNG export rendering**
   - PNG export now preserves the intended map colors instead of rasterizing as a blacked-out image.
   - This was resolved by inlining computed CSS-variable values into the serialized export SVG before rasterization.

2. **Make export metadata reflect the visible map state**
   - Exported PNG/SVG header metadata now reflects the effective visible date subset at export time rather than only the broader selected control window.
   - This is especially important when exporting during paused or partial playback progression.

---

## Deferred timeline work

1. **Revisit Step 2C later, but only narrowly**
   - Return only when there is a concrete bug, feature need, or a much narrower safe target than the failed attempts.
   - Do not resume Step 2C as casual cleanup.

---

## Deferred export work

1. **Revisit Step 3B later, but only narrowly**
   - Export panel extraction triggered the same control-panel white-screen failure pattern seen in other fragile panel-boundary changes.
   - Do not resume Step 3B as casual cleanup.
   - Return only when there is a concrete bug, feature need, or a much narrower target than the failed extraction.

---

## Current fragile zones

These areas should still be treated as high-risk:

- map viewport centering/reset behavior
- dense map hover/click interaction
- selection persistence across filters
- playback/timeline state coupling
- export rendering/state coupling
- broad orchestration work in `src/App.jsx`
- control-panel render boundaries when extracting subsystem panels

Additional notes:

- the timeline/playback render/handler boundary is a known fragile zone because Step 2C failed twice and was rolled back
- export panel extraction is a known fragile zone because Step 3B triggered the same white-screen panel failure pattern and was rolled back
- purpose-driven behavior changes inside the existing working control-panel boundary have been safer than structural extraction across that boundary

---

## Recommended next subsystem order

The safest next directions are:

1. broader `App.jsx` bottleneck reduction using only clearly safe extraction targets
2. future structural revisits to deferred panel boundaries only when a concrete purpose justifies them
3. additional purpose-driven behavior work as new concrete needs emerge

Timeline/playback Step 2C and export Step 3B should come later, and only with concrete purpose and narrower scope.

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
