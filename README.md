# pi-specs

> Moved to `@capyup` and published to npm in `0.1.7`. Old `git:github.com/lulucatdev/pi-spec-driven-dev` and `git:github.com/lulucatdev/pi-specs` URLs both redirect on GitHub. New installs should prefer `pi install npm:@capyup/pi-specs`.

A pi package for research-driven spec development. It turns a feature idea into purpose-directed research, a reviewed `PRODUCT.md`, a codebase-grounded `TECH.md`, and an implementation that keeps specs, code, research evidence, and tests aligned.

This package is adapted from Warp's internal spec-driven workflow and generalized for repositories that benefit from PRD-style product specs, technical design docs, and agent-friendly implementation plans.

`pi-specs` intentionally does not provide or coordinate progress management. Agents and sessions can maintain their own working state, while durable project artifacts stay focused on product behavior, technical plans, implementation history, validation, and audit evidence.

## What This Package Adds

### Skills

- `specs` - end-to-end spec-first workflow: decide whether specs are warranted, write specs, implement, and verify.
- `specs-product` - write or revise a behavior-first `PRODUCT.md` from the user/caller perspective.
- `specs-tech` - write or revise a codebase-grounded `TECH.md` with implementation plan, risks, and validation.
- `specs-research` - run purpose-directed research inside a spec workflow, including source/code investigation, prototypes, benchmarks, experiments, and observable feedback loops.
- `specs-grill-me` - grill the current spec design, research evidence, technical plan, or implementation progress with adversarial questions.
- `specs-implement` - implement approved specs while keeping specs, code, and tests synchronized.
- `specs-audit` - audit a repository's spec workflow, spec quality, or spec/code/test drift.

### Slash Commands

The extension registers direct commands so you do not have to remember skill names:

```text
/specs <feature, issue, or goal>
/specs-product <ticket/feature and desired behavior>
/specs-tech <spec path or feature>
/specs-research <topic, question, or research purpose>
/specs-grill-me [spec id, path, or focus area]
/specs-implement <spec directory or feature>
/specs-audit [spec directory, issue, or area]
/specs-help
```

### Agent Tools

The extension also registers helper tools that the model can call when useful:

- `spec_scaffold` - creates `PRODUCT.md`, `MILESTONES.md`, optional `TECH.md`, and a `SPECS.yaml` registry entry.
- `spec_research` - creates or focuses a spec folder, prepares `research/`, creates a purpose-named research report, and returns guidance for the agent.
- `spec_questionaire` / `spec_questionnaire` - ask specs-specific grilling questions with recommended answers, free-text correction, and Q&A records.
- `spec_focus` / `spec_unfocus` - set or clear the currently focused spec.
- `spec_status` - summarizes lifecycle state, artifact presence, latest audit metadata, and focus state.
- `spec_finish` - runs local completion checks and marks a spec completed; audit execution is deferred to a future `spec_audit` flow.
- `spec_append_milestone` - appends a free-form milestone paragraph to the currently focused spec's `MILESTONES.md`.
- `specs_settings_get` / `specs_settings_update` - read or update future audit provider/model defaults in `SPECS.settings.yaml`.

### Footer Widget

When pi has an interactive UI, `pi-specs` mirrors the `pi-goal` footer/status pattern for focused specs:

- The lower `footer/status` entry shows the currently focused spec id, lifecycle status, title, and research report count.
- A `compact widget` above the editor shows the focused spec title, artifact readiness for `PRODUCT.md`, `TECH.md`, `MILESTONES.md`, the `research/` report count, and the spec path.
- If registered specs exist but no spec is focused, the widget explains that the session is unfocused and suggests `/spec-status` or `spec_focus`.
- If no registry/specs exist, the status and widget stay hidden rather than creating a new state surface.

The widget derives everything from `SPECS.yaml` and files in the spec directory; it does not add a separate database or replace `spec_status`.

### Command Palette

The canonical slash commands are the extension commands listed above. This package intentionally does not ship prompt templates, because template commands would duplicate the same workflows in the command palette.

Pi may still show `skill:specs*` entries when `enableSkillCommands` is enabled. Those are pi's direct skill invocation commands, not separate workflows; use `/specs*` as the normal entry points.

## Install

From npm (recommended):

```bash
pi install npm:@capyup/pi-specs
```

From GitHub (always tracks `main`):

```bash
pi install git:github.com/capyup/pi-specs
```

From a local checkout:

```bash
pi install /Users/lucas/Developer/pi-specs
```

Reload an existing pi session after installing:

```text
/reload
```

Try it without installing permanently:

```bash
pi -e npm:@capyup/pi-specs
```

## Quick Start

Start a full spec-driven workflow:

```text
/specs APP-1234 add Mermaid diagram editing support in editable plans
```

Draft only the product spec:

```text
/specs-product GH408 make /open-file expand ~ paths the same way the file picker does
```

Write a technical plan from an existing product spec:

```text
/specs-tech specs/GH408
```

Run research before or during spec work:

```text
/specs-research initial-superpowers-mechanisms for a lightweight research-driven spec workflow
```

Grill the current focused spec design or progress:

```text
/specs-grill-me validation and remaining product risks
```

Implement approved specs:

```text
/specs-implement specs/GH408
```

Audit an existing project or feature:

```text
/specs-audit specs/mermaid-markdown-in-plans
```

## Recommended Workflow

1. **Start from an issue or feature idea.** Use `/specs` when the change is substantial, ambiguous, risky, or likely to involve multiple files.
2. **Discover conventions first.** Read `AGENTS.md`; if no spec root is documented, prefer existing `specs`, `docs/specs`, `.pi/specs`, then any nested `specs`, then create `./specs` and record the convention in `AGENTS.md`.
3. **Confirm new conventions.** Before finalizing an inferred convention, tell the user the planned spec root and date-prefixed directory name, then ask whether to proceed or adjust.
4. **Research when evidence would change direction.** Use `/specs-research` or `spec_research` to create/focus the spec folder, write purpose-named reports under `research/`, and ground decisions in sources, code, prototypes, benchmarks, or experiments.
5. **Write `PRODUCT.md` first.** Capture observable behavior as numbered, testable invariants. Keep implementation details out.
6. **Write `TECH.md` when warranted.** Read the product spec, current source code, and relevant research reports. Ground the plan in real files, types, state, data flow, risks, and validation.
7. **Implement from approved specs.** Treat `PRODUCT.md` as behavior source of truth and `TECH.md` as the implementation plan; launch more research if implementation exposes uncertainty or measurable tradeoffs.
8. **Handle steering top-down.** If the user steers mid-workflow and behavior changes, update `PRODUCT.md`, then `TECH.md`, then implementation/tests as needed.
9. **Record implementation milestones.** Update `MILESTONES.md` after meaningful phase changes, including successes, setbacks, failed attempts, fixes, validation notes, and decisions.
10. **Keep specs current.** If implementation changes behavior, architecture, or validation, update the relevant spec in the same PR.
11. **Verify against behavior.** Tests and manual checks should map back to the behavior invariants in the product spec.
12. **Audit before finishing.** Use `/specs-audit` when you want a final check for spec/code/test drift.

## Default Spec Layout

When a repository does not already have a convention, this package uses:

```text
specs/YYYY-MM-DD-kebab-feature/PRODUCT.md
specs/YYYY-MM-DD-kebab-feature/TECH.md
specs/YYYY-MM-DD-kebab-feature/MILESTONES.md
specs/YYYY-MM-DD-kebab-feature/research/YYYY-MM-DD-<purpose>.md
```

Examples:

```text
specs/2026-05-01-spec-lifecycle-audit/PRODUCT.md
specs/2026-05-01-spec-lifecycle-audit/TECH.md
specs/2026-05-01-spec-lifecycle-audit/MILESTONES.md
specs/2026-05-01-mermaid-markdown-in-plans/PRODUCT.md
```

The skills first inspect `AGENTS.md` and current repository conventions. If no convention exists, the agent should propose the default to the user, then record the chosen spec root, `YYYY-MM-DD-kebab-feature` naming format, and `MILESTONES.md` convention in `AGENTS.md`.

## What Makes a Good Product Spec

A good `PRODUCT.md` describes behavior from the consumer's point of view:

- UI features: what the user sees, does, and experiences.
- APIs/protocols/libraries: what callers can rely on.
- CLI/developer tools: what operators invoke and get back.
- Data models: what readers and writers can assume.

The core is a numbered `Behavior` section with testable invariants. It should cover the happy path, states, transitions, inputs, outputs, errors, empty states, cancellation, compatibility, accessibility, and edge cases that are easy to miss.

## What Makes a Good Research Report

A good `research/YYYY-MM-DD-<purpose>.md` captures evidence before a product, technical, implementation, or audit decision changes direction. Research can mean literature or web review, source/code investigation, prototype spikes, benchmarks, transcript comparisons, controlled experiments, or any inquiry that can produce observations or measurable signals.

It should record the purpose, method, observations, conclusions, impact on the spec or plan, and remaining uncertainty. For experiments, state the hypothesis or question, the observable or quantitative signal, the setup, the result, and limits of interpretation.

After research, `/specs-research` should normally run a multi-round research/question/synthesis loop. Use `/specs-grill-me` when the spec already exists and the goal is to pressure-test its current design, evidence, technical plan, or progress. Agents should use `spec_questionaire` / `spec_questionnaire` to grill one decision branch at a time, include a recommended answer, let the user accept/reject/modify, then continue with follow-up research, another question, or spec synthesis. The intended behavior is not a single ceremonial clarifying question. The questionnaire tools are implemented inside `pi-specs`; they do not require an external questionnaire plugin.

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

## What Makes a Good Milestones Log

A good `MILESTONES.md` is a plain-text implementation history, not a status list or required schema. It should record meaningful moments that help a future engineer or agent understand how the implementation unfolded. Use the `spec_append_milestone` tool when available so the TUI shows the milestone write explicitly:

```text
spec_append_milestone {current_spec_name}
{milestone content}
```

Record:

- completed phases or important checkpoints
- failed approaches and why they failed
- setbacks, blockers, and how they were resolved
- validation results or changes to the validation plan
- decisions that affected the implementation path

Use third-level headings with timestamps down to seconds for entries, for example `### 2026-05-13 14:16:36 - Short milestone title`; bullets or prose below are both fine. `spec_append_milestone` adds this heading automatically when the content does not already start with `###`. Keep it honest and lightweight; do not turn it into a rigid status database.

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
pi-specs/
├── AGENTS.md
├── package.json
├── README.md
├── LICENSE
├── extensions/
│   ├── pi-specs.ts
│   └── widgets/
│       └── spec-widget.ts
├── test/
│   ├── package-shape.test.mjs
│   └── spec-widget.test.mjs
└── skills/
    ├── specs/
    │   └── SKILL.md
    ├── specs-audit/
    │   └── SKILL.md
    ├── specs-grill-me/
    │   └── SKILL.md
    ├── specs-implement/
    │   └── SKILL.md
    ├── specs-research/
    │   └── SKILL.md
    ├── specs-product/
    │   └── SKILL.md
    └── specs-tech/
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
- extension shape, widget registration, and spec command registration
- widget renderer coverage for focused, completed, unfocused, and width-safe states
- README/AGENTS coverage for AGENTS discovery, steering alignment, lifecycle tools, research reports, specs-owned questionnaire tools, and progress-free spec scaffolding

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

The package is intentionally project-agnostic: it reads the current repository's conventions first and only falls back to `specs/<id>/PRODUCT.md` + `TECH.md` + `MILESTONES.md` when no stronger convention exists.

## License

MIT
