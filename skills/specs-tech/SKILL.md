---
name: specs-tech
description: Write or revise an implementation-focused TECH.md spec grounded in the current codebase. Use when the user asks for a tech spec, implementation plan, architecture plan, TECH.md, codebase-grounded design, migration plan, or validation plan tied to a PRODUCT.md/product spec.
---

# Tech Spec Writer

Translate product intent into an implementation plan that fits the existing codebase and gives reviewers a concrete plan to evaluate.

## Preconditions

Prefer to have a sibling `PRODUCT.md` first. If no product spec exists, either:

- ask whether to draft a product spec first, or
- proceed only when the work is purely technical and behavior is already settled.

Do not guess about architecture when the code can be inspected directly.

## Research before writing

Read, in order:

1. the product spec or issue description
2. repository contribution/agent docs (`CONTRIBUTING.md`, `AGENTS.md`, `WARP.md`, etc.)
3. relevant source files, tests, and existing patterns
4. nearby specs for similar changes

Use the minimum code and document inspection needed to ground the plan. Make another pass only when a required file, API, state transition, owner, migration detail, or validation path is missing or unsupported. If architecture is uncertain, use `/specs-research` or `spec_research` for source-code archaeology, dependency exploration, prototype spikes, benchmark plans, or experiments with observable/quantitative signals.

Identify:

- relevant purpose-named research reports under the spec's `research/` directory, if any
- entry points for the user flow or API
- existing types, state, events, and data flow
- ownership boundaries and persistence/network/migration concerns
- test harnesses and validation conventions
- feature flags or rollout mechanisms

## Plan traceability

Make the implementation plan traceable rather than exhaustive. Include:

- product behavior requirements and where the plan addresses them
- named files, modules, types, APIs, commands, or systems involved
- state transitions, data flow, ownership, and failure behavior where relevant
- validation commands or manual checks mapped to product behavior numbers
- privacy, security, compatibility, rollout, and migration considerations when they can affect the design
- open questions that materially affect implementation

## File location

Match the product spec directory. Default:

```text
specs/YYYY-MM-DD-kebab-feature/TECH.md
specs/YYYY-MM-DD-kebab-feature/MILESTONES.md
```

If the feature is large, additional focused tech docs can live alongside it, for example `TECH-protocol.md`, `TECH-client-wiring.md`, or checklists. Keep the top-level `TECH.md` as the map. Keep implementation history in `MILESTONES.md` rather than turning `TECH.md` into a diary.

## Required structure

Use this structure unless the repo has an established alternative:

```markdown
# Tech Spec: <title>

Product spec: `specs/<id>/PRODUCT.md`

## Context

Current system, relevant files, and why they matter.

## Proposed changes

Concrete implementation plan.

## Testing and validation

How behavior from PRODUCT.md will be verified.
```

Optional sections, only when useful:

- `## End-to-end flow` - when tracing the lifecycle clarifies the plan
- `## Diagram` - Mermaid diagrams for non-trivial data/state flow
- `## Risks and mitigations` - real failure modes and rollout hazards
- `## Parallelization` - clean agent/team splits
- `## Follow-ups` - intentionally deferred work

## Context section

Ground the plan in code. Include file references with line numbers when possible:

```markdown
- `app/src/settings_view/mod.rs:230` - display names and parsing for settings sections.
- `app/src/settings_view/mod_test.rs:199` - existing round-trip tests to extend.
```

Explain current behavior and constraints. Reference `PRODUCT.md` for desired behavior instead of restating every invariant. Cite any relevant `research/YYYY-MM-DD-<purpose>.md` reports that shaped the technical plan.

## Proposed changes section

Be concrete about:

- modules/files to change
- new or renamed types, APIs, fields, events, or commands
- data flow and ownership
- persistence, migration, compatibility, and rollout
- feature flags or staged enablement
- tradeoffs when more than one approach is plausible

Prefer repo-native patterns over generic architecture advice.

For work that will be implemented by an agent or split across phases, include a compact implementation sequence with dependencies. Name dependencies explicitly, for example `implementation depends on approved TECH.md` or `validation depends on code changes`.

## Testing and validation section

Map important product behavior to verification:

```markdown
- Behavior #1: unit test `...` verifies display string.
- Behavior #2/#8: parser round-trip test verifies old and new deep links.
- Behavior #11: manual VoiceOver check is sufficient because visible text is the accessible label.
```

Include commands when known:

```bash
cargo fmt
cargo nextest run -p <crate> <test_name>
./script/presubmit
```

If a behavior cannot be automated, say why and list the manual artifact expected. If validation depends on an experiment or benchmark, describe the measurable signal and save the underlying research report before relying on its conclusion.

## Keep current during implementation

If the user steers mid-workflow and behavior changed, make sure `PRODUCT.md` is revised before `TECH.md`. If implementation changes the plan, update `TECH.md` in the same PR. In particular, revise the tech spec when:

- module boundaries move
- data flow or state ownership changes
- compatibility assumptions change
- rollout or feature flag strategy changes
- the test plan changes

The tech spec should describe the implementation that ships. During implementation, record meaningful milestones, failed approaches, setbacks, fixes, validation notes, and decisions in sibling `MILESTONES.md`.
