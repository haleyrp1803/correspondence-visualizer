# Maintainer's Guide

## Purpose

This document is the architectural reference for the correspondence visualizer app. It should stay aligned with the committed source of truth in the repository and with the workflow rules in `PROJECT_WORKFLOW_CHARTER.md`. This guide is updated on committed architectural changes.

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
- `src/personForceLayoutHelpers.js`
- `src/InspectorConnectedCorrespondents.jsx`
- `src/InspectorPersonPlaces.jsx`
- `src/InspectorBackButton.jsx`

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

- **Geographic view**
- **Person view**

The app includes:

- CSV ingestion and normalization
- graph derivation
- interactive SVG-based rendering
- timeline filtering and playback
- right-panel inspection workflow
- theme presets and visual controls
- export tools for image and tabular outputs

The main maintenance challenge remains structural concentration in `src/App.jsx`, but that concentration has been reduced in bounded passes.

The current person view supports:

- **Geographic anchor**
- **Force-directed** (pre-settled `d3-force`)

The force-directed person view is intentionally rendered on a clean theme-driven background rather than on top of the geographic map backdrop.

The inspector now supports internal navigation between **people** and **places**, with a working Back button for returning to the immediately previous internal inspector panel.

---

## Current module responsibilities

### `src/App.jsx`

Still the main orchestration file. It owns top-level state, derived data wiring, workspace composition, and inspector navigation state.

### `src/mapLayoutHelpers.js`

Pure map/layout helper logic.

### `src/mapStageComponents.jsx`

Map-stage-adjacent UI/chrome components.

### `src/interactionHelpers.js`

Pure interaction-resolution and selection-building helpers.

This file now also owns the helper logic for:

- weighted connected-correspondent ordering
- `person-detail` and `place-detail` payload derivation
- person-detail sent/received place-section derivation

### `src/mapInteractionHandlers.js`

Top-level map interaction handlers.

### `src/timelinePlaybackHelpers.js`

Pure timeline/playback derivation helpers.

### `src/timelinePlaybackComponents.jsx`

Timeline/playback panel UI boundary.

### `src/exportHelpers.js`

Pure export utilities and export row-builder helpers.

### `src/personForceLayoutHelpers.js`

Pure helper logic for the pre-settled force-directed person-network layout.

### `src/InspectorConnectedCorrespondents.jsx`

Inspector navigation component for person-to-person movement.

This succeeded where earlier inline-inspector approaches failed because it kept the new UI bounded and extracted, with only a small mount-point change in `App.jsx`.

### `src/InspectorPersonPlaces.jsx`

Inspector navigation component for person-to-place movement.

It shows two explicit sections:

- **Places this person sent letters to**
- **Places where this person received letters**

### `src/InspectorBackButton.jsx`

Inspector-internal Back button.

It uses a small local history model for **inspector-internal navigation only** and does not attempt to track ordinary map clicks as navigation history.

---

## What was accomplished in Step 4 so far

### Issue 4: person-network layout correction

Completed through bounded behavior and visual passes:

1. dependency addition for `d3-force`
2. pure force-layout helper extraction
3. wiring the force-layout helper into the person graph builder
4. suppressing the geographic map backdrop in force-directed person mode

Committed results:

- `81a75d0` — Add `d3-force` dependency for person-network layout work
- `3480858` — Add pre-settled `d3-force` person network layout
- `225c7e4` — Wire person force layout into App graph builder
- `ffb5a30` — Hide map backdrop in force-directed person view

### Architectural effect

The person view now has a real distinction between its two layout modes:

- **Geographic anchor** remains geographically positioned and map-backed
- **Force-directed** is now a true network layout backed by a pre-settled `d3-force` simulation and rendered on a clean theme-driven stage

---

## What was accomplished in Step 5 so far

### Issue 5: inspector navigation between people and places

Completed through bounded behavior passes:

1. selection plumbing for `person-detail` and `place-detail`
2. extracted connected-correspondents inspector navigation section
3. weighted ordering and visible count labels for correspondents
4. extracted person-place navigation section
5. inspector Back button

Committed results:

- `cfa6d63` — Add inspector selection plumbing for person and place detail targets
- `17be829` — Add connected correspondents inspector navigation section
- `06e0b3b` — Sort connected correspondents by relationship weight
- `ab0e1fe` — Show relationship counts in connected correspondents buttons
- `6772c1d` — Clarify connected correspondents count label
- `b3e6fe8` — Add place navigation sections to person inspector
- `5af819b` — Add inspector back navigation

### Architectural effect

The inspector now supports a bounded internal navigation workflow:

- person node → person detail
- person detail → place detail
- person/place detail → Back

This feature succeeded only after abandoning brittle inline `App.jsx` surgery in favor of small extracted inspector components plus narrow mount points.

### Maintainer caution

A UI-polish refinement to anchor the Back button directly beneath the inspector close `×` was attempted and deferred. The current Back button behavior is functionally stable, but the exact anchoring refinement should be treated as a later visual-only pass.

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
- inspector-open interactions

### Inspector-specific note

For runtime white-screen failures after interaction, the browser F12 console has repeatedly been decisive. Future debugging of post-load inspector/map failures should check the console early rather than relying only on build output.

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

## Current stable checkpoints / rollback points

Key recent stable rollback points include:

- `2b3c265` — documentation updated for force-layout work
- `5af819b` — working inspector Back button
- later UI-polish anchoring experiments for the Back button were intentionally not committed
