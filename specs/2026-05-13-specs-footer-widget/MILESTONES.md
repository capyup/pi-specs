# Milestones: Specs footer widget

Free-form implementation log. Record meaningful phase changes, successful milestones, failed attempts, setbacks, fixes, validation notes, and decisions. Use third-level headings with timestamps down to seconds, for example `### 2026-05-13 14:16:36 - Short milestone title`. No strict schema is required.


### 2026-05-13 17:34:11 - Milestone

Started the specs footer widget feature from the user request to reference `/Users/lucas/Developer/pi-goal` and implement the same lower footer widget behavior in `pi-specs`. Created the focused spec directory before source research.

### 2026-05-13 17:45:05 - Milestone

Completed initial research and spec drafting. Inspected `pi-goal` widget/status implementation, pi TUI docs for `setStatus`/`setWidget`, then wrote `PRODUCT.md`, `TECH.md`, and a purpose-named research report for the specs footer widget feature.

### 2026-05-13 18:04:02 - Milestone

Implemented the specs footer/widget UI. Added `extensions/widgets/spec-widget.ts` with a pure renderer, footer status formatter, and component wrapper; wired `extensions/pi-specs.ts` to set/clear `ctx.ui.setStatus("specs", ...)` and `ctx.ui.setWidget("specs", ..., { placement: "aboveEditor" })` on session lifecycle and relevant spec mutations; documented the behavior in `README.md`; added widget renderer tests. Validation passed with `npm test` and `npm run test:smoke`.

### 2026-05-13 20:11:00 - Milestone

Refactored the spec footer/widget UX from a verbose tree layout to a compact two-line format based on user feedback.

- Removed artifact badges (P✓ T✓ M✓ R1) and spec count suffix (+N specs) from the widget heading.
- Introduced `derivePhase()` that maps artifact presence + registry status to a user-friendly phase: scaffold → product → design → build → test → review → audit → done.
- Widget line 1: `{icon} {id} {status} → {phase}` — id is the primary identifier, status and phase give immediate context.
- Widget line 2: latest milestone from MILESTONES.md (`### YYYY-MM-DD HH:mm:ss - Title`) showing date and title.
- Footer status simplified to `specs: {id} · {status} · {phase}`.
- Added `readLatestMilestone()` in `extensions/pi-specs.ts` to parse the most recent milestone heading.
- Updated all widget tests to cover the new phase derivation and two-line layout. All 12 tests pass; smoke test passes.

### 2026-05-13 20:28:00 - Milestone

Restored tree structure and multi-milestone display after UX review: the compact two-line layout lost the decorative branch lines (├─ └─) and the "Spec" heading, and showed only one milestone.

- Restored `heading()` with `◆ Spec {label}` left side and `{status} → {phase}` right side.
- Restored `branchLine()` with `├─` / `└─` prefixes for all body lines.
- Changed `readLatestMilestone()` to `readLatestMilestones()` returning up to 3 recent entries.
- Body layout: `├─ {id} · {status} → {phase}` followed by milestone lines.
- Kept the removal of P/T/M/R artifact badges and `+N specs` suffix from heading.
- Updated tests for tree shape and multiple milestones. All 12 tests pass; smoke test passes.

### 2026-05-13 20:55:00 - Milestone

Fixed spec_append_milestone promptGuidelines after user called out that the agent was directly editing MILESTONES.md instead of using the registered tool.

- Problem: the agent repeatedly used `edit` to modify MILESTONES.md directly, bypassing `spec_append_milestone`. This exposed that the tool's promptGuidelines were too passive ("Use... after...") and did not explicitly prohibit direct file edits.
- Fix: changed promptGuidelines from "Use spec_append_milestone after..." to "When a focused spec exists, ALWAYS use spec_append_milestone... Do NOT directly edit or write MILESTONES.md." Also added explicit triggers: code changes, design decisions, test adjustments, completed phases, failed attempts, setbacks, fixes, validation notes, or user-steering pivots.
- Validation: tests pass (12/12). The agent itself (this entry) still cannot invoke the tool in this context and is appending manually as a transitional record — future sessions should follow the updated guideline.

### 2026-05-13 20:45:00 - Milestone

Final UX polish after live preview: heading alignment, milestone ordering, and latest-first display.

- Removed `heading()` right-alignment for the first line; everything is now left-aligned as `◆ Spec {id} · {status} → {phase}`.
- Unfocused heading also left-aligned: `◇ Specs unfocused · 4 specs`.
- Reversed milestone order so the newest entry is at the top of the tree (line 2), with older entries below.
- Milestones capped at 3 entries (unchanged from previous limit).
- Updated tests for left-aligned heading and reversed milestone order. All 12 tests pass; smoke test passes.

### 2026-05-13 20:35:00 - Milestone

Fixed widget layout duplication and milestone display after live preview feedback.

- Merged heading and id line into one: `◆ Spec` on the left, `{id} · {status} → {phase}` on the right. Removed the duplicate `├─ {id} · {status} → {phase}` body line.
- Changed milestone parsing to extract the first non-empty paragraph under each `###` heading as `summary` (up to 120 chars), instead of using the always-identical "Milestone" title.
- Updated `readLatestMilestones()` in `extensions/pi-specs.ts` to split by `###` blocks and extract body text.
- Widget body now shows `date – {actual summary text}` for each milestone.
- Updated tests for new merged heading and summary-based milestones. All 12 tests pass; smoke test passes.

### 2026-05-13 18:29:25 - Milestone

Added milestone count, research report count, and spec age badges to the widget heading right side.

- `readLatestMilestones()` now returns `{ items, total }` so the widget can display total milestone count (M) separately from the displayed items.
- Added `specAgeDays()` in `extensions/pi-specs.ts` that parses the date prefix from the spec id (e.g. `2026-05-13-...`) and computes days elapsed.
- Widget `statBadge()` renders `M{total} R{reports} D{days}` on the heading right side using the existing `heading()` spacer alignment.
- Type `SpecWidgetRecord` extended with `milestonesTotal?: number` and `ageDays?: number`.
- `specFooterStatus` unchanged — it stays compact without badges.
- All 12 tests pass; smoke test passes.

### 2026-05-13 18:31:31 - Milestone

Replaced the static `M R D` age badge with a dynamic elapsed-time counter on the widget heading right side.

- `D0` (static days) replaced by `0DAY 00:00:00` format computed live from `Date.now() - createdTimestamp` during each render.
- `createdTimestamp` is parsed from the spec id date prefix (e.g. `2026-05-13-...`) and stored in `SpecWidgetRecord`.
- `formatElapsed()` produces `0DAY 12:30:45` style output with days, hours, minutes, seconds.
- Because elapsed time is calculated inside `renderSpecWidgetLines()` using `Date.now()`, the counter updates every time the TUI redraws — no polling or timers needed.
- The `M` and `R` counts remain on the right side: `M4 R1 0DAY 00:00:00`.
- Added `options.now` override to `renderSpecWidgetLines()` for deterministic testing.
- Tests updated: 13/13 pass; smoke test passes.

### 2026-05-13 18:35:46 - Milestone

Removed M/R stat badges from widget heading and added live 1-second timer refresh for elapsed time display.

- Dropped milestone count (M) and research report count (R) from the heading right side — user confirmed these are unnecessary noise.
- Heading right side now shows only the live elapsed timer: `0DAY 12:30:45` format.
- Implemented `setInterval` refresh pattern matching pi-goal: a 1-second interval calls `specWidgetComponent?.update()` → `tui.requestRender()` so the time counter ticks every second in the TUI.
- Added `startStatusRefresh()` and `stopStatusRefresh()` helpers in `extensions/pi-specs.ts`; timer starts when a focused spec exists and stops on session shutdown or when the spec is cleared.
- Used `timer.unref?.()` so the interval does not prevent Node process exit.
- Tests updated: 13/13 pass; smoke test passes.

### 2026-05-13 18:38:15 - Milestone

Removed the `→ phase` arrow from the widget heading. The heading now shows only the raw status (draft, completed, etc.) without deriving or displaying the next-step phase.

- `derivePhase()` is kept internally for `specFooterStatus` and potential future use, but no longer rendered in the widget.
- Heading format is now: `◆ Spec {id} · {status}` with elapsed timer on the right.
- Updated tests to assert the absence of `→` in heading lines. 13/13 tests pass.

### 2026-05-13 18:40:01 - Milestone

Simplified status vocabulary and removed hardcoded state machine logic from the widget/footer.

- Reduced `STATUS_VOCABULARY` from 8 entries to 4: draft, implementing, audit_running, completed. Removed ready_for_review, validating, audit_failed, archived.
- Deleted `derivePhase()` entirely — the function that mapped status+artifacts to a derived phase (design, build, test, etc.).
- `specFooterStatus` now returns `specs: {id} · {status}` without any phase suffix.
- `displayIconAndColor()` simplified to only map icon/color for the 4 remaining statuses; label mapping removed since the heading already shows raw `spec.status`.
- `SPECS.yaml` `status_vocabulary` updated to match.
- No state-transition validation added; agents remain free to set any status value without enforcement. This is intentionally not advertised in tool prompts.
- 12/12 tests pass; smoke test passes.
