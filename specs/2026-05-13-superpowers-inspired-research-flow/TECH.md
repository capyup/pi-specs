# Tech Spec: Superpowers-inspired research, grilling, and audit flow

Product spec: `specs/2026-05-13-superpowers-inspired-research-flow/PRODUCT.md`

## Context

- `extensions/pi-specs.ts:6` defines the slash-command registry for `/specs`, `/specs-product`, `/specs-tech`, `/specs-implement`, and `/specs-audit`.
- `extensions/pi-specs.ts:485` registers commands by sending a skill prompt through `sendSkillMessage`, so `/specs-research` can follow the same command-to-skill pattern.
- `extensions/pi-specs.ts:493` registers `/specs-help`; it should list the new command and research tool.
- `extensions/pi-specs.ts:503` registers `spec_scaffold`, which currently creates `PRODUCT.md`, `MILESTONES.md`, optional `TECH.md`, and a registry entry. `/specs-research` needs a lighter folder-first scaffold path that can create the spec directory and `research/` before final spec content exists.
- `extensions/pi-specs.ts:369` and `extensions/pi-specs.ts:402` define placeholder templates for `PRODUCT.md` and `TECH.md`; research-first scaffolding should not imply those placeholders are final or approved.
- `extensions/pi-specs.ts:635` registers `spec_append_milestone`; research setup and completed research reports should use milestone entries for durable phase history.
- `skills/specs/SKILL.md`, `skills/specs-product/SKILL.md`, `skills/specs-tech/SKILL.md`, and `skills/specs-implement/SKILL.md` currently describe spec-driven flow but do not yet frame research as an always-available capability across phases.
- `test/package-shape.test.mjs` asserts command/tool registration and documentation surfaces; it should be extended for `/specs-research`, `spec_research`, and the research-driven prompt updates.
- Current package shape is one TypeScript extension plus Markdown skills, with tests run by `npm test` from `package.json`.

## Proposed changes

### 1. Add a research skill

Create `skills/specs-research/SKILL.md`.

The skill should behave like a focused, Superpowers-inspired workflow document. It should instruct the agent to:

1. Resolve or create the spec folder structure before substantive research.
2. Treat scaffold as folder naming/layout first, not as final spec content.
3. Use `spec_research` when available to prepare the spec directory, `research/` subfolder, purpose-named report path, and research guidance.
4. Research the stated purpose using appropriate methods: source/web/docs/code inspection, prototype spikes, benchmarks, transcript comparisons, controlled experiments, or other observable inquiries.
5. For experiments, define expected observations or measurable signals before drawing conclusions.
6. Save findings to the purpose-named report path.
7. Enter adversarial but collaborative grilling after the initial report when user direction is still needed.
8. Update `PRODUCT.md` first when research or grilling changes observable behavior; update `TECH.md` only when implementation shape changes.
9. Record meaningful research phase changes with `spec_append_milestone`.

The skill should not impose a state machine, fixed research budget, mandatory TDD, worktrees, or subagents. It should rely on the agent loop to decide when enough evidence exists.

### 2. Register `/specs-research`

Add a new `COMMANDS` entry in `extensions/pi-specs.ts`:

```ts
{
  name: "specs-research",
  skill: "specs-research",
  description: "Run purpose-directed research inside a spec workflow",
  usage: "/specs-research <topic, question, or research purpose>",
}
```

This should reuse the existing `sendSkillMessage` flow. With no arguments, the existing `buildSkillPrompt` behavior can resolve the focused spec first; with arguments, the `specs-research` skill receives the user request directly.

Update `/specs-help` so users see `/specs-research` and the `spec_research` tool.

### 3. Add `spec_research` tool

Register a new tool in `extensions/pi-specs.ts` with a TUI label such as `Spec Research`.

Recommended parameter shape:

```ts
parameters: Type.Object({
  purpose: Type.String({ description: "Research purpose, e.g. initial-superpowers-mechanisms, product-risk-grill, benchmark-parser-options" }),
  topic: Type.String({ description: "Question, feature, reference system, experiment, or uncertainty to research." }),
  spec: Type.Optional(Type.String({ description: "Existing spec id, path, basename, or title. Defaults to focused spec when present." })),
  id: Type.Optional(Type.String({ description: "Short feature id to scaffold when no target spec exists." })),
  title: Type.Optional(Type.String({ description: "Human-readable title for a newly scaffolded spec folder." })),
  phase: Type.Optional(Type.Union([
    Type.Literal("initial"),
    Type.Literal("product"),
    Type.Literal("tech"),
    Type.Literal("implement"),
    Type.Literal("audit"),
    Type.Literal("experiment"),
  ])),
  instructions: Type.Optional(Type.String({ description: "Additional user or agent instructions for the research." })),
})
```

Execution behavior:

1. Resolve the spec root using existing `resolveSpecRoot`.
2. If `spec` is provided, resolve that registry entry.
3. If `spec` is omitted, use the focused spec when available.
4. If no focused spec exists and `id` is provided, create a new spec directory using `defaultSpecId(id)`, register it in `SPECS.yaml`, and focus it.
5. If no spec can be resolved or scaffolded, return an error that asks for `spec` or `id`.
6. Create the spec directory and `research/` subdirectory.
7. Ensure `MILESTONES.md` exists using the existing `milestonesTemplate`.
8. Do not force-create final `TECH.md`.
9. Create `PRODUCT.md` only as a minimal draft placeholder if no product file exists and the tool is creating a new spec; the content should clearly say behavior is not finalized yet.
10. Generate a report path under `research/` using local date, optional phase, and a slugified purpose/topic.
11. If the generated report path already exists, append a numeric suffix rather than overwriting.
12. Return concise guidance: spec id/path, report path, research purpose, suggested research angles, and a reminder to write the report before making spec/implementation claims.

The tool should prepare the research workspace and guidance; it does not need to perform the research itself. The calling agent remains responsible for executing research, writing the report, grilling the user, and updating specs.

### 4. Research report filename helpers

Add small helpers in `extensions/pi-specs.ts`:

- `slugifyResearchPurpose(value: string): string` - lowercase, ASCII-ish slug, hyphen-separated, strip unsafe path characters.
- `researchReportBasename(phase, purpose, topic): string` - build `YYYY-MM-DD-<phase?>-<purpose-or-topic>.md`.
- `nextAvailablePath(dir, basename): Promise<string>` - preserve existing files by adding `-2`, `-3`, etc.

Keep path safety consistent with existing spec path checks: resolved spec paths and report paths must remain under the current project.

### 5. Folder-first scaffold adjustment

Do not change existing `spec_scaffold` behavior unless implementation convenience requires a shared helper. Instead, extract or add helper functions so both tools can share:

- spec id validation/defaulting
- registry upsert/focus
- milestones creation
- optional product placeholder creation
- research directory creation

`spec_scaffold` can remain the full conventional scaffold tool for users who already know the feature shape. `spec_research` is the earlier, folder-first entrypoint for pre-spec research.

### 6. Prompt and documentation updates

Update `skills/specs/SKILL.md`:

- Add a first-principle that specs are not only spec-driven but may be research-driven.
- Mention that agents can launch `/specs-research` or `spec_research` during product, tech, implementation, or audit work when uncertainty or testable hypotheses appear.
- Add `research/` as an optional per-spec artifact directory for purpose-named reports.

Update `skills/specs-product/SKILL.md`:

- Before writing behavior, remind agents to run or request research when claims, target users, tradeoffs, reference products, or experiments need evidence.
- Make clear that research can include experiments or prototype spikes, not just web/docs lookup.

Update `skills/specs-tech/SKILL.md`:

- In research before writing, mention `spec_research` for architecture spikes, benchmark plans, source-code archaeology, dependency exploration, and measurable tradeoff checks.
- Tell agents to cite relevant research reports from `research/` in `TECH.md` context.

Update `skills/specs-implement/SKILL.md`:

- During implementation, remind agents they may launch extra research when implementation exposes uncertainty, surprising test results, performance tradeoffs, or unclear behavior.
- Require research reports for non-trivial experiments whose observations change the implementation plan.

Update `README.md`:

- Document `/specs-research`.
- Document `spec_research`.
- Document `research/YYYY-MM-DD-<purpose>.md` report files.
- Explain that research may be literature/code review or experiments with observable/quantitative outcomes.

### 7. Registry and lifecycle behavior

`SPECS.yaml` does not need a new status or research database. Research artifacts are files under the spec directory and are discovered by path, not tracked as state.

`spec_status` may optionally add a line showing the count or latest file under `research/`, but this is not required for the first implementation. If added, tests should cover it.

### 8. Implementation sequence

1. Add `skills/specs-research/SKILL.md`.
2. Add `/specs-research` to `COMMANDS` and `/specs-help` output.
3. Add helpers for research slugs/report paths and folder-first scaffold behavior.
4. Register `spec_research` with the parameter shape above.
5. Update existing skill docs to mention research availability across phases.
6. Update `README.md` and tests.
7. Run `npm test`.
8. Optionally run `npm run test:smoke` if local `pi` smoke tests are available.

## Testing and validation

- Behavior #1/#3: `test/package-shape.test.mjs` should assert `/specs-research` is registered and documented.
- Behavior #2/#4: tests should assert `spec_research` appears in the extension and README/tool documentation.
- Behavior #5/#6/#7: add tests or extension shape checks for folder-first scaffold logic: `research/` directory creation, milestone creation, and no forced `TECH.md` creation.
- Behavior #10/#11/#12: add unit or shape tests for purpose-specific report path generation and no overwrite behavior.
- Behavior #21/#22/#23: docs tests should assert research language includes experiments, observable/quantitative signals, and iteration loops.
- Behavior #24: docs tests should assert product, tech, and implementation skills mention launching additional research.
- Behavior #25: no new persistent research status file should be introduced; tests should continue to reject legacy progress surfaces.

Validation commands:

```bash
npm test
npm run test:smoke
```

If `npm run test:smoke` is unavailable in the current environment, report that and keep `npm test` as the required local gate.

## Risks and mitigations

- Risk: `/specs-research` becomes a vague research dump. Mitigation: require explicit `purpose`, purpose-named filenames, and report guidance that records observations and conclusions.
- Risk: folder-first scaffold is confused with approved spec content. Mitigation: keep `spec_research` scaffold minimal and mark any generated `PRODUCT.md` as draft/unfinalized.
- Risk: multiple agents overwrite each other's reports. Mitigation: use purpose-based names plus `nextAvailablePath` suffixing.
- Risk: research becomes a hidden state machine. Mitigation: store only reports and milestones; let the agent loop manage sequencing.
- Risk: existing users expect `spec_scaffold` to create full starter files. Mitigation: do not change `spec_scaffold`; add `spec_research` as a separate earlier entrypoint.

## Follow-ups

- Decide whether `spec_status` should summarize research report counts or latest report.
- Decide whether later `/specs-audit` should create audit research reports through `spec_research` or a specialized audit tool.
- Consider adding an optional report template only after the first implementation proves the minimal guidance is insufficient.
