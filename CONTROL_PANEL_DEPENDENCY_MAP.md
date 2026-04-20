# Control Panel Dependency Map

## Purpose

This document maps the left control panel architecture in the current committed app state.

It is a **maintainer-facing audit document**, not a refactor plan by itself. It exists to explain:

- where the control panel opens
- what code path renders it
- which props, helpers, and state values it depends on
- why it has been fragile to extract or restructure
- what is safer or less safe to change in future passes

This document is based on the current committed source-of-truth state after the control-panel architecture comments were added to `src/App.jsx`.

---

## Scope

This document covers the **left control panel render path**, especially the subtree opened by the cog button.

It does **not** cover:

- the right inspector panel
- map rendering internals except where the control panel depends on them indirectly
- export behavior debugging itself
- timeline playback semantics themselves
- implementation changes

---

## High-level architecture map

The control panel currently works as a layered render path:

1. **Top-level app state in `App.jsx`**
2. **Prop assembly in `buildLeftControlPanelProps(...)`**
3. **Panel shell in `LeftControlPanel(...)`**
4. **Panel group wrappers**
   - `DataInputsGroup(...)`
   - `DisplayFilteringGroup(...)`
5. **Section components rendered inside the panel**
   - summary
   - display controls
   - timeline/playback
   - theme/appearance
   - export

This is important because the panel does **not** fail at app boot. It fails only when that subtree actually mounts and renders.

---

## Render path in detail

## 1. Open / close state

The control panel depends first on the top-level sidebar visibility state in `App.jsx`.

Relevant responsibility:
- `showLeftSidebar` determines whether the main panel subtree mounts
- the cog/left-sidebar toggle changes that state
- if `showLeftSidebar` is false, much of the panel code path is dormant

### Why this matters
This delayed mounting explains the repeated white-screen failure pattern:
- app loads
- map renders
- failure only appears after the panel is opened

That means a bug can live in the panel subtree without affecting initial app load.

---

## 2. Prop contract assembly

`buildLeftControlPanelProps(...)` is the most important contract point for the control panel.

It assembles grouped dependency bundles such as:
- `sidebarState`
- `dataInputState`
- `displayState`
- `timelineState`
- `themeState`
- `exportState`

### Why this matters
This function is the narrowest single place where the panel's dependency surface becomes explicit.

It is also a high-risk location because:
- many values are forwarded through it
- missing one value may not break initial app load
- but it can break when a specific panel section actually renders

### Practical maintainer rule
If a future panel extraction or refactor fails, inspect this prop assembler first.

---

## 3. `LeftControlPanel(...)`

`LeftControlPanel` is the shell component for the left-side controls.

It is responsible for:
- rendering the sidebar toggle
- deciding whether the full panel subtree renders
- mounting the inner panel structure only when open

### Dependency type
`LeftControlPanel` is not just decorative. It is a **render gate**.

### Why this matters
Any child subtree bug can stay hidden until `LeftControlPanel` renders the panel contents.

That is one reason the same failure can happen across unrelated-looking subsystems like timeline and export.

---

## 4. First-level inner groups

After the shell opens, the panel splits into two major group wrappers:

### `DataInputsGroup(...)`
This area is comparatively straightforward.

Typical dependency types:
- file input labels
- upload handlers
- dataset status information

### `DisplayFilteringGroup(...)`
This is the dense dependency hub.

It forwards into:
- summary content
- display controls
- timeline/playback content
- theme/appearance content
- export content

### Why this matters
`DisplayFilteringGroup` is not just a visual grouping component. It is a **dependency distribution hub**.

That makes it a fragile extraction target.

---

## 5. Section-level dependencies

## Summary section
Usually lower-risk.
Depends on:
- derived counts
- view-mode/state summaries
- display-only stats

## Display controls section
Moderate risk.
Depends on:
- view mode
- search
- label toggles
- thresholds
- panel-open booleans for display-related sections

## Timeline/playback section
Higher risk.
Depends on:
- timeline boundary state
- playback state
- playback handlers
- current range labeling
- helper components such as `StepSlider`
- shared collapsible panel behavior

This area has already proved fragile in Step 2C attempts.

## Theme/appearance section
Moderate risk.
Depends on:
- theme preset application
- reset theme behavior
- current visual settings state

## Export section
Higher risk than it looks.
Depends on:
- export status metadata
- export action handlers
- current graph/filter state
- shared button helpers
- collapsible panel helpers

This area has already shown the same white-screen failure pattern when extracted.

---

## Shared helper dependencies

The control panel relies on several helpers that may appear “generic” but are actually critical dependencies.

### `CollapsiblePanelSection`
Used to structure individual sections inside the panel.

### `buttonClassName`
Shared UI helper used by multiple panel sections.

### `StepSlider`
Used by timeline/playback controls.

### Why these matter
When a panel section is moved out of `App.jsx`, it may still implicitly depend on these helpers existing in local scope or being passed correctly.

If one is omitted, renamed, or passed incorrectly, the app may only fail when that section is rendered.

---

## Dependency categories

The control panel currently mixes several kinds of dependency:

### Pure / display-only
Examples:
- labels
- counts
- derived read-only summaries

These are generally safer.

### Shared UI dependency
Examples:
- `CollapsiblePanelSection`
- `buttonClassName`
- `StepSlider`

These look reusable, but they still create coupling.

### Stateful but explicit
Examples:
- booleans for panel visibility
- search text
- threshold values
- view-mode values

These are safer if clearly bundled and consistently named.

### Stateful and implicit
Examples:
- callbacks or setters assumed to exist because they used to live in parent scope
- handler ownership that is not clearly documented

These are dangerous.

### Render-time fragile
Examples:
- dependencies only exercised when the panel actually opens
- sections that assume full parent lexical context
- sections whose props are wide and easy to mismatch

These are the main cause of the white-screen failure pattern.

---

## Why the control panel is fragile

## Core reason
The panel is fragile because it has a **large dormant render-time dependency surface**.

That means:
- while closed, many bugs are invisible
- when opened, React mounts a subtree with many props and shared helpers
- if even one required dependency is missing or wrong, the failure appears late and looks abrupt

## Strong fragility signals observed in this project

### 1. High prop fan-out
Many values and handlers are forwarded into the panel through grouped prop bundles.

### 2. Conditional mounting
The subtree only mounts when the panel is opened, hiding errors until then.

### 3. Shared-helper coupling
Panel sections rely on shared helpers that must remain available across extraction boundaries.

### 4. Repeated failure across different subsystems
The same symptom appeared when changing:
- timeline/playback panel-adjacent code
- export panel extraction

This suggests the fragile boundary is the **panel render path itself**, not just one subsystem.

---

## Safe / unsafe extraction matrix

## Safer
These are still the best structural targets:

- pure helpers
- data/row builders
- math/layout functions
- serialization utilities
- small, clearly pure helper modules
- narrowly scoped prop-builder helpers when the contract is explicit

## Riskier than they look
These should not be treated as routine cleanup:

- subsystem panel extraction
- prop rebundling across panel boundaries
- moving handler ownership out of currently working panel-adjacent code
- extraction based only on visual separation rather than dependency separation

## Do not extract casually right now
These should be treated as deferred/high-risk:

- dense parts of `DisplayFilteringGroup`
- current timeline/playback render boundary
- current export panel render boundary
- anything whose correctness depends on an implicit parent-scope assumption

---

## What future maintainers should inspect first

Before any future control-panel refactor, inspect these in order:

1. `showLeftSidebar` and the panel-open render gate
2. `buildLeftControlPanelProps(...)`
3. `LeftControlPanel(...)`
4. `DisplayFilteringGroup(...)`
5. the exact prop contract of the targeted section
6. shared helper requirements:
   - `CollapsiblePanelSection`
   - `buttonClassName`
   - `StepSlider` where applicable

If a future extraction fails, the most likely causes are:
- missing prop
- helper not passed through
- prop name mismatch
- child component still assuming parent lexical scope

---

## Revised forward plan

## Immediate rule
Do not keep extracting control-panel sections casually.

## Safer future sequence
1. **Dependency mapping first**
2. **Purpose-driven change second**
3. **Only then consider structural cleanup**
4. **Extract a panel section only if its dependency surface is already shallow and explicit**

## What to prefer instead
For now, prefer:
- pure helper extraction
- pure utility extraction
- purpose-driven behavior fixes
- highly local edits inside already-working panel boundaries

## What to defer
Until a narrower purpose-driven reason exists, defer:
- deeper timeline/playback panel refactoring
- export panel extraction
- broad control-panel boundary rewiring

---

## Suggested next directions

The best next work is likely one of:

### Option A — purpose-driven timeline behavior pass
Examples:
- preserve current map position during timeline interaction
- prevent selecting an end date earlier than the selected start date

### Option B — purpose-driven export bug pass
Example:
- investigate why PNG export produces a blacked-out image

### Option C — broader planning pass
Use what is now known about fragile panel boundaries to revise the modularization roadmap.

---

## Summary

The control panel is not fragile because it is “just complicated.”
It is fragile because:

- it mounts conditionally
- it has a large render-time dependency surface
- it forwards many props and shared helpers
- some dependencies are more implicit than they first appear
- extraction attempts can succeed on pure helpers but fail on panel boundaries

The safe conclusion is:

> **Pure helper extraction remains the default safe move. Control-panel extraction should now be treated as an evidence-driven exception, not a default cleanup strategy.**
