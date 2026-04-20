# VIEWPORT_TIMELINE_AUDIT.md

## Purpose

This document investigates why timeline interactions can reset or disturb the user's current map zoom/pan position.

It is a **documentation / investigation pass only**. It proposes no code changes. Its purpose is to identify the likely reset trigger and define the safest fix path.

---

## Scope

In scope:

- map viewport state ownership
- timeline/playback state ownership
- the prop/state path between timeline/playback and the map stage
- reset/recenter behavior in the current implementation

Out of scope:

- code changes
- speculative refactors
- panel extraction
- export work

---

## 1. Viewport / timeline interaction architecture map

## A. Where viewport state lives

Viewport state is owned inside `SvgMap`:

- `const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });`

This means the actual zoom/pan position is **local to the map renderer**, not top-level app state.

### Relevant supporting values in `SvgMap`
- `defaultView` is derived with `buildDefaultMapView(nodes, width, height, clampScale)`
- `hasInitializedViewRef`
- `lastViewResetKeyRef`
- `lastViewportSizeRef`

These are used to determine when the current view should be initialized or re-centered.

---

## B. Where map reset logic lives

The most important reset logic is this effect inside `SvgMap`:

- if the map has not initialized yet, or
- if `lastViewResetKeyRef.current !== viewResetKey`

then:

- `setView(defaultView)`

This means the map will recenter whenever `viewResetKey` changes.

### Why this is critical
The current behavior is not caused by the timeline panel itself. It is caused by the fact that timeline/playback changes eventually change `viewResetKey`, and `SvgMap` treats that as authority to reapply `defaultView`.

---

## C. Where `viewResetKey` comes from

`App.jsx` computes:

- `graph`
- `filteredRowsByTime`
- `viewResetKey`

Current formula:

- layout key (`viewMode` and `personLayoutMode`)
- `filteredRowsByTime.length`
- `graph.nodes.length`
- `graph.edges.length`

So the reset key is tightly coupled to the **current filtered/playback-visible graph state**.

---

## D. Where timeline/playback affects graph state

The path is:

1. `timelineMonths`
2. `rangeStart` / `rangeEnd`
3. `selectedRowsForPlayback`
4. `playbackIndex`
5. `filteredRowsByTime`
6. `graph`
7. `viewResetKey`
8. `SvgMap` recenter effect

That is the key coupling chain.

---

## 2. Fragility analysis

The viewport reset problem is not an isolated bug. It is a structural coupling issue.

## Core fragility

The current implementation treats changes in the playback-filtered graph as if they were the same kind of change as:

- new dataset
- new layout
- new graph identity

But from the user's perspective, timeline playback is often an **animation or visibility progression inside the same current view**, not a request to recenter the camera.

That mismatch is the likely cause of the unwanted resets.

## Why it feels surprising to the user

The user is interacting with:

- play
- pause
- reset
- range controls

But the implementation is effectively saying:

> “If the visible graph size changes, recenter the map.”

That may make sense for some graph identity changes, but not for normal timeline interaction after the user has already navigated to a desired viewport.

## Known fragile zones involved

This issue sits exactly at the intersection of two already-known fragile zones:

- map viewport centering/reset behavior
- playback/timeline state coupling

---

## 3. Likely root-cause candidates, ranked

## Most likely: `viewResetKey` is too sensitive
Current probability: **very high**

Because `viewResetKey` includes:

- `filteredRowsByTime.length`
- `graph.nodes.length`
- `graph.edges.length`

any playback progression or reset that changes the visible graph shape can trigger a recenter.

This is the strongest candidate because it directly matches the current implementation and the observed symptom.

---

## Second likely: playback filtering changes graph identity too aggressively
Current probability: **high**

`filterRowsForPlayback(...)` returns:

- full base rows when `playbackIndex < 0`
- otherwise only rows whose IDs are in `playbackRows.slice(0, playbackIndex + 1)`

So the visible graph is not just “highlighted.” It is actively being rebuilt from a changing subset of rows during playback.

That means graph size and composition can change repeatedly as playback advances or resets.

This likely feeds directly into the sensitive `viewResetKey`.

---

## Third likely: `defaultView` is recomputed from changing nodes
Current probability: **moderate**

`defaultView` depends on `nodes`, `width`, and `height`.

Since graph nodes are derived from the currently filtered rows, playback changes can change the node set, which changes `defaultView`.

That by itself would not be enough to force a reset unless the recenter effect runs, but combined with `viewResetKey`, it likely produces the visible jump.

---

## Less likely: panel controls themselves are resetting the viewport
Current probability: **low**

The evidence points away from the control panel being the direct cause here.

The control panel may trigger state changes, but the likely viewport reset mechanism is still the `viewResetKey` / `defaultView` recenter path inside `SvgMap`.

---

## 4. Safe fix options, ranked by risk

## Option 1 — Decouple `viewResetKey` from playback progression
**Safest likely fix**

Idea:
- keep `viewResetKey` sensitive to true graph-identity changes
- stop making it sensitive to playbackIndex-driven graph growth/shrinkage

In practice, this likely means removing playback-driven graph-size churn from the reset key, while still allowing resets for real changes such as:
- view mode changes
- person layout mode changes
- major dataset/window changes

### Why this is promising
It directly targets the reset trigger without moving ownership boundaries or panel code.

### Main design question
What should count as a “real recenter-worthy change” versus a normal timeline interaction?

---

## Option 2 — Distinguish range changes from playback animation changes
**Moderate risk**

Idea:
- changing the selected date window may still justify a reset
- playback stepping within the current window should not

This would likely require a more explicit separation between:
- range/window graph identity
- playback animation progress

### Why this is good
It matches user expectations better.

### Why it is riskier
It may require more changes to how graph state is derived or interpreted.

---

## Option 3 — Preserve viewport once the user manually moves the map
**Moderate to higher risk**

Idea:
- once the user pans/zooms manually, playback actions should not override that view until the user explicitly requests reset

### Why this is attractive
It is highly user-centered.

### Why it is riskier
It requires introducing a notion of “user has taken control of viewport,” which adds more state and more behavioral rules.

---

## Option 4 — Stop rebuilding the visible graph during playback and use highlight-only animation
**Highest risk of the options**
Idea:
- keep the graph stable during playback
- animate/highlight progress without changing the structural graph used for layout/view

### Why this could solve the issue
If graph identity stops changing, the recenter trigger may disappear naturally.

### Why it is not the first choice
This is a broader behavioral/design change and likely touches more fragile logic than necessary.

---

## 5. Recommended implementation plan

## Recommended first fix
**Option 1: make `viewResetKey` insensitive to playback progression**

This is the narrowest and safest candidate because:

- it targets the observed reset trigger directly
- it stays away from the fragile control-panel boundary
- it does not require panel extraction
- it does not require moving handler ownership
- it does not require redesigning playback semantics

## Proposed bounded pass definition

**Change type:** behavior

**Goal:** preserve the user's current map viewport during timeline playback interactions by preventing playback-driven `viewResetKey` changes from forcing recentering

**In scope:**
- `viewResetKey` logic
- any closely related viewport-reset condition in `SvgMap`

**Out of scope:**
- panel code
- export code
- broader refactors
- timeline panel restructuring

**Acceptance test:**
1. the app runs
2. the control panel opens normally
3. the user can pan/zoom the map during playback
4. play / pause / playback progression do not recenter the map unexpectedly
5. explicit reset controls still reset the map when intended
6. true major layout changes (for example changing view mode) still allow recentering when appropriate

---

## 6. Practical warning before implementation

The likely fix is conceptually narrow, but it still touches a known fragile zone:

- viewport centering/reset behavior

So the implementation pass should be **small and singular**:
- no panel changes
- no timeline panel refactor
- no extraction
- only the reset-trigger logic

---

## 7. Summary

### Most likely cause
The map resets because timeline/playback changes feed into:

- `filteredRowsByTime`
- `graph`
- `viewResetKey`

and `SvgMap` uses `viewResetKey` to decide when to reapply `defaultView`.

### Best next move
Do one narrow behavior pass that changes **when** the map is allowed to recenter, without changing panel structure or playback UI.

### Recommended target
Make `viewResetKey` stop treating ordinary playback progression as a recenter-worthy graph identity change.
