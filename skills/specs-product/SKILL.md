---
name: specs-product
description: Write or revise a behavior-first PRODUCT.md product spec for a feature, API, workflow, CLI, UI, or data surface. Use whenever the user asks for a PRD, desired behavior doc, product spec, PRODUCT.md, ready-to-spec work, or wants to clarify feature behavior before implementation.
---

# Product Spec Writer

Write `PRODUCT.md` specs that make desired behavior unambiguous enough for an agent or engineer to implement without guessing.

## Scope

A product spec describes the surface from the consumer's point of view:

- UI feature: what the human sees, does, and experiences
- API/protocol/library: what callers can rely on
- CLI/developer tool: what the operator invokes and gets back
- data model: what readers/writers can assume

Avoid internal implementation details. Put implementation plans, test strategy, and validation mechanics in `TECH.md`.

## Drafting posture

- Write the desired outcome first, then behavior invariants. Avoid process-heavy prose that tells implementers how to think instead of what must be true.
- If claims about target users, reference products, market/customer outcomes, tradeoffs, risks, or measurable success need evidence, use `/specs-research` or `spec_research` before hardening the product spec.
- Ask for the smallest missing detail only when it materially changes behavior, scope, or risk. Otherwise proceed with clearly labeled assumptions.
- Use provided or retrieved facts for concrete claims about users, metrics, roadmap status, customer outcomes, product capabilities, deadlines, and compatibility. Do not invent specifics to make the spec sound stronger.
- Preserve the requested artifact, length, structure, and genre when revising. Improve clarity and correctness without adding extra sections or scope unless the user asked for them.
- Stop when the behavior is numbered, testable, scoped, and honest about open questions.

## Before writing

Use existing context first. Research is allowed during product spec work: it may include web/docs/source lookup, codebase archaeology, prototype spikes, benchmarks, experiments, or any inquiry with observable or quantitative signals. If research starts before the product spec is clear, create/focus the spec folder first so reports can live under `research/` with purpose-specific filenames.

If needed, ask concise questions about:

- ticket or feature id for the spec directory
- target users/callers
- desired behavior and non-goals
- edge cases and compatibility constraints
- Figma/mock/design reference for UI or interaction work
- whether this should follow an existing repo-specific spec format

For UI or interaction features, ask whether a Figma/mock exists unless the user already said no. If none exists, note `Figma: none provided` in the spec so the absence is explicit.

## File location

Follow the repository's existing convention when present. Read local `AGENTS.md` first for spec root and naming rules. If no convention exists, propose the default to the user before finalizing it:

```text
specs/YYYY-MM-DD-kebab-feature/PRODUCT.md
specs/YYYY-MM-DD-kebab-feature/TECH.md
specs/YYYY-MM-DD-kebab-feature/MILESTONES.md
```

If the user agrees to a newly inferred default, ensure `AGENTS.md` records the spec root, `YYYY-MM-DD-kebab-feature` format, and free-form `MILESTONES.md` log convention in short sentences. If the `spec_scaffold` tool is available, use it when creating a new spec directory and registry entry.

## Required structure

Use this structure unless the repo already has a stronger convention:

```markdown
# Product Spec: <title>

Issue: <link or id, optional>
Figma: <link or "none provided", when relevant>

## Summary

1-3 sentences describing the feature and desired outcome.

## Behavior

1. Numbered, testable invariant.
2. Numbered, testable invariant.
3. ...
```

Optional sections, only when they add signal:

- `## Problem` - motivation when not obvious
- `## Goals / Non-goals` - scope boundaries when ambiguity exists
- `## Open questions` - unresolved choices that block or affect implementation

Avoid empty placeholder sections. Do not add a separate Validation or Testing section unless the repository's existing style requires it; validation belongs in `TECH.md`.

## Behavior section guidance

Behavior is the core of the product spec. Write numbered invariants that cover:

- default happy path
- all user-visible states and transitions
- inputs and responses
- empty, error, loading, pending, and cancellation states
- offline, permission, timeout, stale data, and concurrency/race cases when relevant
- keyboard, focus, and accessibility expectations for UI work
- compatibility with existing links/settings/storage/API callers
- what must not regress

Prefer concrete observable statements:

Good:

```markdown
1. When the user opens Settings and searches "warp agent", the renamed subpage appears in the results.
2. Existing deep links that use the old "Oz" section id still navigate to the renamed page.
```

Weak:

```markdown
1. Search should work well.
2. Compatibility should be preserved.
```

## Output discipline

When drafting for the user, write the file and summarize:

- path written
- key behavior decisions captured
- research reports used or created, if any
- open questions, if any
- suggested next step, usually `TECH.md` via the `specs-tech` skill

When revising an existing product spec, preserve decisions that are still valid and update only the stale behavior. If the revision comes from mid-workflow user steering, update `PRODUCT.md` first and call out that `TECH.md` may need follow-up updates before implementation continues.
