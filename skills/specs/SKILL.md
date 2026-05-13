---
name: specs
description: Run a pragmatic spec-driven development workflow for substantial features, risky behavior changes, cross-cutting refactors, or agent-driven implementation. Use this whenever the user mentions PRODUCT.md, TECH.md, specs/, PRD, product spec, tech spec, ready-to-spec, spec-first implementation, or asks to plan a feature before coding.
---

# Spec-Driven Development

Use this skill to drive a feature from intent to implementation through checked-in specs. It is adapted from the Warp repository's spec workflow, but written to fit any project.

## First principles

- Specs are working inputs for implementation and review, not ceremony.
- Spec-driven work can also be research-driven: use purpose-directed research when evidence, experiments, benchmarks, prototypes, or source/code investigation would reduce uncertainty.
- `PRODUCT.md` owns observable behavior from the user/caller perspective.
- `TECH.md` owns implementation shape, codebase context, risks, and validation.
- `research/` may contain purpose-named research reports for literature/code review, experiments, benchmarks, prototypes, or audit evidence gathered before or during spec work.
- `MILESTONES.md` owns free-form implementation history: milestones, setbacks, failed attempts, fixes, validation notes, and decisions.
- Code, tests, and specs should describe the same feature by the time the PR ships.
- Agent/session-local planning is enough for execution state; this package does not create durable progress files.
- Skip specs for small local bug fixes, narrow refactors, and obvious one-file tweaks.

## Prompting posture

- Prefer outcome-first guidance: define the artifact, success criteria, constraints, available evidence, and final answer shape; do not over-prescribe the agent's internal process.
- Use absolute words like `always`, `never`, and `must` only for real invariants such as safety, file ownership, required outputs, or non-destructive behavior. Use decision rules for judgment calls.
- For multi-step or tool-heavy work, begin with a short visible preamble that acknowledges the request and states the first step.
- Stop when the user's core request is satisfied with enough evidence, explicit open questions, and a clear next action. Do not keep expanding the workflow just to add polish.

## Decide whether specs are warranted

Strongly prefer specs when the change has any of these traits:

- product or architectural ambiguity
- expected implementation size around 1k+ LOC
- deep or cross-cutting stack changes
- risky behavior changes where regressions would be expensive
- UI/interaction flows with many states or edge cases
- work that will be delegated to agents or reviewed asynchronously

Specs are usually unnecessary for:

- small, local bug fixes
- straightforward refactors
- narrow UI copy/style tweaks with little ambiguity

When unsure, write a short product spec first. A lightweight spec is cheaper than debugging mismatched assumptions later.

## Repository conventions

Before creating files, inspect the project for existing conventions:

- read local `AGENTS.md` first and follow any documented spec root or naming convention
- then inspect `CONTRIBUTING.md`, `README.md`, `WARP.md`, `CLAUDE.md`, or equivalent agent docs
- then check existing roots in this order: `specs`, `docs/specs`, `.pi/specs`
- then search for another `specs` directory if the preferred roots do not exist
- inspect examples of `PRODUCT.md`, `TECH.md`, PRDs, design docs, or RFCs
- inspect test and validation conventions

Default convention when none exists:

```text
specs/YYYY-MM-DD-kebab-feature/PRODUCT.md
specs/YYYY-MM-DD-kebab-feature/TECH.md
specs/YYYY-MM-DD-kebab-feature/MILESTONES.md
```

When no convention exists, propose the convention to the user before finalizing it: spec root, date-prefixed directory name, and free-form `MILESTONES.md` log. If the user agrees or says to proceed, create/update `AGENTS.md` with short sentences for the spec root, `YYYY-MM-DD-kebab-feature` naming format, and milestone log convention.

Use a ticket id when available (`APP-1234`, `GH408`, `JIRA-123`) only if the project already prefers ticket ids. Otherwise default to `YYYY-MM-DD-kebab-feature`. If the package extension is installed, call `spec_scaffold` to create the directory, starter files, registry entry, and default focus.

## Workflow

### 1. Capture intent and shape

If the work is ambiguous or evidence would change the direction, use `/specs-research` or the `spec_research` tool to create/focus a spec folder and write a purpose-named research report before hardening behavior. Research can include source/web/docs lookup, code archaeology, prototypes, benchmarks, or experiments with observable/quantitative signals. During research-driven grilling, use `spec_questionaire` / `spec_questionnaire` to ask one decision branch at a time with a recommended answer and Q&A records.

Clarify only what is needed to avoid guessing:

- feature summary and target users/callers
- triggering issue/ticket, if any
- expected behavior and non-goals
- important edge cases or compatibility constraints
- UI design/Figma/mock availability when relevant
- expected validation bar

If the user already gave enough context, proceed instead of over-interviewing.

### 2. Write the product spec first

Use the `specs-product` skill. If claims about users, reference systems, tradeoffs, risks, or measurable outcomes are uncertain, launch additional research instead of inventing certainty. The product spec should define:

- what problem is being solved
- desired user/caller experience
- numbered, testable behavior invariants
- states, transitions, inputs, outputs, and edge cases
- goals, non-goals, and open questions when useful

Keep implementation details out unless they are visible to the consumer of the surface.

### 3. Write the tech spec when warranted

Use the `specs-tech` skill when implementation is non-trivial. Read the product spec and relevant source code before drafting. Use additional research for architecture spikes, dependency exploration, benchmarks, or experiments when the technical path is uncertain. The tech spec should define:

- current system context with file references
- proposed module/API/state/data-flow changes
- tradeoffs and rollout strategy
- risks and mitigations
- testing and validation mapped back to product behavior

It is acceptable to prototype first if the architecture is too uncertain, then write the tech spec from what was learned.

### 4. Implement approved specs

Use the `specs-implement` skill once the specs are approved enough to build. If implementation reveals surprising behavior, unclear requirements, performance tradeoffs, or a testable hypothesis, launch additional research and record the report before changing direction. During implementation:

- treat `PRODUCT.md` as the behavior source of truth
- treat `TECH.md` as the implementation plan, not an immutable contract
- update specs immediately when behavior or architecture changes
- use `spec_append_milestone` when available to update `MILESTONES.md` after meaningful implementation milestones, setbacks, failed attempts, fixes, validation notes, and decisions
- add tests and artifacts that verify the current specs

For large work, consider optional helper docs in the same spec directory:

- `DECISIONS.md` for focused product/technical decisions that need to stand apart from the milestone log

### 5. Verify against the specs

Before completion, map verification back to the specs:

- unit tests for pure logic and regression coverage
- integration/e2e tests for user flows
- manual walkthroughs, screenshots, or videos for UI-heavy work
- compatibility checks for migrations, old links, old settings, or old serialized data

If a behavior invariant is important enough to write, it should have a verification story.

## Direct commands

If the extension from this package is installed, the user can invoke:

- `/specs <feature>` - start the full workflow
- `/specs-product <feature>` - draft or revise `PRODUCT.md`
- `/specs-tech <path-or-feature>` - draft or revise `TECH.md`
- `/specs-research <topic, question, or research purpose>` - run purpose-directed research inside a spec workflow
- `/specs-implement <spec-dir>` - implement approved specs
- `/specs-audit [area]` - audit spec workflow or spec/code alignment
- `/specs-help` - list commands

The extension also exposes tools:

- `spec_scaffold` - create `PRODUCT.md`, `MILESTONES.md`, optional `TECH.md`, and a registry entry without overwriting files
- `spec_research` - create/focus a spec folder, prepare `research/`, and return a purpose-named report path plus research guidance.
- `spec_focus` / `spec_unfocus` - set or clear the focused spec
- `spec_status` - summarize lifecycle state and artifact readiness
- `spec_finish` - run local completion checks and mark the spec completed when required artifacts exist
- `spec_append_milestone` - append a milestone paragraph to the focused spec's `MILESTONES.md` with visible TUI tool-call context
- `specs_settings_get` / `specs_settings_update` - read or update future audit provider/model defaults

## Keep specs current

When the user steers the work mid-conversation, do not patch only the current file. First decide whether the steering changes observable behavior. If yes, update `PRODUCT.md` first, then update `TECH.md`, then adjust implementation, tests, and `MILESTONES.md` as needed. If behavior does not change, update the lowest affected layer and explain why higher layers stay unchanged.

Update `PRODUCT.md` when:

- user-facing behavior changes
- success criteria or UX details change
- edge cases or compatibility decisions change

Update `TECH.md` when:

- module boundaries or data flow change
- risks, dependencies, rollout, or migration assumptions change
- the testing or validation plan changes

Update `MILESTONES.md` with `spec_append_milestone` when the tool is available. The tool adds a `### YYYY-MM-DD HH:mm:ss - Milestone` heading automatically unless the content already starts with `###`. Use it when:

- an implementation phase completes
- an approach fails and the reason matters
- a setback or blocker is resolved
- validation results affect confidence or next steps
- a decision changes the implementation path

The checked-in specs should describe the feature that actually ships, and the milestone log should explain how the implementation got there.
