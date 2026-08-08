# Maintainer's Guide

## Executive Summary

This guide is Peridot’s authoritative current architecture and maintenance reference. Use it to identify ownership boundaries, current data and interaction contracts, fragile systems, stylesheet responsibilities, regression expectations, and the active technical backlog before changing source code.

It complements the Project Workflow Charter, which governs process, and the Changelog, which preserves historical chronology. This guide does not reproduce full commit history; it records what the current architecture requires a maintainer to understand and preserve.

## Quick Navigation

- [Current architecture snapshot](#1-current-architecture-snapshot)
- [Application boundaries and route model](#2-application-boundaries-and-route-model)
- [Data lifecycle and scope vocabulary](#3-data-lifecycle-and-scope-vocabulary)
- [Visualizations, Timeline, Inspector, and Export](#4-visualizations-timeline-inspector-and-export-contracts)
- [Advanced Search / Explore](#5-advanced-search--explore-contract)
- [Analytics](#6-analytics-contract)
- [Data import and workbooks](#7-data-import-and-workbook-contract)
- [Theme and stylesheet architecture](#8-theme-and-stylesheet-architecture)
- [Module ownership index](#9-module-ownership-index)
- [Fragile zones and regression tests](#10-fragile-zones-and-regression-test-matrix)
- [Active backlog](#11-active-technical-backlog)
- [Archived and compatibility paths](#12-archived-and-compatibility-paths)
- [Fresh-chat handoff](#13-fresh-chat-handoff-essentials)

## Document Role and Boundaries

This document owns current architecture, source/module ownership, state and data contracts, fragile-zone descriptions, regression matrices, compatibility paths, and the active technical backlog. It does not own full commit chronology, broad public onboarding, or the mandatory process rules for changing source; those belong respectively to the Changelog, README, and Project Workflow Charter.

Current synchronized checkpoint:

```text
134c67c — Refine upload review checkpoint
Branch: main
Status: local and origin/main aligned after the latest sync ritual
```

For detailed milestone interpretation and full commit history, see [CHANGELOG.md](CHANGELOG.md).


## 1. Current Architecture Snapshot

Peridot is a Vite/React/Tailwind research application that has moved from a map-first side-panel model to a workspace-first, multimodal exploration environment. `src/App.jsx` remains the top-level orchestration boundary, while dedicated workspaces and pure/helper modules now own much of the UI, import, visualization, theme, and interaction behavior.

The active data architecture now includes a canonical normalized research model beneath the current runtime consumers. Correspondence imports normalize into canonical entities/places/records/participations/evidence/assertions and then pass through a legacy compatibility adapter so existing consumers retain their accepted row contracts. Genealogy imports normalize person-centered data directly into canonical entities, life events, relationships, places, evidence, and provenance and project through a dedicated genealogy runtime model. Phase 1 established user-owned variable/mapping definitions, stable source-table metadata, deterministic transformation helpers, and an explicit runtime compatibility boundary.

Phase 2 has now generalized the active correspondence/directed-record mapping shell itself. The accepted workflow is Preview → Time → Places → Relations → Evidence → Review, with a workbook Sheets step where relevant. Preview records table orientation without visually transposing the source; Time uses plain date/beginning/ending roles; Places stores repeatable place parts; Relations stores repeatable n-participant relationship parts; Evidence preserves Include/Ignore and display labels; Review repeats the assignments before capability validation. Workbook Places and Relations use the same interaction model with sheet-qualified references. These richer mappings are currently preserved in mapping state, but the next Phase 2 task is to make them authoritative inputs to canonical normalization/runtime behavior rather than leaving legacy Source/Target and point/route compatibility fields as downstream decision-makers.

The active public workflow is Home → Manage Your Data → Visualize Your Data → Explore Your Data → Learn More. Themes and Accessibility remains route-compatible but intentionally hidden from the public hamburger menu. Timeline and Export are Visualizations-integrated surfaces; Inspector is a compact/full shared-state evidence system.

A first-time tutorial now overlays this workspace model. Its accepted flow begins in Visualizations and guides the researcher through Visualizations, Timeline, Inspector, Explore, Browse / Apply, Working Set, and Export. The former standalone tutorial Start page has been removed. The tutorial retains draggable panels, minimize/restore docking, step progression and recovery, keyboard-accessible controls, target anchoring/highlighting, and a Home-page entry point.

### Current source context

- Local source of truth: `C:\Users\haley\OneDrive\Desktop\Peridot\`
- Active continuation branch: `main`
- Repository: `https://github.com/haleyrp1803/peridot-humanistic-data`
- Active D3/SVG path: MapLibre experimental work is archived and not part of active `main`.

### Supporting planning documents

The following tracked planning documents remain relevant maintenance references:

- `planning_documents/PERIDOT_INTERFACE_REDESIGN_PLAN.md` — original workspace-first redesign rationale and public-navigation direction.
- `planning_documents/PERIDOT_ROUTING_CONTRACT_AUDIT.md` — routing and compatibility-boundary audit.
- `planning_documents/PERIDOT_INSPECTOR_WORKSPACE_CONTRACT.md` — compact/full Inspector model and shared-state contract.
- `planning_documents/PERIDOT_CODE_STRUCTURE_AUDIT.md` — structural cleanup roadmap and bounded future decomposition reference.
- `planning_documents/PERIDOT_NORMALIZED_DATA_MODEL_PLAN.md` — historical/architectural plan that established the canonical normalized model, provenance/temporal contracts, correspondence compatibility boundary, and genealogy normalization sequence; much of this plan is now implemented.

### Application-boundary inventory

| System | Primary owner | Core responsibility | Sensitive coupling | Minimum regression check |
|---|---|---|---|---|
| Top-level orchestration | `App.jsx` | state, derived data, routing, Inspector history, export wiring | filters, timeline, compact/full Inspector bridge | open each workspace; upload/use sample; click node/edge/cluster |
| Workspace navigation | `peridotWorkspaceConfig.js`, `PeridotHamburgerMenu.jsx` | public routing and hidden Theme path | active workspace state, Inspector presentation | hamburger routes; Home CTAs; return paths |
| First-time tutorial | tutorial state, panel, dock, anchor/highlight, and Home-entry boundaries | seven-stage guided workflow, progression, recovery, draggable/minimized presentation | workspace routing, Inspector close behavior, target observation, keyboard focus | launch from Home; complete all stages; drag; minimize/restore; Back/Continue; close Inspector when instructed |
| Data import | Data workspace + mapping/import helpers | parse, map, validate, normalize, capability audit | upload reset and downstream data scope | template, CSV, TSV, XLSX, XLS, mapped import |
| Visualizations | `PeridotVisualizationsWorkspace.jsx` | modes, header, stage, Timeline placement, Export menu | stage sizing, Inspector overlay, portal layers | map/network/chart switch; header/timeline controls |
| Search | `PeridotSearchWorkspace.jsx` | draft/apply search and Explore UI | active dataset, facets, Inspector handoff | Apply/Clear, suggestion, pagination, Inspect return |
| Inspector | Inspector modules + `App.jsx` | compact/full evidence dossier and history | selection resolution, mounted overlay | node/edge/cluster; Expand; Back; close |
| Analytics | Analytics modules | controls, derivation, SVG rendering and chart export | scope/date handling, palette roles | chart switch, series selection, export |
| Theme/CSS | theme modules + stylesheets | semantic colors and component presentation | import order, dropdown/z-index, reduced motion | theme role/palette change; each workspace |
| Export | `exportHelpers.js` + Visualizations header | image/tabular export | visible/selected/charted scope | SVG/PNG/CSV output |

## 2. Application Boundaries and Route Model

Peridot uses a workspace-first route model. The active public path is **Home → Manage Your Data → Visualize Your Data → Explore Your Data → Learn More**. The hamburger menu is the primary visible navigation surface. **Themes and Accessibility** remains implemented and route-compatible, but is intentionally hidden from the public menu.

### Workspace boundaries

| Surface | User-facing role | Primary boundary | Important maintenance condition |
|---|---|---|---|
| Home | concise start surface | `PeridotHomeWorkspace.jsx` | preserve fixed-ratio, non-scrolling title-card composition |
| Manage Your Data | import, mapping, validation | `PeridotDataWorkspace.jsx`, mapping/import helpers | preserve permissive database-first ingestion and explicit user mapping |
| Visualize Your Data | map, network, charts, Timeline, Export | `PeridotVisualizationsWorkspace.jsx` | preserve stage sizing, mounted Inspector behavior, and header/timeline layering |
| Explore Your Data | Advanced Search and research scope | `PeridotSearchWorkspace.jsx` | preserve draft/apply semantics and return-to-state Inspector handoff |
| Learn More | project context and help | `PeridotLearnMoreWorkspace.jsx` | preserve editorial reading flow and divider choreography |
| Themes and Accessibility | internal appearance/settings workspace | `PeridotThemeWorkspace.jsx` | retain route/component even while menu entry is hidden |
| Inspector | compact selection summary and full dossier | Inspector modules + `App.jsx` | compact/full modes share selection and Back history |

### First-time tutorial contract

The tutorial is a guided overlay system rather than a separate workspace. Its current accepted contract is:

- Begin directly with Visualizations; do not restore the removed standalone Start page.
- Preserve the seven-stage sequence: Visualizations → Timeline → Inspector → Explore → Browse / Apply → Working Set → Export.
- Preserve draggable tutorial panels, minimize/restore docking, Back/Continue progression, recovery logic, and keyboard accessibility.
- Keep the current dialogue composition: large centered title, one sentence per frame, footer progress, and the Adobe Stock Filigree 3 divider treatment.
- Keep target highlighting and the stabilized observer behavior represented by the `619bab0` baseline.
- Explicitly require the user to close the Inspector before the tutorial advances from Inspector guidance.
- Treat stronger attention animation as deferred experimentation, not as current functionality.

Minimum regression checks: launch from Home; progress forward and backward through every stage; drag the panel; minimize and restore it; verify keyboard progression/focus; verify each target anchor; open and close Inspector at the instructed step; recover cleanly from a temporarily unavailable target.

### Current route and visualization model

- Visualizations exposes capability-aware Place Map, People Network, Force-Directed Network, and Chart Visualizations views.
- Timeline is a year-based bottom scrubber within Visualizations; Export is a shared Visualizations header menu rather than a separate workspace.
- Advanced Search is the primary Explore surface and owns global applied filtering.
- Legacy rail and panel paths exist only as compatibility bridges where they preserve visualization-click Inspector behavior.
- MapLibre work is archived; active `main` uses the D3/SVG path.

Detailed subsystem contracts appear in Sections 4–8. The module index in Section 9 identifies the concrete source owners.

## 3. Data Lifecycle and Scope Vocabulary

Use these terms consistently:

| Scope term | Definition | Created by | Consumed by | Known audit caveat |
|---|---|---|---|---|
| loaded data | all records currently loaded in the app | sample-data or import path | Search, visualization derivation, Analytics, export | may contain incomplete but accepted records |
| mapped/normalized data | accepted source interpretations represented in the canonical model, plus compatibility/runtime projections where a consumer still requires them | profile/universal mapping, canonical normalizers, and runtime adapters | graph, capability, search, Inspector, genealogy, and future universal consumers | mapping remains user-owned; not every canonical-only universal dataset has a current runtime consumer |
| applied/filtered data | records included after Advanced Search criteria are committed | Search Apply Filters | visualizations, Inspector, Analytics, exports | formal coverage audit remains pending |
| timeline-visible data | records inside current timeline range/playback state | Timeline controls | active stage and related consumers | Timeline × Analytics audit remains pending |
| selected data | node, edge, cluster, entity, place, route, or record under inspection | interaction/Inspector state | compact/full Inspector | must preserve Back history |
| charted data | records or derived values supplied to a chart | Analytics derivation helpers | chart renderer and chart export | may be further constrained by chart-local settings |
| exported data | output explicitly described by an export action | export helpers/header actions | image/CSV file | labels must identify relevant scope |

The authoritative Advanced Search contract appears in [Section 5](#5-advanced-search--explore-contract). The scope vocabulary above must be used precisely until the dedicated coverage and Timeline × Analytics audits are complete.

## 4. Visualizations, Timeline, Inspector, and Export Contracts

### Inspector

The Inspector is a dual-mode evidence system. Visualization clicks open compact side-panel summaries; **Expand**, linked-data navigation, and full Inspector routes open the dossier workspace. Compact and full modes must share one selected target and multi-step Back history.

- `App.jsx` owns Inspector presentation mode, selection resolution, history, and linked person/place/record/route navigation.
- `InspectorPanel.jsx` owns shared Inspector content chrome; `InspectorBodyRouter.jsx` resolves view type.
- `InspectorNodeView.jsx`, `InspectorEdgeView.jsx`, and `InspectorClusterView.jsx` own the principal dossier views.
- The full Inspector overlays Visualizations without remounting the underlying stage. Closing it should restore the mounted visualization state.
- Connected-record tables retain date-first sorting, per-column filtering, 10/25/50 page sizes, pagination, and capability-aware relational versus point-only columns.
- **Unknown** remains a first-class place-like bucket for unresolved/missing locations.

Minimum regression checks: node, edge, and cluster click; compact close; Expand; related person/place; route/record navigation; Back; Explore-to-Inspector return; and full Inspector open/close without stage reanimation.

### Visualizations and Timeline

Visualizations owns capability-aware map, network, force-directed, and chart entry points; header collapse behavior; the bottom timeline scrubber; and the shared Export menu. Timeline is year-based and must remain a Visualizations-integrated control rather than a separate workspace.

### Export

Export is a header action rather than a top-level workspace. Map/network exports include SVG, PNG, nodes CSV, and edges/routes CSV; Chart Visualizations provides PNG export through the same header menu. Map PNG default output is map-only, without mandatory Peridot branding, with optional title and metadata annotations.

## 5. Advanced Search / Explore Contract

Advanced Search is the primary Explore Your Data surface and the owner of global **applied/filtered data**. It uses the explicit draft/apply model: typing, suggestions, Browse selections, facets, and structured criteria change draft state until **Apply Filters** commits the scope.

### Responsibilities

- Build Search supports keyword, person/entity, place, route-place, route-people, date, minimum-weight, capability, and structured criteria inputs.
- Browse exposes route-aware dataset indexes for people/entities, places/locations, and routes when relationship data exists.
- Results provides compact route-aware ledgers, pagination, and Inspector handoff.
- Refine / Inspect exposes applied-result facets; expansions fill draft controls for later Apply rather than silently changing scope.
- Capabilities presents the active dataset’s supported research surfaces.
- Inspect opens the full Inspector above the current Explore state, so closing it returns the researcher to the same search context.

### Scope and regression contract

Search is a fragile active-data boundary. After changes, verify draft suggestions, Apply, Clear, criteria connectors, Browse/facet behavior, Results pagination, Inspector return-to-state behavior, and interaction with Timeline, Analytics, and Export.

The dedicated Search coverage/scope audit remains pending. Do not state that every consumer applies loaded, filtered, timeline-visible, and chart-local scope identically until that audit is complete.


### Preserved detailed Search regression expectations

The following implementation-level expectations were relocated from the Project Workflow Charter so the Charter can remain process-focused. They remain current maintenance requirements.

<details>
<summary><strong>Open detailed Advanced Search preservation notes</strong></summary>

Advanced Search is the intended consolidation point for global filters and the primary Explore Your Data surface.

Committed Advanced Search controls include:

- keyword search
- person filter
- place filter
- **Route Filter (Place)**
- **Route Filter (People)**
- minimum correspondence weight
- date range
- predictive suggestions for person, place, route-place, route-people, start-year, end-year, and structured-criteria value fields
- structured criteria with AND / OR / EXCLUDING connectors
- dataset-wide Browse indexes for people/entities, places, routes, and evidence fields
- result cards with Inspector handoff
- result facets based on the current applied result set
- Capabilities tab containing what-this-data-can-do summaries
- **Apply Filters**
- **Clear Filters**
- pre-update status feedback

Future Advanced Search controls may include:

- language/relationship filters
- mappability filters
- safe categorical metadata filters
- inspector actions such as “filter to this person/place/route”

Filter controls should not trigger expensive graph/data recomputation on every keystroke or draft edit. Use draft values with an explicit **Apply Filters** action when the filter can affect the active dataset. Use **Clear Filters** to reset the global filter state. For expensive full-dataset updates, show visible feedback before committing state changes so users understand that the app is updating.

When changing Advanced Search, explicitly test:

- typing in a text field does not freeze the app
- filters apply only when intended
- current applied filter scope is clear to the user and remains visible near the top of the workspace
- Timeline playback remains functional
- Analytics receives the intended filtered scope
- Export scope remains clear

---

Detailed subsystem regression checks belong in the Maintainer’s Guide. Preserve the distinction between active paths, compatibility paths, and archived experiments.

</details>

## 6. Analytics Contract

Analytics is conceptually part of Visualizations. It supports Bar, Grouped Bar, Stacked Bar, Line, Multi-Line, Histogram, Pie, Sunburst, and Heatmap views; tabbed controls; manual category/series selection; persistent summaries/legends; a default finite 30-color series library; and chart PNG export.

Core ownership:
- `AnalyticsPanel.jsx` owns the configuration UI and registers export upward.
- `analyticsConfig.js` owns chart metadata, defaults, and curated variable definitions.
- `analyticsDerivationHelpers.js` owns variable detection, bucketing, filtering, aggregation, and chart-ready data.
- `analyticsChartComponents.jsx` owns SVG rendering, card/legend geometry, visible summaries, ticks/gridlines, theme-series marks, and exportable SVG surface.

The current accepted chart model uses a quarter-width control rail and three-quarter chart/legend card. Bar charts default to vertical orientation. Use semantic chart series roles rather than local hardcoded colors. Preserve the deferred Timeline playback × Analytics scope audit rather than asserting universal scope consistency.

## 7. Data Import and Workbook Contract

Peridot supports template CSV, explicit arbitrary CSV/TSV mapping, workbook-aware XLSX/XLS import, and two active normalization profiles: **Correspondence / Directed Record** and **Genealogy / Person-Centered**. The canonical model is database-first: source material may remain useful even when it is not map-, network-, timeline-, or legacy-runtime-ready.

### Canonical normalization and profile boundary

The current import architecture is:

```text
parsed/staged source
→ user-selected and user-owned mapping/profile
→ canonical normalized dataset
→ validation
→ profile/consumer-specific runtime projection
```

- Correspondence/directed-record imports use the canonical correspondence normalizer and then `peridotLegacyCompatibilityAdapter.js` to reproduce the established `normalizedRows` / `normalizedLetters` / `normalizedPersonMetadata` / `places` runtime contract.
- Genealogy/person-centered imports normalize directly into canonical entities, birth/death events, parent/partner relationships, places, evidence, assertions, and provenance, then use `peridotGenealogyRuntimeModel.js` for the active genealogy runtime projection.
- Phase 1 universal fixtures for stock-price, Alaskan-airfield, and Maria-Maddalena-style structures are valid canonical/universal datasets but are deliberately **not** forced through correspondence or genealogy runtime shapes merely to satisfy existing consumers.
- Dataset profiles are active compatibility/preset paths. Do not retire or collapse Correspondence or Genealogy unless a later universal mapping workflow proves full capability parity and the change demonstrably simplifies architecture rather than relocating complexity.

### Import contract

- `PeridotDataWorkspace.jsx` owns user entry, template download, upload launch, profile selection, upload summary, and navigation into Visualizations.
- `PeridotColumnMappingModal.jsx` owns the correspondence/directed-record mapping stages (Preview, Sheets where applicable, Time, Places, Relations, Evidence, Review) and the genealogy stages (Preview, Identity, Parents, Partners, Life events, Places, Attributes, Review).
- Mapping is explicit, progressive, reversible, and user-owned. Peridot may propose recognizable structures, but it does not silently standardize values, assign scholarly meaning, or infer irreversible relationships.
- Preview preserves the source table visually as uploaded. For single tables, the user can state whether headings run across the top or down the left; downstream mapping controls and example values must use the same orientation-aware internal row set.
- Time maps Date, Beginning date, and Ending date in human-readable language; no mandatory primary date is imposed.
- Places uses repeatable `placeParts` (Place A/B/C...) with place source, role source, and optional combined or separate coordinates. The user-facing model no longer asks users to classify a place as a point versus route endpoint.
- Relations uses repeatable `relationshipParts` (Part A/B/C...) with per-part participant and role mappings, plus optional relationship-level type/label fields. N-part relationships must not be silently reduced to binary Source/Target just to satisfy legacy consumers.
- Workbook Places and Relations mirror the single-table interaction model using `{ sheetName, columnName }` references.
- Evidence retains explicit Include and Ignore controls, optional display labels, source examples, and chart/filter-readiness hints. Fields already structurally mapped on earlier pages remain visible but are ignored as duplicate evidence.
- Review is a summary + validation + correction checkpoint. It repeats Time/Places/Relations/Evidence assignments, provides one unified **Map** readiness row, and retains current capability/warning output underneath.
- Workbooks still use a selected primary record sheet and user-configured unique-ID joins; never use row-order joining as the primary assembly strategy.
- The Phase 1 universal mapping/source/transformation layer remains the canonical architectural foundation. The Phase 2 UI is now substantially integrated, but its richer assignments are not yet authoritative throughout runtime assembly and all consumer paths.

### Minimum regression checks

Test template download; CSV and TSV mapping; XLSX and XLS staging; primary-sheet selection; multiple joins; joined-field mapping; post-upload validation; retained accepted incomplete rows; Search reset/coherence; Timeline and Analytics scope after upload; Inspector navigation; and relevant exports.


### Preserved detailed import regression expectations

The following implementation-level expectations were relocated from the Project Workflow Charter so the Charter can remain process-focused. They remain current maintenance requirements.

<details>
<summary><strong>Open detailed data-import preservation notes</strong></summary>

Data Inputs is now the public owner of the standardized single-CSV upload workflow and the arbitrary table column-mapping workflow.

Committed Data Inputs behavior includes:

- downloadable Peridot CSV template;
- one unified CSV / TSV / XLSX / XLS table-workbook upload control;
- arbitrary CSV/TSV/Excel upload staging and role-based column mapping;
- mapped arbitrary-table import into Peridot data;
- post-upload validation popup;
- persistent latest-upload summary in the Data Inputs panel after the popup closes;
- capability reporting for Inspector, Search, unified Map readiness, network readiness, timeline readiness, Analytics/chart readiness, and Export;
- public legacy Geography / Raw Data / Person Metadata upload controls superseded by the one-file and mapped-import workflows;
- workbook parsing, mapping, unique-ID joins, and import assembly for XLSX/XLS workbooks;
- selected workbook custom fields visible in linked-record and entity-profile Inspector views;
- generic chart/evidence records admitted into the active dataset where they have usable content;
- evidence/analysis include/ignore checkboxes that default to Include.
- active Correspondence / Directed Record and Genealogy / Person-Centered profile routing;
- canonical correspondence normalization with a legacy-runtime compatibility adapter;
- active genealogy normalization/mapping/runtime projection for stable person IDs, parents, partners, life events, places, attributes, supplemental-row decisions, and provenance;
- an internal universal mapping/source/transformation foundation whose generalized public mapping UI is deliberately deferred to Phase 2.


Future Data Inputs changes should explicitly test:

- template download works;
- uploading a valid template CSV updates the app data;
- uploading a workbook stages sheets without freezing on reasonably sized files;
- workbook mapping can configure primary sheet, unique-ID joins, core field mapping, and selected Inspector fields;
- upload summary popup appears;
- closing the popup does not erase the persistent side-panel summary;
- rows lacking coordinates are not silently discarded if otherwise accepted;
- rows lacking parseable dates are not silently discarded if otherwise accepted;
- Inspector still opens after upload;
- Search & Filter resets or remains coherent after upload;
- Timeline playback does not use stale date scope after upload;
- Analytics receives the intended uploaded/filtered rows;
- Export still labels and exports the intended data scope.

Do not reintroduce the legacy three-file upload workflow unless there is a specific recovery or compatibility reason; the active public direction is one-file template upload plus mapped arbitrary-table import.

</details>

## 8. Theme and Stylesheet Architecture

### Semantic theme ownership

`peridotTheme.js` is the semantic theme control surface. New color work should extend theme roles rather than scatter component constants. `peridotThemeRoleMetadata.js` supplies human-facing role descriptions; `peridotColorPalette.js` remains a legacy compatibility adapter. Chart-targeted palette imports may override `analytics.series` without recoloring unrelated chrome.

### Stylesheet cascade contract

The active stylesheet architecture is component-oriented. `index.css` owns only shared/global rules: Tailwind setup, document defaults, shared cards/forms/buttons/ornaments, shared theme/design contracts, Visualizations-stage transitions, timeline choreography, and reduced-motion behavior.

`main.jsx` owns this functional cascade order:

```jsx
import './index.css';
import './InspectorPanel.css';
import './AnalyticsPanel.css';
import './PeridotSearchWorkspace.css';
import './PeridotColumnMappingModal.css';
import './PeridotLearnMoreWorkspace.css';
import './PeridotFeedbackForm.css';
```

| Stylesheet | Ownership boundary | Sensitive behavior | Verify after change |
|---|---|---|---|
| `index.css` | shared global layer | shared selectors and cross-workspace defaults | Home, Data, Visualizations, Explore, Learn More |
| `InspectorPanel.css` | compact/full/Explore Inspector | overlay and dossier presentation | compact click, Expand, Back, Explore handoff |
| `AnalyticsPanel.css` | chart builder and renderer chrome | controls, dropdown layering, reduced motion | chart switch, menus, export |
| `PeridotSearchWorkspace.css` | Explore folio/search | scroll containment and folio corners | expanded Build/Refine/Browse/Results scrolling |
| `PeridotColumnMappingModal.css` | role-mapping modal | modal layering and step transitions | table/workbook mapping flow |
| `PeridotLearnMoreWorkspace.css` | Learn More reading surface | portrait/text flow, dividers, expansion | biography, disclosure, Tutorials |
| `PeridotFeedbackForm.css` | feedback modal | modal layering and form layout | hamburger-adjacent form, backdrop/Escape, Visualizations controls |

CSS extraction, dead-rule removal, behavior repairs, and visual redesign are distinct bounded passes. The earlier component-style extraction sequence is historical context in the Changelog; the `7df46a8` import restoration is a correction to preserve this functional cascade, not a new architectural direction.

### Brand Assets and Home Workspace Constraints

The user-designed Peridot logo and related design assets live in `assets/`:

- `assets/Peridot Logo.png` — original solid-background logo for documentation/reference use.
- `assets/Peridot Logo Transparent.png` — original transparent-background logo.
- `assets/Peridot Logo Gilded.png` — revised gilded logo for documentation/reference use.
- `assets/Peridot Logo Gilded Transparent.png` — revised transparent logo used by the current Home workspace.
- `assets/Adobe Stock Filigree 1.png` — selected licensed filigree used as Home workspace framing.
- `assets/Adobe Stock Filigree Divider Set.png`
- `assets/Adobe Stock Filigree Full Set.png` — licensed Adobe Stock filigree set retained as a future design-reference asset.
- `assets/Homepage Current 2026-06-16.png` — current homepage screenshot for documentation.
- `assets/Homepage Layout Mockup.png` and `assets/Homepage Layout Mockup Annotated.png` — user-authored layout references for the homepage redesign.
- `assets/Chart Colors Base.jpeg`, `assets/Chart Colors Dark.jpeg`, and `assets/Chart Colors Pale.jpeg` — chart-palette reference assets.
- `assets/Peridot Palette Upload Guide 1.png` and `assets/Peridot Palette Upload Guide 2.png` — palette-upload guide/reference assets.
- `assets/2026_Price_Headshot.jpg` — creator portrait used in the Learn More biography flow.
- `assets/Price_CV.pdf` — creator CV resource linked from Learn More.

`src/PeridotHomeWorkspace.jsx` imports the gilded transparent logo directly from `../assets/Peridot Logo Gilded Transparent.png` and the selected filigree from `../assets/Adobe Stock Filigree 1.png`. Keep these files under version control. The local Photoshop source file, `assets/Peridot Logo Workspace.psd`, should remain ignored unless there is an explicit decision to archive editable design sources in the repository.

### Home title-card layout contract

The Home workspace is intentionally a minimal orientation surface rather than a full onboarding page.

Keep:

- the deep green, multi-tone, striped Peridot background;
- the gilded transparent logo;
- the selected licensed gold filigree asset;
- the CTA pair **Use sample data** and **Upload your data**, with **Upload your data** on the right;
- the concise sentence: “Your go-to tool for exploring, visualizing, and presenting humanistic data.”;
- Georgia / Peridot display-serif typography for the sentence;
- non-scrolling first-screen presentation.

Do not:

- add explanatory cards back to the homepage;
- let filigree overlap the logo, sentence, or buttons;
- let button labels wrap;
- let the sentence dominate the Peridot wordmark;
- turn the homepage back into a dashboard/card-grid layout.

Anchor rules:

- the full homepage composition is one centered fixed-ratio title-card stage;
- the logo is the largest visual object and sits left of center;
- the sentence and buttons form one right-side content unit, vertically centered relative to the logo;
- the sentence is centered over the buttons;
- the left filigree frames the outside of the logo group;
- the right filigree frames the outside of the text/buttons group;
- all homepage elements should scale from the same stage sizing logic so the relative proportions remain stable across browser sizes.


### Current Theme and Routing State

The default interface is Peridot-inspired and controlled through semantic roles in `peridotTheme.js`. `peridotThemeRoleMetadata.js` must remain aligned with those roles, while `peridotColorPalette.js` supports older compatibility paths. Chart-targeted palette imports may change chart series only; they must not recolor unrelated interface chrome.

Current routing constraints are stable: the hamburger exposes Manage Your Data, Visualize Your Data, Explore Your Data, and Learn More; Themes and Accessibility remains internally routable but hidden; Export and Timeline stay inside Visualizations; and the persistent rail survives only as a compact Inspector compatibility bridge. For the historical palette and workspace-routing commit sequence, see the Changelog.

## 9. Module Ownership Index

Use this index by subsystem rather than as an alphabetical file list. Module descriptions below remain the current ownership record; detailed behavioral contracts belong in Sections 4–8.

- [Application shell and workspace routing](#application-shell-and-workspace-routing)
- [Data import and mapping](#data-import-and-mapping)
- [Visualizations, map, and timeline](#visualizations-map-and-timeline)
- [Search and interaction resolution](#search-and-interaction-resolution)
- [Analytics](#analytics)
- [Inspector](#inspector)
- [Theme, styles, and visual language](#theme-styles-and-visual-language)
- [Export and shared utilities](#export-and-shared-utilities)

### Application shell and workspace routing

#### `src/App.jsx`

Main orchestration file. It owns top-level state, derived data wiring, workspace composition, theme token definitions, side-panel compatibility contract building, Search & Filter state, timeline state, inspector navigation state, export wiring, the connected-record table renderer, and the live Data workflow. It wires template download, upload parsing, arbitrary CSV/TSV/workbook mapping flow, validation summary state, normalization output, upload-source reset behavior, and modal visibility.

`App.jsx` no longer contains the inline Home, Data, Theme, Visualizations, Explore, Learn More, Search, Export, or hamburger-menu UI components. Those have been extracted into dedicated `Peridot*Workspace` / menu files. It still remains the main state/orchestration boundary.

#### `src/peridotWorkspaceConfig.js`

Workspace-mode vocabulary and helper functions used by `App.jsx` for Home, Data, Visualizations, Explore, Learn More, Search, Inspector, and Themes/Accessibility routing. Export and Timeline are now Visualizations-integrated features rather than standalone workspace modes.

#### `src/PeridotHamburgerMenu.jsx`

Primary visible navigation component. It renders the hamburger button and the simplified task-oriented public menu: Manage Your Data, Visualize Your Data, Explore Your Data, and Learn More about Peridot. Themes and Accessibility is intentionally hidden from the public menu for now, but the component comments preserve the restore point for re-adding that entry later.

#### `src/PeridotHomeWorkspace.jsx`

Full Home / welcome workspace implemented as a fixed-ratio title-card composition. It uses the gilded transparent Peridot logo, licensed filigree framing, a single concise sentence, and **Use sample data** / **Upload your data** calls to action. The component intentionally keeps detailed onboarding out of the homepage; longer explanatory material belongs in `PeridotLearnMoreWorkspace.jsx`.

#### `src/PeridotDataWorkspace.jsx`

Full Data workspace for CSV template download, unified CSV/TSV/XLSX/XLS upload, staged table/workbook summary, mapping launch, latest-upload summary, and navigation to Visualizations.

#### `src/PeridotVisualizationsWorkspace.jsx`

Full Visualizations workspace. It contains capability-aware dropdown groups for mapping, network, chart, and data-exploration views; renders unavailable-state explanations when a dataset cannot support a selected view; hosts the large chart workspace; owns the collapsible visualization header, the bottom Timeline scrubber placement, and the shared header Export menu; and wraps the live map/network stage.

#### `src/PeridotSearchWorkspace.jsx`

Full Advanced Search workspace and primary Explore surface. It renders active-scope summary plus the animated **Build Search**, **Browse**, **Results**, **Refine / Inspect**, and **Capabilities** tabs. It owns the UI for keyword/person/place/route/date/weight filters, predictive suggestions, capability filters, structured AND / OR / EXCLUDING criteria, compact dataset-wide Browse ledgers, route-aware Results ledgers, result facets, Apply Filters, Clear Filters, Explore-scoped page animations, and search-result Inspector handoff. Inspect actions from Explore now open the full Inspector above the current Explore page so the researcher returns to the same tab/state when the Inspector closes.

#### `src/PeridotThemeWorkspace.jsx`

Themes and Accessibility workspace for Peridot default, Early modern map, Modern map presets, custom palette import, role-targeted palette application, and future accessibility/appearance controls. It remains implemented and route-compatible, but the hamburger menu entry is currently hidden while the page remains more development-facing than user-ready. Theme controls should continue to operate through semantic role targets rather than one-off component overrides. Explicit chart-targeted imports should alter chart series colors without recoloring unrelated app chrome.

#### `src/PeridotExploreWorkspace.jsx`

Compatibility routing boundary for the old Explore workspace. Current Explore entry points should route directly to `PeridotSearchWorkspace.jsx`; the former capability-summary role has moved into the Advanced Search **Capabilities** tab.

#### `src/PeridotLearnMoreWorkspace.jsx`

Public project-information hub for creator context, project provenance, open-source resources, AI-method disclosures, tutorials, and help. It keeps compact reading as the default: the creator biography and both disclosure papers expand independently, while the creator/GitHub top row can reallocate width in favor of the longer biography without removing access to repository materials. The creator portrait is part of the expanded biography’s reading flow rather than a separate dashboard card. Major Learn More sections are separated by the same restrained gold-filigree divider language used in Inspector and Explore; divider timing intentionally establishes reading order before each following section appears.

#### `src/PeridotFeedbackForm.jsx`

Persistent feedback modal opened from the control placed beneath the hamburger menu. It owns feedback-type selection, required message validation, optional context/email capture, Formspree submission, success/error states, Cancel/close controls, backdrop behavior, and Escape handling. It is coupled to `PeridotHamburgerMenu.jsx` for entry placement and to `PeridotFeedbackForm.css` for modal layering; its overlay must remain above Visualizations header and stage controls.

### Data import and mapping

#### `src/peridotCsvSchema.js`

Owns the public Peridot CSV schema contract. It defines:

- exact template column names
- field groupings
- minimum record rules
- capability labels
- upload tips
- validation summary copy
- small pure helpers for values, coordinates, person-pair/place-pair checks, mappability, machine-readable dates, accepted-record status, and missing-column checks

This file records the product rule that Peridot is database-first and that missing coordinates/dates should be flagged rather than silently rejecting otherwise useful records.

#### `src/peridotCsvNormalizer.js`

Owns pure conversion from public one-file template rows into the existing internal row shapes. It creates:

- internal geography rows
- internal letter/Inspector metadata rows
- lightweight exact-name person metadata rows
- map-ready places
- accepted/unsupported row groupings

It does not clean or standardize user-entered values.

#### `src/peridotCsvValidation.js`

Owns pure post-upload validation summaries. It produces:

- row-level capability reports
- total uploaded rows
- accepted record counts
- unsupported row counts
- missing-column warnings
- capability counts
- popup-ready summary lines
- persistent side-panel latest-upload summary text

#### `src/PeridotColumnMappingModal.jsx`

Owns the large column/workbook-mapping workspace for arbitrary CSV/TSV/XLSX/XLS imports. The current UI is role-based rather than correspondence-template-first: users move through Preview, Sheets for workbooks, Time, Places, Relations, Evidence, and Review. It still produces Peridot-compatible rows for the existing visualization pipeline, but it now exposes explicit temporal roles, point-location roles, route coordinate-pair roles, workbook primary-sheet selection, multi-sheet unique-ID joins, and selected evidence/Analytics metadata from primary and joined sheets.

This file has been partially decomposed. Static UI labels/step groupings live in `peridotColumnMappingUiConfig.js`; repeated Time/Places/Relations controls live in `PeridotMappingFieldControls.jsx`; Evidence Include/Ignore controls live in `PeridotEvidenceFieldControls.jsx`. The modal now also owns orientation-aware single-table interpretation, `placeParts`, `relationshipParts`, workbook-qualified equivalents, and the human-readable Review assignment summary. It should continue to own state transitions, workbook state, import/cancel behavior, final mapping assembly, upload-mapping entrance animation hooks, and the accepted opacity-only step transition. Avoid reintroducing carousel/slide/scale/blur transitions for step changes unless a new motion pass explicitly chooses that direction.

#### `src/peridotColumnMappingUiConfig.js`

Static UI configuration for the mapping modal: single-table/workbook step sequences, display labels, field groupings, capability labels, and formatting helpers. It intentionally contains no React state and no import/application logic.

#### `src/PeridotMappingFieldControls.jsx`

Presentational mapping controls used by the mapping modal for Time, generalized repeatable Places, generalized repeatable Relations, and workbook-qualified equivalents. Places support arbitrary Place A/B/C parts with role source and optional coordinates; Relations support Part A/B/C participants with per-part role source and optional relationship metadata. Workbook controls use combined sheet-column references while preserving the internal workbook reference shape. This file should remain stateless and receive current values plus callbacks from `PeridotColumnMappingModal.jsx`.

#### `src/PeridotEvidenceFieldControls.jsx`

Presentational Evidence Include/Ignore controls for single-table and workbook imports. Workbook Evidence remains grouped by sheet, default display labels use the column name only, and each field may show up to three unique nonblank examples from the same source rows used by mapping controls. Structurally mapped Time/Place/Relation fields remain visible but are treated as already used rather than duplicated as Evidence. The modal owns state and update handlers; this file owns repeated row rendering, labels, examples, and checkbox layout.

#### `src/peridotColumnMapping.js`

Owns helper logic for arbitrary table column mapping, including common-name suggestions, core-field mapping rules, temporal-role mapping, point-location role mapping, route coordinate-pair mapping, and selected evidence/Analytics metadata handling. It preserves the existing correspondence-compatible route/network fields while adding role mappings for point/site datasets, start/end/display dates, and latitude-first combined coordinate pairs.

#### `src/peridotWorkbookMapping.js`

Owns workbook-aware mapping and import assembly helpers. It models primary record sheets, sheet/column references, arbitrary unique-ID joins, workbook validation, joined-row context construction, Peridot-shaped row assembly, temporal/point/route role mappings, and selected evidence/Analytics field handling from primary and joined sheets.

#### `src/peridotDataCapabilityAudit.js`

Pure UI-agnostic helper for inspecting uploaded rows and reporting field roles, row capabilities, and dataset-level readiness for Inspector, Search, point maps, route maps, networks, timelines, charts, and export. It supports temporal intervals, latitude-first coordinate pairs, point/site records, route records, time-series-like numeric fields, and generic evidence records.

#### `src/peridotWorkbookParsing.js`

Owns workbook parsing helper logic for CSV, TSV, XLSX, and XLS inputs. It isolates the `xlsx` dependency, parses all sheets into a shared workbook model, ignores formatting/merged-cell styling, and reads saved/displayed cell values only.

#### `src/peridotSampleData.js`

Bundled sample CSV constants used by the Home **Use sample data** path. Keeping sample data out of `App.jsx` reduces top-level orchestration noise and makes future sample replacement safer.

### Canonical normalization, profiles, and universal data foundation

#### `src/peridotNormalizedModel.js`

Owns the consumer-neutral canonical dataset envelope and constructors for entities, places, records, events, relationships, participations, evidence sources, assertions, validation/capability metadata, source manifests, saved variable definitions, and universal mapping state. This is the authoritative normalized research representation; consumer-specific flattening belongs in adapters.

#### `src/peridotNormalizationProvenance.js`

Owns machine-readable source and transformation provenance for normalized items. Provenance records how Peridot obtained a claim and remains distinct from scholarly evidence explaining why the researcher accepts it.

#### `src/peridotTemporalAssertions.js`

Owns conservative parsing and preservation of exact, partial, ranged, approximate, before/after, uncertain, unknown, and textual dates for canonical structures. Original date values remain preserved.

#### `src/peridotNormalizedValidation.js`

Owns cross-collection canonical structural validation and blocking/error/warning/information reporting.

#### `src/peridotCorrespondenceProfile.js`

Normalizes current correspondence/directed-record mapped rows into canonical records, entities, places, participations, evidence, assertions, temporal structures, and provenance.

#### `src/peridotLegacyCompatibilityAdapter.js`

Active compatibility boundary for correspondence. It projects canonical correspondence datasets back into the accepted legacy runtime shapes by delegating compatibility-sensitive row shaping to `peridotCsvNormalizer.js`. Do not remove this adapter until downstream parity has been proven without it.

#### `src/peridotCanonicalRuntimeModel.js`

Active correspondence normalization entry point. It makes canonical normalization authoritative, validates the canonical dataset, and then supplies current `App.jsx` consumers through the legacy compatibility adapter.

#### `src/peridotNormalizationShadowAudit.js`

Parity/audit boundary retained from the canonical migration sequence. It compares direct legacy normalization with the canonical-through-adapter path and should remain available for regression diagnosis.

#### `src/peridotDatasetProfiles.js`

Registry and routing vocabulary for the active Correspondence / Directed Record and Genealogy / Person-Centered profiles. Profiles are current presets/normalization strategies, not a permanent limit on supported humanistic data.

#### `src/peridotGenealogyProfile.js`

Normalizes person-centered genealogy rows into canonical people/entities, birth/death events, parent-child and partnership relationships, places, attributes, evidence, temporal assertions, and provenance. It preserves direct source relationships and does not infer false movement or derived kinship.

#### `src/peridotGenealogyMapping.js` and `src/PeridotGenealogyMappingControls.jsx`

Own genealogy-specific mapping schema, defaults/suggestions, validation, supplemental-row handling, capability summaries, and presentational mapping controls for Identity, Parents, Partners, Life events, Places, Attributes, and Review.

#### `src/peridotGenealogyRuntimeModel.js`

Projects validated canonical genealogy datasets into the current active genealogy runtime model without routing them through the correspondence compatibility adapter.

#### `src/peridotUniversalMappingModel.js`

Phase 1 universal mapping vocabulary. Owns saved variable definitions, source-field assignments, sheet-purpose assignments, repeated-heading groups, and table-connection definitions. Mapping ownership is the user's; the model does not preserve a confidence/origin column stating who assigned a mapping.

#### `src/peridotSourceModel.js`

Phase 1 generalized source-file/table/field descriptors and workbook-to-source-manifest helpers. It provides stable structural references without duplicating the full workbook content into every canonical dataset.

#### `src/peridotUniversalTransformations.js`

Phase 1 deterministic transformation compiler/executor. It supports ordinary field preservation, repeated headings becoming generated header/value variables, transpose, and non-flattening table connections, with provenance retained. It does not perform AI/domain interpretation.

#### `src/peridotUniversalRuntimeCompatibility.js`

Phase 1 compatibility classifier. It explicitly permits current correspondence and genealogy runtime projections while keeping broader universal datasets canonical-only until a downstream consumer deliberately supports them.

Each of these model/profile modules has dependency-free fixture or audit companions where present. The universal fixture set includes correspondence, genealogy, wide/transposed stock-price, Alaskan-airfield, and Maria-Maddalena-style structures so future changes can test generality without encoding those examples as special-case application logic.

### Visualizations, map, and timeline

#### `src/mapLayoutHelpers.js`

Pure map/layout helper logic, including viewport construction, clustering, cluster radius calculation, label visibility, and geometric calculations.

#### `src/mapStageComponents.jsx`

Map-stage-adjacent UI/chrome components.

#### `src/mapInteractionHandlers.js`

Top-level map interaction handlers.

#### `src/timelinePlaybackHelpers.js`

Pure timeline/playback derivation helpers.

#### `src/timelinePlaybackComponents.jsx`

Timeline/playback panel UI boundary. The timeline is now **year-based**, not month-based.

#### `src/personForceLayoutHelpers.js`

Pure helper logic for the pre-settled force-directed person-network layout.


### Search and interaction resolution

#### `src/interactionHelpers.js`

Pure interaction-resolution and selection-building helpers. This file owns helper logic for nearby candidate generation, selection resolution, cluster selection payload building, connected-correspondent ordering, `person-detail` / `place-detail` payload derivation, Unknown-as-place resolution, person-detail sent/received place-section derivation, and person-graph fallback resolution for related-person navigation from geographic contexts.

### Analytics

#### `src/AnalyticsPanel.jsx`

Owns the Analytics / Chart Visualizations control UI. It renders chart type selection, tabbed Chart/Fields/Categories/Present controls, chart descriptions/example questions, date controls, variable controls, manual category/series selection controls, selection-mode and comparison-total controls, optional presentation-title editing, and the large chart workspace. It preserves compatible chart settings as users switch chart types where possible, defaults Bar Chart orientation to Vertical, and registers chart PNG export with the Visualizations header Export menu rather than rendering a separate export control in the chart rail.

#### `src/analyticsConfig.js`

Owns Analytics chart configuration, including chart labels/descriptions, example research questions, default Analytics state, aggregation options, top-N display options, manual-selection defaults, curated variable definitions, and **Route (Place)** / **Route (Person)** definitions.

#### `src/analyticsDerivationHelpers.js`

Owns Analytics data derivation, including available variable detection, numeric measure detection, conservative filtering of dynamic metadata fields, Year and Full date bucketing, flexible chart data construction, record-count aggregation, manual selected-category filtering, selected-only/Other/dataset-total comparison behavior, grouped/stacked/multi-line count buckets, and semantic alias handling for curated fields such as Language and Relationship.

Dynamic variable detection should exclude technical or non-categorical fields such as IDs, latitude/longitude fields, date fields, mappability flags, object/array values, purely numeric values, long note-like fields, and near-unique row identifiers.

#### `src/analyticsChartComponents.jsx`

Owns SVG chart rendering and shared chart hover tooltip styling for Bar Chart, Grouped Bar Chart, Stacked Bar Chart, Line Chart, Multi-Line Chart, Histogram, Pie Chart, Sunburst Chart, and Heatmap. It also owns shared chart frames, the shared three-quarter chart / one-quarter legend layout, complete simplified summary/legend panels, ranked/segment/line/trend/bin/matrix/slice/sunburst annotation panels, major/minor axis ticks, gridline styling, active theme-series mark colors for every chart type, and the rendered SVG surface used for chart PNG export.

The shared chart tooltip uses a mossy/title-green background with light text for legibility over dense charts such as heatmaps. Axis and panel styling should stay legible against the warm chart-paper background and should not depend on hover-only disclosure for core values. Keep chart-card geometry centralized through the shared layout helper rather than reintroducing unrelated per-chart spacing constants.

### Inspector

#### `src/LeftControlPanel.jsx`

Compact Inspector side-panel shell. Earlier rail/workflow content has been removed. This file now exists primarily to preserve visualization-click Inspector behavior: node, edge, and cluster clicks still open the compact Inspector while deeper evidence navigation routes into the full Inspector workspace.

The old `showRightSidebar` naming remains semantically stale but compatibility-sensitive. Do not rename this path casually; explicitly test node click, edge click, cluster click, contained member navigation, compact close, Expand, and Back behavior before changing it.

#### `src/InspectorPanel.jsx`

Owns inspector content only. It no longer owns the outer panel shell. It renders the inspector header, inspector-internal Back button, and `InspectorBodyRouter`.

#### `src/InspectorBodyRouter.jsx`

Routes resolved inspector state to the appropriate extracted view.

#### `src/InspectorEmptyState.jsx`

Owns the empty inspector state.

#### `src/InspectorClusterView.jsx`

Owns the cluster inspector view. Current behavior groups contained members by place and sorts groups/members by represented visible volume.

#### `src/InspectorEdgeView.jsx`

Owns the edge inspector state boundary.

#### `src/InspectorNodeView.jsx`

Owns the node / person-detail / place-detail inspector boundary. It now renders the scholarly reference-entry Inspector layout: lead summary, optional image/placeholder, compact summary facts, role-grouped connected places and people, directed connections, expandable high-volume lists, selected user-uploaded fields, and connected-record navigation entry points. It also preserves **Unknown** as a place-like bucket when source/target location values are missing or unresolved.

#### `src/InspectorConnectedCorrespondents.jsx`

Inspector navigation component for person-to-person movement.

#### `src/InspectorPersonPlaces.jsx`

Inspector navigation component for person-to-place movement. It shows two explicit sections:

- **Places this person sent letters to**
- **Places where this person received letters**

#### `src/InspectorBackButton.jsx`

Inspector-internal Back button. It uses a small local history model for inspector-internal navigation only and does not track ordinary map clicks as navigation history.

---


### Theme, styles, and visual language

#### `src/peridotTheme.js`

Semantic theme control surface for the whole app. It defines source palettes, custom theme override storage, palette import targets, the finite 30-color default chart series library, semantic role construction, legacy color adaptation, map/network roles, chart roles, navigation chrome roles, timeline roles, search roles, Inspector/search roles, and CSS-variable export. Chart-targeted palette imports should override only `analytics.series`, while the legacy compatibility adapter should not use chart-only overrides to recolor unrelated chrome.

Future color work should start here unless a component genuinely lacks a theme role. Do not scatter new hardcoded colors through chart, Inspector, map, or workspace components when the correct fix is to extend the semantic theme roles.

#### `src/peridotThemeRoleMetadata.js`

Human-facing metadata for theme roles and role groups used by the Themes and Accessibility workspace. This file should stay aligned with `peridotTheme.js` so users can understand what each role controls and so palette imports remain explainable.

#### `src/peridotColorPalette.js`

Legacy compatibility palette adapter. Prefer `peridotTheme.js` for new color work; keep this file available for older component paths that still import legacy tokens.

### Export and shared utilities

#### `src/exportHelpers.js`

Pure export utilities and export row-builder helpers.

## 10. Fragile Zones and Regression Test Matrix



These areas still deserve narrow, explicit passes:

- workspace routing and hamburger-menu behavior
- first-time tutorial progression, target observation, panel placement, minimize/restore state, and workspace/Inspector transitions
- shared `src/index.css` delivery: broad replacements can silently overwrite newer unrelated visual rules; treat small styling work as a source-verified local change rather than a convenience full-file handoff
- map viewport centering/reset behavior
- map/network viewport measurement after switching between Analytics and map/network modes
- dense map hover/click interaction
- selection persistence across filters
- timeline/playback state coupling
- export rendering/state coupling
- broad orchestration work in `src/App.jsx`
- Data upload state, one-file CSV normalization, arbitrary table mapping, workbook parsing helper, and validation summary behavior
- canonical normalization/runtime compatibility boundaries: correspondence must preserve legacy parity; genealogy must remain direct; canonical-only universal datasets must not be silently coerced into either profile
- universal mapping/source/transformation schemas and fixture parity across correspondence, genealogy, stock-price, Alaska, and Maria-style examples
- generalized mapping/runtime authority boundary: `placeParts` and `relationshipParts` are accepted user mappings, but some assembly, capability, and warning paths still consult legacy Source/Target and point/route fields; do not treat those legacy diagnostics as the universal contract
- Review warning/validation audit is deferred until generalized runtime integration is complete; distinguish genuine runtime constraints from correspondence-specific legacy assumptions before removing or rewriting warnings
- dataset-profile fixtures: one pre-existing assertion still describes genealogy as routed-but-not-importable even though active genealogy import was enabled at `8f19997`; treat this as a stale maintenance fixture, not current product behavior

- shared side-panel shell and inspector-open interactions
- cluster grouping and cluster inspector navigation
- Analytics expanded overlay positioning and backdrop contrast above the map area
- Analytics dynamic variable detection from uploaded/current row data
- Analytics SVG-to-PNG chart export rendering
- Search & Filter active-dataset state, especially draft/apply coordination across keyword, person, place, route-place, route-people, date, weight, Timeline, Analytics, Inspector, and Export behavior
- archived MapLibre branch work if it is ever explicitly resumed

### Practical regression matrix

| Fragile zone | Typical regression | Minimum test |
|---|---|---|
| Workspace routing | wrong workspace or lost state | Home CTA and every hamburger route |
| First-time tutorial | stalled progression, missing target, obscured control, broken restore, or unstable highlight | launch; all seven stages; Back/Continue; drag; minimize/restore; keyboard; Inspector close; target recovery |
| Inspector bridge | compact Inspector fails to open | node, edge, cluster, contained member, Expand, Back |
| Search scope | results or facets omit/misstate records | draft suggestion, Apply, Clear, pagination, Inspect handoff |
| Timeline / Analytics | stale or inconsistent chart scope | alter timeline/date controls, refresh chart, export |
| Data import | loss of accepted rows or bad joins | template and arbitrary-table import, workbook join, validation |
| Canonical/profile boundary | correspondence parity loss, genealogy misrouting, or universal data coerced into legacy rows | canonical correspondence adapter audit; genealogy runtime fixture; universal compatibility fixtures |
| Visual stage | remount/reanimation or viewport shift | map/network/chart switch, full Inspector open/close |
| CSS cascade | late stylesheet masks accepted behavior | inspect every extracted workspace and feedback form |
| Chart rendering/export | mismatched labels, colors, or PNG | multiple chart types, manual series, PNG export |
| Theme roles | chart-only changes recolor chrome | apply chart-targeted palette and inspect map/header |
| Export | wrong output scope or broken render | map PNG/SVG, CSV, chart PNG |

## 11. Active Technical Backlog

1. **Universal data architecture — Phase 2: make generalized mappings authoritative end-to-end.**
   - Trace Confirm import from `placeParts`, `relationshipParts`, generalized temporal/evidence mappings, and workbook-qualified references into canonical normalization and runtime assembly.
   - Make the generalized assignments the authoritative source for downstream semantics.
   - Retain legacy correspondence-shaped projections only where a current consumer still demonstrably requires them.
   - Do not collapse arbitrary n-part relationships into Source/Target or reinstate point-versus-route classification as the user-facing model.
2. **Audit validation and Review warnings against the generalized model.**
   - Classify each warning/requirement as universal, compatibility-path-specific, or obsolete.
   - Pay particular attention to `Letter_ID`, exact-key join language, Source/Target requirements, source/target place assumptions, and point/route terminology.
   - Rewrite or retire warnings only after the authoritative runtime requirements are known.
3. **End-to-end Phase 2 regression suite.**
   - Test the Maria Maddalena workbook, correspondence data, genealogy data, Alaskan-airfield data, and wide/transposed stock-price data.
   - Verify mapping → confirm import → canonical dataset → applicable Search/Inspector/Map/Network/Timeline/Charts/Export consumers.
   - Preserve canonical-only validity where no current visualization consumer exists.
4. **Repository-wide legacy upload/runtime retirement audit.**
   - Run only after generalized runtime integration and regression testing.
   - Inventory old Source/Target-only mapping code, point/route branching, correspondence-shaped workbook assembly, obsolete UI/components, compatibility adapters, tests/fixtures, comments, and documentation.
   - Classify each item as **delete now**, **still-required compatibility layer**, **legitimate profile-specific specialization**, or **uncertain/retain**.
   - Retire in bounded cleanup passes; do not perform one broad deletion.
5. **Close Phase 2 with core-document synchronization and a clean checkpoint.**
6. **Universal data architecture — Phase 3: chart builder**, only after the Phase 2 authority/retirement boundary is clean:
   - universal chart-variable registry;
   - permissive direct x/y/group/filter controls;
   - structured scholarly sentence builder with autocomplete and visible interpretation, not free-form natural-language prompting;
   - targeted clarification/validity handling;
   - Search/Timeline/export integration audit;
   - final UX simplification as needed.
7. First-time tutorial polish, in bounded passes:
   - attention choreography that sequences dialogue, workspace movement, tutorial placement, and target emphasis;
   - placement audit for panels that obscure important controls;
   - minor typography/spacing refinement;
   - standardized semantic keyword highlighting;
   - final full UX walkthrough.
8. Search coverage and scope audit.
9. Inspector → Advanced Search actions and safe metadata filters, after the coverage audit.
10. Timeline playback × Analytics audit.
11. Accessibility pass.
12. Clarify data-scope language across the app.
13. Learn More completion: substantive research-workflow tutorial/help material.
14. Correct the stale dataset-profile fixture that still expects genealogy to be non-importable; keep this as a narrowly bounded maintenance fix rather than mixing it into universal-upload behavior.
15. Continue bounded structural work only when a concrete maintenance need exists; `App.jsx` remains concentrated but should not be casually refactored.

For the universal-data program, the page-by-page Phase 2 mapping redesign is accepted at `134c67c`. The next work is not another mapper-shell redesign: it is making those mappings authoritative in the runtime, then auditing warnings and legacy paths from that new baseline. Correspondence and Genealogy profiles remain until the retirement audit proves a simpler no-loss replacement. For tutorial polish, prefer subtle motion over stronger outlines and explicitly review animation order/timing during final visual polish.

## 12. Archived and Compatibility Paths



### Canonical correspondence adapter and profile routing — active compatibility paths

The canonical normalized model is authoritative for correspondence import, but many current downstream consumers still receive established legacy row structures through `peridotLegacyCompatibilityAdapter.js` and `peridotCanonicalRuntimeModel.js`. The Phase 2 mapping UI now captures richer generalized place and relationship assignments than those legacy row contracts can express. This is therefore an **active compatibility boundary**, not yet dead code. Genealogy continues to use its own direct canonical runtime projection.

Do not remove or collapse the Correspondence / Directed Record or Genealogy / Person-Centered profiles merely because the generalized mapper UI exists. First make the generalized mapping architecture authoritative end-to-end, then run the warning/validation and repository-wide retirement audits. A compatibility adapter should be removed only after all remaining consumers have either migrated or been shown not to need it.

### MapLibre migrated-overlay branch paused / active preview removed

The later `maplibre-native-geographic-view` branch remains an archived experiment. Active `main` no longer contains the dormant MapLibre preview files or dependency after `55a368c`. The removed active-main preview path included `src/MapLibreMapStage.jsx`, `src/mapStyleConfig.js`, and the `maplibre-gl` dependency.

If MapLibre work resumes, begin with a fresh source-of-truth audit and intentionally reintroduce any required package dependencies and stage files. Do not assume the old experiment can be merged directly.

### Shared-panel semantic prop rename

An attempted cleanup of old `showLeftSidebar` / `showRightSidebar` compatibility names was rolled back because it broke inspector auto-open behavior from node, edge, and cluster clicks.

Do not rename this compatibility path casually. If revisited, explicitly test:

- node click opens Inspector
- edge click opens Inspector
- cluster click opens Inspector
- contained cluster member opens detail
- Back behavior still works

### Responsive side-panel sizing

An attempted universal responsive positioning change for the shared side panel was rolled back because it disrupted the normal full-size landscape layout and forced scrolling before the map.

Future responsive work should be a narrow-window-specific override, not a universal replacement of the panel positioning model.

---

The archived MapLibre branch, legacy side-panel naming, and responsive panel lessons remain relevant only as labeled compatibility/history context. For the complete chronology and all rolled-back records, see the Changelog.

## 13. Fresh-Chat Handoff Essentials



A future chat should start from:

- source of truth folder: `C:\Users\haley\OneDrive\Desktop\Peridot\`
- active branch: `main`
- current synchronized checkpoint: **`134c67c` — `Refine upload review checkpoint`**

A future chat should also be told that:

- the app identity is **Peridot**
- Phase 1 of the universal data architecture is complete: universal mapping definitions, generalized source/sheet descriptors, deterministic transformation helpers, and a runtime compatibility boundary are implemented
- Phase 2's page-by-page mapping redesign is accepted through `134c67c`: Preview/orientation, Time, generalized repeatable Places, generalized n-part Relations, Evidence, and Review have been tested; workbook Places/Relations have parity with the single-table interaction model
- Review is a double-check checkpoint: it repeats assignments and reports one unified **Map** readiness state rather than separate point/route map categories
- the new mapper state is richer than the legacy runtime: `placeParts` and `relationshipParts` are preserved, but the next task is to make them authoritative through canonical normalization/runtime consumption instead of allowing old Source/Target or point/route fields to decide downstream behavior
- after runtime integration, audit validation/warnings; then run the representative dataset regression suite; then perform a repository-wide legacy upload/runtime retirement audit; only after Phase 2 is clean should Phase 3 chart-builder work begin
- the deferred Review-warning audit must distinguish genuine requirements from legacy correspondence/workbook assumptions, including `Letter_ID`, exact-key joins, Source/Target, and point/route language
- canonical normalization remains active: correspondence currently runs canonical → legacy compatibility adapter; genealogy runs canonical → dedicated genealogy runtime; broader universal structures may remain canonical-only until deliberately adopted by consumers
- Correspondence / Directed Record and Genealogy / Person-Centered remain active profiles until the retirement audit proves full parity and actual architectural simplification

- the first-time tutorial is implemented as a seven-stage guided overlay beginning in Visualizations, with draggable/minimizable panels, Back/Continue progression, recovery logic, keyboard accessibility, target highlighting, and explicit Inspector-close guidance; `619bab0` is the stable baseline for future polish
- the user-designed Peridot logo, gilded logo, selected Adobe Stock filigree, homepage screenshot, and homepage mockup assets are stored in `assets/`; the Home workspace uses `assets/Peridot Logo Gilded Transparent.png` and `assets/Adobe Stock Filigree 1.png`; the additional licensed filigree assets `Adobe Stock Filigree 2.png`, `Adobe Stock Filigree 3.png`, `Adobe Stock Filigree Divider Set.png`, and `Adobe Stock Filigree Full Set.png` are retained for design reference/use
- the fixed basemap is `countries50m`
- itch.io packaging support is already committed
- the simplified hamburger/workspace structure is committed; public menu entries are Manage Your Data, Visualize Your Data, Explore Your Data, and Learn More about Peridot; Themes and Accessibility is hidden from public navigation but retained internally; the shared side panel remains primarily as the compact Inspector surface and compatibility bridge
- `InspectorPanel.jsx` is content-only
- `LeftControlPanel.jsx` owns the compact Inspector side-panel shell; Data/Visualizations/Explore/Learn More/Search are public full workspace paths; Themes and Accessibility remains an internal full workspace path; Export and Timeline are Visualizations-integrated
- `peridotCsvSchema.js`, `peridotCsvNormalizer.js`, `peridotCsvValidation.js`, `peridotColumnMapping.js`, `PeridotColumnMappingModal.jsx`, and `peridotWorkbookParsing.js` own the current template upload, arbitrary table mapping, validation, and workbook-helper boundaries
- current cluster, Inspector profile, dual-mode Inspector, linked-letter history, clickable linked people/places, compact summary tile, and route-row features are committed, not deferred
- MapLibre preview code has been removed from active `main`; the migrated-overlay branch remains archived and should not be treated as active implementation direction
- documentation should preserve the full commit trajectory carefully in `CHANGELOG.md`
- the implemented Search & Filter panel consolidates global filtering and defines the active filtered dataset before Analytics, Timeline, Inspector, and Export consume it
- Search & Filter currently uses a compact advanced-search layout with current applied scope at the top
- Data Inputs currently uses a one-file Peridot CSV workflow, arbitrary CSV/TSV mapping, workbook import with unique-ID joins, active Correspondence and Genealogy profiles, downloadable template, validation popup, and persistent upload summary; the Phase 1 universal mapper is internal and has not yet replaced these public flows
- Chart Visualizations use a large left-controls/right-chart workspace, manual series/category selection, year-default date axes, summary panels, major/minor axis ticks, finite chart colors, higher-contrast tooltips, fit-to-workspace chart rendering, and header-based chart PNG export

Before any source or documentation change, read the current affected source files. Before a core-documentation pass, read the Governance Protocol, restructuring plan, and all four core documents. For process law, use the Project Workflow Charter; for chronology, use the Changelog.
