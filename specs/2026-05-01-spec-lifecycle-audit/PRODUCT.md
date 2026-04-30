# Product Spec: Spec lifecycle registry and isolated audit workflow

Issue: user request to add project-level spec lifecycle tracking, focused spec selection, automatic isolated spec audits, configurable audit provider/model settings, spec-only task creation, YAML lifecycle/settings files, and YAML spec task databases.

## Summary

Spec-driven development should have a project-level lifecycle registry so agents and users can see which specs exist, which one is focused, whether a spec is done, and what audit evidence supports that state. Audits should run automatically in a separate `pi` process for memory isolation, using user-configured audit provider/model when present and otherwise falling back to the current session's provider/model. Task creation is only valid after a spec exists or is focused, because the task system is a spec workflow mechanism rather than a general todo system.

## Behavior

1. The spec root contains a `SPECS.yaml` file that manages lifecycle state for all spec directories under that root.
2. `SPECS.yaml` is the project-level source of truth for each spec's id/path, title, lifecycle status, focus state, last audit record, and last updated date.
3. The workflow can create `SPECS.yaml` when missing, using readable YAML that is stable in git diffs and editable by users.
4. `SPECS.yaml` must be YAML, not a Markdown table, Markdown todo list, hidden JSON, or mixed-format file.
5. `SPECS.yaml` includes the lifecycle schema conventions: valid statuses, the currently focused spec id, required commands, and the specs list.
6. Only one spec is focused at a time by default; focusing one spec updates the top-level focused spec id and clears focus from other specs.
7. When a spec is focused, task tools default to that spec's `TASKS.yaml`, `/tasks` displays that spec's task list, and spec commands use that spec unless the user supplies another path.
8. Users can focus a spec explicitly through `/spec-focus <spec-id-or-path>` or an equivalent tool flow.
9. Users can clear focus through `/spec-unfocus`.
10. Users can inspect lifecycle state through `/spec-status [spec-id-or-path]` or a tool that reads `SPECS.yaml`, the focused spec's `PRODUCT.md`, `TECH.md`, `TASKS.yaml`, and latest audit record.
11. Users can attempt completion through `/spec-finish [spec-id-or-path]`, which runs completion checks and automatic audit before marking a spec complete.
12. Users can configure audit defaults through `/specs-settings`, which writes spec-root settings.
13. The task system is spec-scoped by design. Code must not create or mutate tasks unless it can resolve an explicit or focused spec directory with a `TASKS.yaml` file.
14. If an agent calls a task tool before a spec is started or focused, the tool fails with a clear message telling the agent to create or focus a spec first; it must not silently create an in-memory, session, or project task list.
15. A spec is not considered completed merely because all `TASKS.yaml` tasks are completed; completion requires lifecycle state and audit evidence in `SPECS.yaml`.
16. A spec can become `completed` only when product behavior is stable, technical plan/implementation are not known to drift, task state is complete, validation is recorded, and the latest automatic audit passes.
17. Spec audit runs automatically when the workflow attempts to finish or mark a spec complete.
18. The automatic audit launches a separate `pi` process so the audit has isolated conversation memory from the implementation session.
19. The audit process receives a self-contained audit prompt and reads repository files itself; it should not rely on the parent session's memory.
20. By default, the audit process uses the current session's provider and model.
21. Users can configure audit provider/model through specs settings. If the settings file is missing, or either audit provider/model field is empty, the missing value falls back to the current session default.
22. The settings surface is named `specs-settings` and allows users to enter `audit-provider` and `audit-model` values.
23. The persisted settings live under the spec root so they travel with the repository; the default file is `specs/SPECS.settings.yaml`.
24. Each audit result is written to the audited spec directory under an audit records folder.
25. Audit result filenames use `timestamp-provider--model` format, with path-unsafe characters sanitized, for example `2026-05-01T14-30-00Z-openai--gpt-5.4-pro.md`.
26. After an audit finishes, `SPECS.yaml` is updated with the audit status, latest audit record path, and lifecycle status transition.
27. If audit passes, the spec can transition to `completed` when all other completion conditions are satisfied.
28. If audit fails or finds drift, the spec transitions to `audit_failed` or remains in its prior active state, and the workflow records concrete follow-up work in the spec's `TASKS.yaml`.
29. Audit records are append-only artifacts; new audits create new files instead of overwriting prior audit results.
30. The workflow should explain audit provider/model selection in the audit record, including whether each value came from settings or fallback defaults.
31. Spec lifecycle updates follow steering order: behavior changes update `PRODUCT.md` first, then `TECH.md`, then `TASKS.yaml`, then `SPECS.yaml` lifecycle status and audit state.

## Goals / Non-goals

- Goal: make spec focus and completion explicit instead of inferred only from tasks.
- Goal: keep lifecycle state reviewable and structured in `specs/SPECS.yaml`.
- Goal: make focus commands and lifecycle command requirements visible in the lifecycle registry schema.
- Goal: isolate audit memory by running a separate `pi` instance.
- Goal: allow user-configured audit provider/model while preserving current provider/model fallback behavior.
- Goal: preserve audit evidence as timestamped files under each spec directory.
- Goal: enforce that tasks are created only for an existing or focused spec.
- Non-goal: replace per-spec `TASKS.yaml`; `SPECS.yaml` tracks lifecycle, while `TASKS.yaml` tracks work items.
- Non-goal: silently mark specs complete without audit evidence.
- Non-goal: store lifecycle state in Markdown or hidden JSON.
- Non-goal: support general-purpose tasks before a spec exists or is focused.

## Open questions

- Should lifecycle transitions be exposed only as slash commands, only as tools, or both?
- Should automatic audit run when all tasks complete, only on `/spec-finish`, or both?
