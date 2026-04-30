# AGENTS.md

Spec directories live under `specs` unless a nested AGENTS.md documents a more specific convention.
Spec directory names use `YYYY-MM-DD-kebab-feature`, for example `2026-05-01-builtin-task-workflow`.
Spec task databases live beside each spec as `TASKS.yaml`.
When a user steers behavior mid-workflow, update `PRODUCT.md` first when behavior changes, then `TECH.md`, then `TASKS.yaml`, then implementation and tests as needed.
Before every commit, bump the package patch version by exactly one, for example `0.1.0` -> `0.1.1`.
