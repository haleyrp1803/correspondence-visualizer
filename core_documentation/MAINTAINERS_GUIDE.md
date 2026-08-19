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
4076e5b — Checkpoint generalized identity mapping groundwork
Branch: main
Status: local and origin/main aligned after the latest sync ritual
```

For detailed milestone interpretation and full commit history, see [CHANGELOG.md](CHANGELOG.md).


## 1. Current Architecture Snapshot

Peridot is a Vite/React/Tailwind research application that has moved from a map-first side-panel model to a workspace-first, multimodal exploration environment. `src/App.jsx` remains the top-level orchestration boundary, while dedicated workspaces and pure/helper modules now own much of the UI, import, visualization, theme, and interaction behavior.

The active data architecture now includes a canonical normalized research model beneath the current runtime consumers. Correspondence imports normalize into canonical entities/places/records/participations/evidence/assertions and then pass through a legacy compatibility adapter so existing consumers retain their accepted row contracts. Genealogy imports normalize person-centered data directly into canonical entities, life events, relationships, places, evidence, and provenance and project through a dedicated genealogy runtime model. Phase 1 established user-owned variable/mapping definitions, stable source-table metadata, deterministic transformation helpers, and an explicit runtime compatibility boundary.

Phase 2 has crossed the generalized-mapping authority boundary for single-table and workbook relationship, place, temporal, and evidence semantics. The current `4076e5b` checkpoint additionally introduces a generalized **Identity** mapping surface for both single tables and workbooks. Identity distinguishes record identity from recurring entity identity; it can model label-based identity, one identifying field, several fields used together, or row-level uniqueness, and it supports multiple independently configured kinds of recurring things such as People and Places. It can also express equivalent identifying information across different participant roles or workbook fields—for example `Source + Source Title` and `Target + Target Title` as the same Name + Title identity structure. At this checkpoint the Identity UI/state is preserved groundwork, not yet authoritative runtime identity. The current on-screen order is Preview → Relations → Time → Places → Identity → Evidence → Review, with workbook Sheets where relevant; moving Identity immediately after Relations is the next small mapping-flow correction.

Canonical temporal semantics are now fully authoritative across active consumers. The former `parsedDate`, `parseHistoricalDate`, duplicate capability parser, and lexical date-sorting fallbacks have been retired from active `src`. Search and Network relationship semantics have also migrated substantially toward generalized participant relationships, while geographic Network and legacy Inspector profile derivations remain active migration targets.

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

The Inspector is a dual-mode evidence system. Visualization clicks open compact side-panel summaries; **Expand**, linked-data navigation, and full Inspector routes open the dossier workspace. Compact and full modes share one selected target and a central multi-step history owned through `App.jsx`.

The linked-data navigation model is a hard preservation contract. Researchers must be able to move through chains such as node → connected person → another connected person → connected place → connected record, then use **Back** several times and branch from an earlier dossier without losing the previous sequence. Full Inspector continues to overlay the mounted Visualizations or Explore workspace rather than remounting it.

Current `4076e5b` state is transitional:

- `PeridotRecordStructure.jsx` / `peridotRecordStructure.js` provide a generalized mapped-information reader for record detail and entity-attributed structures.
- The reader understands repeatable temporal assertions, generalized relationship participants, mapped places, semantic relationship counterparts, and entity-owned evidence; canonical entity IDs are preferred where present.
- `App.jsx`, `interactionHelpers.js`, `peridotGenealogyRuntimeModel.js`, and `peridotEntityNetwork.js` contain canonical-identity groundwork so downstream selection can distinguish same-label entities when stable IDs are actually available.
- The older upper person/place profile architecture in `InspectorNodeView.jsx` still relies substantially on Source/Target-era aggregations. That can omit later participants in n-part relationships, treat non-correspondence genealogy geography as directed routes, and fail to connect mapped places to people through generalized participant-place associations.
- The next Inspector pass must overhaul **both compact and expanded views** from the same generalized semantic source. Do not patch individual Source/Target labels while leaving the old derivation model intact.

Ownership remains:

- `App.jsx` owns Inspector presentation mode, selection resolution, central history, and linked person/place/record/route navigation.
- `InspectorPanel.jsx` owns shared Inspector content chrome; `InspectorBodyRouter.jsx` resolves view type.
- `InspectorNodeView.jsx`, `InspectorEdgeView.jsx`, and `InspectorClusterView.jsx` own the principal dossier views.
- **Unknown** remains a first-class place-like bucket for unresolved/missing locations when the source genuinely contains unresolved location evidence; do not manufacture Unknown routes merely to satisfy a correspondence-shaped profile.
- Connected-record tables retain date-first sorting, per-column filtering, 10/25/50 page sizes, and pagination, but their universal Source/Target column assumptions are an explicit overhaul target.

Minimum regression checks for the overhaul: node, edge, and cluster click; compact close; Expand; related person/place; record and legitimate route navigation; at least a five-step linked-data chain; repeated Back; branch from an earlier history state; Explore-to-Inspector return; full Inspector open/close without stage reanimation; generalized genealogy mother/father/partner coverage; and correspondence sender/recipient preservation.
### Visualizations and Timeline

Visualizations owns capability-aware map, network, force-directed, and chart entry points; header collapse behavior; the bottom timeline scrubber; and the shared Export menu. Timeline remains a Visualizations-integrated control rather than a separate workspace. Its active chronology is derived from canonical `temporalAssertions[]` on runtime rows. The former `parsedDate` fallback has been retired from active source. A record may contribute multiple assertion-level timeline entries, and interval filtering uses temporal intersection rather than only an interval start.

The Timeline derives available **Time types** from mapped temporal roles and keeps the controls visible even when only one role is available. Playback supports **Cumulative Events** and **Co-current Events**. Cumulative mode retains records after their date or period begins/occurs; co-current mode recalculates visibility at the current moment, removes ended intervals, bounds point dates to their temporal unit, and inserts interval-end checkpoints so disappearing records are observable. A co-current moment with zero active rows is a valid empty visualization state and must not cause capability routing to replace the workspace with an unavailable-state screen.

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
- `PeridotColumnMappingModal.jsx` owns the generalized correspondence/directed-record mapping stages. At `4076e5b` the current UI order is Preview, Sheets where applicable, Relations, Time, Places, Identity, Evidence, Review; a pending small correction will move Identity directly after Relations. The specialized genealogy stages remain Preview, Identity, Parents, Partners, Life events, Places, Attributes, Review.
- Mapping is explicit, progressive, reversible, and user-owned. Peridot may propose recognizable structures, but it does not silently standardize values, assign scholarly meaning, or infer irreversible relationships.
- Identity mapping now separates **record identity** from **recurring entity identity**. Record rules can use row uniqueness, one field, several fields together, or a workbook primary-ID choice. Entity groups can independently describe recurring People, Places, or other things and can use label, one field, composite fields, or row-level identity. Equivalent conceptual components can be mapped across different roles/sheets, e.g. Name → Source and Title → Source Title versus Name → Target and Title → Target Title.
- `PeridotIdentityMappingControls.jsx` currently owns this interaction layer. Its header comment is explicit that the UI stores user-declared recognition rules only and that runtime authority is a separate bounded pass. Do not document the Identity rules as already controlling all downstream consumers.

- Preview preserves the source table visually as uploaded. For single tables, the user can state whether headings run across the top or down the left; downstream mapping controls and example values must use the same orientation-aware internal row set.
- Relations uses repeatable `relationshipParts` (Part A/B/C...) with per-part participant and role mappings, plus optional relationship-level type/label fields. N-part relationships must not be silently reduced to binary Source/Target just to satisfy legacy consumers.
- Time uses repeatable temporal mappings rather than fixed Date/Beginning/Ending slots. Each user-named assertion is either a Date or Period / range and can describe the row/record as a whole or a mapped relationship participant. Date sources may be one column or separate year/month/day columns. Period sources may be one range column or separate beginning/end representations; each endpoint may use one column or separate year/month/day columns, including six-column Y/M/D + Y/M/D ranges. Source columns are reusable across different temporal assertions.
- Each temporal assertion may attach zero or more researcher-note columns. These notes are preserved independently of machine-derived temporal structure and do not silently control visualization eligibility.
- Places uses repeatable `placeParts` (Place A/B/C...) with place source, role source, and optional combined or separate coordinates. The user-facing model no longer asks users to classify a place as a point versus route endpoint.
- Workbook Relations, Time, and Places mirror the single-table interaction model using `{ sheetName, columnName }` references.
- Evidence retains explicit Include and Ignore controls, optional display labels, source examples, and chart/filter-readiness hints. Fields already structurally mapped on earlier pages remain visible but are ignored as duplicate evidence.
- Review is a summary + validation + correction checkpoint. It repeats Relations/Time/Places/Evidence assignments, reports temporal interpretation separately from record-level Timeline readiness, provides one unified **Map** readiness row, and retains current capability/warning output underneath.
- Workbooks still use a selected primary record sheet and user-configured unique-ID joins; never use row-order joining as the primary assembly strategy.
- The generalized mapping/source/transformation layer is now authoritative for single-table and workbook import semantics through canonical normalization/runtime consumption. Legacy correspondence-shaped projections remain only as explicit compatibility paths and must not override accepted generalized mappings.

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

Main orchestration file. It owns top-level state, derived data wiring, workspace composition, theme token definitions, side-panel compatibility contract building, Search & Filter state, timeline state, Inspector presentation/selection/history state, export wiring, the connected-record table renderer, and the live Data workflow. It wires template download, upload parsing, arbitrary CSV/TSV/workbook mapping flow (including checkpointed Identity state), validation summary state, normalization output, upload-source reset behavior, and modal visibility.

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

Owns the large column/workbook-mapping workspace for arbitrary CSV/TSV/XLSX/XLS imports. The current UI is role-based rather than correspondence-template-first: users move through Preview, Sheets for workbooks, Relations, Time, Places, Evidence, and Review. It exposes generalized relationship parts, repeatable temporal assertions, repeatable places, workbook primary-sheet selection, multi-sheet unique-ID joins, and selected evidence/Analytics metadata from primary and joined sheets.

This file has been partially decomposed. Static UI labels/step groupings live in `peridotColumnMappingUiConfig.js`; repeated Time/Places/Relations controls live in `PeridotMappingFieldControls.jsx`; Evidence Include/Ignore controls live in `PeridotEvidenceFieldControls.jsx`. The modal now also owns orientation-aware single-table interpretation, `placeParts`, `relationshipParts`, workbook-qualified equivalents, and the human-readable Review assignment summary. It should continue to own state transitions, workbook state, import/cancel behavior, final mapping assembly, upload-mapping entrance animation hooks, and the accepted opacity-only step transition. Avoid reintroducing carousel/slide/scale/blur transitions for step changes unless a new motion pass explicitly chooses that direction.

#### `src/peridotColumnMappingUiConfig.js`

Static UI configuration for the mapping modal: single-table/workbook step sequences, display labels, field groupings, capability labels, and formatting helpers. It intentionally contains no React state and no import/application logic.

#### `src/PeridotMappingFieldControls.jsx`

Presentational mapping controls used by the mapping modal for generalized repeatable Relations, Time, Places, and workbook-qualified equivalents. Time presents repeatable Date/Period cards, source-representation controls, Y/M/D component selectors, relationship-participant attachment, and related-note selectors. Places support arbitrary Place A/B/C parts with role source and optional coordinates; Relations support Part A/B/C participants with per-part role source and optional relationship metadata. Workbook controls use combined sheet-column references while preserving the internal workbook reference shape. This file should remain stateless and receive current values plus callbacks from `PeridotColumnMappingModal.jsx`.

#### `src/PeridotIdentityMappingControls.jsx`

Presentational generalized Identity-mapping controls introduced in the `4076e5b` checkpoint. The page distinguishes record recognition from recurring people/places/other-things recognition, supports multiple entity groups, radio-choice identity strategies, composite identity components, and role/sheet-specific mappings of equivalent identifying information. It consumes current relationship/place appearances plus optional custom appearances. The current component deliberately stores mapping state only; it does not yet make those rules authoritative in runtime identity resolution.

#### `src/peridotRecordStructure.js` and `src/PeridotRecordStructure.jsx`

Generalized record-structure reader and renderer introduced during the SI1 Inspector-legibility work. They expose mapped temporal assertions, participants, places, generalized semantic relationships, and evidence without forcing every record into Source/Target display. `buildPeridotEntityAttributedStructure()` scopes participant-attached information to the selected entity and prefers canonical entity IDs where present. The renderer preserves linked person/place navigation callbacks. These modules are the semantic reference surface for the planned generalized Inspector overhaul, not a replacement for central Inspector history.

#### `src/peridotRecordStructureFixtures.js`

Dependency-light regression fixtures for generalized record/entity-attribution semantics, including relationship role resolution, duplicate/self-relationship handling, and same-label canonical identity cases.

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

Owns conservative parsing and preservation of canonical temporal assertions. Original source text always survives. The parser distinguishes temporal shape, known components, approximation, boundedness, consistency, warnings, and machine usability rather than forcing every value into one JavaScript date. It supports ordinary point dates, mixed-precision and open intervals, approximation markers, partial values such as `1607/00/02` and `0000/08/08`, and chronologically backwards ranges that remain preserved but unsafe for ordinary interval computation. Annotated date strings may be parsed from viable outer date expressions, while cells containing competing date possibilities remain flagged rather than collapsed into false certainty. Researcher-supplied temporal notes remain separate from Peridot's derived temporal structure.

#### `src/peridotTemporalMapping.js`

Owns generalized temporal-mapping normalization and composition. It represents repeatable Date/Period mappings independently from display labels, supports one-column and Y/M/D source representations, composes beginning/end endpoints for periods, allows source-column reuse across assertions, and carries relationship-participant attachment and related temporal-note mappings into canonical temporal assertions.

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

#### `src/peridotGeneralizedMappingRuntime.js`

Authoritative runtime application boundary for accepted generalized single-table mappings. It turns user-confirmed relationship participants, places, temporal assertions, and evidence into a `generalizedObservation` and derives temporary correspondence-shaped compatibility fields only for consumers that still require them. At `4076e5b`, this module does **not yet compile the new Identity mapping rules** into participant/entity IDs; that gap is the reason downstream same-label fallback can still merge distinct entities.

#### `src/peridotGeneralizedMappingRuntimeFixtures.js` and `src/peridotGeneralizedWorkbookRuntimeFixtures.js`

Regression fixtures for authoritative generalized single-table/workbook runtime behavior. Future Identity-authority work should extend these fixtures with true end-to-end duplicate-label and cross-role identity cases rather than testing only preconstructed runtime rows.

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

Pure canonical Timeline/playback derivation helpers. It consumes `row.temporalAssertions[]`, derives temporal roles, builds assertion-level entries and interval boundaries, filters ranges by temporal intersection, and deduplicates active assertion entries back to visualization rows. Legacy `parsedDate` fallback behavior has been retired. It also owns Cumulative versus Co-current playback visibility semantics and period-end checkpoints.

#### `src/timelinePlaybackComponents.jsx`

Timeline/playback panel UI boundary. It renders dataset-derived Time types, the selected temporal-role controls, Cumulative Events / Co-current Events mode controls and explanatory hover text, range/playback controls, and empty/unavailable states. Timeline remains Visualizations-integrated.

#### `src/peridotEntityNetwork.js`

Shared generalized person/entity relationship semantic layer used by Search and Network consumers. It resolves n-part generalized observations without inventing pairwise relationships among every co-occurring participant, preserves direction/type/label/participant roles, and now carries canonical source/target IDs when available. Search relationship facets and Network availability use this generalized boundary. Geographic Network derivation is still incomplete: structural relationship scope, visible event/place scope, transparent geographic anchoring, and playback highlighting require further work.

#### `src/peridotEntityNetworkFixtures.js`

Regression fixtures for generalized relationship semantics, including multipart relationships, canonical identity preservation, direction, and repeated observations.

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

1. **Generalize Inspector person/place profiles across compact and expanded modes.**
   - Replace the old Source/Target-derived upper dossier with generalized relationship, temporal, place-association, identity, and evidence semantics.
   - Derive Connected People from all explicit generalized relationships; Part C/D/etc. must not disappear because a legacy projection preserved only one pair.
   - Derive place-to-person connections from mapped participant-place associations rather than requiring Source Location / Target Location routes.
   - Show directed sections only when the underlying data genuinely carries direction.
   - Generalize connected-record presentation beyond universal Source entity / Target entity / Source location / Target location columns.
   - Preserve the existing linked-data curiosity workflow and central multi-step Back history in both compact and full Inspector.
2. **Make generalized Identity mappings authoritative.**
   - Move the Identity step immediately after Relations in single-table and workbook flows.
   - Compile accepted record/entity identity rules into stable machine-facing identities without changing the user's display labels.
   - Support label, one-field, composite-field, and row-unique strategies plus multiple entity groups.
   - Preserve equivalence across roles/sheets when the researcher maps the same conceptual identity components to different source fields.
   - Exercise end-to-end duplicate-label tests (for example multiple same-named people) from mapping through runtime, Search/Network, and Inspector.
3. **Complete the generalized Network follow-up after Inspector/Identity legibility is stable.**
   - Correct geographic relationship/event scoping so selected Timeline event types do not combine with unrelated structural relationships.
   - Replace crude most-frequent-place anchoring with transparent/user-selected participant-place associations; later named place-association mapping remains planned.
   - Generalize Timeline playback highlighting so an active record can highlight all mapped relationships, not only a legacy Source/Target pair.
   - Repair Force-Directed fit-to-viewport and terminate arrowheads at node boundaries after semantics are correct.
4. **Generalize Search places/facets.**
   - Relationship Search semantics are substantially generalized; place Browse/facet/criteria/result paths still need migration from source/target place assumptions to all mapped place associations.
5. **Repository-wide legacy upload/runtime retirement audit.**
   - Inventory old Source/Target-only mapping code, obsolete point/route branches, correspondence-shaped assembly logic, compatibility adapters, stale tests/fixtures, comments, and documentation.
   - Classify each item as **delete now**, **still-required compatibility layer**, **legitimate profile-specific specialization**, or **uncertain/retain**.
6. **Optional Timeline temporal-structure controls.**
   - Consider user-facing filters for approximate, partial, open-ended, or inconsistent structures only if analytically useful and human-readable.
7. **Search coverage and scope audit.**
8. **Inspector → Advanced Search actions and safe metadata filters, after the coverage audit.**
9. **Timeline playback × Analytics audit.**
10. **Universal data architecture — Phase 3: generalized chart builder**, after the identity/Inspector/Network boundary is sufficiently clean.
11. First-time tutorial polish, accessibility, data-scope language clarification, and substantive Learn More/tutorial/help content remain later bounded work.
12. Correct the stale dataset-profile fixture that still expects genealogy to be non-importable; keep this as a narrowly bounded maintenance fix.
13. Continue bounded structural work only when a concrete maintenance need exists; `App.jsx` remains concentrated but should not be casually refactored.

The current milestone is `4076e5b`: generalized Identity-mapping and record-structure groundwork are checkpointed, but the next implementation sequence begins with the generalized Inspector overhaul rather than another broad mapper redesign.
## 12. Archived and Compatibility Paths



### Canonical correspondence adapter and profile routing — active compatibility paths

The canonical normalized model and generalized mapping architecture are authoritative for correspondence/directed-record import semantics. Current downstream consumers may still receive established legacy row structures through `peridotLegacyCompatibilityAdapter.js` and `peridotCanonicalRuntimeModel.js`; that adapter carries canonical `temporalAssertions[]` onto active runtime rows so consumers use the unified temporal model without losing correspondence parity. Genealogy continues to use its own direct canonical runtime projection.

This is an **active compatibility boundary**, not yet dead code. Do not remove or collapse the Correspondence / Directed Record or Genealogy / Person-Centered profiles merely because generalized mappings are authoritative. Compatibility adapters should be removed only after all remaining consumers have either migrated or been shown not to need them. The separate legacy date interpretation path itself has already been retired.

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
- current synchronized checkpoint: **`4076e5b` — `Checkpoint generalized identity mapping groundwork`**
- local development command on the user's machine: **`npm.cmd run dev`**

A future chat should also be told that:

- canonical Temporal Assertions are the sole active temporal interpretation system; `parsedDate`, `parseHistoricalDate`, duplicate parser authority, and lexical chronology fallbacks have been retired;
- generalized relationship semantics now drive Search relationship readiness/facets and much of Network construction through `peridotEntityNetwork.js`;
- geographic People Map work is checkpointed but incomplete because structural relationships and Timeline-visible event/place scope still need correct contextual scoping and transparent geographic anchors;
- SI1 added `peridotRecordStructure.js`, `PeridotRecordStructure.jsx`, and fixtures so Search/Inspector can visibly expose mapped dates/periods, participants, places, generalized relationships, and evidence;
- same-label entity conflation revealed the need for explicit researcher-declared identity rules rather than universal name equality;
- `4076e5b` includes `PeridotIdentityMappingControls.jsx` and Identity state in `PeridotColumnMappingModal.jsx`; researchers can define record identity and multiple recurring entity groups using label, one field, several fields together, or row uniqueness, and can map equivalent identity components across different roles/sheets;
- those Identity rules are **not yet authoritative downstream**; the current code comment explicitly reserves runtime authority for a later bounded pass;
- the current generalized mapping UI places Identity after Places; the next small flow correction should move it immediately after Relations;
- Inspector is the immediate substantive task. The lower generalized mapped-information reader is much closer to the user's mapping, but the legacy upper person/place profile still uses Source/Target-era derivation. This causes missing later participants (e.g. fathers), meaningless genealogy directed routes, and place profiles that fail to derive connected people from participant-place assertions;
- overhaul **both compact side-panel and expanded Inspector views** from one generalized semantic model;
- preserve linked-data navigation and central multi-step Back history as a hard contract: researchers must be able to follow person → person → place → record chains, back up several steps, and branch from an earlier dossier;
- correspondence-specific sender/recipient/origin/destination semantics may remain when the mapped data genuinely supports them; they must not remain universal assumptions;
- after Inspector and Identity authority are stable, continue Search-place generalization and resume geographic Network scoping/anchoring/highlighting work;
- Analytics remains substantially correspondence-shaped for relationship variables and belongs to the later Phase 3 generalized Chart Builder rather than the current Inspector pass;
- Search coverage/scope and Timeline × Analytics scope remain deferred audits;
- MapLibre remains archived.

Before any Inspector implementation pass, review the current complete `src` files, especially `App.jsx`, `InspectorPanel.jsx`, `InspectorBodyRouter.jsx`, `InspectorNodeView.jsx`, `InspectorEdgeView.jsx`, `InspectorClusterView.jsx`, `InspectorConnectedCorrespondents.jsx`, `InspectorPersonPlaces.jsx`, `InspectorBackButton.jsx`, `interactionHelpers.js`, `peridotRecordStructure.js`, `PeridotRecordStructure.jsx`, and `peridotEntityNetwork.js`. Preserve compact/full Inspector state continuity and the mounted underlying workspace.
