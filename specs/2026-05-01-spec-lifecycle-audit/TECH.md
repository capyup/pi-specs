# Tech Spec: Spec lifecycle registry and isolated audit workflow

Product spec: `specs/2026-05-01-spec-lifecycle-audit/PRODUCT.md`

## Context

- `AGENTS.md` documents the spec root (`specs`) and date-prefixed spec directory format.
- `specs/SPECS.yaml` is introduced as the project-level lifecycle registry for specs.
- `specs/SPECS.settings.yaml` is introduced as the project-level audit provider/model settings file.
- `extensions/spec-driven-dev.ts` currently registers `/spec-workflow`, `/spec-product`, `/spec-tech`, `/spec-implement`, `/spec-audit`, `/spec-help`, `spec_scaffold`, and `spec_list`.
- `src/tasks/index.ts` currently resolves the active task store from `specDir`, current cwd, active spec config, or a single `TASKS.yaml` candidate; this must change to fail closed when no spec is resolvable.
- `src/tasks/tasks-config.ts` already has an `activeSpecDir` field but does not yet expose focus as a lifecycle concept.
- `src/tasks/task-store.ts` now parses/renders YAML `TASKS.yaml` and keeps legacy Markdown parsing only for migration/compatibility.
- Pi extension docs expose `ctx.model` for current provider/model access and model selection events for tracking model changes.
- Pi CLI can be launched as a separate process with `--provider`, `--model`, `--no-session`, and `-p` to isolate audit memory.

## Proposed changes

### Lifecycle registry

Add a `src/specs/` module group:

- `specs-registry.ts` parses and renders `specs/SPECS.yaml`.
- `specs-settings.ts` loads/saves `specs/SPECS.settings.yaml` with optional `audit_provider` and `audit_model` fields.
- `specs-audit.ts` launches isolated audit processes and writes audit records.
- `specs-focus.ts` resolves spec ids/paths and updates focus state.

Add the `yaml` npm dependency and use it for parsing/rendering registry and settings files. Renderer output should be deterministic: stable key order, final newline, no comments required.

`SPECS.yaml` should use this schema:

```yaml
version: 1
focused: 2026-05-01-spec-lifecycle-audit
status_vocabulary:
  - draft
  - ready_for_review
  - implementing
  - validating
  - audit_running
  - audit_failed
  - completed
  - archived
commands:
  focus: /spec-focus <spec-id-or-path>
  unfocus: /spec-unfocus
  status: /spec-status [spec-id-or-path]
  finish: /spec-finish [spec-id-or-path]
  settings: /specs-settings
specs:
  - id: 2026-05-01-builtin-task-workflow
    path: specs/2026-05-01-builtin-task-workflow
    title: Built-in task tracking for spec-driven workflow
    status: completed
    focused: false
    last_audit: null
    updated: 2026-05-01
  - id: 2026-05-01-spec-lifecycle-audit
    path: specs/2026-05-01-spec-lifecycle-audit
    title: Spec lifecycle registry and isolated audit workflow
    status: ready_for_review
    focused: true
    last_audit: null
    updated: 2026-05-01
```

Registry invariants:

1. `version` is required and starts at `1`.
2. `focused` is either `null` or the id of exactly one spec in `specs`.
3. Each spec entry has `id`, `path`, `title`, `status`, `focused`, `last_audit`, and `updated`.
4. Exactly one entry may have `focused: true`; it must match the top-level `focused` value.
5. `completed` status is authoritative for completion; no checkbox mirror is used.
6. `commands` documents the canonical lifecycle commands so registry readers can discover the focus/status/finish/settings surfaces.
7. Unknown top-level keys are preserved when possible, but known keys are normalized on write.

Use a small lifecycle status vocabulary:

```text
draft, ready_for_review, implementing, validating, audit_running, audit_failed, completed, archived
```

### Commands and tools

Add extension commands:

- `/spec-focus <spec-id-or-path>` - set exactly one focused spec in `SPECS.yaml` and update task focus defaults.
- `/spec-unfocus` - clear focused spec.
- `/spec-status [spec-id-or-path]` - summarize lifecycle, tasks, validation/audit state, and completion eligibility.
- `/spec-finish [spec-id-or-path]` - run completion checks and automatic isolated audit before marking complete.
- `/specs-settings` - open a settings UI for `audit-provider` and `audit-model`, persisted to `specs/SPECS.settings.yaml`.

Add or update tools if useful:

- `spec_focus`
- `spec_status`
- `spec_finish`
- `specs_settings_get` / `specs_settings_update`

### Focus behavior

1. `spec_focus` resolves the target against the documented spec root.
2. It updates `SPECS.yaml` so top-level `focused` equals the target id, target entry has `focused: true`, and every other entry has `focused: false`.
3. It updates `.pi/tasks-config.json` `activeSpecDir` as a compatibility cache, but `SPECS.yaml` remains the lifecycle source of truth.
4. Task resolution in `src/tasks/index.ts` checks explicit `specDir`, then focused spec in `SPECS.yaml`, then current cwd if it is inside a spec directory, and resolves those specs to `TASKS.yaml`.
5. Task resolution must not fall back to memory/session/project storage for `TaskCreate` or mutating task operations when no spec is resolvable.
6. `/tasks` should show the focused spec id/path in its menu title or status line.
7. Existing `/spec-*` skill prompts with no arguments should read `AGENTS.md` and `specs/SPECS.yaml` first, then use the focused spec when exactly one focused spec is configured.

### Task creation guard

Implement a fail-closed guard in `src/tasks/index.ts`:

1. Add a resolver that returns `{ store, specDir }` only when an explicit or focused spec directory with `TASKS.yaml` is available.
2. `TaskCreate`, `TaskUpdate`, `TaskStop`, `TaskExecute`, and `/tasks` mutations must call this resolver before mutating task state.
3. If no spec is resolved, return a clear error such as: `No active spec. Create or focus a spec before using task tools.`
4. Read-only operations may show `No active spec` instead of creating fallback storage.
5. Remove or restrict automatic memory/session/project fallback for normal spec workflow task tools. Environment overrides may remain only for explicit non-default testing/automation paths, but the default UX must not create tasks before a spec exists.
6. `spec_scaffold` may create an empty `TASKS.yaml`, but it should not create task entries before `PRODUCT.md` exists.

### Completion and audit behavior

`spec_finish` should:

1. Resolve target spec.
2. Run `npm run tasks:check` or equivalent direct checker for that spec's `TASKS.yaml`.
3. Read `PRODUCT.md`, `TECH.md`, `TASKS.yaml`, `SPECS.yaml`, and existing audit records.
4. If tasks are incomplete, report blockers and do not audit unless the user explicitly asks to audit anyway.
5. If completion is plausible, set `SPECS.yaml` status to `audit_running`.
6. Launch isolated audit using a child process:

```bash
pi --no-session --provider <provider> --model <model> -p "<self-contained audit prompt>"
```

Consider adding `--no-extensions --no-prompt-templates` if recursive extension behavior becomes a problem. Keep context files enabled unless tests show this creates unwanted coupling, because `AGENTS.md` is part of repository convention evidence.

7. Write audit output to:

```text
specs/<id>/audits/<timestamp>-<provider>--<model>.md
```

8. Sanitize provider/model for filenames by replacing path-unsafe characters with `-`.
9. Update `SPECS.yaml` `last_audit`, `updated`, and `status`:
   - `completed` if audit passes and all completion gates pass.
   - `audit_failed` if audit reports drift/blockers.
   - prior active status if the audit process fails before producing a usable result.
10. If audit fails with concrete fixes, append compact follow-up tasks to `TASKS.yaml` or report suggested task entries for the parent agent to add.

### Audit provider/model settings

Persist settings in:

```text
specs/SPECS.settings.yaml
```

Shape:

```yaml
audit_provider: openai
audit_model: gpt-5.4-pro
```

Selection rules:

1. Read current provider/model from `ctx.model` at command execution time.
2. Read settings from `SPECS.settings.yaml`.
3. If `audit_provider` is missing or empty, use current provider.
4. If `audit_model` is missing or empty, use current model id.
5. Record both selected values and their source (`settings` or `current-session-fallback`) in the audit record.

### Audit prompt

The child `pi` process should receive a self-contained prompt that asks it to:

- read `AGENTS.md`
- read `specs/SPECS.yaml`
- read the target spec's `PRODUCT.md`, `TECH.md`, `TASKS.yaml`
- inspect relevant implementation/tests when the tech spec points to code paths
- classify each key behavior as implemented/tested/partial/missing/stale
- report blockers, drift, validation gaps, and recommended task additions
- end with a machine-searchable verdict line such as `SPEC_AUDIT_VERDICT: pass` or `SPEC_AUDIT_VERDICT: fail`

The parent process should parse that verdict line conservatively. Missing verdict means audit failed.

## Testing and validation

- Unit-test `SPECS.yaml` parser/renderer with multiple specs, one focused spec, status updates, and last audit updates.
- Unit-test settings fallback: missing file, empty provider, empty model, and fully configured settings.
- Unit-test audit filename sanitization and timestamp-provider--model naming.
- Unit-test focus behavior: focusing one spec clears focus from others and updates active spec cache.
- Unit-test task creation guard: mutating task tools fail when no explicit or focused spec can be resolved, and do not create memory/session/project fallback task stores.
- Unit-test completion gate logic for incomplete tasks, failed audit, missing verdict, and passing audit.
- Integration-smoke test isolated audit command construction without invoking a real model by injecting a fake command runner.
- Update README and skills to document `SPECS.yaml`, `/spec-focus`, `/spec-status`, `/spec-finish`, `/specs-settings`, and automatic isolated audit.

## Risks and mitigations

- Risk: launching `pi` recursively could load the same extension and create nested side effects. Mitigation: make audit command construction configurable and consider `--no-extensions` if recursion appears in testing.
- Risk: current provider/model may not be directly available in every extension context. Mitigation: use `ctx.model` when available and track `model_select` events as fallback.
- Risk: audit result parsing is brittle. Mitigation: require a strict verdict line and treat missing verdict as failure.
- Risk: automatic audit may be expensive. Mitigation: run it only on finish/completion attempts, not on every task update.
- Risk: `SPECS.yaml` hand edits can break lifecycle parsing. Mitigation: validate schema, normalize known keys, and report repair suggestions.
- Risk: users may expect task tools to work as a general todo system. Mitigation: fail closed before spec focus/start and make the error explain that tasks belong to specs.

## Follow-ups

- Decide whether all lifecycle operations should be exposed as both tools and slash commands.
- Decide whether a scheduled/background audit should run when all tasks complete, or only when `/spec-finish` is invoked.
