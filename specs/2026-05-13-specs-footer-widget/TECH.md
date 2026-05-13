# Tech Spec: Specs footer widget

Product spec: `specs/2026-05-13-specs-footer-widget/PRODUCT.md`

## Context

- `extensions/pi-specs.ts` currently owns all commands/tools and registry parsing/rendering for `SPECS.yaml`.
- `extensions/pi-specs.ts` already has `loadRegistry`, `resolveSpecTarget`, `artifactState`, and tool handlers that mutate registry or spec artifacts.
- `pi-goal` reference: `/Users/lucas/Developer/pi-goal/extensions/widgets/goal-widget.ts` implements a pure renderer plus `GoalWidgetComponent` wrapper.
- `pi-goal` reference: `/Users/lucas/Developer/pi-goal/extensions/goal.ts` registers a footer status with `ctx.ui.setStatus("goal", ...)` and a widget with `ctx.ui.setWidget("goal", factory, { placement: "aboveEditor" })`.
- Pi TUI docs at `/Users/lucas/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/tui.md` require widget render lines to fit the provided width and document `setStatus`/`setWidget` patterns.
- Existing tests are shape tests only in `test/package-shape.test.mjs`; this feature should add focused widget renderer tests.

## Proposed changes

### 1. Add spec widget renderer module

Create `extensions/widgets/spec-widget.ts`.

Exports:

- `SpecWidgetRecord` - display record for one focused spec.
- `SpecWidgetArtifactState` - booleans/counts for `PRODUCT.md`, `TECH.md`, `MILESTONES.md`, and `researchReports`.
- `renderSpecWidgetLines(spec, theme, width, options?)` - pure renderer.
- `SpecWidgetComponent` - `Component` wrapper with `update()` and `invalidate()` calling `tui.requestRender()`.
- `specFooterStatus(spec, options?)` - compact lower footer status string.

Display record shape:

```ts
export interface SpecWidgetRecord {
  id: string;
  title: string;
  status: string;
  focused: boolean;
  path: string;
  artifacts: {
    product: boolean;
    tech: boolean;
    milestones: boolean;
    researchReports: number;
  };
  lastAudit?: string | null;
}
```

Renderer behavior:

- No focused spec + zero registered specs returns `[]`.
- No focused spec + open specs returns an unfocused guidance widget.
- Focused spec heading uses status-aware icon/color:
  - `completed`: `✓` / success
  - `audit_failed`: `⊘` / warning or error
  - `audit_running` or `validating`: `◐` / warning
  - other draft/active states: `◆` or `●` / accent
- Body lines show title, artifacts, and path.
- Artifact text should be compact, e.g. `P✓ T• M✓ R2`, where missing optional `TECH.md` is visible but not necessarily an error.
- All lines must use `truncateToWidth`/`visibleWidth` like `pi-goal`.

### 2. Add UI state derivation in extension

In `extensions/pi-specs.ts`:

- Import `SpecWidgetComponent`, `specFooterStatus`, and `SpecWidgetRecord`.
- Import `readdir` is already present; add helper for research report count.
- Add `specWidgetComponent: SpecWidgetComponent | null` and `widgetRegistered` closure state in `piSpecsExtension`.
- Add `SPEC_WIDGET_KEY = "specs"`.
- Add `async specWidgetState(ctx.cwd)` that reads registry, focused spec, artifact state, and research report count.
- Add `async updateSpecUI(ctx)`:
  - Return early if `!ctx.hasUI`.
  - If no registry/specs, clear `ctx.ui.setStatus("specs", undefined)` and `ctx.ui.setWidget("specs", undefined)`.
  - If unfocused specs exist, set a footer like `specs: unfocused [N specs] - /spec-status` and widget guidance.
  - If focused spec exists, set footer via `specFooterStatus(record, { totalSpecs })` and register/update widget.
- Add `clearSpecWidget(ctx)` for `session_shutdown`.
- Register `pi.on("session_start", ...)` to call `updateSpecUI(ctx)`.
- Register `pi.on("session_shutdown", ...)` to clear status/widget.

### 3. Refresh after mutations

Call `await updateSpecUI(ctx)` after commands/tools that mutate or inspect relevant state enough that UI should refresh:

- `spec_scaffold`
- `spec_research`
- `spec_focus`
- `spec_unfocus`
- `spec_finish`
- `spec_append_milestone`
- `specs_settings_update` only if inexpensive; optional because it does not affect widget content
- `specs_list` / `spec_status` may call update for reconciliation, but it is not required.

When command handlers only send a skill message (`/specs*`), they do not need immediate refresh because the actual tool updates will refresh.

### 4. Research report count

Extend artifact state or add a sibling helper:

```ts
async function researchReportCount(specDir: string): Promise<number> {
  try {
    return (await readdir(join(specDir, "research"))).filter((entry) => entry.endsWith(".md")).length;
  } catch {
    return 0;
  }
}
```

Avoid recursive counting in the first version; one-level `research/*.md` is enough.

### 5. Tests

Add `test/spec-widget.test.mjs` using `node --test --experimental-strip-types` importing `extensions/widgets/spec-widget.ts`.

Test cases:

- focused draft spec renders heading/title/artifacts/path.
- completed spec uses completed heading/icon.
- unfocused registry renders guidance.
- long title/path lines do not exceed width by visible width.

Update `test/package-shape.test.mjs` to assert:

- `extensions/widgets/spec-widget.ts` is present.
- `extensions/pi-specs.ts` references `setStatus("specs"`, `setWidget("specs"`, `session_start`, and `session_shutdown`.
- README documents the footer/widget.

### 6. README updates

Document the new footer/widget behavior:

- focused spec appears in lower footer status.
- compact widget displays current focused spec, artifact readiness, research report count, and path.
- widget derives from `SPECS.yaml` and spec files; no new state database.

## Testing and validation

- Behavior #1/#2/#3: renderer tests verify focused status and widget lines.
- Behavior #4: renderer tests verify width safety.
- Behavior #6: renderer tests verify artifact readiness and research report count text.
- Behavior #7/#8: renderer tests verify unfocused/no-spec behavior.
- Behavior #9: package-shape tests verify mutation tools call or reference `updateSpecUI`.
- Behavior #13: package-shape tests verify `session_shutdown` cleanup.

Commands:

```bash
npm test
npm run test:smoke
```

## Risks and mitigations

- Risk: widget gets stale if files are edited externally. Mitigation: refresh on session start and tool actions; detailed `/spec-status` remains source of truth.
- Risk: footer/widget becomes too noisy. Mitigation: keep footer one line and widget compact.
- Risk: stale session context on replacement. Mitigation: clear widget/status on `session_shutdown` and use only current `ctx` in update calls.
- Risk: line overflow. Mitigation: pure renderer tests assert visible width.
