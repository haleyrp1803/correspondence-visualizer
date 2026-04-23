# Peridot

Peridot is an interactive browser-based research tool for exploring historical correspondence networks as either geographic routes or person-to-person relationship graphs.

## Current baseline

This repository is currently at a publishable browser-playable baseline with these recent committed milestones:

- `951b450` — **Replace embedded sample data with current publication dataset**
- `f859595` — **Add itch.io HTML5 build packaging support**
- `f959fac` — **Use countries50m as the fixed basemap**
- `b1fdbd5` — **Update maintainer handoff documentation**
- `dd12281` — **Normalize summary panel spacing**

The app is now called **Peridot**. Earlier repository history and notes may still refer to the project by its previous working name, **Correspondence Visualizer**.

## What the app does

Peridot supports two main analytical views:

- **Geographic view** for mapping correspondence routes between places
- **Person view** for exploring correspondence as a network of people

The app currently includes:

- CSV-based data ingestion
- embedded publication/demo sample data
- node, edge, and cluster derivation from uploaded or embedded data
- an interactive SVG map stage
- a person-network mode
- timeline range filtering and playback
- right-side inspection of nodes, edges, clusters, and linked records
- theme presets, including the Peridot default full-app theme
- export tools for SVG, PNG, nodes CSV, and edges/routes CSV
- itch.io-ready HTML5 build packaging support

## Current publication state

Peridot is now in a browser-publishable state for itch.io.

Current publication-related decisions:

- the fixed basemap uses **`countries50m`**
- the embedded sample dataset is the intended publication/demo dataset
- `vite.config.js` uses a relative base path for safer HTML5 subdirectory hosting
- `Build_Itch_Zip.py` creates a ZIP suitable for itch.io HTML uploads

Typical packaging workflow:

```powershell
python .\Build_Itch_Zip.py
```

That produces:

```text
itch_upload\correspondence-visualizer-itch.zip
```

The ZIP is a generated artifact and should normally stay out of Git history.

## Repository shape

Main app files:

- `src/App.jsx`
- `src/index.css`
- `src/main.jsx`

Current extracted support modules:

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

Root-level project docs:

- `README.md`
- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`
- `CHANGELOG.md`
- `CONTROL_PANEL_DEPENDENCY_MAP.md`
- `VIEWPORT_TIMELINE_AUDIT.md`

Publication/build helpers:

- `vite.config.js`
- `Build_Itch_Zip.py`

## Recent development trajectory

The recent trajectory of development is:

1. stabilize and document the app handoff baseline
2. tighten control-panel organization and spacing
3. keep the default map/theme experience stable while improving maintainability
4. simplify the basemap decision to a fixed `countries50m` default
5. add repeatable itch.io HTML5 packaging support
6. replace the embedded sample dataset with the current publication/demo dataset

That sequence matters because the current publishable state is the result of a simplification process, not just feature accumulation.

## Current maintenance note

The app is now in a strong state for publication, but `src/App.jsx` is still the main orchestration file and should continue to be edited in bounded passes.

For architectural and workflow details, see:

- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`
- `CHANGELOG.md`
