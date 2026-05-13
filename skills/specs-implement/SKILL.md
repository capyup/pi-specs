---
name: specs-implement
description: Implement approved PRODUCT.md and TECH.md specs while keeping specs, code, tests, and review artifacts aligned. Use when the user asks to build from specs, implement a spec directory, continue after spec approval, or turn PRODUCT.md/TECH.md into code.
---

# Spec Implementation

Build the feature described by checked-in specs and keep those specs accurate as implementation evolves.

## Target resolution

When `/specs-implement` is invoked without arguments, do not ask immediately. First read `AGENTS.md` and `specs/SPECS.yaml`. If `SPECS.yaml` has exactly one focused spec entry, use that spec directory as the implementation target. Ask the user only when no focused spec can be found or the focused state is ambiguous.

## Prerequisites

Before coding, confirm:

- `PRODUCT.md` exists for user/caller behavior
- `TECH.md` exists when the implementation is non-trivial
- `MILESTONES.md` exists or can be created for free-form implementation history
- specs are approved enough to start, or unresolved questions are explicitly accepted
- repository development commands and test conventions are known

If a required spec is missing, suggest using `specs-product` or `specs-tech` first.

## Start by reading specs

Treat:

- `PRODUCT.md` as the source of truth for observable behavior
- `TECH.md` as the source of truth for implementation shape, sequencing, risks, and validation
- `MILESTONES.md` as the free-form record of meaningful implementation events

Extract:

- behavior invariants to satisfy
- files/modules likely to change
- compatibility constraints and non-goals
- test plan and manual verification requirements

## Inspect current code

Before editing, read the relevant files named in `TECH.md` and nearby tests. Read existing `MILESTONES.md` when present to understand prior attempts and decisions. Verify the tech spec still matches the current codebase. If it is stale, update it before or alongside implementation.

## Plan implementation steps

Plan in the active agent/session rather than creating durable progress files. Use `MILESTONES.md` only for durable narrative history after meaningful events. Good implementation steps are concrete:

- update enum/display/parser in `path`
- wire action through `path`
- add regression test in `path`
- run targeted command

Avoid vague steps like "implement feature" or "add validation". If needed, record durable reasoning in `MILESTONES.md`; use optional docs such as `DECISIONS.md` only when a focused decision log is useful.

## Implement against the specs

During implementation:

- preserve unrelated user changes in the worktree
- keep changes focused on the spec scope
- prefer existing patterns over novel abstractions
- add feature flags for risky or staged rollout when the project uses them
- update tests as behavior lands
- use `spec_append_milestone` when available to update `MILESTONES.md` after meaningful phase changes, setbacks, failed attempts, fixes, validation notes, and decisions
- update specs immediately when behavior or architecture changes

Do not silently diverge from the product spec. If the user steers mid-workflow or a behavior invariant is impossible or undesirable after inspecting the code, update in order: `PRODUCT.md` for behavior, `TECH.md` for implementation shape, then code/tests and `MILESTONES.md`.

## Update specs as needed

Update `PRODUCT.md` when:

- user-facing behavior changes
- edge cases or compatibility behavior changes
- goals/non-goals shift
- UX wording or accessibility expectations change

Update `TECH.md` when:

- files/modules/types differ from the plan
- data flow, ownership, or migration strategy changes
- risks or rollout assumptions change
- the verification plan changes

Keep these updates in the same PR as the code when practical.

Update `MILESTONES.md` with `spec_append_milestone {current_spec_name} {milestone_content}` when the tool is available. The tool adds a `### YYYY-MM-DD HH:mm:ss - Milestone` heading automatically unless the content already starts with `###`. Use it when:

- an implementation phase reaches a useful checkpoint
- an approach fails or is abandoned
- a setback, blocker, or confusing bug is resolved
- validation passes, fails, or changes direction
- a decision affects future maintainers or agents

## Verify

Prefer targeted verification first, then broader checks:

1. unit tests for changed logic
2. integration/e2e tests for important flows
3. lint/format/typecheck commands required by the repo
4. manual artifacts for UI/UX behavior when needed

Map verification back to the product behavior numbers. If a behavior is not verified, explain the residual risk.

Run the most relevant validation available after changes: targeted tests for changed behavior, type checks or lint checks when applicable, build checks for affected packages, and a minimal smoke test when full validation is too expensive. If validation cannot be run, explain why and name the next best check.

## Stop conditions

Stop when the current specs, code, and tests agree on the implemented behavior; relevant validation has either passed or been honestly reported as unavailable; and any remaining blockers or follow-ups are explicit. Do not broaden the request into unrelated refactors or speculative improvements.

## Final report

When done, summarize:

- specs read and updated
- milestone log entries added
- code paths changed
- tests or manual verification run
- behavior invariants covered
- any deviations, follow-ups, or risks

Do not claim completion solely because code compiles; completion means the current code matches the current specs.
