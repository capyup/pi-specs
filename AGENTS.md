# AGENTS.md

Spec directories live under `specs` unless a nested AGENTS.md documents a more specific convention.
Spec directory names use `YYYY-MM-DD-kebab-feature`, for example `2026-05-01-spec-lifecycle-audit`.
Spec directories contain `PRODUCT.md`, when implementation planning is useful `TECH.md`, and a free-form `MILESTONES.md` implementation log.
`MILESTONES.md` records meaningful implementation milestones, failed attempts, setbacks, fixes, validation notes, and decisions without a strict schema.
When a user steers behavior mid-workflow, update `PRODUCT.md` first when behavior changes, then `TECH.md`, then implementation, tests, and `MILESTONES.md` as needed.
Before every commit, bump the package patch version by exactly one, for example `0.1.0` -> `0.1.1`.
