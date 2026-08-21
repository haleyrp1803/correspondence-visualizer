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
8290696 — Add first-class generalized sample datasets
Branch: main
Status: local and origin/main aligned after the latest sync ritual
```

For detailed milestone interpretation and full commit history, see [CHANGELOG.md](CHANGELOG.md).


## 1. Current Architecture Snapshot

Peridot is a Vite/React/Tailwind research application organized around a workspace-first, multimodal exploration environment. `src/App.jsx` remains the top-level orchestration boundary, while dedicated workspaces and pure/helper modules own most UI, import, visualization, theme, search, Inspector, export, and generalized mapping behavior.

The active data architecture is now one generalized user-mapping model over the canonical normalized research model. The public upload workflow no longer asks the researcher to choose Correspondence / Directed Record versus Genealogy / Person-Centered, and the former separate experimental “universal mapper” surface has been removed. Ordinary CSV/TSV/XLS/XLSX uploads pass through the generalized mapping workflow; older correspondence/genealogy normalizers and adapters may remain internally as compatibility/specialization boundaries, but they are not competing public semantic authorities.

Generalized mapping is authoritative for Relations, Identity, Time, Places, and Evidence. Identity now compiles researcher-declared record/entity recognition rules into stable runtime identities. It supports labels, single identifying fields, composite identity components, stable source IDs, and intentional row uniqueness. Equivalent components can be mapped across different roles or sheets—for example Name → Source plus Title → Source Title and Name → Target plus Title → Target Title—so one historical person can remain one entity across Source and Target appearances. Same display labels do not override stronger mapped identity.

Inspector has likewise crossed the generalized semantic boundary. Compact and full person/entity/place dossiers derive connected people, participant-attached places, temporal assertions, semantic relationships, and mapped evidence from generalized structures rather than assuming every record has one Source and one Target. Participant attribution is authoritative: a value mapped to a mother does not automatically become information about the child, and the same source place column can be interpreted with distinct named roles for different participants (for example a child’s birthplace versus the mother’s childbirth location). Correspondence-specific directed place pairs remain available when the mapped record genuinely supplies them.

Mapped uploads are now editable after import. The Data workspace can reopen the original source with the active mapping, and **Apply changes** recompiles the dataset through the generalized import path. Workbook joins remain explicit unique-ID joins; unsafe duplicate join IDs are blocked rather than multiplied silently. Identity suggestions shown in the mapper are materialized into authoritative mapping state when accepted untouched, while intentionally cleared suggestions remain cleared.

Sample data is now first-class generalized data rather than hidden embedded fallback state. Peridot starts with **no active dataset**. A researcher must explicitly select a sample or upload their own data. `public/sample_data/` contains three ordinary downloadable source files—correspondence network, family tree, and cardinals—and `src/peridotSampleDatasets.js` pairs each with a preserved generalized mapping. Sample mappings can be edited for learning/QA without mutating the shipped mapping; **Reset to sample mapping** restores the canonical interpretation.

Canonical temporal semantics remain fully authoritative across active consumers. The former `parsedDate`, `parseHistoricalDate`, duplicate capability parser, and lexical date-sorting fallbacks are retired from active `src`. Search and Network relationship semantics are substantially generalized, while place/facet generalization, geographic Network event/anchor semantics, and several scope/performance audits remain active follow-up work.

The active public workflow remains Home → Manage Your Data → Visualize Your Data → Explore Your Data → Learn More. Themes and Accessibility remains route-compatible but intentionally hidden from the public hamburger menu. Timeline and Export are Visualizations-integrated surfaces; Inspector is a compact/full shared-state evidence system. The current tutorial overlay remains functional, but a later homepage/tutorial redesign is explicitly deferred: the future Home should merge the strongest branded Home and Data/sample-selection patterns and expose a static tutorial button rather than the current pop-up/launch treatment.

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

The linked-data navigation model remains a hard preservation contract. Researchers must be able to move through chains such as node → connected person → another connected person → connected place → connected record, then use **Back** several times and branch from an earlier dossier without losing the previous sequence. Full Inspector continues to overlay the mounted Visualizations or Explore workspace rather than remounting it.

At `8290696`, generalized Inspector semantics are the accepted current model:

- `PeridotRecordStructure.jsx` / `peridotRecordStructure.js` expose mapped temporal assertions, generalized relationship participants, participant-attached places, semantic relationship counterparts, and evidence without forcing records into Source/Target display.
- `peridotIdentityRuntime.js`, the generalized mapping runtime, `peridotEntityNetwork.js`, and Inspector selection/aggregation paths preserve authoritative mapped entity IDs when available. Same-label people remain distinct when their mapped identities differ; one recurring entity remains unified across different mapped roles.
- Person/entity dossiers derive Connected People from explicit generalized relationships and include later Part C/D/etc. participants rather than truncating to a legacy pair.
- Place and temporal information respect mapped subjects. A row that contains both a child and mother may legitimately provide the child’s birth date/place and the mother’s childbirth date/place without attaching both assertions to both people.
- Place profiles derive connected people through participant-place associations. A place may therefore connect to people even when there is no correspondence-style source/target route.
- User-named place roles remain visible and semantically distinct. The same underlying source value can appear under different participant-specific meanings.
- Directed place connections are shown only when explicit directed place pairs exist in the mapped record. Non-correspondence data is not required to produce artificial routes.
- Connected-record tables preserve chronological sorting, filtering, pagination, and generalized mapped-information drilldown. Correspondence-shaped columns may still appear when the data genuinely maps those roles, but they are no longer the universal semantic source.

Ownership remains:

- `App.jsx` owns Inspector presentation mode, selection resolution, central history, and linked person/place/record/route navigation.
- `InspectorPanel.jsx` owns shared Inspector content chrome; `InspectorBodyRouter.jsx` resolves view type.
- `InspectorNodeView.jsx`, `InspectorEdgeView.jsx`, and `InspectorClusterView.jsx` own the principal dossier views.
- **Unknown** remains a first-class place-like bucket for genuinely unresolved/missing location evidence.
- `peridotRecordStructure.js` is the preferred generalized semantic reader for mapped-information detail and entity-attributed structures; avoid reintroducing separate Source/Target-only aggregation logic.

Minimum regression checks: node, edge, and cluster click; compact close; Expand; related person/place; record and legitimate route navigation; at least a five-step linked-data chain; repeated Back; branch from an earlier history state; Explore-to-Inspector return; full Inspector open/close without stage reanimation; genealogy mother/father/partner coverage; participant-specific time/place attribution; duplicate-label identity cases; and correspondence sender/recipient preservation.

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

Peridot supports a simple downloadable template, arbitrary CSV/TSV mapping, workbook-aware XLSX/XLS import, editable post-import mappings, and three first-class sample datasets. The public import model is now **one generalized mapping system** rather than a Correspondence-versus-Genealogy profile choice. The canonical model remains database-first: source material may remain useful even when it is not map-, network-, timeline-, or chart-ready.

### Canonical normalization and compatibility boundary

The current public import architecture is:

```text
parsed/staged source
→ explicit user-owned generalized mapping
→ authoritative generalized runtime observations / canonical normalization
→ validation and capability derivation
→ compatibility/consumer projections only where still required
```

Older correspondence and genealogy profile/normalizer modules remain in source where they still provide compatibility or specialized canonical/runtime projection behavior. They are not public ontology choices and must not override accepted generalized mappings. A later retirement audit should remove only code whose replacement has been proven end-to-end.

### Import contract

- `PeridotDataWorkspace.jsx` owns user entry through **Start with a Template**, **Start with Sample Data**, and **Upload Your Data**. It no longer exposes the old Correspondence/Genealogy profile selector or a separate experimental universal-mapper surface.
- Peridot starts with **no active dataset**. Do not restore a hidden sample fallback beneath Home/Data. A dataset becomes active only after an explicit sample selection or user upload.
- `PeridotColumnMappingModal.jsx` owns the generalized mapping workflow for both ordinary tables and workbooks. The active conceptual order is Preview, Sheets where applicable, Relations, Identity, Time, Places, Evidence, Review.
- Mapping is explicit, progressive, reversible, and user-owned. Peridot may propose recognizable structures, but it does not silently standardize values, merge entities, assign scholarly meaning, or infer irreversible relationships.
- Existing uploaded mappings are editable after import. **Apply changes** recompiles the active dataset from the preserved original uploaded source with the revised mapping rather than patching only the rendered runtime rows.
- Identity mapping separates **record identity** from **recurring entity identity**. Rules can use row uniqueness, one field, stable IDs, several fields together, or equivalent conceptual components mapped across different roles/sheets.
- `peridotIdentityRuntime.js` compiles accepted Identity mappings into stable runtime entity keys. Display labels remain presentation rather than identity authority.
- Visible suggested Identity assignments are materialized into authoritative mapping state when accepted unchanged. If the researcher explicitly clears a suggested field, the blank remains intentional and is not silently restored.
- Relations uses repeatable `relationshipParts` (Part A/B/C...) with per-part participant and role mappings, plus optional relationship-level type/label fields. N-part relationships must not be silently reduced to one Source/Target pair.
- Time uses repeatable temporal mappings. Each user-named assertion is a Date or Period/range and currently can describe the record or a mapped participant. Date sources may be one column or separate year/month/day columns; Period sources may be one range column or separate beginning/end representations, including six-column Y/M/D + Y/M/D ranges. Source columns may be reused across assertions.
- Each temporal assertion may attach researcher-note columns. Notes remain separate from machine-derived temporal structure and do not silently control visualization eligibility.
- Places uses repeatable `placeParts` (Place A/B/C...) with a place source, researcher-visible named role, subject/participant attachment where mapped, and optional combined or separate coordinates.
- Place subjects are authoritative. Reusing one source column for two different participant-specific mappings is valid; for example a child’s source-row place may be mapped as `place of birth` for the child and as `birthed child here` for the mother.
- Workbook Relations, Identity, Time, and Places use sheet-qualified references and the same generalized semantic model.
- Evidence retains explicit Include/Ignore controls, optional display labels, examples, and downstream chart/search availability where appropriate. Structurally mapped fields may remain visible without being duplicated as evidence.
- Review is a summary + validation + correction checkpoint. It repeats accepted assignments, reports temporal/capability information, and exposes warnings without treating legacy correspondence-shaped requirements as semantic authority.
- Workbooks use a selected primary record sheet and explicit unique-ID joins. Row order is not a primary join strategy. Duplicate join IDs that would make assembly unsafe must be blocked or clearly surfaced rather than multiplying rows silently.
- The generalized mapping/source/transformation layer is authoritative. Legacy correspondence-shaped fields may exist only as downstream compatibility projections.

### First-class sample-data contract

The sample system is QA infrastructure and a public learning surface, not a separate demo architecture.

Canonical source files:

```text
public/sample_data/correspondence_network_sample.xlsx
public/sample_data/family_tree_sample.csv
public/sample_data/cardinals_1600_1640_sample.xlsx
```

`src/peridotSampleDatasets.js` owns each sample’s display metadata, source path, and preserved generalized mapping.

Rules:

- samples are ordinary source files passing through ordinary generalized mappings;
- the user must explicitly choose a sample before it becomes active;
- sample source files are downloadable and may be modified/re-uploaded as ordinary user data;
- sample mappings are inspectable and editable in the active session;
- editing a sample changes the active interpretation only, not the shipped sample mapping or source file;
- the mapping editor must show: **“You’re editing Peridot’s interpretation of this sample data. Your changes will affect the active sample, but the original sample mapping is preserved and can be restored at any time.”**
- **Reset to sample mapping** restores the preserved shipped mapping before the user reapplies it;
- sample mapping edits remain identifiable as sample state rather than being silently converted to researcher-upload state;
- the retired `src/peridotSampleData.js` embedded fallback must not be restored.

### Current unresolved mapping-model questions

Two issues are intentionally deferred rather than solved through dataset-specific parsing:

1. **Cardinality / multiple values in one cell.** The agreed direction is a per-mapped-item one-value/multiple-values declaration plus a researcher-chosen delimiter. For non-space delimiters, leading/trailing whitespace around split tokens should be trimmed; if a literal space is explicitly selected as the delimiter, that space is the separator. This must work broadly across relevant mapping types rather than only for genealogy partner IDs.
2. **Record versus participant attribution.** Current “describes this row / record” wording is semantically too broad because researchers may need a value to describe the record, one or more participants, or both. The future control should support that multiplicity explicitly instead of implying that record-level information belongs to every participant.

### Minimum regression checks

Test: first launch with no active data; template download; all three sample chooser entries; sample source download; sample mapping edit/cancel/reset; CSV and TSV mapping; XLSX and XLS staging; primary-sheet selection; multiple joins; duplicate-ID blocking; joined-field mapping; Identity continuity across repeated roles; post-upload mapping re-edit/apply; retained accepted incomplete rows; Search reset/coherence; Timeline and Analytics scope after upload; Inspector participant attribution and linked navigation; and relevant exports.

### Preserved detailed import regression expectations

The following implementation-level expectations were relocated from the Project Workflow Charter so the Charter can remain process-focused. They remain current maintenance requirements.

<details>
<summary><strong>Open detailed data-import preservation notes</strong></summary>

Committed Data behavior includes:

- downloadable simple Peridot template;
- one unified CSV / TSV / XLSX / XLS table-workbook upload control;
- no implicit/default loaded sample on first use;
- explicit sample selection among ordinary generalized source files;
- downloadable sample source files and editable/resettable sample mappings;
- arbitrary CSV/TSV/Excel upload staging and role-based generalized mapping;
- editable post-import mapping that recompiles from the original source;
- post-upload validation and capability reporting;
- workbook parsing, mapping, explicit unique-ID joins, duplicate-join safeguards, and import assembly;
- selected workbook evidence/metadata visible in linked-record and entity-profile Inspector views;
- generic chart/evidence records admitted when they contain useful source content;
- Evidence Include/Ignore controls that default to Include;
- authoritative generalized relationship, Identity, temporal, place, and evidence semantics;
- stable cross-role entity identity where the researcher maps equivalent identity components;
- participant-specific temporal/place attribution;
- correspondence/genealogy-specific modules retained only where still needed as internal compatibility/specialization paths.

Future Data changes should explicitly test:

- the app begins with no active dataset;
- template download works;
- choosing a sample is required before sample data becomes active;
- sample files download correctly;
- sample mappings can be edited, cancelled, and reset without mutating the canonical mapping;
- uploading a valid mapped file updates the app data;
- reopening mapped data shows the current accepted mapping;
- applying mapping changes recompiles the original source;
- uploading a workbook stages sheets without freezing on reasonably sized files;
- workbook mapping can configure primary sheet, unique-ID joins, generalized roles, and selected evidence fields;
- duplicate workbook join IDs do not silently multiply records;
- untouched accepted Identity suggestions become authoritative;
- explicit mapping blanks stay blank;
- rows lacking coordinates are not silently discarded if otherwise accepted;
- rows lacking parseable dates are not silently discarded if otherwise accepted;
- Inspector still opens after upload and respects mapped participant subjects;
- Search remains coherent after import/remap;
- Timeline playback does not use stale date scope after upload;
- Analytics receives the intended uploaded/filtered rows;
- Export labels and exports the intended data scope;
- repeated visualization switching remains responsive after large workbook import.

Do not reintroduce the legacy three-file workflow, public Correspondence/Genealogy profile-choice screen, separate experimental universal-mapper surface, or embedded default sample fallback without an explicit architecture decision.

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

Main orchestration file. It owns top-level state, derived-data wiring, workspace composition, side-panel compatibility contracts, Search state, Timeline state, Inspector presentation/selection/history, export wiring, connected-record rendering, and the live generalized Data workflow. It coordinates template download, explicit sample selection, sample mapping edit/reset state, user upload parsing, editable table/workbook mapping, validation, authoritative Identity/runtime compilation, active-source replacement, and visualization resets after imports/remaps.

`App.jsx` must preserve the no-preloaded-data contract: null/no source means no active dataset rather than an implicit sample fallback. It no longer contains the inline Home, Data, Theme, Visualizations, Explore, Learn More, Search, Export, or hamburger-menu UI components; dedicated `Peridot*Workspace` / menu files own those presentations.

#### `src/peridotWorkspaceConfig.js`

Workspace-mode vocabulary and helper functions used by `App.jsx` for Home, Data, Visualizations, Explore, Learn More, Search, Inspector, and Themes/Accessibility routing. Export and Timeline are now Visualizations-integrated features rather than standalone workspace modes.

#### `src/PeridotHamburgerMenu.jsx`

Primary visible navigation component. It renders the hamburger button and the simplified task-oriented public menu: Manage Your Data, Visualize Your Data, Explore Your Data, and Learn More about Peridot. Themes and Accessibility is intentionally hidden from the public menu for now, but the component comments preserve the restore point for re-adding that entry later.

#### `src/PeridotHomeWorkspace.jsx`

Full Home / welcome workspace implemented as a fixed-ratio title-card composition. It uses the gilded transparent Peridot logo, licensed filigree framing, a single concise sentence, and **Use sample data** / **Upload your data** calls to action. The component intentionally keeps detailed onboarding out of the homepage; longer explanatory material belongs in `PeridotLearnMoreWorkspace.jsx`.

#### `src/PeridotDataWorkspace.jsx`

Full Data workspace for the three explicit entry paths: **Start with a Template**, **Start with Sample Data**, and **Upload Your Data**. It also identifies the active source, exposes **Edit mapped data** for researcher uploads, exposes **Edit sample mapping** for active samples, and routes sample selection/download/mapping actions. It must preserve the no-preloaded-data contract: first launch has no active dataset until the user explicitly chooses or uploads one.

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

Owns the large generalized column/workbook-mapping workspace for arbitrary CSV/TSV/XLSX/XLS imports and editable sample mappings. The active model is Preview, Sheets where applicable, Relations, Identity, Time, Places, Evidence, and Review. It exposes repeatable relationship participants, authoritative Identity rules, repeatable temporal assertions, repeatable participant-attached places, workbook primary-sheet selection, multi-sheet unique-ID joins, and selected Evidence/Analytics metadata.

The same modal is reused after import. Researcher uploads can be reopened and recompiled from their preserved original source. Samples open an editable active copy of the shipped mapping and display the approved warning that sample edits affect only the active interpretation; a reset action restores the canonical sample mapping.

This file remains partially decomposed: static UI labels/step groupings live in `peridotColumnMappingUiConfig.js`; repeated Time/Places/Relations controls live in `PeridotMappingFieldControls.jsx`; Identity presentation lives in `PeridotIdentityMappingControls.jsx`; Evidence Include/Ignore controls live in `PeridotEvidenceFieldControls.jsx`. The modal owns mapping state transitions, workbook state, edit/apply/cancel/reset behavior, final mapping assembly, and mapping-workspace presentation.

#### `src/peridotColumnMappingUiConfig.js`

Static UI configuration for the mapping modal: single-table/workbook step sequences, display labels, field groupings, capability labels, and formatting helpers. It intentionally contains no React state and no import/application logic.

#### `src/PeridotMappingFieldControls.jsx`

Presentational mapping controls used by the mapping modal for generalized repeatable Relations, Time, Places, and workbook-qualified equivalents. Time presents repeatable Date/Period cards, source-representation controls, Y/M/D component selectors, relationship-participant attachment, and related-note selectors. Places support arbitrary Place A/B/C parts with role source and optional coordinates; Relations support Part A/B/C participants with per-part role source and optional relationship metadata. Workbook controls use combined sheet-column references while preserving the internal workbook reference shape. This file should remain stateless and receive current values plus callbacks from `PeridotColumnMappingModal.jsx`.

#### `src/PeridotIdentityMappingControls.jsx`

Presentational generalized Identity-mapping controls. The page distinguishes record recognition from recurring people/places/other-things recognition, supports multiple entity groups, label/field/composite/row-unique strategies, and role/sheet-specific mappings of equivalent identifying information. It consumes current relationship/place appearances plus optional custom appearances. Runtime identity authority is implemented downstream by `peridotIdentityRuntime.js`; this component remains the user-facing editor rather than the compiler itself.

#### `src/peridotRecordStructure.js` and `src/PeridotRecordStructure.jsx`

Generalized record-structure reader and renderer introduced during the SI1 Inspector-legibility work. They expose mapped temporal assertions, participants, places, generalized semantic relationships, and evidence without forcing every record into Source/Target display. `buildPeridotEntityAttributedStructure()` scopes participant-attached information to the selected entity and prefers canonical entity IDs where present. The renderer preserves linked person/place navigation callbacks. These modules are the semantic reference surface for the current generalized Inspector implementation and mapped-information detail; they do not replace central Inspector history.

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

#### `src/peridotSampleDatasets.js`

First-class sample-data registry. It identifies the ordinary source file for each bundled sample, preserves the shipped generalized mapping, provides display/chooser metadata, and supplies the immutable reset baseline used when a user experiments with a sample mapping. Samples are not a separate parser or runtime architecture.

Canonical public sample sources live under `public/sample_data/`:

- `correspondence_network_sample.xlsx`
- `family_tree_sample.csv`
- `cardinals_1600_1640_sample.xlsx`

The earlier embedded `src/peridotSampleData.js` module has been retired and must not be restored as an implicit first-load fallback.

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

Compatibility registry for the older Correspondence / Directed Record and Genealogy / Person-Centered profile vocabulary. The public upload flow no longer asks users to choose between these profiles; retain this module only where current internal normalizers/runtime adapters still depend on it, and include it in the later legacy-retirement audit.

#### `src/peridotGenealogyProfile.js`

Normalizes person-centered genealogy rows into canonical people/entities, birth/death events, parent-child and partnership relationships, places, attributes, evidence, temporal assertions, and provenance. It preserves direct source relationships and does not infer false movement or derived kinship.

#### `src/peridotGenealogyMapping.js` and `src/PeridotGenealogyMappingControls.jsx`

Own genealogy-specific mapping schema, defaults/suggestions, validation, supplemental-row handling, capability summaries, and presentational mapping controls for Identity, Parents, Partners, Life events, Places, Attributes, and Review.

#### `src/peridotGenealogyRuntimeModel.js`

Projects validated canonical genealogy datasets into the current active genealogy runtime model without routing them through the correspondence compatibility adapter.

#### `src/peridotGeneralizedMappingRuntime.js`

Authoritative runtime application boundary for accepted generalized single-table mappings. It turns user-confirmed relationships, Identity rules, places, temporal assertions, and evidence into generalized observations and compatibility projections only where older consumers still require them. Identity mappings are now compiled into stable participant/entity IDs through the identity runtime; participant-attached time/place assertions carry their mapped subject rather than defaulting to every entity in the row.

#### `src/peridotIdentityRuntime.js`

Compiles accepted generalized Identity definitions into deterministic machine-facing keys for records and recurring entities. It preserves equivalence across participant roles/sheets when the researcher maps the same conceptual identity components, distinguishes same-label entities when stronger identity differs, and provides controlled unresolved/row-scoped fallback only when no usable mapped identity is available. Suggested Identity fields must be materialized into the accepted mapping before compilation rather than remaining UI-only defaults.

#### Identity/place/workbook regression fixtures

`src/peridotIdentityRuntimeFixtures.js`, `src/peridotPlaceSubjectMappingFixtures.js`, `src/peridotWorkbookMappingValidationFixtures.js`, `src/peridotCorrespondenceUniversalModelFixtures.js`, and the generalized runtime/workbook fixture suites preserve the recently accepted identity continuity, participant-place subject, correspondence aggregation, and safe workbook-join behavior. Extend these fixtures rather than relying only on visual QA when changing these boundaries.

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

- workspace routing and hamburger-menu behavior;
- first-time tutorial progression, target observation, panel placement, minimize/restore state, and workspace/Inspector transitions;
- shared `src/index.css` delivery: broad replacements can silently overwrite newer unrelated visual rules;
- map viewport centering/reset behavior and map/network viewport measurement after switching visualization modes;
- dense map hover/click interaction and selection persistence across filters;
- timeline/playback state coupling;
- export rendering/state coupling;
- broad orchestration work in `src/App.jsx`;
- generalized Data state: genuine no-data startup, explicit sample selection, researcher upload replacement, and active-source reset behavior;
- editable mapping state: reopen/cancel/apply must preserve the original source and current accepted interpretation;
- sample mapping state: editing must not mutate the canonical sample mapping/source; reset must restore the shipped definition;
- Identity materialization/runtime authority: visible accepted suggestions, explicit blanks, same-label distinct entities, and cross-role composite identity must remain stable;
- participant attribution: place/time assertions must remain attached only to the mapped subject(s);
- workbook assembly: duplicate join IDs must not silently multiply rows;
- internal compatibility boundaries: public generalized mappings are authoritative, while correspondence/genealogy adapters may still be needed by current consumers;
- Review warning/validation logic: distinguish real runtime constraints from old correspondence-specific assumptions;
- shared side-panel shell and Inspector-open interactions;
- cluster grouping and Inspector navigation;
- Analytics expanded overlay positioning, dynamic variable detection, and SVG-to-PNG chart export;
- Search active-dataset state, especially draft/apply coordination across keyword, person, place, relationship, date, weight, Timeline, Analytics, Inspector, and Export;
- archived MapLibre work if it is ever explicitly resumed.

### Practical regression matrix

| Fragile zone | Typical regression | Minimum test |
|---|---|---|
| Workspace routing | wrong workspace or lost state | Home CTA and every hamburger route |
| First-time tutorial | stalled progression, missing target, obscured control, broken restore, or unstable highlight | launch; all seven stages; Back/Continue; drag; minimize/restore; keyboard; Inspector close; target recovery |
| Inspector bridge | compact Inspector fails to open | node, edge, cluster, contained member, Expand, Back |
| Search scope | results or facets omit/misstate records | draft suggestion, Apply, Clear, pagination, Inspect handoff |
| Timeline / Analytics | stale or inconsistent chart scope | alter timeline/date controls, refresh chart, export |
| Data import | loss of accepted rows, hidden default data, or bad joins | no-data first launch; template/upload; workbook join; validation |
| Sample system | canonical sample mutated or implicit fallback restored | choose each sample; download; edit/cancel/reset mapping; hard refresh with no selected source |
| Identity/runtime | duplicate-label conflation or one entity split by role/row | same-label ID fixture; untouched suggestion; explicit blank; Source/Target composite identity |
| Participant attribution | child/mother or other participant information bleeds across entities | participant-specific Time/Place fixture and Inspector dossier |
| Compatibility boundary | generalized mapping overridden by profile/legacy projection | correspondence adapter audit; genealogy fixture; generalized runtime fixtures |
| Visual stage | remount/reanimation, viewport shift, or post-import freeze | repeated map/network/chart switching; full Inspector open/close |
| CSS cascade | late stylesheet masks accepted behavior | inspect every extracted workspace and feedback form |
| Chart rendering/export | mismatched labels, colors, or PNG | multiple chart types, manual series, PNG export |
| Theme roles | chart-only changes recolor chrome | apply chart-targeted palette and inspect map/header |
| Export | wrong output scope or broken render | map PNG/SVG, CSV, chart PNG |

## 11. Active Technical Backlog

1. **Add per-mapped-item cardinality and delimiter semantics.**
   - Let the researcher declare whether a mapped item contains one value or multiple values in a cell.
   - If multiple, require an explicit delimiter rather than guessing.
   - Trim leading/trailing whitespace around tokens for non-space delimiters; if a literal space is chosen as the delimiter, preserve that semantics.
   - Design the model broadly enough for relationship participants/IDs, places, time, Evidence, and other suitable mapped values; do not build a genealogy-only `Ex Partner IDs` special case.
   - Use the family-tree sample’s multiple partnership data and the cardinals sample’s repeated conclave/evidence structures as independent QA cases.

2. **Generalize record-versus-participant attribution multiplicity.**
   - Replace ambiguous “describes this row / record as a whole” wording with a clearer control.
   - Support information that belongs to the record, one or more mapped participants, or both.
   - Preserve current participant-specific place/time behavior while making mixed attribution explicit rather than inferred.

3. **Complete generalized Network geographic/event semantics.**
   - Correct relationship/event scoping so selected Timeline event types do not combine with unrelated structural relationships.
   - Replace crude most-frequent-place anchoring with transparent/user-selected participant-place associations.
   - Generalize playback highlighting so active records can highlight all mapped relationships.
   - Address Force-Directed fit-to-viewport and arrowhead termination only after semantic correctness is preserved.

4. **Generalize Search places/facets.**
   - Relationship Search semantics are substantially generalized; place Browse/facet/criteria/result paths still need migration to all mapped place associations.

5. **Universal data architecture — Phase 3 Chart Builder.**
   - Build chart controls from saved variables and generalized mapped fields.
   - Retain the structured scholarly-sentence/autocomplete direction rather than unrestricted natural-language prompting.
   - Use the wide/transposed multi-company stock-price case as a required regression dataset.

6. **Search coverage and scope audit.**
   - Verify loaded dataset versus applied result set versus Browse, Results, Refine/facets, pagination, capability filters, structured criteria, Inspector handoff, and exports.

7. **Timeline playback × Analytics audit.**
   - Verify timeline range/playback scope against chart input rows, chart-local date controls, rendering updates, titles/counts/legends, and exported chart output.

8. **Repository-wide legacy/compatibility retirement audit.**
   - Inventory old Source/Target-only mapping code, obsolete profile routing, correspondence-shaped assembly logic, compatibility adapters, stale fixtures/comments, and old sample/data fallback paths.
   - Classify each item as **delete now**, **still-required compatibility layer**, **legitimate specialization**, or **uncertain/retain**.
   - Do not remove code simply because the public generalized workflow no longer exposes it.

9. **Homepage and tutorial-entry redesign — deferred visual work.**
   - Merge the strongest aspects of the current branded Home composition and Data/sample-selection surface into one coherent entry experience.
   - Replace the current tutorial pop-up/launch treatment with a static tutorial button.
   - Do not combine this with current data-model work.

10. **Optional Timeline temporal-structure controls.**
    - Consider filters for approximate, partial, open-ended, or inconsistent temporal structures only if analytically useful and human-readable.

11. **Inspector → Advanced Search actions and safe metadata filters**, after the Search coverage audit.

12. First-time tutorial polish, accessibility, data-scope language clarification, and substantive Learn More/tutorial/help content remain later bounded work beyond the static-entry redesign.

13. Continue bounded structural work only when a concrete maintenance need exists; `App.jsx` remains concentrated but should not be casually refactored.

The current milestone is `8290696`: generalized Inspector semantics, mapped Identity/place-subject authority, editable mappings, stable correspondence cross-role identity, and first-class sample datasets are accepted. The next implementation sequence begins with cardinality/multi-value semantics and attribution multiplicity rather than additional Inspector/Identity repair.

## 12. Archived and Compatibility Paths



### Canonical correspondence/genealogy adapters and profile vocabulary — active internal compatibility paths

The generalized public mapping architecture is authoritative. Current downstream consumers may still receive established correspondence-shaped row structures through `peridotLegacyCompatibilityAdapter.js` / `peridotCanonicalRuntimeModel.js`, while genealogy-specific canonical/runtime modules may still provide specialized projection behavior. The public Data workflow no longer exposes Correspondence / Directed Record versus Genealogy / Person-Centered as a required choice.

These modules are **active internal compatibility/specialization boundaries**, not automatically dead code. Do not remove them merely because the generalized public workflow has superseded profile selection. Remove or collapse them only after remaining consumers have migrated or been shown not to need them. The separate legacy date interpretation path and embedded sample fallback are already retired.

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
- current synchronized checkpoint: **`8290696` — `Add first-class generalized sample datasets`**
- local development command on the user's machine: **`npm.cmd run dev`**

A future chat should also be told that:

- canonical Temporal Assertions are the sole active temporal interpretation system;
- generalized mapping is the ordinary public upload model; there is no longer a public Correspondence/Genealogy profile-choice gate or separate experimental universal-mapper surface;
- Peridot starts with no active dataset. A user must explicitly choose a sample or upload data;
- three ordinary sample source files live under `public/sample_data/`, with canonical generalized mappings in `src/peridotSampleDatasets.js`;
- sample mappings are editable in the active session and resettable to the shipped interpretation; the source files and canonical mappings remain unchanged;
- researcher uploads can be reopened through **Edit mapped data**, and applying changes recompiles from the original source;
- generalized Identity rules are authoritative at runtime. Stable mapped IDs and composite identity components distinguish same-label people while unifying one entity across roles such as Source/Target;
- accepted visible Identity suggestions are materialized into mapping state even if the researcher does not manually touch the dropdown; explicitly cleared suggestions remain blank;
- generalized Inspector semantics and participant attribution are accepted. Connected people, places, dates/periods, relationships, and evidence derive from mapped semantics rather than universal Source/Target assumptions;
- place/time assertions respect their mapped participant subject. The same source column can carry different named semantic roles for different participants;
- correspondence-specific directed place pairs remain available only when explicit directed place mappings exist;
- workbook joins use explicit IDs and include safeguards against duplicate join IDs that would make assembly unsafe;
- the prior Maria Maddalena correspondence freeze/occurrence-identity failure is not reproducing in the accepted sample QA sequence after `e944e60`, but large-workbook responsiveness remains worth monitoring;
- the next data-model task is **cardinality/multi-valued cells**: per mapped item, user-declared one-versus-many and explicit delimiter semantics, without genealogy-specific parsing;
- the second immediate data-model task is richer **record-versus-participant attribution**, allowing information to belong to the record, one or more participants, or both;
- after those, resume generalized geographic Network scoping/anchors/playback highlighting, Search place/facet generalization, and Phase 3 Chart Builder work;
- Search coverage/scope and Timeline × Analytics remain dedicated deferred audits;
- a later Home redesign should merge the current branded landing page with the Data/sample-selection strengths and replace the current tutorial pop-up/launch treatment with a static tutorial button;
- MapLibre remains archived.

Before implementing the next data-model pass, reread the current complete mapping/runtime files from the synchronized repo, especially `App.jsx`, `PeridotColumnMappingModal.jsx`, `PeridotMappingFieldControls.jsx`, `PeridotIdentityMappingControls.jsx`, `peridotGeneralizedMappingRuntime.js`, `peridotIdentityRuntime.js`, `peridotWorkbookMapping.js`, `peridotSampleDatasets.js`, and the relevant identity/place/workbook regression fixtures. Preserve the accepted generalized Inspector and cross-role Identity behavior while adding cardinality or attribution multiplicity.

