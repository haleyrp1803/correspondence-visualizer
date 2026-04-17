# Maintainer's Guide

## Purpose

This document is the living architectural reference for the correspondence visualizer app. It explains what the app does, how it is currently structured, where its major risks live, and how future maintainers should think about safe changes.

This guide should be:

- grounded in the current source-of-truth repository or file
- consulted before and during implementation passes
- updated only on committed changes
- kept consistent with `PROJECT_WORKFLOW_CHARTER.md`

---

## Project overview

The correspondence visualizer is a Vite/React/Tailwind application for exploring correspondence data as an interactive network.

The app currently supports two main analytical views:

- **Geographic view**: places as nodes, with routes between places shown as edges
- **Person view**: people as nodes, with correspondence relationships shown as edges

It is designed for researcher-oriented exploration rather than generic dashboard reporting. The app combines:

- historical-data ingestion
- graph derivation
- interactive network rendering
- map-based exploration
- timeline filtering and playback
- inspector-driven detail views
- theming and aesthetic presets
- export tools for map images and tabular data

---

## Current high-level architecture

At the repository level, the application shell is lightweight. Most of the actual behavior is concentrated in a single large file:

- `src/main.jsx` — React entry point
- `src/index.css` — global CSS and Tailwind directives
- `src/App.jsx` — primary application logic, orchestration, rendering, state, data processing, and most UI

### Architectural reality

The app is already feature-rich, but it is still in a structurally centralized phase. The largest architectural fact a maintainer must understand is this:

> The app's main maintenance risk is not lack of functionality. It is the concentration of many subsystems inside `src/App.jsx`.

That centralization increases the chance that visual changes, behavior changes, and refactors can interfere with each other unless they are handled in very controlled passes.

---

## What the app does

### 1. Data ingestion

The app can ingest correspondence-related datasets from CSV inputs. The current design supports multiple data roles, including:

- geography/correspondence rows
- letters metadata rows
- person metadata rows

The app also includes embedded fallback/sample data so the interface can run before a user uploads their own files.

### 2. Data normalization

Incoming rows are normalized into a consistent internal shape. This includes:

- header normalization
- defensive text coercion
- number coercion
- coordinate validation
- date parsing for historical records
- place-key generation and related matching logic

### 3. Graph derivation

Normalized rows are aggregated into graph structures for the active mode. The app derives:

- nodes
- edges
- counts and weights
- scaling information for node radius and edge width
- view-specific graph structures for place view and person view

### 4. Interactive rendering

The app renders the graph in an interactive SVG-based workspace. Core interactions include:

- hover
- click selection
- inspector synchronization
- zoom and pan
- reset/recenter behavior
- visible label logic
- clustered behavior in crowded regions
- playback highlighting

### 5. Research inspection

The right-side inspector is a major functional feature, not a decorative add-on. It is used to examine:

- node details
- edge details
- cluster summaries
- linked letters
- person metadata
- expanded excerpts or text blocks

### 6. Filtering and timeline analysis

The app supports time-aware exploration, including:

- date-window filtering
- timeline boundary selection
- chronological playback
- playback-specific row filtering
- view-state updates tied to temporal subsets

### 7. Export

The app can export both graphics and tables, including:

- SVG map export
- PNG map export
- nodes CSV export
- edges/routes CSV export

---

## Internal structure of `src/App.jsx`

Although `App.jsx` is large, its contents can be understood in logical layers.

### Layer A: embedded defaults and sample data

The file begins with baseline data and constants that allow the app to render before uploads.

### Layer B: parsing and normalization

This section handles text-table parsing, header normalization, coercion, validation, and canonical row shaping.

### Layer C: graph construction and derivation

This section aggregates normalized rows into nodes, edges, and related structures for the current display mode.

### Layer D: export and utility helpers

This section handles CSV serialization, SVG serialization, rasterization support, file reading, and download preparation.

### Layer E: theme system and class helpers

This section defines theme defaults, CSS-variable-driven design tokens, and shared class helpers used throughout the interface.

### Layer F: reusable UI components

This includes cards, controls, sliders, upload widgets, detail rows, and other building blocks.

### Layer G: map geometry, hit testing, and selection resolution

This includes projection support, clustered-node logic, visible-label rules, path parsing, hover/click targeting, and selection-model building.

### Layer H: timeline and export-row builders

This includes helpers that derive time slices, playback sequences, export rows, and hover summaries.

### Layer I: map renderer

The SVG map component handles the most interaction-heavy logic in the app:

- zooming
- panning
- hover
- click selection
- control overlays
- animation and reset behavior

### Layer J: sidebar and inspector panels

This layer renders the visible workspace chrome: panels, titles, legends, exports, appearance controls, and inspector states.

### Layer K: top-level app orchestration

The exported app component owns the overall state graph and wires together:

- uploaded files
- normalized datasets
- derived graph data
- active view mode
- current selection
- timeline state
- playback state
- theme state
- export state
- hover state
- panel visibility state

---

## Design and aesthetic system

The design language is one of the app's distinguishing strengths.

### Core visual character

The default interface is not generic dashboard styling. It combines:

- archival / museum-like visual language
- parchment-toned map surfaces
- muted historical-map color relationships
- serif typography in key display roles
- softer naturalistic tones for routes, labels, and surfaces
- floating cards and layered panel surfaces

This produces a research-oriented experience with a more scholarly and exhibition-like character.

### Theme architecture

The theme system is driven by centralized defaults mapped into CSS custom properties. Components then consume those variables through class names and shared helpers.

This means:

- the design is more systematic than it may first appear
- visual tuning can often be done centrally
- theme changes should not be confused with behavior changes

### Preset logic

The app supports more than one aesthetic preset, including a more modern mode in addition to the more archival default mode.

Maintainers should treat preset work as visual work, not structural work, unless the task specifically involves reorganizing the theme system.

---

## Principal strengths

### 1. The app is already a real analytical tool

It is not just a mockup. It already integrates ingestion, transformation, rendering, inspection, filtering, and export.

### 2. The theme layer is conceptually strong

The visual system is deliberate and gives the project a distinctive identity.

### 3. The inspector model is useful for scholarship

The app is clearly oriented toward research exploration rather than generic summary metrics.

### 4. The interaction model is sophisticated for a prototype

Zoom, pan, hover, selection, playback, and export all coexist in the same application.

---

## Principal maintenance risks

### 1. Structural centralization in `src/App.jsx`

This is the largest current risk. The file currently mixes:

- data logic
- interaction logic
- render logic
- panel orchestration
- theme consumption
- export behavior

This does not make the app bad. It makes careless edits dangerous.

### 2. Fragile interaction zones

The most sensitive regions of the app are the ones where multiple systems meet. In practice, these are the zones most likely to break during changes:

- viewport centering and reset behavior
- dense-map hover and click interaction
- selection persistence across filtering
- inspector-open interactions
- playback and timeline state
- export rendering

These should be treated as fragile zones and changed only in bounded passes.

### 3. Mixed concerns during editing

A single request can easily tempt a maintainer to modify styling, behavior, and structure at once. That is precisely what the workflow charter is designed to prevent.

---

## Safe maintenance guidance

### What to prefer

- bounded local edits
- one change type per pass
- explicit acceptance tests
- extraction of pure helpers when a safe structural pass is warranted
- source-of-truth discipline
- documented commit/checkpoint decisions

### What to avoid

- casual multi-subsystem rewrites
- mixing visual redesign with behavioral fixes
- using GitHub, local files, canvas, and temp copies as co-equal during an editing pass
- initiating cleanup passes without a clearly bounded scope
- changing fragile zones without explicit verification criteria

---

## Modularization roadmap

This roadmap exists to guide future decomposition of `App.jsx`. It should inform planning, but it should **not** be executed casually or opportunistically.

Preferred order:

1. pure data helpers
2. export helpers
3. theme/constants
4. small reusable UI pieces
5. map interaction helpers
6. left/right panel components
7. app orchestration last

### Why this order matters

This order reduces risk because it extracts low-coupling logic first and leaves the most stateful orchestration for last.

---

## Relationship to the workflow charter

`MAINTAINERS_GUIDE.md` and `PROJECT_WORKFLOW_CHARTER.md` serve different purposes.

- **Maintainer's Guide** = what the app is, how it works, where the risk is
- **Project Workflow Charter** = how we make changes safely

The two documents should remain consistent.

---

## Update rule

Update this guide when a **committed** change materially affects:

- architecture
- file structure
- subsystem boundaries
- major feature set
- known fragile zones
- modularization priorities

Do not rewrite it for every temporary experiment or checkpoint.

---

## Current maintainer summary

If you remember only one thing, remember this:

> This is a feature-rich correspondence analysis app whose main engineering challenge is safe evolution from a centralized `App.jsx` prototype into a more modular codebase without breaking interaction-heavy researcher workflows.
