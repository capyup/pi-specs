---
name: specs-research
description: Run purpose-directed research inside a spec workflow before or during PRODUCT.md, TECH.md, implementation, or audit work. Use when the user invokes /specs-research, asks to research before deciding, wants to grill assumptions with evidence, or when an agent needs evidence, experiments, benchmarks, prototypes, or code/source investigation to reduce uncertainty.
---

# Spec Research

Use research to drive spec formation and implementation decisions. Research is broader than source lookup: it includes literature/web/docs review, codebase archaeology, prototype spikes, benchmarks, transcript comparisons, controlled experiments, and any inquiry that can produce observations or measurable signals before changing direction.

## Purpose

`/specs-research` exists so ambiguous work can start with evidence before product behavior, technical plans, implementation, or audit conclusions harden. It borrows the useful part of Superpowers-style brainstorming: understand the problem and pressure-test assumptions before acting.

## Workflow

1. **Orient.** Restate the topic and identify whether the research supports product discovery, technical design, implementation, audit, or an experiment.
2. **Prepare the spec folder.** Use `spec_research` when available. If no spec exists yet, provide a short `id` and title so the tool can create the canonical spec directory and `research/` subfolder before substantive research starts.
3. **Treat scaffold as structure.** A research-first scaffold means folder name and directory layout first; placeholder spec files are not final behavior or approved technical design.
4. **Define the purpose.** Give the research a concise purpose that will be visible in the report filename, such as `initial-superpowers-mechanisms`, `product-risk-grill`, or `benchmark-parser-options`.
5. **Pick methods.** Use the least sufficient mix of sources, repo inspection, docs, experiments, prototypes, benchmarks, or transcript comparisons. Do not restrict research to web search.
6. **Predeclare signals for experiments.** If running an experiment, state the observable, statistical, or quantitative signal before interpreting results.
7. **Write the report.** Save findings to the report path returned by `spec_research`. Include sources/method, observations, conclusions, and impact on the spec or plan.
8. **Start the research-question loop.** Use the report to ask the first decision-driving grilling question. Do not stop after one shallow clarification.
9. **Continue the loop.** After each answer, decide whether the next best move is more research, another grilling question, or synthesis. Repeat until shared understanding is reached, the user explicitly stops, or remaining uncertainty is clearly documented.
10. **Update specs top-down.** If research or grilling changes observable behavior, update `PRODUCT.md` first. Update `TECH.md` only when implementation shape, risks, or validation change.
11. **Record meaningful milestones.** Use `spec_append_milestone` when research starts a new phase, resolves uncertainty, changes direction, or produces evidence that affects future work.

## Research Report Guidance

A good report answers:

- What was the research purpose?
- What sources, code, prototypes, benchmarks, or experiments were used?
- What observations were made?
- Which conclusions are supported by evidence?
- What changed in `PRODUCT.md`, `TECH.md`, implementation, or audit expectations?
- What uncertainty remains?

For experiments, include:

- hypothesis or question
- observable or measurable signal
- setup and command/procedure
- result
- interpretation and limits

## Grilling Procedure

This integrates the `grill-me` workflow into spec research. The agent is expected to be agentic: keep walking the decision tree until the plan holds together, without needing a durable state machine.

1. **Identify the target.** Name the active plan, spec, research question, or design assumption being grilled. Prefer the focused spec when the user has not specified another target.
2. **Explore before asking.** If a question can be answered by reading files, searching docs, running commands, or inspecting prior research reports, do that instead of asking the user.
3. **Ask one decision branch at a time.** Use `spec_questionaire` or `spec_questionnaire` when available. A single tool call may include a small cluster of tightly related branch questions, but do not dump an intake form.
4. **Provide a recommended answer.** Every grilling question should include a concrete recommended answer as an option, so the user can accept, reject, or modify it.
5. **Resolve dependencies in order.** Do not jump to downstream details until the current branch is settled enough to reason about the next branch.
6. **Loop.** After the answer, explicitly choose: research a dependency, ask the next adversarial question, update the spec, or synthesize. Continue until shared understanding is reached.
7. **Stop only for real stop conditions.** Stop when the user explicitly ends the session, confirms the plan holds together, or the remaining risks/open questions are clearly written down.

## Questioning Style

Default to adversarial but collaborative questioning. Ask fewer, sharper questions. Challenge:

- whether the problem is worth solving
- whether the proposed scope is too broad or too vague
- whether the user is copying a reference system's complexity unnecessarily
- whether success can be observed or measured
- what evidence would change the decision

Do not turn grilling into a long intake form. Ask questions that change the spec or plan. Do not ask one ceremonial question and then declare the research phase complete.

## Boundaries

- Do not create a research state machine or durable research status database.
- Do not treat research reports as completion evidence by themselves.
- Do not force TDD, worktrees, or subagents for research-only work.
- Do not overwrite existing research reports; use purpose-named files so parallel or later research can coexist.
- Do not make implementation claims that depend on research before writing the report.
