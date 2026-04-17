# Changelog

This is a lightweight project change log for the Correspondence Visualizer app.

It is meant to track committed implementation passes at a practical level:

- commit hash
- one-sentence summary
- files changed
- whether the Maintainer's Guide should be updated
- whether later cleanup is warranted

---

## 2026-04-17

### `c3f856f` — Add maintainer guide and project workflow charter

**Summary**
Added `MAINTAINERS_GUIDE.md` and `PROJECT_WORKFLOW_CHARTER.md` at repo root.

**Files changed**
- `MAINTAINERS_GUIDE.md`
- `PROJECT_WORKFLOW_CHARTER.md`

**Maintainer's Guide update needed?**
- included in this commit

**Later cleanup warranted?**
- no immediate cleanup; this established the project documentation baseline

---

### `7742149` — Update README to reflect current app and workflow

**Summary**
Replaced the minimal README with a fuller project overview aligned to the current app and workflow docs.

**Files changed**
- `README.md`

**Maintainer's Guide update needed?**
- no

**Later cleanup warranted?**
- no immediate cleanup

---

### `02dcfc4` — Extract pure map layout helpers from App

**Summary**
Extracted a first bounded cluster of pure map/layout helpers out of `src/App.jsx`.

**Files changed**
- `src/App.jsx`
- `src/mapLayoutHelpers.js`

**Maintainer's Guide update needed?**
- yes

**Later cleanup warranted?**
- yes; proceed to map-stage boundary cleanup

---

### `181a63e` — Extract map stage components from App

**Summary**
Extracted map-stage-adjacent UI/chrome components out of `src/App.jsx`.

**Files changed**
- `src/App.jsx`
- `src/mapStageComponents.jsx`

**Maintainer's Guide update needed?**
- yes

**Later cleanup warranted?**
- yes; continue Step 1C interaction-boundary work

---

### `30e5b1b` — Extract interaction resolution helpers from App

**Summary**
Extracted pure interaction-resolution helpers out of `src/App.jsx`.

**Files changed**
- `src/App.jsx`
- `src/interactionHelpers.js`

**Maintainer's Guide update needed?**
- yes

**Later cleanup warranted?**
- yes; continue top-level interaction-handler extraction

---

### `145cfc2` — Extract map interaction handlers from App

**Summary**
Extracted top-level map interaction handlers out of `src/App.jsx`.

**Files changed**
- `src/App.jsx`
- `src/mapInteractionHandlers.js`

**Maintainer's Guide update needed?**
- yes

**Later cleanup warranted?**
- yes; Step 1 is complete for this phase, next priorities are timeline/playback and export
