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

- `CONTRIBUTING.md`, `README.md`, `AGENTS.md`, `WARP.md`, `CLAUDE.md`, or equivalent agent docs
- existing `specs/`, `docs/specs/`, `rfcs/`, `docs/adr/`, or issue-linked directories
- examples of `PRODUCT.md`, `TECH.md`, `product.md`, `tech.md`, PRDs, design docs, or RFCs
- test and validation conventions

Default convention when none exists:

```text
specs/<ticket-or-feature-id>/PRODUCT.md
specs/<ticket-or-feature-id>/TECH.md
```

Use a ticket id when available (`APP-1234`, `GH408`, `JIRA-123`). Otherwise ask for a short kebab-case feature id. If the package extension is installed, you can call `spec_scaffold` to create the directory and starter files.

## Workflow

### 1. Capture intent

Clarify only what is needed to avoid guessing:

- feature summary and target users/callers
- triggering issue/ticket, if any
- expected behavior and non-goals
- important edge cases or compatibility constraints
- UI design/Figma/mock availability when relevant
- expected validation bar

If the user already gave enough context, proceed instead of over-interviewing.

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

- `spec_scaffold` - create `specs/<id>/PRODUCT.md` and optional `TECH.md` without overwriting files
- `spec_list` - list current spec directories and whether each has product/tech specs

## Keep specs current

Update `PRODUCT.md` when:

- user-facing behavior changes
- success criteria or UX details change
- edge cases or compatibility decisions change

Update `TECH.md` when:

- module boundaries or data flow change
- risks, dependencies, rollout, or migration assumptions change
- the testing or validation plan changes

The checked-in specs should describe the feature that actually ships, not just the initial intent.
