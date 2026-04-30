# pi-spec-driven-dev

A pi package for spec-driven development. It turns a feature idea into a reviewed `PRODUCT.md`, a codebase-grounded `TECH.md`, and then an implementation that keeps specs, code, and tests aligned.

This package is adapted from Warp's internal spec-driven workflow and generalized for any repository that benefits from PRD-style product specs, technical design docs, and agent-friendly implementation plans.

## What This Package Adds

### Skills

- `spec-driven-dev` - end-to-end spec-first workflow: decide whether specs are warranted, write specs, implement, and verify.
- `spec-product` - write or revise a behavior-first `PRODUCT.md` from the user/caller perspective.
- `spec-tech` - write or revise a codebase-grounded `TECH.md` with implementation plan, risks, and validation.
- `spec-implement` - implement approved specs while keeping specs, code, and tests synchronized.
- `spec-audit` - audit a repository's spec workflow, spec quality, or spec/code/test drift.

### Slash Commands

The extension registers direct commands so you do not have to remember skill names:

```text
/spec-workflow <feature, issue, or goal>
/spec-product <ticket/feature and desired behavior>
/spec-tech <spec path or feature>
/spec-implement <spec directory or feature>
/spec-audit [spec directory, issue, or area]
/spec-help
```

### Agent Tools

The extension also registers helper tools that the model can call when useful:

- `spec_scaffold` - creates `specs/<id>/PRODUCT.md` and optional `TECH.md` scaffolds without overwriting existing files.
- `spec_list` - lists spec directories under `specs/` and reports whether each has product and tech specs.

### Prompt Templates

Prompt templates are included as fallback/manual entry points:

```text
/write-product-spec <feature>
/write-tech-spec <feature>
/implement-spec <spec directory>
/audit-specs <area>
```

Prompt templates intentionally avoid names used by extension commands so command lists show one canonical entry for each slash command.

## Install

Install from GitHub:

```bash
pi install git:github.com/lulucatdev/pi-spec-driven-dev
```

Or install from a local checkout:

```bash
pi install /Users/lucas/pi-spec-driven-dev
```

Reload an existing pi session after installing:

```text
/reload
```

Try it without installing permanently:

```bash
pi -e git:github.com/lulucatdev/pi-spec-driven-dev
```

## Quick Start

Start a full spec-driven workflow:

```text
/spec-workflow APP-1234 add Mermaid diagram editing support in editable plans
```

Draft only the product spec:

```text
/spec-product GH408 make /open-file expand ~ paths the same way the file picker does
```

Write a technical plan from an existing product spec:

```text
/spec-tech specs/GH408
```

Implement approved specs:

```text
/spec-implement specs/GH408
```

Audit an existing project or feature:

```text
/spec-audit specs/mermaid-markdown-in-plans
```

## Recommended Workflow

1. **Start from an issue or feature idea.** Use `/spec-workflow` when the change is substantial, ambiguous, risky, or likely to involve multiple files.
2. **Write `PRODUCT.md` first.** Capture observable behavior as numbered, testable invariants. Keep implementation details out.
3. **Write `TECH.md` when warranted.** Read the product spec and current source code. Ground the plan in real files, types, state, data flow, risks, and validation.
4. **Implement from approved specs.** Treat `PRODUCT.md` as behavior source of truth and `TECH.md` as the implementation plan.
5. **Keep specs current.** If implementation changes behavior or architecture, update the relevant spec in the same PR.
6. **Verify against behavior.** Tests and manual checks should map back to the behavior invariants in the product spec.
7. **Audit before finishing.** Use `/spec-audit` when you want a final check for spec/code/test drift.

## Default Spec Layout

When a repository does not already have a convention, this package uses:

```text
specs/<ticket-or-feature-id>/PRODUCT.md
specs/<ticket-or-feature-id>/TECH.md
```

Examples:

```text
specs/APP-1234/PRODUCT.md
specs/APP-1234/TECH.md
specs/GH408/PRODUCT.md
specs/markdown-table-rendering/TECH.md
```

The skills first inspect the current repository for existing conventions. If the project already uses `docs/rfcs/`, lowercase `product.md`, or another pattern, the agent should follow that instead.

## What Makes a Good Product Spec

A good `PRODUCT.md` describes behavior from the consumer's point of view:

- UI features: what the user sees, does, and experiences.
- APIs/protocols/libraries: what callers can rely on.
- CLI/developer tools: what operators invoke and get back.
- Data models: what readers and writers can assume.

The core is a numbered `Behavior` section with testable invariants. It should cover the happy path, states, transitions, inputs, outputs, errors, empty states, cancellation, compatibility, accessibility, and edge cases that are easy to miss.

## What Makes a Good Tech Spec

A good `TECH.md` translates behavior into a concrete implementation plan:

- current system context with file references
- modules/files/types/APIs to change
- state and data flow
- compatibility and migration concerns
- rollout or feature flag strategy when relevant
- risks and mitigations
- tests and manual validation mapped to product behavior

It should be grounded in the codebase. The agent should inspect source files before drafting rather than inventing architecture from memory.

## When to Use Specs

Use specs for:

- ambiguous product behavior
- cross-cutting or multi-module work
- risky behavior changes
- architecture changes or migrations
- UI flows with many states
- work delegated to agents or reviewed asynchronously

Skip specs for:

- tiny local bug fixes
- obvious one-file changes
- mechanical refactors
- copy-only tweaks with no behavioral ambiguity

When in doubt, write a short product spec. It is often cheaper than resolving mismatched assumptions later.

## Package Structure

```text
pi-spec-driven-dev/
├── package.json
├── README.md
├── extensions/
│   └── spec-driven-dev.ts
├── prompts/
│   ├── audit-specs.md
│   ├── implement-spec.md
│   ├── write-product-spec.md
│   └── write-tech-spec.md
└── skills/
    ├── spec-audit/
    │   └── SKILL.md
    ├── spec-driven-dev/
    │   └── SKILL.md
    ├── spec-implement/
    │   └── SKILL.md
    ├── spec-product/
    │   └── SKILL.md
    └── spec-tech/
        └── SKILL.md
```

## Development

Validate the package shape:

```bash
python3 - <<'PY'
import json, re
from pathlib import Path
root = Path('.')
json.load(open(root / 'package.json'))
for skill in (root / 'skills').iterdir():
    if not skill.is_dir():
        continue
    text = (skill / 'SKILL.md').read_text()
    name = re.search(r'^name:\\s*(.+)$', text, re.M).group(1).strip()
    assert name == skill.name, f'{skill}: frontmatter name {name}'
    desc = re.search(r'^description:\\s*(.+)$', text, re.M).group(1)
    assert len(desc) <= 1024, skill
print('ok')
PY
```

Test-load locally:

```bash
PI_OFFLINE=1 pi --no-extensions -e . --no-context-files -p "/spec-help"
```

## Credits

This package generalizes the spec-driven workflow used in the Warp codebase, especially the ideas behind:

- `spec-driven-implementation`
- `write-product-spec`
- `write-tech-spec`
- `implement-specs`

The package is intentionally project-agnostic: it reads the current repository's conventions first and only falls back to `specs/<id>/PRODUCT.md` + `TECH.md` when no stronger convention exists.

## License

MIT
