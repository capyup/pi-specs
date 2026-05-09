# Product Spec: Built-in task tracking for spec-driven workflow

Issue: user request to integrate the capabilities of `https://github.com/tintinweb/pi-tasks` directly into this package, without depending on it.

## Summary

`pi-specs` (formerly `pi-spec-driven-dev`) should include a first-class task manager so spec-driven work can be tracked dynamically from intake through product spec, tech spec, implementation, validation, and user steering. Users and agents should see live task progress, manage dependencies, persist work inside each spec directory, and optionally coordinate subagent execution without installing a separate task package.

> Historical note: this behavior was implemented by vendoring `@tintinweb/pi-tasks` under `src/tasks/`. As of `pi-specs@0.1.4`, the runtime was deleted and the same task tracking is provided by installing `@tintinweb/pi-tasks` alongside `pi-specs`. The behavior surface below describes the original intent and is preserved for historical context.

## Behavior

1. When this package is loaded, the agent has task-management tools for creating, listing, inspecting, updating, executing, reading output from, and stopping structured tasks.
2. When a spec-driven task has three or more meaningful steps, or the user asks for planning/coordination, the agent can create compact tasks that represent the current workflow phases and update them as work progresses.
3. Before creating a new spec, the workflow first checks local `AGENTS.md` for the documented spec root and naming convention.
4. If `AGENTS.md` is missing or does not document a spec root, the workflow looks first in `specs`, then `docs/specs`, then `.pi/specs`; if none exist, it searches for another `specs` directory; if none is found, it creates `./specs`.
5. When the workflow creates or infers a missing default spec convention, it records the convention in `AGENTS.md` in short sentences so future agents reuse the same root and naming format.
6. Before finalizing newly inferred or changed spec conventions, the agent presents the intended convention to the user and asks whether to proceed or adjust it.
7. Default spec directory names use `YYYY-MM-DD-kebab-feature`, for example `2026-05-01-builtin-task-workflow`; `spec_scaffold` prefixes the current date when the caller provides only a short feature id.
8. Every spec directory contains a 1:1 task database file next to the specs: `PRODUCT.md`, `TECH.md`, and `TASKS.yaml`.
9. `TASKS.yaml` is a readable YAML file. The YAML entries are the task database and the source of truth used by task tools.
10. Task entries stay compact because detailed behavior and technical rationale belong in `PRODUCT.md` and `TECH.md`.
11. Tasks have stable IDs, subject, description, status, optional active spinner text, optional owner, metadata, creation/update timestamps, and dependency edges.
12. Task status progresses through `pending`, `in_progress`, and `completed`; setting status to `deleted` removes the task and cleans related dependency edges.
13. Task dependencies are bidirectional: adding `blocks` or `blockedBy` updates both sides, and warnings are returned for self-dependencies, dangling references, or obvious cycles.
14. The task sync layer can check and repair `TASKS.yaml` files by normalizing YAML task entries, repairing dependency edges, removing invalid references, and preserving a readable YAML representation.
15. The agentic workflow also repairs drift: when task files look stale, malformed, or inconsistent with PRODUCT/TECH, the agent should repair `TASKS.yaml` or explain the remaining ambiguity before continuing.
16. When the user steers the work mid-stream, the workflow evaluates whether observable behavior changed; if yes, it updates `PRODUCT.md` first, then `TECH.md`, then `TASKS.yaml`, then implementation/tests as needed.
17. A live widget appears above the editor while tasks exist, showing task count, status breakdown, visible task rows, blocked-by hints, active spinner text, elapsed time, and token counters when available.
18. Users can manage tasks interactively through `/tasks`: view all tasks, create a task, inspect task details, mark pending tasks as in progress, complete in-progress tasks, delete tasks, clear completed tasks, clear all tasks, and edit settings.
19. Task tools accept a `specDir` when the active spec directory is ambiguous; otherwise the extension can infer a spec directory from the current working directory, configured active spec, or a single existing `TASKS.yaml` under the spec root.
20. Task storage still supports memory-only, per-session, and project-shared modes for non-spec workflows or explicit user preference.
21. Environment variable overrides are honored: `PI_TASKS=off` disables file persistence, named values use shared lists, absolute paths use that file, and relative paths resolve from the current working directory.
22. Multiple sessions can share a file-backed task list safely via file locking and stale lock recovery.
23. Completed tasks can auto-clear according to settings: never, when the full list is complete, or after each task completes, with a short turn-based delay.
24. When tasks exist but task tools have not been used for several turns, non-task tool results may include a hidden system reminder nudging the agent to update tasks without mentioning the reminder to the user.
25. Tasks with `agentType` metadata can be executed as background subagent tasks when a compatible subagent extension is present; unavailable subagent support returns a friendly error without breaking core task management.
26. Subagent task execution respects dependencies, marks tasks in progress, stores agent IDs/results/errors in metadata, supports `TaskOutput`/`TaskStop`, and can auto-cascade newly unblocked agent tasks when enabled.
27. If another task manager package is not installed, all core behavior still works because this package owns the implementation directly.
28. The package README, prompt templates, and skills explain that spec-driven work should use the built-in task manager for non-trivial workflows while still skipping task tracking for trivial one-step requests.

## Goals / Non-goals

- Goal: absorb the practical task-management capabilities of `pi-tasks` into this package as local source code, with attribution where appropriate.
- Goal: make task tracking part of the spec-driven workflow rather than an optional external dependency.
- Goal: keep command/tool names familiar (`TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `TaskExecute`, `/tasks`) so existing agent habits transfer.
- Goal: keep task storage reviewable as YAML inside the relevant spec directory.
- Non-goal: require users to install `@tintinweb/pi-tasks` or any separate pi task package.
- Non-goal: hide a JSON database inside Markdown or YAML.
- Non-goal: implement a new subagent system; this package only talks to a compatible subagent extension if one is already loaded.
- Non-goal: make task tracking mandatory for tiny fixes, simple Q&A, or obvious one-file edits.

## Open questions

- Should future releases expose spec-specific aliases such as `SpecTaskCreate`, or keep only the familiar task tool names?
