# Tech Spec: Spec lifecycle registry and isolated audit workflow

Product spec: `specs/2026-05-01-spec-lifecycle-audit/PRODUCT.md`

## Context

- `AGENTS.md` documents the spec root (`specs`), date-prefixed spec directory format, free-form `MILESTONES.md` implementation logs, and steering order without any persisted progress layer.
- `specs/SPECS.yaml` is introduced as the project-level lifecycle registry for specs.
- `specs/SPECS.settings.yaml` is introduced as the project-level audit provider/model settings file.
- `extensions/pi-specs.ts` currently registers `/specs`, `/specs-product`, `/specs-tech`, `/specs-implement`, `/specs-audit`, `/specs-help`, `spec_scaffold`, `specs_list`, and should add lifecycle/settings tools plus `spec_append_milestone`.
- The package currently has no local progress runtime; README, skill, scaffold, and test references should keep durable progress tracking out of scope rather than redirecting to another package.
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
5. `completed` status is authoritative for completion; no checkbox or progress-database mirror is used.
6. `commands` documents the canonical lifecycle commands so registry readers can discover the focus/status/finish/settings surfaces.
7. Unknown top-level keys are preserved when possible, but known keys are normalized on write.

Use a small lifecycle status vocabulary:

```text
draft, ready_for_review, implementing, validating, audit_running, audit_failed, completed, archived
```

### Commands and tools

Add extension commands:

- `/spec-focus <spec-id-or-path>` - set exactly one focused spec in `SPECS.yaml`.
- `/spec-unfocus` - clear focused spec.
- `/spec-status [spec-id-or-path]` - summarize lifecycle, validation/audit state, and completion eligibility.
- `/spec-finish [spec-id-or-path]` - run local completion checks and mark complete when required artifacts exist; separate audit execution is deferred to a future `spec_audit` design.
- `/specs-settings` - open a settings UI for `audit-provider` and `audit-model`, persisted to `specs/SPECS.settings.yaml`.

Add or update tools if useful:

- `spec_focus`
- `spec_unfocus`
- `spec_scaffold`
- `spec_status`
- `spec_finish`
- `specs_settings_get` / `specs_settings_update`
- `spec_append_milestone` for appending a paragraph to the focused spec's `MILESTONES.md` with visible TUI tool-call context

### Focus behavior

1. `spec_focus` resolves the target against the documented spec root.
2. It updates `SPECS.yaml` so top-level `focused` equals the target id, target entry has `focused: true`, and every other entry has `focused: false`.
3. Existing `/specs-*` skill prompts with no arguments should read `AGENTS.md` and `specs/SPECS.yaml` first, then use the focused spec when exactly one focused spec is configured.
4. Focus must not depend on any external progress manager or persisted progress database.

### Milestone log workflow

Add a free-form implementation log without reintroducing progress management:

1. `spec_scaffold` creates `PRODUCT.md`, optional `TECH.md`, and `MILESTONES.md`.
2. `MILESTONES.md` starts with a short note explaining that it is free-form, uses `### YYYY-MM-DD HH:mm:ss - Short milestone title` entry headings, and may record milestones, failed attempts, setbacks, fixes, validation notes, and decisions.
3. `specs_list` reports product, tech, and milestone log file presence.
4. `spec_append_milestone` resolves the focused spec from `specs/SPECS.yaml`, validates that `current_spec_name` matches the focused id/path/title, creates `MILESTONES.md` if it is missing, and appends `milestone_content` as a paragraph under an automatic `### YYYY-MM-DD HH:mm:ss - Milestone` heading unless the content already starts with a third-level heading.
5. `spec_append_milestone` returns an error instead of writing when no focused spec exists, the displayed spec name is stale, the content is empty, or the resolved spec path is outside the current project.
6. `/specs-help` lists only spec commands and spec helper behavior.
7. Skills describe planning as agent/session-local reasoning, while `MILESTONES.md` records durable implementation history after meaningful events.
8. README and tests do not instruct users to install, call, or maintain a separate progress manager.
9. Existing persisted progress files stay removed from the repository.

### Completion behavior

`spec_finish` should:

1. Resolve target spec, defaulting to the focused spec.
2. Read `PRODUCT.md`, `TECH.md` when present, `MILESTONES.md` when present, `SPECS.yaml`, and existing audit record metadata.
3. Require `PRODUCT.md` and `MILESTONES.md`; allow missing `TECH.md` only with a warning because trivial changes may not need a technical plan.
4. Mark the registry entry `completed`, update `updated`, and preserve `last_audit` unchanged.
5. Return a concise TUI result that names the spec, path, and any warnings, including that separate audit execution is deferred.

`spec_audit` is intentionally not implemented in this phase.

### Future audit provider/model settings

Persist settings in:

```text
specs/SPECS.settings.yaml
```

Shape:

```yaml
audit_provider: openai
audit_model: gpt-5.4-pro
```

Selection rules for the future audit flow:

1. Read current provider/model from `ctx.model` at command execution time when available.
2. Read settings from `SPECS.settings.yaml`.
3. If `audit_provider` is missing or empty, use current provider.
4. If `audit_model` is missing or empty, use current model id.
5. Record both selected values and their source (`settings` or `current-session-fallback`) in the audit record.

## Testing and validation

- Unit-test `SPECS.yaml` parser/renderer with multiple specs, one focused spec, status updates, and last audit updates.
- Unit-test settings fallback: missing file, empty provider, empty model, and fully configured settings.
- Unit-test audit filename sanitization and timestamp-provider--model naming.
- Unit-test focus behavior: focusing one spec clears focus from others.
- Unit-test or shape-test `spec_append_milestone` registration, parameters, focused-spec resolution, stale spec-name guard, timestamp-to-seconds heading, and append behavior.
- Unit-test completion gate logic for missing required artifacts, missing optional TECH warnings, and completed status updates.
- Update README and skills to document `SPECS.yaml`, `MILESTONES.md`, `spec_focus`, `spec_status`, `spec_finish`, settings tools, and deferred audit execution.
- Add regression checks that user-facing docs do not mention removed progress-management surfaces and do mention milestone logs.

## Risks and mitigations

- Risk: users expect finish to run audit immediately. Mitigation: make tool output explicit that audit execution is deferred to the future `spec_audit` flow.
- Risk: current provider/model may not be directly available in every extension context. Mitigation: store optional future-audit defaults without requiring current-session values.
- Risk: `SPECS.yaml` hand edits can break lifecycle parsing. Mitigation: validate schema, normalize known keys, and report repair suggestions.
- Risk: milestone logs become noisy or stale. Mitigation: keep them free-form, use third-level headings with timestamps down to seconds, and update only after meaningful implementation events, especially setbacks, fixes, validation changes, and decisions.
- Risk: removing persisted progress files reduces explicit execution history. Mitigation: rely on the active agent/session for execution state and on PRODUCT/TECH/MILESTONES/audit records for durable product and implementation evidence.

## Follow-ups

- Decide whether all lifecycle operations should be exposed as both tools and slash commands.
