# pi-spec-driven-dev

A pi package for spec-driven development. It turns a feature idea into a reviewed `PRODUCT.md`, a codebase-grounded `TECH.md`, and then an implementation that keeps specs, code, and tests aligned.

This package is adapted from Warp's internal spec-driven workflow and generalized for any repository that benefits from PRD-style product specs, technical design docs, and agent-friendly implementation plans.

## What This Package Adds

### Skills

- `spec-driven-dev` - end-to-end spec-first workflow: decide whether specs are warranted, write specs, implement, and verify.
- `spec-product` - write or revise a behavior-first `PRODUCT.md` from the user/caller perspective.
- `spec-tech` - write or revise a codebase-grounded `TECH.md` with implementation plan, risks, and validation.
- `spec-implement` - implement approved specs while keeping specs, code, and tests synchronized.
- `spec-audit` - audit a repository's spec workflow, spec quality, or spec/code/test drift.

### Slash Commands

The extension registers direct commands so you do not have to remember skill names:

```text
/spec-workflow <feature, issue, or goal>
/spec-product <ticket/feature and desired behavior>
/spec-tech <spec path or feature>
/spec-implement <spec directory or feature>
/spec-audit [spec directory, issue, or area]
/spec-help
```

### Agent Tools

The extension also registers helper tools that the model can call when useful:

- `spec_scaffold` - creates `PRODUCT.md`, optional `TECH.md`, and `TASKS.md` under the documented spec root without overwriting existing files.
- `spec_list` - lists spec directories under the documented spec root and reports whether each has product, tech, and task files.

### Built-in Task Manager

Spec-driven work often needs a living task plan, not just static docs. This package includes a built-in task manager adapted from [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks), so no separate task package is required.

It registers:

```text
/tasks
TaskCreate
TaskList
TaskGet
TaskUpdate
TaskOutput
TaskStop
TaskExecute
```

Use it for non-trivial spec workflows: create tasks for product spec, tech spec, implementation steps, validation, and follow-ups; mark tasks `in_progress` before starting and `completed` only when the work and relevant verification are done. Skip task tracking for tiny one-step fixes.

By default, spec-driven tasks are stored in the active spec directory as `TASKS.md`, next to `PRODUCT.md` and `TECH.md`. That file is the task database and uses pure Markdown todos, not embedded JSON. Task tools accept `specDir` when more than one spec exists, for example `specs/2026-05-01-builtin-task-workflow`.

Tasks can also be stored in memory, per session, or project-wide under `.pi/tasks/`; settings live in `.pi/tasks-config.json`. `PI_TASKS=off`, named lists, and explicit paths are supported for automation or shared coordination.

### Prompt Templates

Prompt templates are included as fallback/manual entry points:

```text
/write-product-spec <feature>
/write-tech-spec <feature>
/implement-spec <spec directory>
/audit-specs <area>
```

Prompt templates intentionally avoid names used by extension commands so command lists show one canonical entry for each slash command.

## Install

Install from GitHub:

```bash
pi install git:github.com/lulucatdev/pi-spec-driven-dev
```

Or install from a local checkout:

```bash
pi install /Users/lucas/pi-spec-driven-dev
```

Reload an existing pi session after installing:

```text
/reload
```

Try it without installing permanently:

```bash
pi -e git:github.com/lulucatdev/pi-spec-driven-dev
```

## Quick Start

Start a full spec-driven workflow:

```text
/spec-workflow APP-1234 add Mermaid diagram editing support in editable plans
```

Draft only the product spec:

```text
/spec-product GH408 make /open-file expand ~ paths the same way the file picker does
```

Write a technical plan from an existing product spec:

```text
/spec-tech specs/GH408
```

Implement approved specs:

```text
/spec-implement specs/GH408
```

Audit an existing project or feature:

```text
/spec-audit specs/mermaid-markdown-in-plans
```

## Recommended Workflow

1. **Start from an issue or feature idea.** Use `/spec-workflow` when the change is substantial, ambiguous, risky, or likely to involve multiple files.
2. **Discover conventions first.** Read `AGENTS.md`; if no spec root is documented, prefer existing `specs`, `docs/specs`, `.pi/specs`, then any nested `specs`, then create `./specs` and record the convention in `AGENTS.md`.
3. **Confirm new conventions.** Before finalizing an inferred convention, tell the user the planned spec root, date-prefixed directory name, and pure Markdown `TASKS.md` format, then ask whether to proceed or adjust.
4. **Create live tasks for non-trivial work.** Use `TaskCreate` / `TaskUpdate` to track product spec, tech spec, implementation, validation, and follow-ups when the workflow has multiple meaningful steps.
5. **Write `PRODUCT.md` first.** Capture observable behavior as numbered, testable invariants. Keep implementation details out.
6. **Write `TECH.md` when warranted.** Read the product spec and current source code. Ground the plan in real files, types, state, data flow, risks, and validation.
7. **Implement from approved specs.** Treat `PRODUCT.md` as behavior source of truth and `TECH.md` as the implementation plan.
8. **Handle steering top-down.** If the user steers mid-workflow and behavior changes, update `PRODUCT.md`, then `TECH.md`, then `TASKS.md`, then implementation/tests as needed.
9. **Keep specs and tasks current.** If implementation changes behavior, architecture, or sequencing, update the relevant spec and task state in the same PR.
10. **Verify against behavior.** Tests and manual checks should map back to the behavior invariants in the product spec.
11. **Audit before finishing.** Use `/spec-audit` when you want a final check for spec/code/test/task drift.

## Default Spec Layout

When a repository does not already have a convention, this package uses:

```text
specs/YYYY-MM-DD-kebab-feature/PRODUCT.md
specs/YYYY-MM-DD-kebab-feature/TECH.md
specs/YYYY-MM-DD-kebab-feature/TASKS.md
```

Examples:

```text
specs/2026-05-01-builtin-task-workflow/PRODUCT.md
specs/2026-05-01-builtin-task-workflow/TECH.md
specs/2026-05-01-builtin-task-workflow/TASKS.md
specs/2026-05-01-mermaid-markdown-in-plans/PRODUCT.md
```

The skills first inspect `AGENTS.md` and current repository conventions. If no convention exists, the agent should propose the default to the user, then record the chosen spec root and `YYYY-MM-DD-kebab-feature` naming format in `AGENTS.md`.

## What Makes a Good Product Spec

A good `PRODUCT.md` describes behavior from the consumer's point of view:

- UI features: what the user sees, does, and experiences.
- APIs/protocols/libraries: what callers can rely on.
- CLI/developer tools: what operators invoke and get back.
- Data models: what readers and writers can assume.

The core is a numbered `Behavior` section with testable invariants. It should cover the happy path, states, transitions, inputs, outputs, errors, empty states, cancellation, compatibility, accessibility, and edge cases that are easy to miss.

## What Makes a Good Tech Spec

A good `TECH.md` translates behavior into a concrete implementation plan:

- current system context with file references
- modules/files/types/APIs to change
- state and data flow
- compatibility and migration concerns
- rollout or feature flag strategy when relevant
- risks and mitigations
- tests and manual validation mapped to product behavior

It should be grounded in the codebase. The agent should inspect source files before drafting rather than inventing architecture from memory.

## When to Use Specs

Use specs for:

- ambiguous product behavior
- cross-cutting or multi-module work
- risky behavior changes
- architecture changes or migrations
- UI flows with many states
- work delegated to agents or reviewed asynchronously

Skip specs for:

- tiny local bug fixes
- obvious one-file changes
- mechanical refactors
- copy-only tweaks with no behavioral ambiguity

When in doubt, write a short product spec. It is often cheaper than resolving mismatched assumptions later.

## Package Structure

```text
pi-spec-driven-dev/
├── AGENTS.md
├── package.json
├── README.md
├── THIRD_PARTY_NOTICES.md
├── extensions/
│   └── spec-driven-dev.ts
├── scripts/
│   └── sync-tasks.mjs
├── src/
│   └── tasks/
│       ├── index.ts
│       ├── task-store.ts
│       ├── auto-clear.ts
│       ├── process-tracker.ts
│       ├── tasks-config.ts
│       ├── types.ts
│       └── ui/
├── prompts/
│   ├── audit-specs.md
│   ├── implement-spec.md
│   ├── write-product-spec.md
│   └── write-tech-spec.md
├── test/
│   ├── package-shape.test.mjs
│   └── task-store.test.mjs
└── skills/
    ├── spec-audit/
    │   └── SKILL.md
    ├── spec-driven-dev/
    │   └── SKILL.md
    ├── spec-implement/
    │   └── SKILL.md
    ├── spec-product/
    │   └── SKILL.md
    └── spec-tech/
        └── SKILL.md
```

## Development

Run the test suite:

```bash
npm test
```

The tests use Node's built-in test runner with TypeScript type stripping, so no test framework dependency is required. They cover:

- package manifest and pi resource shape
- skill frontmatter consistency
- duplicate command/prompt prevention
- built-in task-manager source registration
- task-store CRUD, metadata, dependency warnings, deletion cleanup, JSON compatibility, pure Markdown TASKS.md persistence, and auto-clear behavior
- README/spec/prompt coverage for AGENTS discovery, steering alignment, and the built-in task workflow

Check and repair spec task files:

```bash
npm run tasks:check
npm run tasks:repair
```

`tasks:check` verifies discovered `TASKS.md` files under `specs`, `docs/specs`, and `.pi/specs` are canonical pure Markdown todos. `tasks:repair` rewrites them into the normalized Markdown form when safe.

Smoke-test local pi loading:

```bash
npm run test:smoke
```

## Credits

This package generalizes the spec-driven workflow used in the Warp codebase, especially the ideas behind:

- `spec-driven-implementation`
- `write-product-spec`
- `write-tech-spec`
- `implement-specs`

The built-in task manager is adapted from [`@tintinweb/pi-tasks`](https://github.com/tintinweb/pi-tasks) under the MIT license. See `THIRD_PARTY_NOTICES.md`.

The package is intentionally project-agnostic: it reads the current repository's conventions first and only falls back to `specs/<id>/PRODUCT.md` + `TECH.md` when no stronger convention exists.

## License

MIT
