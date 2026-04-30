---
name: spec-audit
description: Audit a repository's spec-driven development process or compare specs against implementation. Use when the user asks whether a project is spec-driven, wants a workflow summary, wants PRODUCT.md/TECH.md quality reviewed, or wants to find drift between specs, code, and tests.
---

# Spec Audit

Use this skill to understand or review a project's spec-driven development workflow.

## Audit modes

Choose the mode that matches the request:

1. **Workflow audit** - summarize how the project uses specs, issues, skills, prompts, tests, and PR review.
2. **Spec quality audit** - review one or more `PRODUCT.md` / `TECH.md` files for clarity, completeness, and implementability.
3. **Spec/code drift audit** - compare a specific spec directory to the implementation and tests.
4. **Readiness audit** - decide whether a feature is ready for implementation or still needs product/tech clarification.

## What to inspect

Start broad, then narrow:

- `CONTRIBUTING.md`, `README.md`, `AGENTS.md`, `WARP.md`, `CLAUDE.md`, project docs
- `.agents/skills/`, `.pi/skills/`, `.pi/prompts/`, package resources
- `specs/`, `docs/specs/`, `rfcs/`, `docs/adr/`, or equivalent
- PR templates and CI/test docs
- built-in task-manager state in pure Markdown `specs/<id>/TASKS.md` or legacy task files under `.pi/tasks/`
- representative code and tests for 2-3 specs

If the extension tool is available, use `spec_list` to get a quick inventory, then inspect representative specs directly.

## Evidence budget and uncertainty

- Use enough repository evidence to answer the audit question, then stop. Do not keep searching just to add examples or improve phrasing.
- Make another inspection pass only when a core claim lacks support, a required spec/code/test artifact is missing, or the user asked for exhaustive coverage.
- Absence of evidence is not automatically evidence that a workflow or behavior does not exist. Say `not found in inspected files` when appropriate.
- Cite concrete file paths and line references when possible so recommendations are reviewable.

## Workflow audit report

Structure the answer like this:

```markdown
## Summary

Short answer: how spec-driven the project is and how the workflow works.

## Evidence

- file/path references and what they show

## Development flow

1. issue/intake
2. product spec
3. tech spec
4. implementation
5. verification/review

## Patterns that work well

- ...

## Gaps or inconsistencies

- ...

## Recommended operating procedure

- concrete steps future agents/engineers should follow
```

## Spec quality checklist

For `PRODUCT.md`, check:

- behavior is written from user/caller perspective
- behavior is numbered and testable
- edge cases and non-goals are explicit
- UI specs mention design/Figma status when relevant
- implementation details are not over-specified

For `TECH.md`, check:

- context is grounded in actual code files
- proposed changes are concrete enough to implement
- testing maps back to product behavior
- risks and compatibility are addressed
- deferred follow-ups are explicit

## Spec/code/task drift checklist

For a target spec directory:

1. Read `PRODUCT.md` and list core behavior invariants.
2. Read `TECH.md` and list expected code paths and validation.
3. Inspect built-in task-manager state if present and note stale, malformed, blocked, or completed tasks that disagree with the specs. Recommend `npm run tasks:repair` when Markdown task files are not normalized.
4. Inspect current code and tests.
5. Mark each invariant as:
   - `implemented and tested`
   - `implemented but not tested`
   - `partially implemented`
   - `not found`
   - `spec appears stale`
5. Recommend concrete fixes: update code, add tests, or update specs.

## Output discipline

Prefer concise findings with file references. If no major issues are found, say so and mention residual risks or unverified areas.
