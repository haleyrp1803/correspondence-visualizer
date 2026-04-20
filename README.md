# Correspondence Visualizer

## 1. Project Title

**Correspondence Visualizer** is a research-oriented interactive web app for exploring historical correspondence networks as either **geographic routes** or **person-to-person relationship graphs**. It is designed for projects where letters, correspondents, places, and dates need to be explored together in a visual environment rather than only in spreadsheets or static maps.

---

## 2. One-Paragraph Summary

This application ingests correspondence-related tabular data, derives network structures from that data, and renders an interactive visualization workspace with filtering, inspection, timeline controls, playback, theme customization, and export tools. The current codebase supports both a **geographic view** and a **person view**, along with node/edge/cluster inspection and export to **SVG**, **PNG**, **nodes CSV**, and **edges/routes CSV**.

---

## 3. Current Status

This repository represents an **active prototype / research tool in ongoing development**.

The current state of the project includes:

- working geographic and person-network visualization modes
- timeline filtering and playback infrastructure
- inspector and control-panel workflows
- theme preset support and map-stage overlays
- export tooling for both images and tabular data
- several successful bounded refactors that extracted helper modules from `src/App.jsx`
- a true pre-settled **force-directed person-network layout** backed by `d3-force`
- a **geographic-anchor person layout** that still places correspondents by mappable location
- a force-directed person view that now renders on a **clean theme-driven background** rather than over the geographic map

The codebase is functional, but it is still under active maintenance. The largest remaining structural issue is that significant orchestration logic still lives in `src/App.jsx`.

---

## 4. Key Features

### Visualization modes

- **Geographic view** for mapping correspondence routes between places
- **Person view** for exploring correspondence as a network of people rather than locations
  - **Force-directed** person layout using a pre-settled `d3-force` simulation
  - **Geographic anchor** person layout using each person’s most-used mappable location

### Data interaction

- CSV-based data ingestion
- fallback embedded sample geography data so the app can render before user uploads
- derived node, edge, cluster, and timeline structures based on uploaded or embedded data

### Research workflow tools

- hover and click inspection
- right-side inspector for selected nodes, edges, clusters, and linked records
- timeline range filtering
- playback controls for chronological exploration
- map legend, title bar, and floating control overlays

### Visual customization

- theme token system with presets
- map and interface chroming controlled primarily through theme values rather than a large global stylesheet
- mode-sensitive stage rendering so the **force-directed person view** uses a clean themed background while geographic modes retain the map backdrop

### Export tools

- export current visualization state as **SVG**
- render SVG export to **PNG**
- export derived **nodes CSV**
- export derived **edges/routes CSV**

---

## 5. Screenshots

The following screenshots reflect the current live app state.

### Geographic view overview

![Geographic view overview](docs/images/geographic-view-overview.png)

Full workspace view of the geographic mode, showing the map stage, title bar, legend, and map controls.

### Person view overview

![Person view overview](docs/images/person-view-overview.png)

Person-network mode with weighted relationship filtering active in the control panel.

### Timeline and playback controls

![Timeline and playback controls](docs/images/timeline-playback.png)

Timeline window selection and playback controls in use, including the animated letter date and playback speed controls.

### Inspector detail view

![Inspector detail view](docs/images/person-network-inspector.png)

Example of the right-side inspector populated from a selected relationship in person-network mode.

### Geographic inspector example

![Geographic inspector example](docs/images/geographic-inspector.png)

Example of the inspector populated from a selected place in geographic mode.

### Control panel overview

![Control panel overview](docs/images/control-panel-overview.png)

Expanded control panel showing data inputs, display and filtering sections, and workspace layout.

### Additional control panel state

![Additional control panel state](docs/images/control-panel-secondary.png)

Alternative control panel state showing data-input cards and collapsed analytical sections.

### Modern theme examples

![Modern theme example 1](docs/images/modern-theme-1.png)
![Modern theme example 2](docs/images/modern-theme-2.png)

Examples of the modern palette preset.

---

## 6. Tech Stack

This project currently uses:

- **React 18** for UI composition and stateful interaction
- **Vite** for development/build tooling
- **Tailwind CSS** for utility-driven styling
- **d3-geo** for projection and map geometry work
- **d3-force** for pre-settled force-directed person-network layout
- **topojson-client** for geographic feature handling
- **world-atlas** for world basemap data

The map-stage rendering logic is SVG-based, with exported SVG optionally rasterized to PNG during export workflows.

---

## 7. Project Structure

The current `src/` structure is:

```text
src/
  App.jsx
  exportHelpers.js
  index.css
  interactionHelpers.js
  main.jsx
  mapInteractionHandlers.js
  mapLayoutHelpers.js
  mapStageComponents.jsx
  personForceLayoutHelpers.js
  timelinePlaybackComponents.jsx
  timelinePlaybackHelpers.js
```

### Module overview

#### `src/main.jsx`
Bootstraps the React application and mounts `<App />`.

#### `src/index.css`
Contains a minimal global layer:

- Tailwind directives
- full-height layout rules for `html`, `body`, and `#root`
- default body font stack
- inherited font settings for form controls

#### `src/App.jsx`
The main orchestration layer.

This file currently handles most of the following:

- top-level application state
- data ingestion and normalization
- fallback embedded data
- graph derivation
- theme token definitions and preset logic
- prop assembly for extracted components
- workspace composition and layout

#### `src/mapLayoutHelpers.js`
Pure helper logic for:

- default viewport construction
- node clustering
- label visibility filtering
- path parsing and geometric calculations

#### `src/interactionHelpers.js`
Selection and inspection logic, including:

- nearby candidate generation
- selection resolution
- node/letter enrichment for inspector workflows

#### `src/mapInteractionHandlers.js`
Centralized map interaction handler factory for hover/click/selection behavior.

#### `src/timelinePlaybackHelpers.js`
Pure timeline/playback derivation functions, including:

- timeline month generation
- playback row generation
- timeline window filtering
- playback-aware filtering
- boundary option derivation

#### `src/timelinePlaybackComponents.jsx`
Timeline/playback UI component(s), currently including the bounded timeline panel content.

#### `src/mapStageComponents.jsx`
Presentation-layer map chrome and overlays, including:

- title bar
- legend
- map controls overlay
- hover card overlay

#### `src/exportHelpers.js`
Export subsystem utilities for:

- nodes CSV generation
- edges/routes CSV generation
- SVG serialization
- PNG rendering from SVG
- browser download URL creation/revocation
- filename normalization

#### `src/personForceLayoutHelpers.js`
Pure helper logic for the force-directed person-network layout, including:

- stable initial seeding for person nodes
- pre-settled `d3-force` simulation setup
- link, charge, collision, and centering forces
- returning final settled coordinates to `App.jsx` rather than running a live simulation in React

---

## 8. Installation and Development

### Prerequisites

You should have a recent version of:

- **Node.js**
- **npm**

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Repository location

GitHub repository:

```text
https://github.com/haleyrp1803/correspondence-visualizer
```

---

## 9. Data Inputs

This is a data-driven visualization app.

The app is intended to work with correspondence-related tabular data that includes some combination of:

- dates
- source person
- target person
- source location
- target or inferred target location
- source latitude / longitude
- target latitude / longitude
- linked letter metadata
- person metadata

The source code currently includes embedded fallback geography-style sample data so that the app can render before user uploads are provided.

### Expected data characteristics

The exact dataset structure may vary by workflow, but the current app logic is built around tables that can support:

- directed correspondence relationships
- temporal filtering
- geographic plotting
- person-network derivation
- linked record inspection in the right sidebar

### Recommendation

If you are extending this repository, document the exact expected CSV schemas here as the data contracts stabilize.

At minimum, future versions of this README should include:

- required files
- required columns
- optional columns
- how person metadata joins onto node data
- how letters/records join onto nodes or edges
- what happens when some files are missing

---

## 10. How to Use the App

A typical workflow is:

1. **Open the app** in the browser.
2. **Load or work from available data**.
3. **Choose a visualization mode** such as geographic view or person view.
4. **Adjust filters** using the control panel.
5. **Use the timeline** to restrict the visible date range.
6. **Use playback controls** to explore the dataset chronologically.
7. **Hover or click** nodes, edges, or clusters to inspect them.
8. **Read detailed information** in the right-side inspector.
9. **Adjust theme/display settings** if needed.
10. **Export** the current state as SVG, PNG, or CSV outputs.

This workflow is intended to support both exploratory research and production of exportable outputs.

---

## 11. Known Limitations and Fragile Zones

This project is actively maintained, and some areas should be treated cautiously.

### Current structural limitation

- `src/App.jsx` still contains a large amount of orchestration logic and remains the main concentration point in the codebase.

### Known fragile zones

The maintainer documentation identifies the following areas as especially sensitive:

- viewport centering/reset behavior
- dense-map hover/click interaction
- selection persistence across filters
- playback/timeline state coupling
- export rendering/state coupling
- broad orchestration work inside `src/App.jsx`

### Practical implication

If you are making changes, avoid broad mixed-purpose edits. Prefer bounded passes that touch one subsystem at a time.

---

## 12. Maintainer Documents

This repository includes internal maintenance and workflow documents that should be consulted before major edits:

- **`MAINTAINERS_GUIDE.md`**  
  Architectural overview, extracted-module history, fragile zones, and recommended future refactor priorities.
- **`PROJECT_WORKFLOW_CHARTER.md`**  
  Working rules for bounded passes, fragile-zone preflights, source-of-truth discipline, and delivery expectations.
- **`CHANGELOG.md`**  
  Record of completed implementation/refactor milestones.
- **`CONTROL_PANEL_DEPENDENCY_MAP.md`**  
  Dependency and render-path documentation for the left control panel.
- **`VIEWPORT_TIMELINE_AUDIT.md`**  
  Notes specific to viewport/timeline coupling and deferred cleanup goals.

### Maintainer recommendation

Before structural edits, read at least:

1. `MAINTAINERS_GUIDE.md`
2. `PROJECT_WORKFLOW_CHARTER.md`
3. `CHANGELOG.md`

---

## 13. Roadmap / Near-Term Priorities

Based on the current repository state, likely next priorities include:

- continuing safe reduction of orchestration pressure inside `src/App.jsx`
- continuing bounded modularization rather than broad rewrites
- improving and formalizing data-input documentation
- further refining exported outputs and related documentation as the research workflow matures

This list is descriptive rather than exhaustive; consult the maintainer docs for the more precise architectural state.

---

## 14. License / Author / Acknowledgments

### Author / Maintainer

Repository owner: **Haley R. P.** (per current GitHub repository ownership)

### License

Add the project’s chosen license here if/when one is finalized. If this project is intended primarily as a research prototype rather than a general-purpose public package, that should be stated explicitly in this section.

### Acknowledgments

This project sits at the intersection of:

- historical correspondence research
- network analysis
- geographic visualization
- interactive digital humanities tooling

---

## Suggested Next README Improvements

The next most valuable improvement would be a dedicated **Data Schema** section with real example CSV headers. That would make the repository substantially easier for both future maintainers and outside collaborators to understand.
