# Project Workflow Charter

## Executive Summary

This Charter is Peridot’s controlling process document for safely changing the project. It defines the source-of-truth rule, bounded-pass method, review and delivery safeguards, recovery protocol, testing/commit discipline, documentation policy, and durable decision governance.

Use it before every implementation or documentation pass. It governs **how** work is done; the Maintainer’s Guide governs the current architecture, the Changelog governs history, and the Core Documentation Governance Protocol governs preservation and ownership during core-documentation maintenance.

## Quick Navigation

- [Non-negotiable operating rules](#1-non-negotiable-operating-rules)
- [Delivery, testing, and commit protocol](#2-delivery-testing-and-commit-protocol)
- [Recovery protocol](#3-recovery-protocol)
- [Documentation maintenance policy](#4-documentation-maintenance-policy)
- [Dependency and tooling freeze](#5-dependency-and-tooling-freeze)
- [Project-specific operating cautions](#6-project-specific-operating-cautions)
- [Decision records by domain](#7-decision-records-by-domain)
- [Standard handoff and completion template](#8-standard-handoff-and-completion-template)

## Document Role and Boundaries

This Charter owns mandatory process rules, source-of-truth continuity, delivery/recovery protocol, commit discipline, tooling constraints, and non-obvious decision governance. It does not own the exhaustive module map, regression matrix, screenshot archive, public product manual, or full commit history.

Current synchronized checkpoint:

```text
301a1e1 — Add universal runtime compatibility boundary
Branch: main
Status: local and origin/main aligned after the latest sync ritual
```

For detailed milestone interpretation and full commit history, see [CHANGELOG.md](CHANGELOG.md).


## 1. Non-Negotiable Operating Rules

### 1.1 Source of Truth and Applied-File Continuity



At the start of any pass, establish one authoritative source of truth.

During active editing, the source of truth must be exactly one of the following:

- one specific local project folder
- one specific pasted/exported file
- one recently synced Git commit when the user has confirmed local and GitHub alignment through the sync ritual

GitHub, canvas copies, temporary zips, downloaded replacements, and other artifacts may be references, but they must not be treated as co-equal authoritative sources during the same pass unless that divergence is explicitly acknowledged.

Current project source of truth folder:

```text
C:\Users\haley\OneDrive\Desktop\Peridot\
```

Current synchronized checkpoint is recorded in the standardized block above. The Changelog is the authoritative source for detailed checkpoint interpretation and complete chronology.

### Applied-file continuity rule

After the user applies and tests an uncommitted replacement, script, or manual edit, the resulting **local file** becomes the new source of truth for that file. Before a later change to the same file, either:

- obtain that exact current local file again; or
- work from a newly committed Git state that the user has confirmed contains the tested change.

Do not regenerate a broad replacement from an earlier upload, generated artifact, or remembered snapshot. This is especially important for shared files such as `src/index.css`, where unrelated workspace rules may coexist and a stale full-file handoff can silently revert a successful visual repair.

Current branch note:

```text
The current active continuation branch may intentionally differ from experimental branches. MapLibre preview code has been removed from active `main`; the later MapLibre migrated-overlay branch remains archived and should not be treated as the active source of truth unless explicitly resumed.
```

Asset-origin and licensing information must remain preserved in the README and Maintainer’s Guide. This Charter governs the process requirement to protect that information when relevant, not the asset inventory itself.

---

### 1.2 Bounded-Pass Rule



Before each coding pass, state:

- change type: exactly one of **behavior**, **visual**, **structural**, or **documentation**
- goal
- in-scope files/regions
- out-of-scope files/regions
- one plain-language acceptance test
- expected artifact: usually a uniquely versioned replacement ZIP bundle plus extract/copy instructions; use pasted diff, isolated file, or commit-ready instructions only when that better fits the bounded pass

Do not mix functional changes, visual redesign, broad refactors, and documentation updates in a single implementation pass unless the user explicitly chooses that scope.

---

### 1.3 Full-File Review and Safe Replacement



Before writing any code edit or patch script, read and review the complete current affected file or files from the real source of truth.

When the user has confirmed local and GitHub are synced, use the current GitHub files as the source for full-file review unless the user explicitly states that local files have diverged.

For code changes, prefer full-file replacements by default, especially when working in dense or fragile files such as:

- `src/App.jsx`
- `src/LeftControlPanel.jsx`
- `src/timelinePlaybackComponents.jsx`
- inspector components
- map interaction components
- export components
- Analytics components

Do not rely on inferred snippets, broad regex patching, partial excerpts, or assumptions about code shape. Use the knowledge gained from reading the actual file to make grounded changes.

Small targeted replacement blocks are allowed only when all of the following are true:

- the full affected file has already been reviewed;
- the edit is genuinely local;
- the anchor text is unambiguous;
- repeated code patterns or prop names will not make the replacement brittle;
- the risk is lower than a full-file replacement.

### Shared-stylesheet and script safeguards

`src/index.css` is a high-risk shared dependency even when a requested visual change is small. For a narrowly scoped color, spacing, or animation adjustment:

- do not send a full stylesheet replacement merely for convenience;
- start from the exact latest local stylesheet or a confirmed commit that contains all accepted interim changes;
- identify preservation checks for unrelated behaviors that must survive the change;
- use a narrow, source-verified edit only when its selector/anchor is stable and unambiguous;
- prefer an ordinary replacement file delivered inside the pass bundle over an executable patch script unless the user explicitly requests a script.

Do not rely on comment markers as the only verification anchor for a generated script. Comment text may be altered by text encoding or prior tooling. Verify stable selector or structural hooks instead.

If a generated patch script fails, stop and confirm that no changes were written. Do not iterate through increasingly permissive scripts against an uncertain local file. Re-establish the current source, then choose one bounded repair or restore a clean checkpoint.

If a patch fails, begins to loop, or requires repeated corrective scripts, stop immediately. Roll back to the last clean commit/checkpoint, restate the goal, and switch to a reviewed full-file replacement or a new implementation plan.

This project is grounded in real code and real data. Do not reconstruct likely code from memory, snippets, or expectations when the actual file can be read.

### Human-readable code comment rule

Code should be commented thoroughly enough for a new human developer to understand what each major section does and how it relates to other app sections and files. Comments should explain architecture, data flow, fragile compatibility paths, non-obvious state coupling, and why a decision was made. They should not merely restate obvious syntax.

When editing a file, review nearby comments for accuracy. Update comments that describe obsolete UI paths, removed routes, or superseded data workflows. Add short architectural comments before complex state blocks, exported helper groups, compatibility bridges, and cross-file wiring. Avoid large noisy comment blocks, but leave enough context that a future maintainer can safely continue work without relying on prior chat history.

Before deleting comments, verify that the information is either obsolete, duplicated by clearer documentation, or obvious from the code. If a path is retained only for compatibility, comment that explicitly.

### Most-recent-upload rule

When the user uploads files after being asked for current source files, treat those most recent uploads as the authoritative source for that pass unless the user explicitly says otherwise.

Do not assume that a same-name file already present in `/mnt/data`, a prior generated replacement file, or an older upload is the latest source. Same-name files from different points in the conversation are common during this project.

Before making claims that a user-uploaded source file is stale, verify that the file being inspected is actually the newest uploaded file for the pass. If there is any ambiguity about file recency or identity, stop and ask rather than declaring the user’s upload stale.

---

### 1.4 Fragile-Zone Preflight Requirement

Before touching a fragile zone, state the affected zone, what could break, what is deliberately out of scope, and how the result will be verified. The authoritative detailed fragile-zone regression matrix is in the Maintainer’s Guide; this Charter requires the preflight, not a duplicate technical inventory.

High-risk examples include `App.jsx` orchestration, workspace routing, compact/full Inspector behavior, Search applied-data state, Timeline/Analytics coupling, upload/mapping behavior, export rendering, shared stylesheets, stylesheet import order, semantic theme roles, and map/chart portal layering.

## 2. Delivery, Testing, and Commit Protocol

A **checkpoint** is a tested intermediate state that may still be revised soon. A **commit** is a coherent completed pass with one clear outcome. Use commits for coherent completed passes; use checkpoints when the user wants recoverability before additional risk.

### Delivery format

- **Default Peridot coding and documentation delivery:** provide one uniquely versioned ZIP bundle per pass containing all new/replacement files for that pass.
- Always provide exact PowerShell commands to extract the bundle into a uniquely named temporary folder and copy each contained file to its intended path under `C:\Users\haley\OneDrive\Desktop\Peridot\`.
- Bundle-internal replacement filenames should also be unique/versioned when practical so downloads from different passes cannot be confused. Repository destination filenames remain the canonical project filenames.
- Avoid separate individual-file downloads unless there is a specific reason to provide one, such as isolated recovery of one file.
- Do not use executable apply/patch scripts unless explicitly requested. The bundle should contain ordinary source/document/asset files and the chat should provide transparent copy commands.
- Small local edits may still use targeted, source-verified blocks only after full-file review when that is demonstrably safer than a replacement bundle.
- For image, brand, screenshot, or other asset passes, include the assets inside the same pass bundle and provide exact copy destinations.
- Do not use `git add .` while generated artifacts such as `itch_upload/` or unrelated working files are untracked.
- Use targeted `git add <file>...` commands by default. Use `git add -A src` only when an intentional source-file rename or deletion requires it.

### Sync ritual

Run after actual commits or major checkpoints:

```powershell
git status
git log --oneline -5
Get-ChildItem -Name
Get-ChildItem src -Name
```

A clean ritual showing local `HEAD`, `origin/main`, and `origin/HEAD` aligned establishes the synced Git state as the current source of truth.

After a clean aligned sync ritual, do not repeatedly request uploaded source files unless there is a specific reason to believe the relevant file has drifted, the current contents are unavailable, or the task requires an uncommitted local version.

## 3. Recovery Protocol



When something goes wrong:

1. Stop further edits.
2. Identify the current source of truth.
3. When a runtime issue appears after user interaction, inspect the F12 browser console early before attempting source edits or speculative fixes.
4. Restore the last good checkpoint/commit.
5. Restate the goal in one sentence.
6. Make one bounded fix only, or switch delivery mode to full-file replacement after full-file review.
7. Rerun the acceptance test.

Do not stack speculative fixes on top of an unstable state.

Recent examples reinforced this rule:

- a responsive shared-panel sizing attempt was rolled back after it disrupted the normal landscape layout
- a semantic shared-panel prop rename was rolled back after it broke inspector auto-open behavior
- repeated Search & Filter patch-script failures showed that dense UI files should not be edited through brittle snippet assumptions
- the team returned to the last clean baseline before proceeding
- an Inspector related-person navigation fix that also changed place cluster display was rolled back after it caused related places to disappear and people clicks still opened the blank state

---

## 4. Documentation Maintenance Policy



Do not update documentation after every small code commit. That slows development.

Instead, defer README / Maintainer Guide / Changelog updates until:

- a meaningful batch of changes has accumulated
- a milestone has been reached
- a fresh-chat handoff is needed
- the current conversation is becoming laggy or unreliable

When documentation is updated, preserve the full development history in `CHANGELOG.md`.

Documentation passes should default to adding new milestone/current-state information where reasonable. Subtract or rewrite existing documentation only when the text is clearly obsolete, duplicated by a more accurate retained entry, or actively misleading.

---

### Executive-summary maintenance rule

Each core document—`README.md`, `MAINTAINERS_GUIDE.md`, `PROJECT_WORKFLOW_CHARTER.md`, and `CHANGELOG.md`—must begin with a one- or two-paragraph **Executive Summary** for human readers.

The Executive Summary is the sole documentation region that may be revised non-additively during a documentation pass. It is a stable orientation layer, not a miniature changelog: update it only when the document’s purpose, audience, or high-level scope has materially changed. All remaining documentation should remain additive, meticulous, and exhaustive by default, subject only to the existing rule allowing clearly obsolete, duplicated, or misleading text to be corrected.

For every core-documentation pass, also follow `PERIDOT_CORE_DOCUMENTATION_GOVERNANCE_PROTOCOL.md` and the current `planning_documents/PERIDOT_CORE_DOCUMENTATION_RESTRUCTURING_PLAN.md`. Read the protocol and all four core documents in full before editing them.

## 5. Dependency and Tooling Freeze



Do not change dependencies, package manager files, Vite config, Tailwind config, lint/format rules, filenames, or folder structure unless the pass is explicitly about tooling or architecture.

Generated artifacts such as `itch_upload/` should not be committed during ordinary source-development passes.

---

## 6. Project-Specific Operating Cautions

### Modularization roadmap

Maintain a modularization roadmap for eventual `App.jsx` decomposition, but do not execute it casually. Preferred order: pure data helpers; export helpers; theme/constants; small reusable UI pieces; map interaction helpers; panel and Inspector content components; then app orchestration last. Stop structural cleanup once the file is stable unless there is a concrete bug, a planned architectural pass, or a specific maintenance pain point.



### Shared side-panel compatibility path

The app still contains old compatibility naming around left/right panel visibility in some places. Although the names are misleading, that path currently preserves Inspector auto-open behavior.

Do **not** casually rename these props or setters.

If revisited, explicitly test:

- node click opens Inspector
- edge click opens Inspector
- cluster click opens Inspector
- contained cluster member opens detail
- Back behavior still works

### Responsive panel sizing

A prior attempt to make the shared side panel absolutely positioned at all viewport sizes was rolled back because it disrupted normal full-size landscape layout.

Future responsive panel work should be a narrow-window-specific override, not a universal positioning replacement.

### Archived MapLibre work

Active `main` no longer contains dormant MapLibre preview files or the `maplibre-gl` dependency.

The later `maplibre-native-geographic-view` branch remains an archived experiment and should not be treated as active production code. Do not reintroduce MapLibre files, dependencies, or preview flags unless the pass is explicitly about resuming MapLibre after a fresh source-of-truth audit.

### Cluster behavior

Cluster behavior is now committed and functional.

Future cluster changes should preserve:

- cluster click opens Inspector
- cluster inspector lists contained members
- members are grouped by place
- member click opens detail
- Back returns to the cluster view
- cluster sizing remains visually meaningful

### Data import, canonical normalization, and mapping caution

Data import is a fragile boundary. Keep the public direction intact: unified CSV / TSV / XLSX / XLS upload, user-confirmed/user-owned mapping, active correspondence and genealogy profiles, permissive database-first admission, and no silent standardization. Correspondence currently passes through the canonical normalized model and a legacy runtime adapter; genealogy uses a direct canonical runtime projection; broader universal structures remain canonical-only until a consumer deliberately adopts them.

Do not create a new profile for every unusual spreadsheet shape as a substitute for the universal mapping work. Conversely, do not retire or collapse the existing Correspondence / Directed Record or Genealogy / Person-Centered profiles until a later universal mapper proves that doing so loses no behavior or scholarly expressiveness and simplifies the architecture rather than relocating complexity. Do not reintroduce the legacy three-file workflow without a specific recovery or compatibility reason.

For the current import/workbook contract and detailed regression checks, see the [Maintainer’s Guide — Data Import and Workbook Contract](MAINTAINERS_GUIDE.md#7-data-import-and-workbook-contract).

### Advanced Search and applied-scope caution

Advanced Search is the primary owner of global applied filtering and the Explore surface. Preserve its draft/apply model, explicit route filters, structured criteria, Browse, Results, Refine / Inspect, Capabilities, and Inspector-overlay return behavior. Do not turn draft edits into uncontrolled full-dataset recomputation or combine Search work with unrelated `App.jsx`, Timeline, Analytics, Inspector, or MapLibre changes.

For the current Search contract and detailed regression checks, see the [Maintainer’s Guide — Advanced Search / Explore Contract](MAINTAINERS_GUIDE.md#5-advanced-search--explore-contract).

## 7. Decision Records by Domain

The concise domain summaries below are the active decision index. When recording a new or materially revised non-obvious decision, add it beneath the relevant domain using:

```text
Decision:
Context:
Chosen approach:
Rejected alternative:
Reason:
Maintenance consequence:
```

Detailed historical decision rationale remains preserved in the archived inventory below.

### 7.1 Data policy and imports

- Peridot is database-first: accepted research items may be incomplete, and coordinates/dates are capability-enabling rather than admission requirements.
- Peridot does not silently standardize, merge, infer domain meaning, or enforce controlled vocabularies.
- The canonical normalized model is the consumer-neutral research representation. It preserves entities, places, records, events, relationships, participations, evidence, assertions, temporal structure, and machine-readable provenance.
- Correspondence / Directed Record and Genealogy / Person-Centered are active mapping/normalization profiles. They remain first-class until a universal mapping workflow demonstrates complete parity and a simpler architecture; do not retire them merely to make the profile list shorter.
- Arbitrary tables use explicit user-confirmed mapping; current correspondence workbooks use user-confirmed unique-ID joins rather than row-order matching.
- The Phase 1 universal mapping foundation is deterministic and user-owned: saved variables, field assignments, sheet-purpose assignments, repeated-heading groups, source-table/field descriptors, transformations, and table connections record what the user has told Peridot. Peridot may suggest broad recognizable forms such as dates or coordinates, but the user is ultimately responsible for the accepted mapping.
- Broader universal datasets must not be forced into correspondence- or genealogy-shaped runtime rows merely because those are the current active consumer projections. Canonical-only preservation is valid until appropriate downstream consumers are implemented.
- Phase 2 should prototype the complete progressive mapping workflow before targeted simplification. Phase 3 should build chart controls from saved variables, including a structured autocomplete sentence builder that mirrors scholarly questions without implementing unrestricted natural-language prompting.

### 7.2 Routing and workspace model

- The active public model is workspace-first: Home, Data, Visualizations, Explore/Advanced Search, and Learn More are the primary public surfaces.
- The hamburger menu is the primary public navigation surface; Themes and Accessibility remains implemented but hidden; Export and Timeline are Visualizations-integrated.
- MapLibre migrated-overlay work is archived. Active `main` continues the D3/SVG path.

### 7.3 Inspector

- Inspector is dual-mode: compact visualization-click summaries and full dossier navigation share selection state and Back history.
- Full Inspector overlays rather than remounts Visualizations. Linked records, routes, people/entities, and places participate in shared history.
- `Unknown` remains a first-class place-like bucket; connected-record tables are capability-aware and support date-first sorting/filtering/pagination.

### 7.4 Search and data scope

- Advanced Search is the owner of global applied filtering and the primary Explore surface.
- Search retains the draft/apply model, predictive discovery, explicit route filters, structured AND / OR / EXCLUDING criteria, Browse, Results, Refine/Inspect, Capabilities, and overlay Inspector handoff.
- Timeline consumes the active temporal scope; Analytics charts the currently filtered data by default. The exact coverage/scope and Timeline × Analytics contracts remain active audit items.

### 7.5 Analytics

- Chart Visualizations belongs inside Visualizations, with tabbed controls and a large chart surface.
- Record count is explicit; Year is the default ordered date axis; compatible settings and manual selections should persist where safe.
- Chart summaries/legends must represent displayed values persistently and export with the chart.
- Chart series colors come from the finite Peridot palette by default and semantic theme roles when users explicitly target charts.

### 7.6 Themes and visual language

- Color changes should use semantic roles in `peridotTheme.js` and related metadata.
- Greens/golds remain primary; map/chrome/chart palettes and dropdown layering are semantic/system concerns rather than local cosmetic overrides.
- Home remains informative-minimalist; Learn More carries expanded project information; licensed Adobe filigree attribution must remain clear.

### 7.7 Export

- Export is an in-place Visualizations header action.
- Map PNG default output is unbranded map-only content, with optional title/metadata using Peridot typography.

### 7.8 Archived or superseded decisions

- Earlier persistent-rail, standalone Export, standalone Timeline, legacy three-file upload, and MapLibre preview directions are historical or superseded. Their active replacement is identified in the contracts above and in the Changelog.


<details>
<summary><strong>Historical flat decision inventory retained for preservation</strong></summary>

This is a preserved legacy archive of the earlier cumulative decision list. It is not the active organizational model: the concise decision records above are the authoritative categorized index. New or revised decisions must be added under Sections 7.1–7.8, using the stated decision-record format. The archive remains available so no historical rationale is lost during the transition.

The following detailed inventory is retained to preserve the complete decision record that previously existed as a flat list. Future decisions should be added under the domain headings above and, when needed, expanded into the consistent record format below.

```text
Decision:
Context:
Chosen approach:
Rejected alternative:
Reason:
Maintenance consequence:
```



For non-obvious implementation choices, record:

- what was chosen
- what alternative was rejected
- why

Current notable decisions:

- The map remains dynamic rather than fixed to a canonical live stage for now.
- Panel standardization focused on a shared side panel instead of freezing the whole viewport.
- The Inspector is now content inside the shared side panel, not a separate right-side shell.
- Cluster sizing now reflects represented letter volume.
- Cluster grouping is zoom-responsive.
- Cluster inspector members are grouped by place.
- MapLibre migrated-overlay work is paused; legacy D3/SVG Peridot is the active continuation path unless the user explicitly resumes MapLibre.
- Advanced Search is the long-term owner of global dataset filtering and the primary Explore Your Data surface.
- The completed Search/Explore redesign uses a compact folio workflow: Build fits by default, Browse uses compact route-aware ledgers, Results uses Inspector-style pagination and route-aware ledger rows, Refine uses route-aware expandable facet cards, and Capabilities uses compact review cards.
- Inspect actions from Explore should open the full Inspector as an overlay above the current Explore page instead of navigating away; closing Inspector should return to the same Explore tab/state.
- Explore animations should remain gentle and useful: left-to-right step-button sequencing, soft content transitions, default Results/Browse row filing effects, normal scrolling after expansion, and reduced-motion fallbacks.
- Controls / View should govern display, not the active filtered dataset.
- Timeline should focus on chronological playback and consume the active date range.
- Analytics should chart the currently filtered dataset by default.
- Advanced Search uses draft inputs plus explicit Apply Filters rather than live filtering.
- Predictive suggestions should support discovery without becoming full dropdown selectors.
- Route filtering is split into Route Filter (Place) and Route Filter (People).
- Advanced Search should visually resemble a compact database/library advanced-search interface rather than a stack of explanatory cards.
- Expanded Analytics charts should keep the chart on a white/cream card while the layer behind it can use a dark translucent green with blur to preserve map context.
- Data Inputs should use one standardized Peridot CSV upload as the public workflow.
- The Data/workbook mapping modal should use the compact Preview/Sheets/Time/Places/Relations/Evidence/Review workflow, combined workbook sheet-column selectors, neutral Review warnings, and opacity-only step transitions.
- Peridot should treat uploaded correspondence data as database records first and visualization inputs second.
- Rows can be accepted when they contain either source/target names or source/target place information; coordinates and parseable dates are capability-enabling fields, not upload-admission requirements.
- Peridot should not clean, standardize, merge, or enforce controlled vocabularies for uploaded names, places, dates, topics, relationships, languages, titles, notes, or links. Users are responsible for standardization outside the app.
- Arbitrary CSV/TSV imports should use an explicit user-confirmed column-mapping workflow rather than silent guessing.
- Core correspondence-compatible Peridot variables remain supported for route/network workflows, but the upload mapping UI should present field roles rather than asking users to conform to correspondence-only “Peridot variables.”
- Peridot should support broader humanistic datasets through role-based mapping for record identity, time, places, relationships, evidence/analysis, and capability review.
- Point/site datasets with one mapped location should be valid Place Map datasets even when they have no People Network or Force-Directed network readiness.
- People Network and Force-Directed views should remain unavailable or empty for datasets that do not map source-target entity relationships; that is correct behavior, not a failed import.
- Coordinate pairs should be interpreted as latitude first, longitude second, including `POINT(latitude longitude)` strings.
- Route datasets should support separated source/target latitude-longitude fields and combined source/target coordinate-pair fields.
- Date handling should distinguish single date, date start, date end, and display date roles. Display dates are human-readable labels and may represent a single date or a composed range.
- Other uploaded columns should be preserved as optional evidence/analysis metadata, with user-selected fields available for Inspector and suitable Analytics visualizations.
- Workbook parsing is now connected to a workbook-aware import path for CSV, TSV, XLSX, and XLS.
- Multi-sheet workbook imports should use user-configured unique-ID joins. Header names for ID columns do not have to match, and row-order joining should not be used as the primary strategy.
- Users may select custom Inspector/Analytics fields from primary and joined workbook sheets.
- Person/place profile views should aggregate linked-record information and display related people, related places, directed routes, date spans, linked letters, and selected uploaded fields where available.
- Linked letters should open as dedicated Inspector detail views rather than long inline expansions.
- Peridot’s primary interface direction is now workspace-first rather than side-panel-first.
- The hamburger menu is now product-task oriented: Manage Your Data, Visualize Your Data, Explore Your Data, and Learn More about Peridot.
- Explore Your Data routes directly to Advanced Search; Inspector remains available through visualization/evidence workflows and compatibility paths rather than as a standalone top-level hamburger destination.
- Export should be an in-place visualization header action rather than a standalone top-level workspace.
- Chart Visualizations should use a dedicated large workspace with controls on the left and the chart canvas on the right.
- Chart Visualizations should use a tabbed builder when that avoids a long cramped control rail; the current accepted tab set is **Chart type**, **X/Y variables**, **Visible categories**, and **Presentation**.
- Timeline is now implemented as a bottom Visualizations scrubber; future timeline work should refine this integration rather than reviving a standalone timeline workspace.
- Map legend and controls should start minimized to preserve visualization workspace area.
- Learn More about Peridot is a public project-information hub for creator context, project resources, AI-method disclosures, tutorials, and help content. Keep detailed onboarding there rather than rebuilding it into the minimal Home workspace.
- Themes and Accessibility is the appearance/settings hub; future accessibility controls should live there.
- Themes and Accessibility is currently hidden from the public hamburger menu because it remains more useful for development than for ordinary users. Keep the workspace, route mode, and component intact so the menu entry can be restored later.
- The hamburger-triggered labeled menu is the intended primary navigation surface; the old persistent icon rail is legacy/compatibility code unless explicitly revived.
- Home, Data, Visualizations, Advanced Search, and Learn More are the primary public full workspaces; Themes and Accessibility remains an internal/development-facing full workspace; Export is integrated into the Visualizations header.
- Timeline should not be promoted to a standalone full workspace; the preferred future direction is a bottom timeline/scrubber integrated with Visualizations.
- Inspector is now dual-mode: visualization clicks open compact side-panel summaries, while hamburger **Inspector**, compact **Expand**, compact summary buttons, and linked-data clicks open the full Inspector workspace.
- Compact and full Inspector modes must share one selection state and multi-step Back history.
- Linked-letter detail pages are part of shared Inspector state/history, not a local-only subview.
- Compact summary tiles should remain at-a-glance affordances that open the full workspace for deeper reading.
- Directed route rows should open route/edge Inspector dossiers and participate in Back history.
- Analytics is conceptually part of Visualizations, not an independent side-panel-first workflow.
- The ordinary legacy Geography / Raw Data / Person Metadata three-file workflow is superseded by the one-file template upload and mapped arbitrary-table import workflows; do not reintroduce it unless a specific recovery or compatibility need is identified.
- Capability-aware visualization menus should explain unavailable views instead of showing empty workspaces when the active dataset cannot support a selected visualization.
- Chart Visualizations should list chart types directly, and each chart should expose relevant variable controls rather than routing users to one broad Analytics choice.
- Record count is a chart metric, not an implicit hidden default; it should be selectable where aggregate charts use record aggregation.
- Generic chart/evidence records should be accepted into the active dataset when they contain useful temporal, numeric, categorical, citation, link, note, or selected metadata content, even when they are not map-ready or network-ready.
- Evidence and analysis field inclusion should use explicit Include and Ignore choices, defaulting to Include, so users understand what metadata will be preserved for Inspector, charts, search, and export.
- Color changes should flow through `peridotTheme.js`, `peridotThemeRoleMetadata.js`, and semantic role targets whenever possible. Component-local hardcoded colors should be treated as compatibility exceptions or temporary defects to centralize later.
- Theme palette import should remain role-targeted so users can apply a detected palette to the whole app or to narrower scopes such as charts, map/network, navigation, timeline, search, Inspector/search, or text/borders.
- The finite Analytics chart color library should remain a curated 30-color default with greens/golds dominant and blues/pinks reserved for supporting contrast. Arbitrary imported palettes should replace chart series colors only when the user explicitly applies a palette to **Charts** or the whole app.
- Chart-targeted palette imports should be scoped to Analytics series colors. They should not recolor headers, timeline, map controls, search, hamburger menu, or other non-chart chrome.
- Visualization header and Timeline collapse/expand controls should stay as high-layer ornamental edge controls. They must remain in front of visualization layers and communicate expansion direction pictorially rather than relying on large text labels.
- Dropdowns and palette/control menus that open over the chart/map stage must be layered above visualization surfaces; treat dropdown portal/z-index regressions as visual bugs, not cosmetic preferences.
- Planning and audit documents from color/theming work belong in `planning_documents/` and should stay tracked there when they describe active design decisions or implementation constraints.
- The palette-system commits from `034ec67` through `81dd7af` establish the current theme-editing direction: central palette values, semantic roles, role dashboards, image palette import by theme area, foundation-tone routing, darkest/lightest role anchoring, built-in Peridot presets, and upload-guide/dropdown-layering behavior.
- Chart date axes should default to **Year** because most historical users care primarily about yearly patterns; **Full date** should remain available when month/day specificity matters.
- Partial dates should follow chart settings: month/day should not affect a Year chart, while Full date charts should use the most specific parseable date label available.
- Chart users should be able to manually choose the people, places, routes, categories, or comparable values they want to visualize instead of relying only on automatic Top N.
- Compatible chart settings should persist across chart-type switches where possible, especially date windows, selected fields, selected manual categories, selection mode, comparison-total mode, and display limits.
- Chart summary/legend panels should make key values visible persistently rather than hiding them only in hover tooltips; panels should be included in SVG/PNG chart export.
- Chart legends should faithfully represent every displayed series/category/slice/cell group rather than folding visible items into a generic “x more” label.
- Axis-based charts should use readable major and minor ticks/gridlines with adequate contrast against the parchment chart surface.
- Chart colors should come from the finite Peridot chart color library by default and from active semantic chart-series roles when the user explicitly applies a chart palette; do not scatter one-off chart series colors through chart renderers.
- Map and visualization chrome colors should be routed through semantic theme roles where possible.
- Peridot’s logo assets should live in `assets/`; solid-background variants are used for documentation/reference display, and transparent variants are used by the Home workspace hero.
- The Home workspace should remain an informative-minimalist title-card surface: a large Peridot logo, one concise description sentence, and two CTAs (**Use sample data** and **Upload your data**). Detailed onboarding belongs in **Learn More about Peridot**.
- Home title-card composition should scale as one fixed-ratio stage. The logo and text/buttons are primary content; filigree is decorative framing anchored outside adjacent content and must not overlap the logo, sentence, or buttons.
- The Home text hierarchy should remain: **PERIDOT** wordmark largest, “Your go-to…” sentence second, button labels smallest.
- The selected homepage filigree comes from licensed Adobe Stock assets. Keep attribution/asset origin clear in documentation and avoid treating the full filigree set as open-source original artwork.
- Map PNG export defaults to map-only output with no Peridot branding. Optional export title appears above the map image; optional metadata appears below it. This supports researchers using exports in presentations without unnecessary branding or whitespace.
- Map PNG export should use Peridot’s in-app typography and readable text sizes for presentation legibility.
- Capability wording should use plain availability language: unavailable visualization types are **not available** for the dataset, not merely “limited.” User-facing capability cards should avoid internal diagnostics language.
- Staged workspace animations are acceptable when they orient the user without blocking work; the current visual direction uses subtle entrance choreography and a solid dark-green visualization transition rather than text-heavy loading states.
- Force-Directed Network initial framing should privilege the densest information cluster / strongest node neighborhood rather than always fitting the whole network evenly.
- Chart-builder and Inspector visual language now distinguish primary commands, related-object navigation, evidence/information cards, and passive metadata. Gold should not be used indiscriminately for every clickable object.
- The full Inspector should behave like a scholarly reference entry rather than a dashboard stack: a compact lead summary, optional image/placeholder, connected people/places, directed connections, selected fields, and connected-record tables.
- The full Inspector overlays the existing Visualizations workspace without remounting the map/network/chart surface; closing the Inspector should feel like setting a reference book aside rather than reloading the desk underneath.
- `Unknown` is treated as a first-class place-like bucket, parallel to unresolved person/entity values such as `Illegible`, so missing/unresolved place values are preserved, counted, and inspected rather than silently dropped.
- Connected-record tables should be capability-aware: relational datasets show source entity, target entity, source location, and target location; point-only datasets show entity and location. This table-specific distinction should not force the relationship-summary sections to drop their source/target role logic.
- Connected-record tables should support date-first chronological defaults, sorting, filtering, 10/25/50 page sizes, and pagination so high-volume dossiers remain usable.


- Learn More about Peridot is now a public project-information hub rather than a placeholder. It should keep compact reading as the default, retain expandable creator and disclosure prose, preserve access to open-source project resources, and keep tutorials/help material separate from the minimal Home workspace.
- Learn More dividers reuse the restrained Inspector/Explore filigree treatment. They belong in dedicated dark-green intervals between major horizontal chunks, not inside cards or between the creator and GitHub cards. Their entrance order is divider → following section, so the page reads vertically rather than resolving all elements at once.
- The Learn More expanded biography may grow while the GitHub resource card contracts. The portrait belongs to the biography’s reading flow and should allow prose to wrap alongside it and continue beneath it.
- A small shared-style change must preserve the accepted behavior of unrelated current rules. For example, a Learn More parchment-color adjustment must not reintroduce an earlier portrait crop or remove the expanded biography’s text-flow rules.

- Component-specific CSS is now extracted into dedicated stylesheets for Inspector, Analytics, Search, Mapping, and Learn More. `index.css` remains a shared/global contract, and `main.jsx` import order is treated as functional cascade behavior.
- CSS extraction, dead-rule cleanup, visual redesign, and functional repairs are separate bounded passes. Never remove or rewrite suspect component styles merely because a selector appears unused until the extraction has been visually verified.
- Search has a deferred coverage/scope audit: verify loaded dataset versus applied result set versus the records/counts displayed by Browse, Results, Refine, facets, pagination, capability filters, structured criteria, and Inspector handoff.
- Timeline playback has a deferred Analytics audit: verify timeline range/playback scope against chart input rows, chart-local date controls, rendering updates, titles/counts/legends, and export output.

---

</details>

## 8. Standard Handoff and Completion Template

Each implementation pass should end with:

- what changed;
- exact files changed;
- one acceptance test;
- whether the result is a checkpoint or commit;
- a uniquely versioned replacement bundle when files are being delivered;
- exact PowerShell extract/copy commands for that bundle;
- exact Git commands;
- known residual risks.

### Fresh-chat handoff

A new chat should begin with the confirmed source-of-truth folder, active branch, and current synchronized checkpoint from the most recent clean sync ritual. It should also receive the narrow current task, relevant current source files, and the applicable planning/contract documents. Each new conversation should begin by rereading the four core documents before any development work is done.

For core documentation work, provide all four core documents and `PERIDOT_CORE_DOCUMENTATION_GOVERNANCE_PROTOCOL.md` before edits begin.

### Documentation-pass completion addition

For core-documentation work, complete the Governance Protocol checklist before delivery: confirm checkpoint, ownership, preservation, navigation, and delivery conditions; record the documentation result in the Changelog; and do not silently delete historical or technical knowledge.
