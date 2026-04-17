# Correspondence Visualizer

Correspondence Visualizer is a Vite/React/Tailwind application for exploring correspondence data as an interactive network.

It is designed for researcher-oriented analysis rather than generic dashboard reporting. The app supports two main analytical views:

- **Geographic view**: places as nodes, with routes between places shown as edges
- **Person view**: people as nodes, with correspondence relationships shown as edges

The current app combines:

- correspondence-related CSV ingestion
- graph derivation from uploaded records
- interactive SVG-based rendering
- map-based exploration
- timeline filtering and playback
- inspector-driven detail views
- theme presets and aesthetic controls
- export tools for both images and tabular data

## Current repository shape

The live app surface is intentionally small at the repository level:

- `src/main.jsx` — React entry point
- `src/index.css` — global CSS and Tailwind directives
- `src/App.jsx` — main application logic, orchestration, rendering, state, and most UI

Two additional documentation files should be treated as first-class project references:

- `MAINTAINERS_GUIDE.md` — architectural overview, subsystem map, risks, and modularization guidance
- `PROJECT_WORKFLOW_CHARTER.md` — rules for making safe changes to the app

## What the app currently does

### Data input
The app supports correspondence-related CSV inputs, including:

- geography / correspondence rows
- letters metadata rows
- person metadata rows

It also includes embedded fallback/sample data so the interface can render before uploads.

### Core analysis modes
The app currently supports:

- **Geographic network exploration**
- **Person-to-person network exploration**

These views are derived from normalized input rows and rendered in a shared interactive workspace.

### Interactive workspace
The app includes an SVG-based interactive rendering layer with support for:

- hover
- click selection
- zoom and pan
- reset / recenter behavior
- label visibility logic
- clustered behavior in crowded regions
- synchronized inspector updates
- playback highlighting

### Timeline and filtering
The app supports time-aware exploration, including:

- date-window filtering
- timeline boundary selection
- chronological playback
- playback-aware subset display

### Inspector-driven research workflow
The right-side inspector is a major functional feature. It is used to inspect:

- node details
- edge details
- cluster summaries
- linked letters
- person metadata
- expanded excerpts or text blocks

### Export
The app supports export of both graphics and tables:

- SVG export
- PNG export
- nodes CSV export
- edges/routes CSV export

## Design and aesthetic system

One of the app’s distinguishing features is its deliberate visual language. The default experience is not generic dashboard styling.

The design system currently emphasizes:

- archival / museum-like visual character
- parchment-toned map surfaces
- muted historical-map color relationships
- serif typography in key display roles
- layered side panels and floating cards
- support for more than one visual preset, including a more modern mode

Theme work should be treated as **visual work**, not structural work, unless the pass is explicitly about reorganizing the theme system.

## Architectural reality

The most important architectural fact about the current app is this:

> It is already feature-rich, but much of its logic is still centralized in `src/App.jsx`.

That means the main engineering challenge is not adding basic functionality from scratch. It is safely evolving a working, interaction-heavy prototype into a more modular codebase without breaking research workflows.

If you are maintaining or extending the app, read these two files before making substantial changes:

- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`

## Running locally

In PowerShell:

```powershell
cd "C:\Users\haley\OneDrive\Desktop\CorrespondenceVisualizer"
npm.cmd install
npm.cmd run dev
```

Then open the local Vite URL, usually:

```text
http://localhost:5173/
```

## Maintenance notes

This repository uses a controlled workflow for changes. In particular:

- establish one source of truth before editing
- use bounded passes
- avoid mixing behavior, visual, and structural work casually
- treat map interaction, timeline/playback, export, and `src/App.jsx` orchestration as higher-risk zones
- update the maintainer-facing docs on committed architectural changes

See:

- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`
