# Research Brief: Claude Superpowers Logic

Spec: `specs/2026-05-13-superpowers-inspired-research-flow/PRODUCT.md`

## Sources Inspected

- Anthropic plugin listing: https://claude.com/plugins/superpowers
- Upstream repository: https://github.com/obra/Superpowers/
- Original release announcement: https://blog.fsck.com/2025/10/09/superpowers/
- Local clone for source inspection: `.pi/research/superpowers`
- Key upstream files inspected:
  - `.pi/research/superpowers/README.md`
  - `.pi/research/superpowers/hooks/session-start`
  - `.pi/research/superpowers/skills/using-superpowers/SKILL.md`
  - `.pi/research/superpowers/skills/brainstorming/SKILL.md`
  - `.pi/research/superpowers/skills/writing-plans/SKILL.md`
  - `.pi/research/superpowers/skills/subagent-driven-development/SKILL.md`
  - `.pi/research/superpowers/skills/requesting-code-review/SKILL.md`
  - `.pi/research/superpowers/skills/test-driven-development/SKILL.md`
  - `.pi/research/superpowers/skills/systematic-debugging/SKILL.md`

## Mechanism Summary

Superpowers is not just a prompt pack. Its main mechanism is a bootstrap plus a library of mandatory workflow skills.

1. `hooks/session-start` injects the full `using-superpowers` skill into the agent's session context.
2. `using-superpowers` tells the agent to check for skills before responding or acting, with deliberately forceful language against rationalizing around the workflow.
3. Each skill has metadata and a detailed process. The agent is expected to load and follow the relevant skill when its trigger applies.
4. The core product loop is: brainstorm -> approve design -> create isolated worktree -> write detailed plan -> execute plan -> review after tasks -> finish branch.
5. The implementation loop is intentionally strict: TDD, small tasks, verification, code review, and branch cleanup.
6. Superpowers treats skills as behavior-shaping code, not passive documentation. The repo's contributor guidance says skill changes require evaluation evidence.

## Core Workflow Logic

### 1. Bootstrap and skill discipline

The session-start hook injects `using-superpowers`, which establishes a rule: if a skill might apply, the agent must invoke it before acting. This is the foundation that makes later skills auto-trigger behaviorally rather than relying on the user to remember commands.

Borrowable pattern: a workflow can improve agent behavior by placing a small, high-priority orientation rule at the start of a task.

Risk for pi-specs: copying this forceful auto-trigger model would conflict with Pi's lighter, user-steered spec workflow. Pi should prefer explicit slash commands or focused specs over global mandatory behavior.

### 2. Brainstorming before implementation

The brainstorming skill hard-gates implementation until the agent has explored context, asked clarifying questions, proposed alternatives, presented a design, written a design doc, reviewed it, and received user approval.

Borrowable pattern: do not jump from rough intent to code; make the design reviewable in chunks.

Risk for pi-specs: Superpowers asks one question at a time and requires a saved design doc plus commit. That is too heavy for research/spec/audit ideation unless the user asks to proceed into implementation.

### 3. Planning as executable instructions

The writing-plans skill assumes a future implementer has almost no project context. Plans include exact files, test code, commands, expected failures, expected passes, and commit steps. This reduces ambiguity for subagents or future sessions.

Borrowable pattern: when a plan is needed, make it concrete enough to execute and verify without guessing.

Risk for pi-specs: this belongs in `TECH.md` or implementation plans, not in early research. Bringing this too early would kill brainstorming velocity.

### 4. Review split: spec compliance before code quality

Subagent-driven development uses two reviews after each task: first whether the implementation matches the spec, then whether the code is good. The spec reviewer is explicitly told not to trust the implementer's report and to inspect the code independently.

Borrowable pattern: audit should separate "did we build the requested thing?" from "is it well-built?"

Risk for pi-specs: this is implementation-stage machinery. For the requested flow, the audit boundary should stay unresolved until the desired behavior is clearer.

### 5. TDD and debugging rigor

Superpowers enforces red-green-refactor for feature/bug work and systematic root-cause investigation for debugging. The language is intentionally uncompromising.

Borrowable pattern: for implementation or bugfix phases, evidence should precede completion claims.

Risk for pi-specs: the user explicitly does not want the full complexity. TDD should not be mandatory for research-only or brainstorming-only flows.

### 6. Skills as self-improving operational knowledge

The release announcement emphasizes reading a document, codebase, or book and turning lessons into reusable skills. It also describes testing skills through pressure scenarios rather than quiz-like checks.

Borrowable pattern: after researching Superpowers, Pi can distill reusable workflow lessons into a small skill or command, then pressure-test it with realistic adversarial scenarios.

Risk for pi-specs: a large skill hierarchy would recreate Superpowers' complexity. The first version should be one command/workflow, not a full methodology package.

## What Pi Should Borrow

1. Explicitly refuse to jump straight to implementation when intent is rough.
2. Start with research that understands the reference system or problem domain.
3. Use adversarial but collaborative questioning to expose weak assumptions.
4. Present synthesis in reviewable chunks.
5. Preserve a clear boundary between early research, product direction, technical planning, implementation, and audit.
6. Split later audit into at least two questions: spec fit and implementation/code quality.
7. Treat workflow docs/skills as behavior-shaping artifacts that need testing, not prose that merely sounds good.

## What Pi Should Reject For This Feature

1. Global mandatory skill invocation before every response.
2. Mandatory TDD for non-implementation tasks.
3. Automatic worktree creation during research or brainstorming.
4. Mandatory subagent-driven development for every plan.
5. Long autonomous execution as the default expectation.
6. One-question-at-a-time rigidity when a compact questionnaire is more efficient.
7. Committing design docs automatically as part of brainstorming.
8. A broad Superpowers-style methodology layer before proving the smaller command is useful.

## Proposed Pi Shape

The first productized shape should be an explicit command, not implicit behavior:

- `/specs-research <topic>`: research-first entrypoint that can produce a research brief, then grill the user, then update/create `PRODUCT.md`.
- `/grill-me <topic>`: possible alias or narrower command for adversarial brainstorming when research already exists.

Recommended first command semantics:

1. Orient: classify the task as research/spec/audit/implementation/mixed.
2. Deep initial research: inspect primary sources and source code/docs when available.
3. Research brief: summarize mechanisms, borrowable patterns, rejected complexity, and uncertainties.
4. Adversarial grill: ask pointed questions that challenge value, scope, risks, and hidden assumptions.
5. Synthesis: update `PRODUCT.md`, write a decision/research note, or prepare a `TECH.md` only if implementation is now clear.
6. Deferred audit: record what the later audit must verify, but do not perform it by default.

## Open Research Questions

- Should `/specs-research` and `/grill-me` be separate commands or one command with modes?
- Should the adversarial grilling style be configurable, or should it be the default identity of this workflow?
- Should research briefs be durable files like `RESEARCH.md`, sections in `PRODUCT.md`, or temporary session summaries?
- Should later audit reuse existing `/specs-audit`, or should it have a specialized research-audit mode?
- What evaluation should prove the command improves outcomes: transcript comparisons, pressure prompts, implementation drift checks, or all three?
