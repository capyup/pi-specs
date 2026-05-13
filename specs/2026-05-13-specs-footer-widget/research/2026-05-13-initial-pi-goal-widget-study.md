# Research Report: Initial pi-goal widget study

Spec: `specs/2026-05-13-specs-footer-widget`
Phase: initial
Topic: Reference `/Users/lucas/Developer/pi-goal` footer/status widget behavior and port the same style into `pi-specs`.

## Purpose

Understand how `pi-goal` renders its persistent lower footer status and widget-style spec/goal beacon so `pi-specs` can implement the analogous focused-spec UI without guessing the pi TUI API.

## Method

- Inspected `/Users/lucas/Developer/pi-goal/extensions/widgets/goal-widget.ts`.
- Inspected `/Users/lucas/Developer/pi-goal/tests/goal-widget.test.ts`.
- Inspected `/Users/lucas/Developer/pi-goal/extensions/goal.ts` around `updateUI`, `setStatus`, and `setWidget`.
- Inspected `/Users/lucas/Developer/pi-goal/extensions/goal-core.ts` for compact status formatting helpers.
- Read pi TUI docs at `/Users/lucas/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/tui.md`, especially persistent status and widget patterns.

## Observations

- `pi-goal` uses two UI surfaces: a lower footer status via `ctx.ui.setStatus("goal", ...)` and a persistent widget via `ctx.ui.setWidget("goal", factory, { placement: "aboveEditor" })`.
- `GoalWidgetComponent` implements `Component` from `@earendil-works/pi-tui` and renders synchronously from closure-provided state.
- The widget renderer is pure/testable: `renderGoalWidgetLines(goal, theme, width, options)` returns width-safe lines using `truncateToWidth` and `visibleWidth`.
- `pi-goal` registers the widget once and updates it by calling `goalWidgetComponent?.update()`, which calls `tui.requestRender()`.
- `pi-goal` clears status/widget when there is no relevant state and handles unfocused-but-open goals with guidance.
- Pi docs confirm `ctx.ui.setStatus(key, text)` is the persistent footer/status bar API, while `ctx.ui.setWidget(key, linesOrFactory, { placement })` shows persistent content above or below the editor. `render()` lines must not exceed width.

## Conclusions

- `pi-specs` should implement a pure renderer plus component class like `pi-goal`, but with spec-specific display records derived from `SPECS.yaml` and artifact presence.
- The lower footer status should use `ctx.ui.setStatus("specs", ...)` so users always see the focused spec summary.
- A compact widget can use `ctx.ui.setWidget("specs", ..., { placement: "aboveEditor" })` matching `pi-goal`; if the user later specifically wants `belowEditor`, this can be adjusted, but the lower footer status already satisfies the footer requirement.
- The widget should refresh after spec tools mutate registry/spec artifacts and on session start.

## Impact on spec or plan

- Product behavior should include focused-spec footer status and widget visibility for focused and unfocused/open-spec states.
- Technical plan should add `extensions/widgets/spec-widget.ts`, tests for the pure renderer, and extension `updateSpecUI(ctx)` integration.
