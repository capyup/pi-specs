# Product Spec: Superpowers-inspired research, grilling, and audit flow

Issue: user request to study Claude Superpowers, borrow the useful workflow ideas without importing the overly complex machinery, and define an early research phase that can grill the user through brainstorming before a later, clearer audit/research phase.

## Summary

Pi should support `/specs-research` as a Superpowers-inspired workflow for research-driven spec formation: scaffold a spec folder structure early, perform purpose-directed research, grill the user adversarially through focused brainstorming, then produce a compact behavioral direction that can later feed a clearer audit or implementation spec. The feature should be available both as a user-facing interactive slash command and as an agent-callable tool that tells agents what to research, where to put reports, and how to connect research back to the spec. Research should become a first-class capability throughout product, technical, and implementation phases, not only a one-time literature or code lookup. It should borrow Superpowers' strongest collaboration pattern--Socratic requirement refinement before action--without forcing its full TDD, worktree, mandatory subagent, or long autonomous execution system.

## Background Evidence

- Anthropic's Superpowers plugin page describes it as a skills framework for structured software development, including brainstorming, TDD, systematic debugging, subagent development with code review, and skill authoring: https://claude.com/plugins/superpowers
- The `obra/Superpowers` repository describes the basic workflow as brainstorming before code, design chunks for sign-off, writing implementation plans, then execution/review workflows: https://github.com/obra/Superpowers/
- Local source research is summarized in `specs/2026-05-13-superpowers-inspired-research-flow/research/2026-05-13-initial-superpowers-mechanisms.md`.
- Borrowable insight: the agent should not jump straight to coding or final recommendations when the user's intent is still rough.
- Constraint: Pi should not copy the entire Superpowers methodology; the desired shape is smaller, explicit, and tuned for research/spec/audit workflows.

## Behavior

1. The workflow is exposed as `/specs-research`, not as a separate `/grill-me` command in the first version.
2. `/specs-research` is both a user-facing interactive slash command and an agent-callable tool surface.
3. When invoked by a user, `/specs-research <topic>` starts an interactive workflow that can ask questions, create or select a spec, run research, and grill the user.
4. When invoked by an agent/tool flow, `spec_research` accepts a research purpose, target spec or scaffold id, topic, and optional instructions, then returns guidance and report paths the agent should use.
5. The workflow scaffolds or focuses the spec folder structure before substantive research starts, even when the product spec is not yet final, so pre-spec research artifacts have a durable home.
6. In this workflow, `scaffold` primarily means choosing/creating the canonical spec directory name and subdirectory layout; it does not mean prematurely filling in final `PRODUCT.md`, `TECH.md`, or other spec content.
7. Early scaffold creation must create enough filesystem structure for research reports, milestone logs, and later spec drafting without pretending the behavior is already approved.
8. When a user starts an ambiguous feature, research, or audit-adjacent task through this command, Pi begins with a purpose-directed research phase instead of coding or finalizing the answer.
9. The initial research phase performs a deeper pass than a quick lookup: it should inspect primary sources, relevant docs or code, and enough external commentary to understand the reference system's actual logic.
10. The initial research phase is still separate from audit: it should explain mechanisms, extract patterns, and identify uncertainties, but it should not yet verify implementation drift or make completion claims.
11. Every durable research report uses a purpose-specific filename so multiple reports can coexist, including reports from parallel agents or later audit phases.
12. Research report names should encode date, phase/purpose, and a short slug, for example `research/2026-05-13-initial-superpowers-mechanisms.md` or `research/2026-05-13-audit-implementation-drift.md`.
13. After initial research, Pi enters a `grill me` / brainstorming phase that asks pointed questions, challenges assumptions, and surfaces tradeoffs.
14. The default grilling style is adversarial but collaborative, closer to an investor or architecture review than a gentle intake form.
15. The grilling phase should ask few questions at a time, but each question should pressure-test value, scope, risks, and hidden assumptions.
16. During grilling, Pi may propose strawman options and ask the user to accept, reject, or modify them.
17. Pi should capture the user's answers as evolving product direction, updating `PRODUCT.md` first when observable behavior changes.
18. Once enough direction exists, Pi produces a compact synthesis with: borrowed ideas, rejected complexity, candidate workflow stages, success criteria, and open questions.
19. A later audit phase may perform a separate research pass with a different purpose-specific report name, comparing the product direction against implementation, source evidence, or external references.
20. The later audit phase is distinct from initial research because its purpose, report name, and evidence questions differ; it is not merely "research again."
21. Research includes literature review, web/source lookup, codebase investigation, design exploration, prototype spikes, controlled experiments, benchmarks, transcript comparisons, and any other inquiry that can define observations or measurable outcomes before changing direction.
22. A research task should make its purpose explicit and, when experimental, define observable, statistical, or quantitative signals before drawing conclusions.
23. Research reports should preserve the observation -> feedback -> modification -> iteration loop so later agents can see what was tried, what was observed, and how the spec or plan changed.
24. Product-spec, tech-spec, and implementation prompts should remind agents that they may launch additional `/specs-research` work whenever uncertainty, missing evidence, risky assumptions, or measurable design tradeoffs appear.
25. The workflow should not require a state machine or durable research-status database; the agent loop remains responsible for planning, sequencing, and deciding when enough research has been done.
26. The workflow should expose non-goals clearly so the team does not accidentally adopt Superpowers' whole process.
27. The workflow should remain compatible with the existing `pi-specs` model: `PRODUCT.md` owns behavior, `TECH.md` is added only when implementation planning becomes necessary, and `MILESTONES.md` records meaningful decisions or phase changes.
28. If external research is unavailable, Pi should continue with local evidence and explicitly mark any claims that need later verification.
29. If the user answers a grilling question by changing the desired behavior, Pi should update the product spec before any technical plan or implementation.
30. If the user asks to stop after brainstorming, the workflow should leave a readable draft with open questions rather than pretending the work is complete.

## Candidate Workflow Stages

1. `orientation`: restate the task, identify whether this is research, spec, audit, implementation, or mixed work.
2. `early scaffold`: create or focus the canonical spec directory and research subfolder before substantive research so reports have a stable destination.
3. `purpose-directed research`: inspect primary sources, docs/code, selected commentary, or experimental evidence for the requested research purpose; save a purpose-named report.
4. `adversarial grill me`: ask Socratic, decision-driving questions; challenge vague goals, hidden constraints, value, risks, and tradeoffs.
5. `synthesis`: convert answers and observations into concise product direction, `PRODUCT.md` updates, decision notes, or a later `TECH.md` seed.
6. `research during product/tech/implement`: allow agents to launch additional purpose-named research whenever a later phase exposes uncertainty or a testable hypothesis.
7. `deep audit later`: run a separate purpose-named evidence pass only after the desired behavior is clearer.

## Borrow From Superpowers

- Use workflow docs like skill documents: explicit instructions that shape agent behavior, not just descriptive prose.
- Start by asking what the user is really trying to do before acting.
- Refine rough ideas through dialogue before writing plans or code.
- Present conclusions in chunks small enough to review.
- Keep an explicit plan/audit boundary so early brainstorming does not masquerade as validation.
- Prefer evidence and verification over confident claims.

## Do Not Borrow

- Mandatory red-green-refactor TDD for every workflow.
- Automatic worktree creation as a default behavior.
- Mandatory subagent-driven development for every task.
- Multi-hour autonomous execution as a normal expectation.
- Large skill hierarchies or automatic triggers that make the workflow hard to understand.
- Blocking progress on full formal planning when the user only needs a small research-and-brainstorming loop.

## Goals / Non-goals

- Goal: define `/specs-research` as an inspectable research-first slash-command workflow inspired by Superpowers.
- Goal: expose the same workflow as an agent-callable tool so agents can start purpose-directed research inside spec formation.
- Goal: make research available from product, tech, and implementation prompts so development can be research-driven as well as spec-driven.
- Goal: support broad research methods, including external literature, code archaeology, prototypes, benchmarks, experiments, and measurable observation loops.
- Goal: establish spec folder names and subdirectory structure before research starts so pre-spec research reports have a durable destination.
- Goal: make adversarial `grill me` a first-class brainstorming phase inside `/specs-research`.
- Goal: separate initial mechanism research from later formal audit research through different report purposes and filenames.
- Goal: preserve the existing spec-driven hierarchy: behavior first, technical plan only when useful, milestone log for history.
- Goal: keep the workflow small enough that users can understand and steer it mid-session.
- Non-goal: clone Superpowers or reimplement its full skill library.
- Non-goal: require TDD, worktrees, or subagents for research-only work.
- Non-goal: replace `/specs-audit`; the later audit phase should complement it or feed into it.
- Non-goal: define final implementation details before the user finishes the grilling phase.

## Success Criteria

1. A user can invoke `/specs-research <topic>` and get a researched, question-driven brainstorming session before any implementation plan.
2. An agent can invoke the corresponding tool to start research inside an existing or newly scaffolded spec directory.
3. Research reports are durable, purpose-named files, allowing multiple reports from different phases or parallel agents to coexist.
4. Product, tech, and implementation prompts all remind agents that additional research is available when uncertainty or testable hypotheses appear.
5. Research reports can document experiments with predeclared observable or quantitative signals, not only written-source summaries.
6. The workflow records which Superpowers ideas are adopted and which are explicitly rejected.
7. The agent asks fewer, sharper, more adversarial questions instead of overwhelming the user with a long intake form.
8. Initial research is deep enough to explain the reference system's mechanisms before grilling begins.
9. A later audit can reuse the synthesized direction and prior reports without being a duplicate of initial research.
10. The spec can evolve incrementally as the user answers questions.

## Open questions

- What should be the default output after grilling: `PRODUCT.md` patch, decision log, `TECH.md` seed, or all of these when applicable?
- Should purpose-named research reports live under `research/` inside each spec directory, or at the spec root with filenames that include the spec id?
- What exact boundary should separate deep initial research from the later audit phase?
- Should later audit research use Oracle/subagents, Exa, local repo review, experiments, or a configurable mix?
