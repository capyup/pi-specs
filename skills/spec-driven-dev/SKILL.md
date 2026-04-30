---
name: spec-driven-dev
description: Run a pragmatic spec-driven development workflow for substantial features, risky behavior changes, cross-cutting refactors, or agent-driven implementation. Use this whenever the user mentions PRODUCT.md, TECH.md, specs/, PRD, product spec, tech spec, ready-to-spec, spec-first implementation, or asks to plan a feature before coding.
---

# Spec-Driven Development

Use this skill to drive a feature from intent to implementation through checked-in specs. It is adapted from the Warp repository's spec workflow, but written to fit any project.

## First principles

- Specs are working inputs for implementation and review, not ceremony.
- `PRODUCT.md` owns observable behavior from the user/caller perspective.
- `TECH.md` owns implementation shape, codebase context, risks, and validation.
- Code, tests, and specs should describe the same feature by the time the PR ships.
- Skip specs for small local bug fixes, narrow refactors, and obvious one-file tweaks.

## Prompting posture

- Prefer outcome-first guidance: define the artifact, success criteria, constraints, available evidence, and final answer shape; do not over-prescribe the agent's internal process.
- Use absolute words like `always`, `never`, and `must` only for real invariants such as safety, file ownership, required outputs, or non-destructive behavior. Use decision rules for judgment calls.
- For multi-step or tool-heavy work, begin with a short visible preamble that acknowledges the task and states the first step.
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
- inspect examples of `PRODUCT.md`, `TECH.md`, `TASKS.md`, PRDs, design docs, or RFCs
- inspect test and validation conventions

Default convention when none exists:

```text
specs/YYYY-MM-DD-kebab-feature/PRODUCT.md
specs/YYYY-MM-DD-kebab-feature/TECH.md
specs/YYYY-MM-DD-kebab-feature/TASKS.md
```

`TASKS.md` is the spec-scoped task database. Keep it as pure Markdown todos in the same directory as the specs so product intent, technical plan, and live progress stay together.

When no convention exists, propose the convention to the user before finalizing it: spec root, date-prefixed directory name, and `TASKS.md` format. If the user agrees or says to proceed, create/update `AGENTS.md` with one sentence for the spec root and one sentence for the `YYYY-MM-DD-kebab-feature` naming format.

Use a ticket id when available (`APP-1234`, `GH408`, `JIRA-123`) only if the project already prefers ticket ids. Otherwise default to `YYYY-MM-DD-kebab-feature`. If the package extension is installed, you can call `spec_scaffold` to create the directory and starter files.

## Workflow

### 1. Capture intent and task shape

Clarify only what is needed to avoid guessing:

- feature summary and target users/callers
- triggering issue/ticket, if any
- expected behavior and non-goals
- important edge cases or compatibility constraints
- UI design/Figma/mock availability when relevant
- expected validation bar

If the user already gave enough context, proceed instead of over-interviewing.

For non-trivial workflows, use the built-in task manager when available:

- create compact Markdown todo tasks in the spec directory's `TASKS.md` for product spec, tech spec, implementation, validation, and follow-ups when there are three or more meaningful steps
- pass `specDir` to task tools when more than one spec exists or the active spec is ambiguous
- keep task entries compact; detailed rationale belongs in `PRODUCT.md` and `TECH.md`
- mark a task `in_progress` before starting that phase and `completed` only when it is actually done
- add dependencies when a task cannot begin until another task completes
- skip task tracking for tiny one-step fixes or purely conversational answers

### 2. Write the product spec first

Use the `spec-product` skill. The product spec should define:

- what problem is being solved
- desired user/caller experience
- numbered, testable behavior invariants
- states, transitions, inputs, outputs, and edge cases
- goals, non-goals, and open questions when useful

Keep implementation details out unless they are visible to the consumer of the surface.

### 3. Write the tech spec when warranted

Use the `spec-tech` skill when implementation is non-trivial. Read the product spec and relevant source code before drafting. The tech spec should define:

- current system context with file references
- proposed module/API/state/data-flow changes
- tradeoffs and rollout strategy
- risks and mitigations
- testing and validation mapped back to product behavior

It is acceptable to prototype first if the architecture is too uncertain, then write the tech spec from what was learned.

### 4. Implement approved specs

Use the `spec-implement` skill once the specs are approved enough to build. During implementation:

- treat `PRODUCT.md` as the behavior source of truth
- treat `TECH.md` as the implementation plan, not an immutable contract
- update specs immediately when behavior or architecture changes
- add tests and artifacts that verify the current specs

For large work, consider optional helper docs in the same spec directory:

- `PROJECT_LOG.md` for checkpoints, explored paths, and current state
- `DECISIONS.md` for concrete product/technical decisions

### 5. Verify against the specs

Before completion, map verification back to the specs:

- unit tests for pure logic and regression coverage
- integration/e2e tests for user flows
- manual walkthroughs, screenshots, or videos for UI-heavy work
- compatibility checks for migrations, old links, old settings, or old serialized data

If a behavior invariant is important enough to write, it should have a verification story.

## Direct commands

If the extension from this package is installed, the user can invoke:

- `/spec-workflow <feature>` - start the full workflow
- `/spec-product <feature>` - draft or revise `PRODUCT.md`
- `/spec-tech <path-or-feature>` - draft or revise `TECH.md`
- `/spec-implement <spec-dir>` - implement approved specs
- `/spec-audit [area]` - audit spec workflow or spec/code alignment
- `/spec-help` - list commands

The extension also exposes tools:

- `spec_scaffold` - create `PRODUCT.md`, optional `TECH.md`, and `TASKS.md` under the documented spec root without overwriting files
- `spec_list` - list current spec directories and whether each has product/tech/tasks files

## Keep specs current

When the user steers the work mid-conversation, do not patch only the current file. First decide whether the steering changes observable behavior. If yes, update `PRODUCT.md` first, then update `TECH.md`, then update `TASKS.md`, then adjust implementation and tests as needed. If behavior does not change, update the lowest affected layer and explain why higher layers stay unchanged.

Update `PRODUCT.md` when:

- user-facing behavior changes
- success criteria or UX details change
- edge cases or compatibility decisions change

Update `TECH.md` when:

- module boundaries or data flow change
- risks, dependencies, rollout, or migration assumptions change
- the testing or validation plan changes

Update `TASKS.md` when:

- phase status changes
- task dependencies change
- user steering changes sequencing or introduces/removes work
- task file drift is detected; run or recommend `npm run tasks:repair` when available

The checked-in specs and tasks should describe the feature that actually ships, not just the initial intent.
