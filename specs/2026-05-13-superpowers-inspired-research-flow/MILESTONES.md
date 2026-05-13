# Milestones: Superpowers-inspired research, grilling, and audit flow

Free-form implementation log. Record meaningful phase changes, successful milestones, failed attempts, setbacks, fixes, validation notes, and decisions. Use third-level headings with timestamps down to seconds, for example `### 2026-05-13 14:16:36 - Short milestone title`. No strict schema is required.


### 2026-05-13 15:13:24 - Milestone

Started the Superpowers-inspired workflow spec. Performed bounded research against Anthropic's plugin page and the `obra/Superpowers` repository, then drafted `PRODUCT.md` around a lightweight research -> grill me -> synthesis -> later audit path while explicitly rejecting full TDD/worktree/subagent complexity as default behavior.

### 2026-05-13 15:17:22 - Milestone

Updated `PRODUCT.md` from the first grilling answers: the workflow should be an explicit slash command, default `grill me` should be adversarial/product-review style, and the initial research phase should deeply inspect Superpowers mechanisms before user grilling. The later audit phase remains intentionally unresolved for follow-up.

### 2026-05-13 15:21:58 - Milestone

Completed a deeper Superpowers mechanism pass by cloning `obra/Superpowers` into `.pi/research/superpowers`, inspecting the bootstrap hook and core skills, and writing `RESEARCH.md`. Updated `PRODUCT.md` to make durable research briefs part of the proposed workflow when source evidence needs to survive later audit or planning.

### 2026-05-13 15:33:46 - Milestone

Clarified the meaning of early scaffold from user steering: scaffold means establishing the canonical spec folder name and directory structure early, especially a stable place for purpose-named research reports, not prematurely filling in final spec content.

### 2026-05-13 15:46:13 - Milestone

Normalized the current Superpowers research artifact into the new folder-first scaffold model by moving it to `research/2026-05-13-initial-superpowers-mechanisms.md` and updating the product spec reference. This keeps the report purpose visible in the filename and leaves room for future parallel or audit research reports.

### 2026-05-13 15:50:26 - Milestone

Expanded the product direction from spec-driven development to research-driven spec development. `PRODUCT.md` now treats research as a first-class capability across product, tech, and implementation phases, including not only literature/code investigation but also prototype spikes, benchmarks, controlled experiments, and observable or quantitative feedback loops.

### 2026-05-13 15:56:26 - Milestone

Drafted `TECH.md` for `/specs-research` and `spec_research`. The plan keeps `spec_scaffold` unchanged, adds a folder-first research tool, creates purpose-named reports under each spec's `research/` directory, and updates product/tech/implementation skills so agents can launch additional research across the whole spec lifecycle.

### 2026-05-13 16:21:23 - Milestone

Implemented the first pass of `/specs-research` and `spec_research`: added command registration, a research tool that creates/focuses spec folders and purpose-named reports under `research/`, the new `specs-research` skill, research-driven updates across product/tech/implementation skills, README/AGENTS documentation, and package-shape tests. Validation passed with `npm test` and `npm run test:smoke`.
