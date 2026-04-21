# Maintainer's Guide

## Purpose

This document is the architectural reference for the correspondence visualizer app. It should stay aligned with the committed source of truth in the repository and with the workflow rules in `PROJECT_WORKFLOW_CHARTER.md`. This guide is updated on committed architectural changes and should be sufficient to hand off work into a fresh chat session without depending on older conversation context.

---

## Source of truth and working assumptions

Current source of truth folder:

`C:\Users\haley\OneDrive\Desktop\CorrespondenceVisualizer\`

Current clean rollback point:

- `dd12281` — `Normalize summary panel spacing`

Named checkpoint that should also remain available:

- `checkpoint-map-theme-c0fc600`

This project should continue to follow the user's bounded-pass workflow:

- one source of truth per pass
- classify each pass as exactly one of: behavior, visual, structural, documentation
- keep one clear goal per pass
- use explicit acceptance tests
- checkpoint before higher-risk work
- separate behavior changes from visual changes
- when runtime issues appear after interaction, check the **F12 browser console early**

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

The inspector supports internal navigation between **people** and **places**, with a working Back button for returning to the immediately previous internal inspector panel.

The map now also supports **active-country highlighting** for countries containing currently visible nodes, using flexible country/state/nation/region/territory-like hint matching with coordinate-based fallback.

---

## Current module responsibilities

### `src/App.jsx`

Still the main orchestration file. It owns top-level state, derived data wiring, workspace composition, current theme token definitions, left-panel organization, map-country highlighting, and inspector navigation state.

### `src/mapLayoutHelpers.js`

Pure map/layout helper logic.

### `src/mapStageComponents.jsx`

Map-stage-adjacent UI/chrome components.

### `src/interactionHelpers.js`

Pure interaction-resolution and selection-building helpers.

This file now also owns helper logic for:

- weighted connected-correspondent ordering
- `person-detail` and `place-detail` payload derivation
- person-detail sent/received place-section derivation

### `src/mapInteractionHandlers.js`

Top-level map interaction handlers.

### `src/timelinePlaybackHelpers.js`

Pure timeline/playback derivation helpers.

### `src/timelinePlaybackComponents.jsx`

Timeline/playback panel UI boundary. The visible section heading was renamed from **Timeline and playback** to **Timeline**.

### `src/exportHelpers.js`

Pure export utilities and export row-builder helpers.

### `src/personForceLayoutHelpers.js`

Pure helper logic for the pre-settled force-directed person-network layout.

### `src/InspectorConnectedCorrespondents.jsx`

Inspector navigation component for person-to-person movement.

### `src/InspectorPersonPlaces.jsx`

Inspector navigation component for person-to-place movement.

It shows two explicit sections:

- **Places this person sent letters to**
- **Places where this person received letters**

### `src/InspectorBackButton.jsx`

Inspector-internal Back button.

It uses a small local history model for **inspector-internal navigation only** and does not attempt to track ordinary map clicks as navigation history.

---

## Current visual/theme system state

### Default full-app theme

The default full-app theme is now **Peridot-inspired**.

Design intent:

- pale surrounding neutrals
- soft translucency
- earthy inclusions / matrix
- subdued natural contrast
- layered green accents
- calm, polished, professional tone

This theme affects the **whole app shell**, not just the map.

### Map-only presets

The other two map styles remain available, but they function as **map-only presets** rather than whole-app themes:

- **Early modern map**
- **Modern map**

### Current map/theme behavior

The current visual system includes:

- Peridot default full-app theme
- active-country highlighting for visible-node countries
- refined node hover state
- refined node selected state
- theme-specific hover/selected node colors
- tuned active-country fills for Peridot and Modern
- Early Modern active-country coloring preserved as-is after testing

### Important current design decisions

- The Peridot map may still receive future small token-only color tweaks.
- Modern active-country fill may also be revisited later for taste-level tuning.
- Map granularity changes such as adding subnational/state/province boundaries were discussed and explicitly deferred as a larger separate pass.
- Historical borders are intentionally out of scope. Modern country borders are the target geography layer.

---

## Current left control panel state

The left control panel was recently reorganized and is now a meaningful part of the current baseline.

### Current top-level left-panel grouping

- **DATA**
- **OPTIONS**

### Current section order under the left panel

1. **Data Inputs**
2. **Visualization Type**
3. **Display Controls**
4. **Timeline**
5. **Theme**
6. **Export**
7. **Summary and Diagnostics**

### Important interaction/state notes

- **Data Inputs** is now collapsible but starts open.
- **Visualization Type** now contains:
  - Geographic routes
  - Person network
  - Force-directed
  - Geographic anchor
- **Theme** is the simplified replacement for the earlier “Map appearance” wording.
- The explanatory text about Peridot being the default full-app theme was intentionally removed from the Theme panel.
- The spacing rhythm inside OPTIONS was normalized, including the spacing above **Summary and Diagnostics**.

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

The inspector supports a bounded internal navigation workflow:

- person node → person detail
- person detail → place detail
- person/place detail → Back

### Maintainer caution

A UI-polish refinement to anchor the Back button directly beneath the inspector close `×` was attempted and deferred. The current Back button behavior is functionally stable, but the exact anchoring refinement should be treated as a later visual-only pass.

---

## What was accomplished after the earlier documentation baseline

The uploaded guide and changelog were missing much of the recent visual and organizational work. The current baseline now also includes the following committed passes and should be treated as part of the maintained architecture/state:

- `c666d29` — Add peridot default app theme
- `919ea5f` — Increase green layering in peridot map theme
- `3e43dc9` — Add hovered node color feedback
- `850176f` — Refine hovered and selected node states
- `5cbe9c3` — Refine early modern node hover and selected colors
- `56f0080` — Highlight countries containing visible nodes
- `c0fc600` — Retune active country fills for peridot and modern maps
- `ba746b1` — Simplify theme panel text
- `db5bb1f` — Tighten left panel organization
- `4fdaf73` — Rename timeline panel heading
- `dd12281` — Normalize summary panel spacing

These are now part of the current architectural and visual baseline, not merely optional experiments.

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

### Additional current caution

The left control panel is safer than before, but it remains a render boundary that has historically failed only when the panel actually opens. Small organizational or naming changes are safer now, but they should still be treated as bounded passes.

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

### Handoff note for a fresh chat

A future chat should begin from:

- source of truth folder: `C:\Users\haley\OneDrive\Desktop\CorrespondenceVisualizer\`
- clean rollback point: `dd12281`
- named checkpoint also available: `checkpoint-map-theme-c0fc600`

A fresh chat should also be told that:

- the user prefers direct file replacements when a file is fragile
- the user prefers exact Windows PowerShell copy commands
- if the app runtime breaks after interaction, ask for the **F12 console error**
- the user wants bounded passes with one clear goal at a time

---

## Current stable checkpoints / rollback points

Key recent stable rollback points include:

- `2b3c265` — documentation updated for force-layout work
- `5af819b` — working inspector Back button
- `02ecb11` — documented inspector-navigation feature set
- `43403c3` — restored detail to maintainer documentation
- `c0fc600` — map-theme checkpoint baseline (also tagged as `checkpoint-map-theme-c0fc600`)
- `dd12281` — current clean baseline including theme and control-panel polish

Later UI-polish anchoring experiments for the Back button were intentionally not committed.
