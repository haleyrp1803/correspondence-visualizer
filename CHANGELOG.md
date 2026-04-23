# Changelog

This changelog is intentionally explicit about recent commits so the project’s development trajectory can be explained step by step.

## `951b450` — Replace embedded sample data with current publication dataset

- Replaced the embedded sample/fallback data in `src/App.jsx`
- Set the built-in browser/demo state to use the current intended publication dataset
- Preserved existing app behavior while changing the default embedded content
- Established the current clean publication baseline

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

## Earlier history

Earlier commits remain part of the repository history, but the most important current trajectory for the publishable Peridot baseline is:

1. control-panel cleanup and visual polish
2. maintainer-doc baseline refresh
3. fixed `countries50m` basemap simplification
4. itch.io HTML5 packaging support
5. embedded publication dataset replacement
