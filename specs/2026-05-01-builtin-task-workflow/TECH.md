# Tech Spec: Built-in task tracking for spec-driven workflow

Product spec: `specs/2026-05-01-builtin-task-workflow/PRODUCT.md`

## Context

- `AGENTS.md` - project-level convention source for spec root, spec directory naming, and mid-workflow steering updates.
- `extensions/spec-driven-dev.ts` - extension entry point; registers spec slash commands, scaffold/list helper tools, and built-in task manager registration.
- `src/tasks/task-store.ts` - file-backed task store, pure Markdown `TASKS.md` parser/renderer, normalization, locking, CRUD, dependencies, deletion, and completed-task cleanup.
- `src/tasks/index.ts` - registers task tools, `/tasks`, lifecycle hooks, reminder injection, token tracking, spec-scoped store resolution, and optional subagent RPC.
- `scripts/sync-tasks.mjs` - CLI check/repair path for pure Markdown `TASKS.md` files.
- `package.json` - scripts and pi resource manifest; should remain self-contained and not depend on `@tintinweb/pi-tasks`.
- `skills/spec-driven-dev/SKILL.md` - end-to-end workflow instructions, including convention discovery, user confirmation, task tracking, and steering behavior.
- `skills/spec-implement/SKILL.md` - implementation workflow; should connect PRODUCT/TECH behavior to live tasks and status updates.
- `prompts/*.md` - prompt templates used as manual entry points; should remind agents to keep PRODUCT/TECH/TASKS aligned when steering happens.
- `.pi/research/pi-tasks/src/index.ts` - reference implementation for task tools, `/tasks`, widget lifecycle, reminders, persistence, auto-clear, and subagent RPC.

## Proposed changes

Vendor and adapt the task manager implementation into this repository as local source code rather than an npm/git dependency.

1. Add `src/tasks/` modules:
   - `types.ts` for task, store, and background process types.
   - `task-store.ts` for in-memory/file-backed storage, pure Markdown `TASKS.md` parsing/rendering, locking, CRUD, dependencies, normalization, deletion, and completed-task cleanup.
   - `tasks-config.ts` for `<cwd>/.pi/tasks-config.json` settings, including default `spec` storage.
   - `auto-clear.ts` for turn-based completed-task cleanup.
   - `process-tracker.ts` for background process output/stop support.
   - `ui/task-widget.ts` for the persistent widget.
   - `ui/settings-menu.ts` for `/tasks` settings.
   - `index.ts` for registering task tools, `/tasks`, lifecycle hooks, reminder injection, token tracking, spec-scoped store resolution, and subagent RPC.
2. Update `extensions/spec-driven-dev.ts` to call a local `registerTasks(pi)` function before or after existing spec commands/tools.
3. Update `spec_scaffold` to resolve spec conventions in this order: local `AGENTS.md`, existing `specs`, existing `docs/specs`, existing `.pi/specs`, nested `specs` search, then create `./specs`.
4. Update `spec_scaffold` to create date-prefixed directories by default: `YYYY-MM-DD-kebab-feature`.
5. Update `spec_scaffold` to create `TASKS.md` as pure Markdown todos and to add short convention sentences to `AGENTS.md` when defaults are inferred.
6. Keep task command/tool names compatible with the reference package: `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `TaskExecute`, and `/tasks`.
7. Add optional `specDir` parameters to task tools so agents can explicitly target the correct `TASKS.md` when more than one spec exists.
8. Add `scripts/sync-tasks.mjs` plus package scripts:
   - `npm run tasks:check` verifies every discovered `TASKS.md` is normalized.
   - `npm run tasks:repair` rewrites discovered `TASKS.md` files into canonical pure Markdown.
9. Keep source code local and self-contained. Do not add `@tintinweb/pi-tasks` to `dependencies` or `bundledDependencies`.
10. Add peer dependencies for pi-provided packages imported at runtime: `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, and `typebox` with `"*"` ranges.
11. Add attribution for the vendored/adapted MIT-licensed task manager source in README and a third-party notice file.
12. Update README to describe AGENTS-based spec discovery, date-prefixed spec ids, pure Markdown `TASKS.md`, task sync/repair scripts, storage modes, `/tasks`, and how task tracking supports spec-driven workflows.
13. Update skills and prompt templates:
   - `spec-driven-dev`: first read `AGENTS.md`, propose conventions to the user before finalizing new defaults, and create/update compact tasks for non-trivial workflows.
   - `spec-tech`: optionally break implementation plans into task-sized units with dependencies.
   - `spec-implement`: mark tasks in progress/completed and keep task state aligned with specs and verification.
   - `spec-audit`: include `TASKS.md` state as workflow evidence.
   - all relevant prompts: when the user steers mid-workflow, update `PRODUCT.md -> TECH.md -> TASKS.md -> implementation/tests` as needed.

## Testing and validation

- Behavior #1/#18: load the package locally and verify `/spec-help` still works while `/tasks` is registered.
- Behavior #2/#28: inspect skill, prompt, and README updates for task-manager guidance.
- Behavior #3/#4/#5/#6/#7: add tests that verify AGENTS convention text, date-prefix examples, and scaffold/list source references.
- Behavior #8/#9/#10/#14/#15: unit-test `TaskStore` Markdown parse/render/repair behavior with pure Markdown todos and malformed dependency edges.
- Behavior #11/#12/#13: unit-test task CRUD, dependency cleanup, warnings, deletion cleanup, JSON compatibility for non-Markdown stores, and file-backed persistence.
- Behavior #16: test prompt/skill text includes steering alignment from PRODUCT to TECH to TASKS.
- Behavior #17: manual validation after `/reload` by creating a task and checking the widget renders.
- Behavior #20/#21/#23: manual or unit validation for config/env store path behavior and auto-clear settings.
- Behavior #24: inspect lifecycle hook and task-tool name set; full runtime behavior requires a pi session with tool calls.
- Behavior #25/#26: keep subagent RPC optional and verify unavailable mode returns a friendly message.
- Package validation: run `npm test` and `npm run test:smoke` when possible.

## Risks and mitigations

- Risk: Markdown todo parsing is less expressive than JSON. Mitigation: keep task entries intentionally compact; PRODUCT/TECH carry detail, and the parser supports explicit id/status/dependency/owner attributes.
- Risk: hand-edited `TASKS.md` can drift. Mitigation: `TaskStore` normalizes on write, `tasks:check` detects drift, `tasks:repair` rewrites canonical Markdown, and agent instructions require repair before continuing when drift matters.
- Risk: inferred spec conventions surprise users. Mitigation: skills instruct agents to present the intended root and naming convention to the user before finalizing new defaults.
- Risk: tool or command name collisions if a user also installs another task manager package. Mitigation: document that this package now includes task tools directly and users should not install duplicate task-manager packages unless they intentionally want overlapping tools.
- Risk: vendored source can drift from upstream `pi-tasks`. Mitigation: document upstream source and keep changes localized under `src/tasks/`.
- Risk: runtime imports fail if pi core packages are not available as peers. Mitigation: declare peer dependencies with `"*"` ranges per pi package guidance.

## Follow-ups

- Consider spec-specific aliases or wrappers only if duplicate tool names become a real UX problem.
- Consider `TASKS.sqlite` only if future workflows need real relational queries or transactions; do not mix SQLite/JSON semantics into Markdown.
