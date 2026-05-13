# Milestones: Spec lifecycle registry and isolated audit workflow

Free-form implementation log. Record meaningful phase changes, successful milestones, failed attempts, setbacks, fixes, validation notes, and decisions. No strict schema is required.

### 2026-05-13 14:05:00 - Removed persisted progress management

- The workflow direction changed: `pi-specs` should not provide, require, or coordinate persisted progress management.
- Removed the old persisted progress files and old built-in progress-management spec from the repository.
- Updated `PRODUCT.md`, `TECH.md`, `AGENTS.md`, README, skills, extension behavior, and regression tests so specs now focus on PRODUCT/TECH plus audit evidence.
- Validation: `npm test` and `npm run test:smoke` passed. A repository search confirmed no old progress-management surface remained outside git history.

### 2026-05-13 14:12:00 - Added milestone logging

- New requirement: implementation should keep a human-readable `MILESTONES.md` log for meaningful phases, setbacks, failed attempts, fixes, validation notes, and decisions.
- Decision: `MILESTONES.md` is free-form plain text with no strict schema. It is durable implementation history, not a status database or progress manager.
- Implementation plan: scaffold new specs with `MILESTONES.md`, list its presence in `specs_list`, and instruct implementation/audit skills to read and update it when useful.

### 2026-05-13 14:16:36 - Added visible milestone append tool

- New requirement: milestone writes should happen through a visible tool call, `spec_append_milestone {current_spec_name} {milestone content}`, so the TUI clearly shows which focused spec received the log entry.
- Implementation approach: register `spec_append_milestone` in the extension, resolve the focused spec from `specs/SPECS.yaml`, validate the displayed spec name against the focused spec, create `MILESTONES.md` if missing, and append the provided paragraph.
- Safety decision: the tool refuses empty content, stale spec names, missing focus, and resolved paths outside the current project.

### 2026-05-13 14:34:13 - Implemented lifecycle and settings tools

Added `spec_scaffold`, `spec_focus`, `spec_unfocus`, `spec_status`, `spec_finish`, `spec_append_milestone`, `specs_settings_get`, and `specs_settings_update` as TUI-visible tools with clear labels and concise results. Renamed the milestone append tool from the old plural form to `spec_append_milestone`. `spec_finish` now performs local completion checks and marks the registry complete while leaving full audit execution to a later `spec_audit` design. Validation passed with `npm test` and `npm run test:smoke`.
