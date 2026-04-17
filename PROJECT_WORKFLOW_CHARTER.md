# Project Workflow Charter

## Purpose

This document defines how changes should be made to the correspondence visualizer app.

Its purpose is to reduce risk, prevent version drift, keep source-of-truth discipline, and make changes easier to review and maintain.

This charter should be consulted before every implementation pass.

---

## 1. Source-of-truth rule

At the start of any pass, establish one authoritative source of truth.

During active editing, the source of truth must be exactly one of the following:

- one specific local project folder
- one specific pasted/exported file

GitHub, canvas copies, temporary zips, and other artifacts may be references, but they must not be treated as co-equal authoritative sources during the same pass unless that divergence is explicitly acknowledged.

---

## 2. Alignment rule before starting a new pass

Do not begin a new implementation pass until the current relationship among these is known:

- local folder
- GitHub repository
- pasted/exported file
- temporary delivered artifact

They must be either:

- confirmed aligned, or
- explicitly acknowledged as intentionally divergent

---

## 3. Bounded-pass template

Every coding pass must begin with a bounded-pass definition that states:

- **change type**: behavior, visual, structural, or documentation
- **goal**
- **in-scope files/regions**
- **out-of-scope files/regions**
- **one plain-language acceptance test**
- **expected artifact**: targeted patch, replacement block, full file, zip, or commit-ready instructions

This is mandatory.

---

## 4. Change-type separation rule

Do not casually mix the following in one pass:

- behavior changes
- visual changes
- structural refactors
- documentation updates

If a pass truly must combine them, that combination should be explicit and justified.

Default behavior is one change type per pass.

---

## 5. Fragile-zones preflight rule

Before touching a fragile zone, explicitly state:

- which fragile zone is affected
- what might break
- what is intentionally not being touched
- how the result will be verified afterward

Known fragile zones include:

- viewport centering/reset
- dense-map hover/click interaction
- selection persistence across filters
- inspector-open interactions
- playback/timeline state
- export rendering

---

## 6. Refactor threshold rule

If a requested change can be completed safely with local edits, do that.

If the change would require touching more than one fragile subsystem, do not let it silently expand into a rewrite. Convert it into a planned structural pass instead.

---

## 7. Tooling and dependency freeze rule

Unless a pass is explicitly about tooling or architecture, do not introduce:

- package upgrades
- config rewrites
- lint/format churn
- file renames
- folder moves

These changes create noise and increase risk when mixed into normal feature work.

---

## 8. Delivery-mode rule

Use the smallest safe delivery format.

- **small local edit** → targeted patch instructions
- **medium bounded area** → replacement block with anchors
- **high-risk or unstable file** → full-file replacement from the current source of truth

The delivery mode should match the risk level, not convenience.

---

## 9. Acceptance-test rule

Every bounded pass must end with one explicit plain-language acceptance test.

Examples:

- "Selecting a node still opens the inspector without resetting the viewport."
- "Changing the theme preset updates panel styling without affecting map interaction."

If the acceptance test cannot be clearly stated, the pass is probably too vague.

---

## 10. Checkpoint vs commit rule

Use these terms precisely.

### Checkpoint

A **checkpoint** is a tested intermediate state that may still be revised soon.

### Commit

A **commit** is a coherent completed pass with one clear behavioral, visual, structural, or documentation outcome.

Do not blur the distinction.

---

## 11. Standard delivery format rule

Every implementation pass should end with the following information:

- what changed
- exact files changed
- one acceptance test
- whether this should be a checkpoint or commit
- exact Git commands
- exact copy commands if files are being moved into the source-of-truth folder
- any known residual risks

This standard format should be used consistently.

---

## 12. Post-change synchronization rule

After every checkpoint or commit, run the project synchronization ritual and inspect the source-of-truth folder state before starting the next pass.

The purpose is to reduce drift between:

- local folder
- repository state
- delivered files
- remembered assumptions

---

## 13. Recovery protocol

If the app becomes unstable, the file becomes structurally unclear, or conflicting sources of truth appear, use this recovery protocol:

1. stop further edits
2. identify the current source of truth
3. restore the last known good checkpoint or commit
4. restate the immediate goal in one sentence
5. make one bounded fix only
6. rerun the acceptance test

Do not improvise a large rescue rewrite under pressure.

---

## 14. Lightweight change log rule

Maintain a change log outside memory that records:

- commit hash
- one-sentence summary
- files changed
- whether the Maintainer's Guide needs updating
- whether a later cleanup pass is warranted

This keeps project history practical without overloading memory.

---

## 15. Decision-record rule

For non-obvious implementation choices, record:

- what was chosen
- what alternative was rejected
- why

This is especially important for stability-driven decisions that future maintainers might otherwise undo unintentionally.

---

## 16. Modularization roadmap rule

Maintain a roadmap for eventual `src/App.jsx` decomposition, but do not execute it casually.

Preferred extraction order:

1. pure data helpers
2. export helpers
3. theme/constants
4. small reusable UI pieces
5. map interaction helpers
6. left/right panel components
7. app orchestration last

This roadmap is for planned structural work, not casual opportunistic cleanup.

---

## 17. Relationship to the Maintainer's Guide

This charter defines how work should be done.

`MAINTAINERS_GUIDE.md` defines what the app is, how it is structured, and where the main maintenance risks are.

The two documents should remain aligned.

---

## 18. Working principle

If a requested change is small, keep it small.

If a requested change reveals deeper structural needs, name that explicitly and convert it into a planned pass rather than letting it sprawl.

Safe progress is better than fast but destabilizing progress.
