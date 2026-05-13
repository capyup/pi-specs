# Product Spec: Specs footer widget

Issue: user request to reference `/Users/lucas/Developer/pi-goal` and implement the same lower footer/widget experience for `pi-specs`.

## Summary

`pi-specs` should show the current focused spec in pi's persistent footer/status UI and a compact widget-style beacon, modeled after `pi-goal`. The UI should make the active spec, lifecycle status, artifact readiness, and next action visible without requiring the user to run `/spec-status` repeatedly.

## Background Evidence

- Research report: `specs/2026-05-13-specs-footer-widget/research/2026-05-13-initial-pi-goal-widget-study.md`
- `pi-goal` uses `ctx.ui.setStatus("goal", ...)` for the lower footer status and `ctx.ui.setWidget("goal", ..., { placement: "aboveEditor" })` for the persistent goal beacon.
- Pi TUI docs confirm `ctx.ui.setStatus` is the persistent footer/status surface and `ctx.ui.setWidget` is the persistent widget surface above or below the editor.

## Behavior

1. When a session starts in a repository with a spec registry, `pi-specs` displays a persistent footer status entry under the key `specs`.
2. When exactly one spec is focused, the footer status shows the focused spec id, lifecycle status, and a compact title.
3. When a focused spec exists, a compact widget-style beacon shows the focused spec status, title, artifact readiness, and spec path.
4. The widget uses width-safe lines and truncates long titles/paths instead of overflowing the terminal.
5. The widget visually distinguishes completed specs, active/draft specs, validation/audit states, and blocked/problem states using theme colors/icons.
6. Artifact readiness includes at least `PRODUCT.md`, `TECH.md`, `MILESTONES.md`, and `research/` report count.
7. When no spec is focused but registered specs exist, the footer/widget explains that specs are unfocused and suggests using `spec_focus` or `/spec-status`/`/specs` flows to choose a spec.
8. When no spec registry or registered specs exist, `pi-specs` clears its footer status and widget rather than showing stale information.
9. When spec tools mutate focus, registry state, lifecycle status, milestones, settings, or scaffolded specs, the footer/widget refreshes in the same session.
10. The UI does not replace existing commands; `/spec-status` remains the detailed inspection surface.
11. The UI does not introduce a durable state database; it derives display state from `SPECS.yaml` and files under the focused spec directory.
12. The widget should follow `pi-goal`'s implementation style: a pure renderer covered by tests plus a small component wrapper that calls `tui.requestRender()` on update.
13. The implementation should avoid captured stale session context footguns by clearing the widget/status on session shutdown.

## Goals / Non-goals

- Goal: make focused spec status visible continuously in the footer/status area.
- Goal: provide a compact widget beacon similar to `pi-goal` for current spec context.
- Goal: show artifact readiness and research report presence at a glance.
- Goal: refresh after spec tool actions without requiring manual `/spec-status`.
- Non-goal: replace `SPECS.yaml` or add a new spec state store.
- Non-goal: implement full audit execution or completion policy changes.
- Non-goal: render large spec content in the widget.

## Success Criteria

1. Users can see the focused spec id/status in the footer after session start or a spec tool update.
2. Users can see a compact widget with title, artifact readiness, and path when a spec is focused.
3. Tests cover focused, completed, problem/unfocused, and width-safe rendering cases.
4. Existing spec commands and tools continue to pass tests.
