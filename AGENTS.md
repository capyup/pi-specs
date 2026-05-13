# AGENTS.md

Spec directories live under `specs` unless a nested AGENTS.md documents a more specific convention.
Spec directory names use `YYYY-MM-DD-kebab-feature`, for example `2026-05-01-spec-lifecycle-audit`.
Spec directories contain `PRODUCT.md`, when implementation planning is useful `TECH.md`, and a free-form `MILESTONES.md` implementation log.
Spec directories may also contain `research/` with purpose-named reports such as `YYYY-MM-DD-initial-source-study.md` for evidence, experiments, benchmarks, prototypes, or code/source investigations gathered before or during spec work.
`MILESTONES.md` records meaningful implementation milestones, failed attempts, setbacks, fixes, validation notes, and decisions without a strict schema.
When a user steers behavior mid-workflow, update `PRODUCT.md` first when behavior changes, then `TECH.md`, then implementation, tests, and `MILESTONES.md` as needed.
Before every commit, bump the package patch version by exactly one, for example `0.1.0` -> `0.1.1`.
When upgrading this Pi package, use `pi update` rather than running `pi install` again.
