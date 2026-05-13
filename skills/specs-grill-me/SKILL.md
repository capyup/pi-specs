---
name: specs-grill-me
description: Grill the current spec design, research evidence, technical plan, or implementation progress with adversarial questions. Use when the user invokes /specs-grill-me, says grill the current spec, asks to stress-test PRODUCT.md/TECH.md/progress, or wants focused questioning around a spec.
---

# Specs Grill Me

Use this skill to stress-test the current spec's design or progress. This is the dedicated grilling entrypoint for spec work; it is related to `specs-research`, but starts from an existing/focused spec and its current artifacts.

## Target resolution

When `/specs-grill-me` is invoked without arguments, do not ask immediately. First read `AGENTS.md` and `specs/SPECS.yaml`. If `SPECS.yaml` has exactly one focused spec entry, use that spec as the target. Ask the user only when no focused spec can be found or the target remains ambiguous.

When an argument is provided, treat it as a spec id, path, title, or focus area. If it names a spec, use that spec. If it names a focus area, use the focused spec and grill that area.

## Read before asking

Before grilling, inspect the relevant current artifacts:

- `PRODUCT.md` for behavior and open questions
- `TECH.md` when present for implementation shape, risks, validation, and sequencing
- `MILESTONES.md` for progress, decisions, failed attempts, and validation history
- `research/` reports for evidence, experiments, benchmarks, prototypes, or prior investigations
- source files or tests when the answer can be discovered from the workspace

Do not ask the user questions that the repository or existing reports can answer.

## Grilling loop

This is not a state machine. It is an agentic loop: inspect, ask, interpret, inspect again when needed, and synthesize.

1. **Identify the target.** State whether you are grilling product behavior, technical plan, implementation progress, research evidence, validation, or a specific open decision.
2. **Find the weakest branch.** Look for the assumption, dependency, missing evidence, unclear success criterion, or progress risk most likely to break the plan.
3. **Ask one decision branch at a time.** Use `spec_questionaire` or `spec_questionnaire` when available. A small cluster of tightly related branch questions is acceptable; a long intake form is not.
4. **Provide a recommended answer.** Every question should include a concrete recommended answer or default proposal the user can accept, reject, or modify.
5. **Resolve dependencies in order.** Do not ask downstream implementation details before the product or evidence dependency they rely on is settled.
6. **Continue after each answer.** Decide whether to research a dependency, ask the next grilling question, update specs, or synthesize current understanding. Do not stop after one ceremonial question.
7. **Stop only on real completion.** Stop when the user confirms the plan holds together, explicitly ends the session, or remaining risks/open questions are written down clearly enough for the next phase.

## Questioning style

Be direct, specific, and adversarial but collaborative. Challenge:

- whether the current behavior is actually the behavior the user wants
- whether `PRODUCT.md` is testable or still vague
- whether `TECH.md` overbuilds, underbuilds, or relies on unstated assumptions
- whether progress in `MILESTONES.md` proves the important parts or only easy parts
- whether research evidence actually supports the current direction
- whether validation has observable or quantitative signals
- whether the next step should be more research, a spec update, implementation, or audit

## Updating artifacts

If an answer changes observable behavior, update `PRODUCT.md` first. If it changes implementation shape, validation, risks, or sequencing, update `TECH.md`. If it resolves a meaningful decision, failed assumption, or progress risk, append to `MILESTONES.md` with `spec_append_milestone`.

If the grilling reveals missing evidence, launch `spec_research` or `/specs-research` and write a purpose-named report under `research/` before making claims that depend on that evidence.

## Output

After each grilling round, summarize briefly:

- what was answered
- what changed, if anything
- the next weakest branch or why grilling can stop
- files updated, if any
