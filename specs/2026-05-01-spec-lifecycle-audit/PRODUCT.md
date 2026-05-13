# Product Spec: Spec lifecycle registry and isolated audit workflow

Issue: user request to add project-level spec lifecycle tracking, focused spec selection, automatic isolated spec audits, configurable audit provider/model settings, YAML lifecycle/settings files, and a free-form `MILESTONES.md` implementation log. Durable progress tracking is intentionally out of scope; agents and sessions manage their own working state.

## Summary

Spec-driven development should have a project-level lifecycle registry so agents and users can see which specs exist, which one is focused, whether a spec is done, and what audit evidence supports that state. Audits should run automatically in a separate `pi` process for memory isolation, using user-configured audit provider/model when present and otherwise falling back to the current session's provider/model. The workflow should not create, require, or maintain persisted progress databases, but each spec should have a free-form milestone log for implementation history.

## Behavior

1. The spec root contains a `SPECS.yaml` file that manages lifecycle state for all spec directories under that root.
2. `SPECS.yaml` is the project-level source of truth for each spec's id/path, title, lifecycle status, focus state, last audit record, and last updated date.
3. The workflow can create `SPECS.yaml` when missing, using readable YAML that is stable in git diffs and editable by users.
4. `SPECS.yaml` must be YAML, not a Markdown table, Markdown todo list, hidden JSON, or mixed-format file.
5. `SPECS.yaml` includes the lifecycle schema conventions: valid statuses, the currently focused spec id, required commands, and the specs list.
6. Only one spec is focused at a time by default; focusing one spec updates the top-level focused spec id and clears focus from other specs.
7. When a spec is focused, spec commands use that spec unless the user supplies another path.
8. Users can focus a spec explicitly through `/spec-focus <spec-id-or-path>` or an equivalent tool flow.
9. Users can clear focus through `/spec-unfocus`.
10. Users can inspect lifecycle state through `/spec-status [spec-id-or-path]` or a tool that reads `SPECS.yaml`, the target spec's `PRODUCT.md`, `TECH.md` when present, and latest audit record.
11. Users can attempt completion through `/spec-finish [spec-id-or-path]`, which runs local completion checks and marks the spec complete when required artifacts exist. Separate audit execution is intentionally deferred until the future `spec_audit` design.
12. Users can configure audit defaults through `/specs-settings`, which writes spec-root settings.
13. The workflow does not create, mutate, require, or inspect durable progress databases or external progress-manager state.
14. Each spec directory includes `MILESTONES.md`, a free-form plain-text implementation log for meaningful milestones, failed attempts, setbacks, fixes, validation notes, and decisions.
15. `MILESTONES.md` has no hard schema beyond entry headings preferring `### YYYY-MM-DD HH:mm:ss - Short milestone title`; agents may use bullets or prose below each heading as appropriate for the implementation.
16. During implementation, agents update `MILESTONES.md` after meaningful phase changes, especially when an approach fails, a blocker is resolved, validation changes, or a decision affects future work.
17. The package exposes a `spec_append_milestone` tool that appends a milestone paragraph to the currently focused spec's `MILESTONES.md`.
18. `spec_append_milestone` accepts `current_spec_name` and `milestone_content` so the TUI visibly shows which focused spec is being updated and what milestone is recorded. The tool automatically prepends a `### YYYY-MM-DD HH:mm:ss - Milestone` heading unless the content already starts with a third-level heading.
19. `spec_append_milestone` refuses to write when `current_spec_name` does not match the focused spec, when no focused spec exists, or when the resolved spec path is outside the current project.
20. A spec is not considered completed because an external or session-local progress list is done; completion requires lifecycle state and audit evidence in `SPECS.yaml`.
21. A spec can become `completed` only when product behavior is stable, technical plan/implementation are not known to drift, validation is recorded or explicitly unavailable, and milestone history is reasonably current.
22. `spec_focus` focuses one registry entry, `spec_unfocus` clears focus, and `spec_status` summarizes lifecycle state plus artifact presence for TUI review.
23. `spec_scaffold` creates `PRODUCT.md`, optional `TECH.md`, `MILESTONES.md`, and a `SPECS.yaml` entry; by default it focuses the newly scaffolded spec.
24. `specs_settings_get` and `specs_settings_update` read and write `specs/SPECS.settings.yaml` with optional `audit_provider` and `audit_model` values for future audit flows.
25. The persisted settings live under the spec root so they travel with the repository; the default file is `specs/SPECS.settings.yaml`.
26. Audit records are append-only artifacts when a future audit flow creates them; new audits create new files instead of overwriting prior audit results.
27. Spec lifecycle updates follow steering order: behavior changes update `PRODUCT.md` first, then `TECH.md`, then implementation/tests, then `MILESTONES.md` and `SPECS.yaml` lifecycle status/audit state as needed.

## Goals / Non-goals

- Goal: make spec focus and completion explicit without relying on progress files.
- Goal: keep lifecycle state reviewable and structured in `specs/SPECS.yaml`.
- Goal: make focus commands and lifecycle command requirements visible in the lifecycle registry schema.
- Goal: isolate audit memory by running a separate `pi` instance.
- Goal: allow user-configured audit provider/model while preserving current provider/model fallback behavior.
- Goal: preserve audit evidence as timestamped files under each spec directory.
- Goal: preserve implementation history in free-form `MILESTONES.md` files without turning them into status databases.
- Goal: expose `spec_append_milestone` so milestone updates are visible as tool calls in the TUI.
- Goal: expose lifecycle and settings tools with readable TUI labels and concise results.
- Non-goal: provide, wrap, require, or coordinate progress management.
- Non-goal: store lifecycle state in Markdown or hidden JSON.
- Non-goal: implement `spec_audit` in this phase.

## Open questions

- Should lifecycle transitions be exposed only as slash commands, only as tools, or both?
