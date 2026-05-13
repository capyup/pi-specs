import { access, appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SpecWidgetComponent, specFooterStatus, type SpecWidgetRecord } from "./widgets/spec-widget.ts";

const COMMANDS = [
	{
		name: "specs",
		skill: "specs",
		description: "Start a full spec-driven workflow for a feature or risky change",
		usage: "/specs <feature, issue, or goal>",
	},
	{
		name: "specs-product",
		skill: "specs-product",
		description: "Write or revise a behavior-first PRODUCT.md spec",
		usage: "/specs-product <ticket/feature and desired behavior>",
	},
	{
		name: "specs-tech",
		skill: "specs-tech",
		description: "Write or revise an implementation-focused TECH.md spec",
		usage: "/specs-tech <spec path or feature>",
	},
	{
		name: "specs-research",
		skill: "specs-research",
		description: "Run purpose-directed research inside a spec workflow",
		usage: "/specs-research <topic, question, or research purpose>",
	},
	{
		name: "specs-grill-me",
		skill: "specs-grill-me",
		description: "Grill the current spec design or progress with adversarial questions",
		usage: "/specs-grill-me [spec id, path, or focus area]",
	},
	{
		name: "specs-implement",
		skill: "specs-implement",
		description: "Implement approved PRODUCT.md and TECH.md specs while keeping them current",
		usage: "/specs-implement <spec directory or feature>",
	},
	{
		name: "specs-audit",
		skill: "specs-audit",
		description: "Audit a repository's spec-driven development workflow or spec/code alignment",
		usage: "/specs-audit [spec directory, issue, or area]",
	},
] as const;

const STATUS_VOCABULARY = ["draft", "implementing", "audit_running", "completed"] as const;
const SPEC_WIDGET_KEY = "specs";
const COMMAND_REGISTRY = {
	focus: "/spec-focus <spec-id-or-path>",
	unfocus: "/spec-unfocus",
	status: "/spec-status [spec-id-or-path]",
	finish: "/spec-finish [spec-id-or-path]",
	settings: "/specs-settings",
} as const;

type SpecStatus = (typeof STATUS_VOCABULARY)[number];
type SpecEntry = {
	id: string;
	path: string;
	title: string;
	status: SpecStatus | string;
	focused: boolean;
	last_audit: string | null;
	updated: string;
};
type SpecRegistry = {
	version: number;
	focused: string | null;
	status_vocabulary: string[];
	commands: typeof COMMAND_REGISTRY;
	specs: SpecEntry[];
};
type SpecSettings = {
	audit_provider?: string;
	audit_model?: string;
};

function buildSkillPrompt(skill: string, args: string, usage: string): string {
	const trimmed = args.trim();
	const noArgsInstruction = [
		`No arguments were provided for ${usage}.`,
		"Do not ask immediately.",
		"First read AGENTS.md and specs/SPECS.yaml if they exist.",
		"If SPECS.yaml has exactly one focused spec entry, use that focused spec as the target.",
		"Ask the user only if no focused spec can be found or the target remains ambiguous after reading the registry.",
	].join(" ");
	return [
		`Use the ${skill} skill for this request.`,
		"Read that skill's SKILL.md before taking action if it is available.",
		trimmed ? `User request: ${trimmed}` : noArgsInstruction,
	].join("\n\n");
}

function sendSkillMessage(pi: ExtensionAPI, ctx: ExtensionCommandContext, skill: string, args: string, usage: string) {
	const prompt = buildSkillPrompt(skill, args, usage);
	if (ctx.isIdle()) {
		pi.sendUserMessage(prompt);
		return;
	}
	pi.sendUserMessage(prompt, { deliverAs: "followUp" });
	ctx.ui.notify(`Queued ${skill} as a follow-up request.`, "info");
}

function validateSpecId(id: string): string | undefined {
	const trimmed = id.trim();
	if (!trimmed) return "id is required";
	if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
		return "id must be a single directory name without slashes or '..'";
	}
	if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
		return "id may contain only letters, numbers, dots, underscores, and hyphens";
	}
	return undefined;
}

function defaultSpecId(id: string): string {
	const trimmed = id.trim();
	if (/^\d{4}-\d{2}-\d{2}-/.test(trimmed)) return trimmed;
	const date = new Date().toISOString().slice(0, 10);
	return `${date}-${trimmed}`;
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function extractSpecRootFromAgents(text: string): string | undefined {
	for (const candidate of ["specs", "docs/specs", ".pi/specs"]) {
		if (text.includes(candidate)) return candidate;
	}
	return undefined;
}

async function findNestedSpecsDir(cwd: string, depth = 3): Promise<string | undefined> {
	async function walk(dir: string, remaining: number): Promise<string | undefined> {
		if (remaining < 0) return undefined;
		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch {
			return undefined;
		}
		for (const entry of entries) {
			if (entry === "node_modules" || entry === ".git") continue;
			const full = join(dir, entry);
			if (entry === "specs") return full;
			const found = await walk(full, remaining - 1);
			if (found) return found;
		}
		return undefined;
	}
	return walk(cwd, depth);
}

async function ensureAgentsSpecConvention(cwd: string, specRoot: string): Promise<string | undefined> {
	const agentsPath = join(cwd, "AGENTS.md");
	const relativeRoot = specRoot.startsWith(cwd) ? specRoot.slice(cwd.length + 1) || "specs" : specRoot;
	const rootLine = `Spec directories live under \`${relativeRoot}\` unless a nested AGENTS.md documents a more specific convention.`;
	const nameLine = "Spec directory names use `YYYY-MM-DD-kebab-feature`, for example `2026-05-01-spec-lifecycle-audit`.";
	const milestonesLine = "Spec directories include a free-form `MILESTONES.md` implementation log for milestones, setbacks, fixes, validation notes, and decisions.";
	let current = "";
	try {
		current = await readFile(agentsPath, "utf-8");
	} catch {
		await writeFile(agentsPath, `# AGENTS.md\n\n${rootLine}\n${nameLine}\n${milestonesLine}\n`);
		return agentsPath;
	}
	const additions = [];
	if (!extractSpecRootFromAgents(current)) additions.push(rootLine);
	if (!current.includes("YYYY-MM-DD-kebab-feature")) additions.push(nameLine);
	if (!current.includes("MILESTONES.md")) additions.push(milestonesLine);
	if (additions.length > 0) {
		await appendFile(agentsPath, `\n${additions.join("\n")}\n`);
		return agentsPath;
	}
	return undefined;
}

async function resolveSpecRoot(cwd: string): Promise<{ specRoot: string; agentsUpdated?: string }> {
	const agentsPath = join(cwd, "AGENTS.md");
	try {
		const agents = await readFile(agentsPath, "utf-8");
		const documented = extractSpecRootFromAgents(agents);
		if (documented) return { specRoot: resolve(cwd, documented) };
	} catch {
		// Missing AGENTS.md is handled after repository discovery.
	}

	for (const candidate of ["specs", "docs/specs", ".pi/specs"]) {
		const path = resolve(cwd, candidate);
		if (await exists(path)) {
			const agentsUpdated = await ensureAgentsSpecConvention(cwd, path);
			return { specRoot: path, agentsUpdated };
		}
	}

	const nested = await findNestedSpecsDir(cwd);
	if (nested) {
		const agentsUpdated = await ensureAgentsSpecConvention(cwd, nested);
		return { specRoot: nested, agentsUpdated };
	}

	const fallback = resolve(cwd, "specs");
	await mkdir(fallback, { recursive: true });
	const agentsUpdated = await ensureAgentsSpecConvention(cwd, fallback);
	return { specRoot: fallback, agentsUpdated };
}

function yamlValue(value: string | null | undefined): string {
	if (value === null || value === undefined || value === "") return "null";
	return value;
}

function parseYamlScalar(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed || trimmed === "null" || trimmed === "~") return null;
	return trimmed.replace(/^['\"]|['\"]$/g, "");
}

function readYamlField(block: string, field: string): string | undefined {
	const match = block.match(new RegExp(`^\\s+${field}:\\s*(.+)$`, "m"));
	const value = match ? parseYamlScalar(match[1]) : undefined;
	return value ?? undefined;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function formatLocalTimestamp(date = new Date()): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatMilestoneEntry(content: string): string {
	const trimmed = content.trim();
	if (trimmed.startsWith("### ")) return `\n${trimmed}\n`;
	return `\n### ${formatLocalTimestamp()} - Milestone\n\n${trimmed}\n`;
}

function emptyRegistry(): SpecRegistry {
	return {
		version: 1,
		focused: null,
		status_vocabulary: [...STATUS_VOCABULARY],
		commands: COMMAND_REGISTRY,
		specs: [],
	};
}

function parseRegistry(text: string): SpecRegistry {
	const registry = emptyRegistry();
	registry.version = Number.parseInt(text.match(/^version:\s*(\d+)/m)?.[1] ?? "1", 10);
	registry.focused = parseYamlScalar(text.match(/^focused:\s*(.+)$/m)?.[1] ?? "");

	const entryPattern = /^\s*-\s+id:\s*(.+)$/gm;
	let match: RegExpExecArray | null;
	while ((match = entryPattern.exec(text))) {
		const id = parseYamlScalar(match[1]);
		if (!id) continue;
		const blockStart = match.index;
		const nextEntry = text.slice(entryPattern.lastIndex).search(/^\s*-\s+id:/m);
		const blockEnd = nextEntry === -1 ? text.length : entryPattern.lastIndex + nextEntry;
		const block = text.slice(blockStart, blockEnd);
		registry.specs.push({
			id,
			path: readYamlField(block, "path") ?? `specs/${id}`,
			title: readYamlField(block, "title") ?? id,
			status: readYamlField(block, "status") ?? "draft",
			focused: (readYamlField(block, "focused") ?? "false") === "true",
			last_audit: readYamlField(block, "last_audit") ?? null,
			updated: readYamlField(block, "updated") ?? today(),
		});
	}
	return normalizeRegistry(registry);
}

function normalizeRegistry(registry: SpecRegistry): SpecRegistry {
	let focusedSeen = false;
	for (const spec of registry.specs) {
		if (registry.focused && spec.id === registry.focused) {
			spec.focused = true;
			focusedSeen = true;
		} else {
			spec.focused = false;
		}
	}
	if (!focusedSeen) registry.focused = null;
	return registry;
}

function renderRegistry(registry: SpecRegistry): string {
	const normalized = normalizeRegistry(registry);
	const lines = [
		"version: 1",
		`focused: ${yamlValue(normalized.focused)}`,
		"status_vocabulary:",
		...STATUS_VOCABULARY.map((status) => `  - ${status}`),
		"commands:",
		`  focus: ${COMMAND_REGISTRY.focus}`,
		`  unfocus: ${COMMAND_REGISTRY.unfocus}`,
		`  status: ${COMMAND_REGISTRY.status}`,
		`  finish: ${COMMAND_REGISTRY.finish}`,
		`  settings: ${COMMAND_REGISTRY.settings}`,
		"specs:",
	];
	for (const spec of normalized.specs.sort((a, b) => a.id.localeCompare(b.id))) {
		lines.push(
			`  - id: ${spec.id}`,
			`    path: ${spec.path}`,
			`    title: ${spec.title}`,
			`    status: ${spec.status}`,
			`    focused: ${spec.focused ? "true" : "false"}`,
			`    last_audit: ${yamlValue(spec.last_audit)}`,
			`    updated: ${spec.updated}`,
		);
	}
	return `${lines.join("\n")}\n`;
}

async function loadRegistry(cwd: string): Promise<{ registry: SpecRegistry; specRoot: string; registryPath: string; created: boolean }> {
	const { specRoot } = await resolveSpecRoot(cwd);
	await mkdir(specRoot, { recursive: true });
	const registryPath = join(specRoot, "SPECS.yaml");
	try {
		return { registry: parseRegistry(await readFile(registryPath, "utf-8")), specRoot, registryPath, created: false };
	} catch {
		const registry = emptyRegistry();
		await writeFile(registryPath, renderRegistry(registry));
		return { registry, specRoot, registryPath, created: true };
	}
}

async function saveRegistry(registryPath: string, registry: SpecRegistry) {
	await writeFile(registryPath, renderRegistry(registry));
}

function specPathFromRoot(cwd: string, specDir: string): string {
	return relative(resolve(cwd), resolve(specDir)) || basename(specDir);
}

function findSpec(registry: SpecRegistry, target: string | undefined | null): SpecEntry | undefined {
	const trimmed = target?.trim();
	if (!trimmed) return registry.focused ? registry.specs.find((spec) => spec.id === registry.focused) : undefined;
	return registry.specs.find((spec) => spec.id === trimmed || spec.path === trimmed || basename(spec.path) === trimmed || spec.title === trimmed);
}

async function resolveSpecTarget(cwd: string, target?: string): Promise<{ registry: SpecRegistry; specRoot: string; registryPath: string; spec: SpecEntry }> {
	const loaded = await loadRegistry(cwd);
	const spec = findSpec(loaded.registry, target);
	if (!spec) {
		throw new Error(target ? `Spec not found: ${target}` : "No focused spec in specs/SPECS.yaml.");
	}
	return { ...loaded, spec };
}

function upsertSpec(registry: SpecRegistry, entry: SpecEntry): SpecEntry {
	const existing = registry.specs.find((spec) => spec.id === entry.id);
	if (existing) {
		Object.assign(existing, entry, { focused: existing.focused });
		return existing;
	}
	registry.specs.push(entry);
	return entry;
}

function setFocused(registry: SpecRegistry, id: string | null) {
	registry.focused = id;
	for (const spec of registry.specs) spec.focused = Boolean(id && spec.id === id);
}

function productTemplate(id: string, title: string): string {
	return `# Product Spec: ${title || id}

## Summary

Describe the desired outcome in 1-3 sentences. State who benefits and what changes from the user's or caller's perspective.

## Behavior

1. Describe the default happy path as an observable behavior.
2. Describe important states, transitions, inputs, and outputs.
3. Describe edge cases: empty data, errors, cancellation, races, permissions, offline behavior, accessibility, and compatibility.
4. Describe invariants that must not regress.

## Goals / Non-goals

- Goal: ...
- Non-goal: ...

## Open questions

- ...
`;
}

function milestonesTemplate(id: string, title: string): string {
	return `# Milestones: ${title || id}

Free-form implementation log. Record meaningful phase changes, successful milestones, failed attempts, setbacks, fixes, validation notes, and decisions. Use third-level headings with timestamps down to seconds, for example \`### 2026-05-13 14:16:36 - Short milestone title\`. No strict schema is required.

`;
}

function techTemplate(id: string, title: string, productPath: string): string {
	return `# Tech Spec: ${title || id}

Product spec: \`${productPath}\`

## Context

Explain the current system and list the most relevant files with line references. Reference PRODUCT.md for behavior rather than restating it.

- \`path/to/file.ext:line\` - why it matters

## Proposed changes

Describe the implementation plan: modules touched, new types/APIs/state, data flow, ownership boundaries, rollout, and tradeoffs.

## Testing and validation

Map important PRODUCT.md Behavior items to concrete verification:

- Behavior #1: unit/integration/manual verification
- Behavior #2: ...

## Risks and mitigations

- Risk: ... Mitigation: ...

## Follow-ups

- ...
`;
}

function researchProductTemplate(id: string, title: string): string {
	return `# Product Spec: ${title || id}

Issue: started from research-first scaffold; behavior is not finalized yet.

## Summary

This spec folder was created so research artifacts have a stable home before the product behavior is finalized. Replace this draft with observable behavior once research and user grilling produce enough direction.

## Behavior

1. Draft behavior is intentionally unresolved until research findings and user decisions are synthesized.

## Open questions

- What user-visible behavior should this research inform?
`;
}

function slugifyResearchPurpose(value: string): string {
	const slug = value
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9._ -]+/g, " ")
		.trim()
		.replace(/[._ ]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return slug || "research";
}

function researchReportBasename(phase: string | undefined, purpose: string, topic: string): string {
	const pieces = [today()];
	const phaseSlug = phase ? slugifyResearchPurpose(phase) : undefined;
	if (phaseSlug) pieces.push(phaseSlug);
	pieces.push(slugifyResearchPurpose(purpose || topic));
	return `${pieces.join("-")}.md`;
}

async function nextAvailablePath(dir: string, filename: string): Promise<string> {
	let candidate = join(dir, filename);
	if (!(await exists(candidate))) return candidate;
	const stem = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
	const ext = filename.endsWith(".md") ? ".md" : "";
	for (let index = 2; ; index++) {
		candidate = join(dir, `${stem}-${index}${ext}`);
		if (!(await exists(candidate))) return candidate;
	}
}

async function ensureSpecFile(path: string, content: string, created: string[], skipped: string[]) {
	try {
		await writeFile(path, content, { flag: "wx" });
		created.push(path);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "EEXIST") {
			skipped.push(path);
			return;
		}
		throw err;
	}
}

function matchesFocusedSpecName(input: string, focused: SpecEntry): boolean {
	const normalized = input.trim();
	return normalized === focused.id || normalized === focused.path || normalized === basename(focused.path) || normalized === focused.title;
}

async function artifactState(specDir: string) {
	const product = await exists(join(specDir, "PRODUCT.md"));
	const tech = await exists(join(specDir, "TECH.md"));
	const milestones = await exists(join(specDir, "MILESTONES.md"));
	let latestAudit: string | null = null;
	try {
		const audits = (await readdir(join(specDir, "audits"))).filter((entry) => entry.endsWith(".md")).sort();
		latestAudit = audits.at(-1) ?? null;
	} catch {
		latestAudit = null;
	}
	return { product, tech, milestones, latestAudit };
}

async function researchReportCount(specDir: string): Promise<number> {
	try {
		return (await readdir(join(specDir, "research"))).filter((entry) => entry.endsWith(".md")).length;
	} catch {
		return 0;
	}
}

async function readLatestMilestones(milestonesPath: string, limit = 3): Promise<{ items: Array<{ date: string; summary: string }>; total: number }> {
	try {
		const text = await readFile(milestonesPath, "utf-8");
		const blocks = text.split(/^###\s+/m).slice(1);
		const results: Array<{ date: string; summary: string }> = [];
		for (const block of blocks) {
			const headingMatch = block.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*[-–]\s*(.+)$/m);
			if (!headingMatch) continue;
			const date = headingMatch[1];
			const body = block.slice(headingMatch.index! + headingMatch[0].length).trim();
			const firstLine = body.split(/\n+/).find((line) => line.trim().length > 0) ?? "";
			const summary = firstLine.trim().slice(0, 120);
			results.push({ date, summary });
		}
		return { items: results.slice(-limit).reverse(), total: results.length };
	} catch {
		return { items: [], total: 0 };
	}
}

function specCreatedTimestamp(specId: string): number {
	const dateMatch = specId.match(/^(\d{4}-\d{2}-\d{2})/);
	if (!dateMatch) return Date.now();
	const [y, m, d] = dateMatch[1].split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

async function findExistingSpecRoot(cwd: string): Promise<string | undefined> {
	try {
		const documented = extractSpecRootFromAgents(await readFile(join(cwd, "AGENTS.md"), "utf-8"));
		if (documented) {
			const specRoot = resolve(cwd, documented);
			if (await exists(specRoot)) return specRoot;
		}
	} catch {
		// Missing AGENTS.md means there may still be a conventional specs directory.
	}

	for (const candidate of ["specs", "docs/specs", ".pi/specs"]) {
		const specRoot = resolve(cwd, candidate);
		if (await exists(specRoot)) return specRoot;
	}
	return findNestedSpecsDir(cwd);
}

async function loadRegistryIfPresent(cwd: string): Promise<{ registry: SpecRegistry; specRoot: string; registryPath: string } | null> {
	const specRoot = await findExistingSpecRoot(cwd);
	if (!specRoot) return null;
	const registryPath = join(specRoot, "SPECS.yaml");
	try {
		return { registry: parseRegistry(await readFile(registryPath, "utf-8")), specRoot, registryPath };
	} catch {
		return null;
	}
}

async function specWidgetState(cwd: string): Promise<{ spec: SpecWidgetRecord | null; specCount: number }> {
	const loaded = await loadRegistryIfPresent(cwd);
	if (!loaded) return { spec: null, specCount: 0 };
	const spec = findSpec(loaded.registry, undefined);
	if (!spec) return { spec: null, specCount: loaded.registry.specs.length };
	const absoluteSpecDir = resolve(cwd, spec.path);
	const state = await artifactState(absoluteSpecDir);
	const milestonesPath = join(absoluteSpecDir, "MILESTONES.md");
	const { items: latestMilestones, total: milestonesTotal } = state.milestones ? await readLatestMilestones(milestonesPath, 3) : { items: [], total: 0 };
	const researchReports = await researchReportCount(absoluteSpecDir);
	return {
		spec: {
			id: spec.id,
			title: spec.title,
			status: spec.status,
			focused: spec.focused,
			path: spec.path,
			artifacts: {
				product: state.product,
				tech: state.tech,
				milestones: state.milestones,
				researchReports,
			},
			lastAudit: spec.last_audit ?? state.latestAudit,
			latestMilestones,
			milestonesTotal,
			createdTimestamp: specCreatedTimestamp(spec.id),
		},
		specCount: loaded.registry.specs.length,
	};
}

async function readSettings(specRoot: string): Promise<SpecSettings> {
	try {
		const text = await readFile(join(specRoot, "SPECS.settings.yaml"), "utf-8");
		return {
			audit_provider: parseYamlScalar(text.match(/^audit_provider:\s*(.*)$/m)?.[1] ?? "") ?? undefined,
			audit_model: parseYamlScalar(text.match(/^audit_model:\s*(.*)$/m)?.[1] ?? "") ?? undefined,
		};
	} catch {
		return {};
	}
}

async function writeSettings(specRoot: string, settings: SpecSettings) {
	await mkdir(specRoot, { recursive: true });
	await writeFile(join(specRoot, "SPECS.settings.yaml"), `audit_provider: ${yamlValue(settings.audit_provider)}\naudit_model: ${yamlValue(settings.audit_model)}\n`);
}

type SpecQuestionnaireQuestion = {
	id: string;
	question: string;
	context?: string;
	options?: string[];
	recommended?: number;
};

type SpecQuestionnaireAnswer = {
	id: string;
	question: string;
	answer: string;
	wasCustom: boolean;
};

const specQuestionnaireParameters = Type.Object({
	questions: Type.Array(
		Type.Object({
			id: Type.String({ description: "Short identifier, e.g. scope, risk, success-signal" }),
			question: Type.String({ description: "The adversarial question or decision to ask." }),
			context: Type.Optional(Type.String({ description: "Why this matters, including tradeoffs or downstream dependency." })),
			options: Type.Optional(Type.Array(Type.String({ description: "Suggested answer option." }))),
			recommended: Type.Optional(Type.Integer({ minimum: 0, description: "0-based recommended option." })),
		}),
		{ minItems: 1 },
	),
});

function normalizeSpecQuestions(rawQuestions: SpecQuestionnaireQuestion[]): Array<SpecQuestionnaireQuestion & { id: string; options: string[] }> {
	const seenIds = new Set<string>();
	return rawQuestions.map((question, index) => {
		let id = question.id.trim() || `q${index + 1}`;
		if (seenIds.has(id)) id = `${id}-${index + 1}`;
		seenIds.add(id);
		const options = (question.options ?? []).map((option) => option.trim()).filter(Boolean);
		const recommended = question.recommended !== undefined && question.recommended >= 0 && question.recommended < options.length ? question.recommended : undefined;
		return { ...question, id, options, recommended };
	});
}

function formatSpecQuestionnaireAnswers(questions: Array<SpecQuestionnaireQuestion & { id: string; options: string[] }>, answers: SpecQuestionnaireAnswer[]): string {
	return answers.map((answer) => {
		const question = questions.find((candidate) => candidate.id === answer.id);
		const lines = [`**Q:** ${answer.question}`];
		if (question?.context) lines.push(`\n${question.context}`);
		if (question && question.options.length > 0) lines.push(`\nOptions: ${question.options.join(" / ")}`);
		lines.push(`\n**A:** ${answer.answer}`);
		return lines.join("");
	}).join("\n\n---\n\n");
}

function registerSpecQuestionnaireTool(pi: ExtensionAPI, name: "spec_questionaire" | "spec_questionnaire") {
	pi.registerTool({
		name,
		label: name === "spec_questionaire" ? "Spec Questionaire" : "Spec Questionnaire",
		description: "Ask the user specs-specific grilling questions with recommended answers and free-text correction. Use for research-driven adversarial brainstorming.",
		promptSnippet: "Grill the user with specs-specific questions and capture Q&A records.",
		promptGuidelines: [
			"Use during /specs-research when user decisions are needed after research.",
			"Ask one decision branch at a time, or a small cluster of tightly related branch questions.",
			"Provide a recommended answer for each question so the user can accept, reject, or modify it.",
			"After answers, decide whether to research more, ask the next branch, or synthesize into PRODUCT.md/TECH.md.",
		],
		parameters: specQuestionnaireParameters,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return { content: [{ type: "text", text: "Error: UI not available (running in non-interactive mode)." }], details: { questions: [], answers: [], cancelled: true }, isError: true };
			}
			const questions = normalizeSpecQuestions(params.questions);
			const answers: SpecQuestionnaireAnswer[] = [];
			for (const question of questions) {
				const title = question.context ? `${question.question}\n\n${question.context}` : question.question;
				const displayOptions = question.options.map((option, index) => index === question.recommended ? `★ ${option}` : option);
				const customOption = "Write your own answer...";
				let answer: string | undefined;
				let wasCustom = false;
				if (displayOptions.length > 0) {
					const choice = await ctx.ui.select(title, [...displayOptions, customOption]);
					if (!choice) return { content: [{ type: "text", text: "User cancelled the spec questionnaire." }], details: { questions, answers, cancelled: true } };
					if (choice === customOption) {
						answer = await ctx.ui.input(question.question, "Type your answer");
						wasCustom = true;
					} else {
						answer = choice.replace(/^★\s*/, "");
					}
				} else {
					answer = await ctx.ui.input(title, "Type your answer");
					wasCustom = true;
				}
				if (answer === undefined) return { content: [{ type: "text", text: "User cancelled the spec questionnaire." }], details: { questions, answers, cancelled: true } };
				answers.push({ id: question.id, question: question.question, answer, wasCustom });
			}
			return { content: [{ type: "text", text: formatSpecQuestionnaireAnswers(questions, answers) }], details: { questions, answers, cancelled: false } };
		},
	});
}

export default function piSpecsExtension(pi: ExtensionAPI) {
	let specWidgetComponent: SpecWidgetComponent | null = null;
	let widgetRegistered = false;
	let currentWidgetState: { spec: SpecWidgetRecord | null; specCount: number } = { spec: null, specCount: 0 };

	function clearSpecWidget(ctx: ExtensionContext): void {
		ctx.ui.setStatus(SPEC_WIDGET_KEY, undefined);
		ctx.ui.setWidget(SPEC_WIDGET_KEY, undefined);
		widgetRegistered = false;
		specWidgetComponent = null;
		currentWidgetState = { spec: null, specCount: 0 };
	}

	let statusRefreshTimer: ReturnType<typeof setInterval> | null = null;
	function stopStatusRefresh(): void {
		if (statusRefreshTimer) {
			clearInterval(statusRefreshTimer);
			statusRefreshTimer = null;
		}
	}
	function startStatusRefresh(): void {
		if (statusRefreshTimer) return;
		statusRefreshTimer = setInterval(() => {
			specWidgetComponent?.update();
		}, 1000);
		statusRefreshTimer.unref?.();
	}

	async function updateSpecUI(ctx: ExtensionContext): Promise<void> {
		if (!ctx.hasUI) return;
		currentWidgetState = await specWidgetState(ctx.cwd);
		if (!currentWidgetState.spec && currentWidgetState.specCount <= 0) {
			clearSpecWidget(ctx);
			return;
		}

		ctx.ui.setStatus(SPEC_WIDGET_KEY, specFooterStatus(currentWidgetState.spec, { specCount: currentWidgetState.specCount }));
		if (!widgetRegistered) {
			ctx.ui.setWidget(
				SPEC_WIDGET_KEY,
				(tui, theme) => {
					specWidgetComponent = new SpecWidgetComponent({
						tui,
						theme,
						getSpec: () => currentWidgetState.spec,
						getSpecCount: () => currentWidgetState.specCount,
					});
					return specWidgetComponent;
				},
				{ placement: "aboveEditor" },
			);
			widgetRegistered = true;
		} else {
			specWidgetComponent?.update();
		}
		if (currentWidgetState.spec) {
			startStatusRefresh();
		} else {
			stopStatusRefresh();
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		await updateSpecUI(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopStatusRefresh();
		if (ctx.hasUI) clearSpecWidget(ctx);
	});

	for (const command of COMMANDS) {
		pi.registerCommand(command.name, {
			description: command.description,
			handler: async (args, ctx) => {
				sendSkillMessage(pi, ctx, command.skill, args, command.usage);
			},
		});
	}

	pi.registerCommand("specs-help", {
		description: "Show spec-driven development commands from pi-specs",
		handler: async (_args, ctx) => {
			const lines = COMMANDS.map((command) => `${command.usage} - ${command.description}`);
			lines.push("Tools: spec_scaffold, spec_research, spec_questionaire, spec_questionnaire, spec_focus, spec_unfocus, spec_status, spec_finish, spec_append_milestone, specs_settings_get, specs_settings_update");
			lines.push("/specs-help - Show this help");
			lines.push("/specs-clear - Clear focused spec and hide widget");
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("specs-clear", {
		description: "Clear the focused spec and hide the specs widget",
		handler: async (_args, ctx) => {
			const { registry, registryPath } = await loadRegistry(ctx.cwd);
			const previous = registry.focused;
			setFocused(registry, null);
			await saveRegistry(registryPath, registry);
			await updateSpecUI(ctx);
			ctx.ui.notify(previous ? `Cleared focused spec: ${previous}` : "No focused spec was set.", "info");
		},
	});

	registerSpecQuestionnaireTool(pi, "spec_questionaire");
	registerSpecQuestionnaireTool(pi, "spec_questionnaire");

	pi.registerTool({
		name: "spec_research",
		label: "Spec Research",
		description: "Prepare purpose-directed research inside a spec folder, including research/ report paths and agent guidance.",
		promptSnippet: "Start research-driven spec work and write a purpose-named research report.",
		promptGuidelines: [
			"Use spec_research when research should happen before or during product, tech, implementation, or audit work.",
			"Treat scaffold as folder name and directory structure first; do not assume generated spec content is final.",
			"Research may include source/web/docs/code investigation, prototype spikes, benchmarks, experiments, and observable feedback loops.",
			"Write findings to the returned research report path before making spec, implementation, or audit claims that depend on the research.",
		],
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
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const purpose = params.purpose.trim();
			const topic = params.topic.trim();
			if (!purpose) return { content: [{ type: "text", text: "purpose is required." }], isError: true };
			if (!topic) return { content: [{ type: "text", text: "topic is required." }], isError: true };

			const cwd = resolve(ctx.cwd);
			const { registry, specRoot, registryPath } = await loadRegistry(ctx.cwd);
			let spec = findSpec(registry, params.spec);
			let createdSpec = false;

			if (!spec && params.id) {
				const error = validateSpecId(params.id);
				if (error) return { content: [{ type: "text", text: `Invalid spec id: ${error}` }], isError: true };
				const specId = defaultSpecId(params.id.trim());
				const specDir = resolve(specRoot, specId);
				if (!specDir.startsWith(cwd)) return { content: [{ type: "text", text: "Refusing to create files outside the current project." }], isError: true };
				await mkdir(specDir, { recursive: true });
				const title = params.title?.trim() || specId;
				const relativeSpecDir = specPathFromRoot(cwd, specDir);
				spec = upsertSpec(registry, { id: specId, path: relativeSpecDir, title, status: "draft", focused: false, last_audit: null, updated: today() });
				setFocused(registry, spec.id);
				createdSpec = true;
			}

			if (!spec) {
				return { content: [{ type: "text", text: "No target spec found. Pass spec to use an existing spec, or id/title to scaffold a new research-first spec folder." }], isError: true };
			}

			const specDir = resolve(cwd, spec.path);
			if (!specDir.startsWith(cwd)) return { content: [{ type: "text", text: "Refusing to write research files outside the current project." }], isError: true };
			const researchDir = join(specDir, "research");
			await mkdir(researchDir, { recursive: true });
			const created: string[] = [];
			const skipped: string[] = [];
			await ensureSpecFile(join(specDir, "MILESTONES.md"), milestonesTemplate(spec.id, spec.title), created, skipped);
			if (createdSpec) await ensureSpecFile(join(specDir, "PRODUCT.md"), researchProductTemplate(spec.id, spec.title), created, skipped);

			const reportFile = researchReportBasename(params.phase, purpose, topic);
			const reportPath = await nextAvailablePath(researchDir, reportFile);
			const relativeReportPath = relative(cwd, reportPath);
			const reportTemplate = `# Research Report: ${purpose}\n\nSpec: \`${spec.path}\`\nPhase: ${params.phase ?? "unspecified"}\nTopic: ${topic}\n\n## Purpose\n\n${purpose}\n\n## Method\n\nDescribe sources inspected, experiments run, prototypes built, benchmarks measured, or other observable inquiry methods. For experiments, state the expected observation or measurable signal before interpreting results.\n\n## Observations\n\n- \n\n## Conclusions\n\n- \n\n## Impact on spec or plan\n\n- \n${params.instructions ? `\n## Additional instructions\n\n${params.instructions.trim()}\n` : ""}`;
			await writeFile(reportPath, reportTemplate, { flag: "wx" });

			spec.updated = today();
			await saveRegistry(registryPath, registry);
			await updateSpecUI(ctx);

			const lines = [
				`Spec research prepared: ${spec.id}`,
				`Spec path: ${spec.path}`,
				`Research directory: ${relative(cwd, researchDir)}`,
				`Report path: ${relativeReportPath}`,
				`Purpose: ${purpose}`,
				`Topic: ${topic}`,
				"Guidance:",
				"- Research before making spec, implementation, or audit claims that depend on evidence.",
				"- Use sources, code inspection, prototypes, benchmarks, or experiments as appropriate.",
				"- For experiments, define observable or quantitative signals before drawing conclusions.",
				"- Write findings to the report path, then update PRODUCT.md first if behavior changes.",
				created.length ? `Created:\n${created.map((path) => `- ${relative(cwd, path)}`).join("\n")}` : "Created: research report only",
				skipped.length ? `Skipped existing:\n${skipped.map((path) => `- ${relative(cwd, path)}`).join("\n")}` : "Skipped existing: none",
			];
			return { content: [{ type: "text", text: lines.join("\n") }], details: { spec: spec.id, path: spec.path, reportPath: relativeReportPath, createdSpec } };
		},
	});

	pi.registerTool({
		name: "spec_scaffold",
		label: "Spec Scaffold",
		description: "Create PRODUCT.md, MILESTONES.md, optional TECH.md, and a SPECS.yaml registry entry.",
		promptSnippet: "Scaffold a spec directory and register it in SPECS.yaml.",
		promptGuidelines: [
			"Use spec_scaffold when starting a new spec-driven feature and the user has provided a ticket id or short feature id.",
			"Do not overwrite existing PRODUCT.md, TECH.md, or MILESTONES.md; read existing specs first when they already exist.",
		],
		parameters: Type.Object({
			id: Type.String({ description: "Ticket id or short feature id, e.g. APP-1234 or markdown-tables" }),
			title: Type.Optional(Type.String({ description: "Human-readable spec title" })),
			includeTech: Type.Optional(Type.Boolean({ description: "Whether to create TECH.md as well as PRODUCT.md" })),
			focus: Type.Optional(Type.Boolean({ description: "Whether to make the new spec focused. Defaults to true." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const error = validateSpecId(params.id);
			if (error) return { content: [{ type: "text", text: `Invalid spec id: ${error}` }], isError: true };

			const cwd = resolve(ctx.cwd);
			const resolved = await resolveSpecRoot(ctx.cwd);
			const specId = defaultSpecId(params.id.trim());
			const specDir = resolve(resolved.specRoot, specId);
			if (!specDir.startsWith(cwd)) return { content: [{ type: "text", text: "Refusing to create files outside the current project." }], isError: true };

			await mkdir(specDir, { recursive: true });
			const title = params.title?.trim() || specId;
			const relativeSpecDir = specPathFromRoot(cwd, specDir);
			const created: string[] = [];
			const skipped: string[] = [];
			await ensureSpecFile(join(specDir, "PRODUCT.md"), productTemplate(specId, title), created, skipped);
			await ensureSpecFile(join(specDir, "MILESTONES.md"), milestonesTemplate(specId, title), created, skipped);
			if (params.includeTech ?? true) await ensureSpecFile(join(specDir, "TECH.md"), techTemplate(specId, title, `${relativeSpecDir}/PRODUCT.md`), created, skipped);

			const { registry, registryPath } = await loadRegistry(ctx.cwd);
			const spec = upsertSpec(registry, { id: specId, path: relativeSpecDir, title, status: "draft", focused: false, last_audit: null, updated: today() });
			if (params.focus ?? true) setFocused(registry, spec.id);
			await saveRegistry(registryPath, registry);
			await updateSpecUI(ctx);

			const text = [
				`Spec scaffolded: ${specId}`,
				`Path: ${relativeSpecDir}`,
				`Focus: ${registry.focused === specId ? "yes" : "no"}`,
				created.length ? `Created:\n${created.map((path) => `- ${relative(cwd, path)}`).join("\n")}` : "Created: none",
				skipped.length ? `Skipped existing:\n${skipped.map((path) => `- ${relative(cwd, path)}`).join("\n")}` : "Skipped existing: none",
			].join("\n");
			return { content: [{ type: "text", text }], details: { spec: specId, path: relativeSpecDir, created, skipped } };
		},
	});

	pi.registerTool({
		name: "spec_focus",
		label: "Spec Focus",
		description: "Set exactly one focused spec in specs/SPECS.yaml.",
		promptSnippet: "Focus a spec for no-argument spec commands and milestone updates.",
		parameters: Type.Object({ spec: Type.String({ description: "Spec id, path, basename, or title to focus." }) }),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { registry, registryPath } = await loadRegistry(ctx.cwd);
			const spec = findSpec(registry, params.spec);
			if (!spec) return { content: [{ type: "text", text: `Spec not found: ${params.spec}` }], isError: true };
			setFocused(registry, spec.id);
			spec.updated = today();
			await saveRegistry(registryPath, registry);
			await updateSpecUI(ctx);
			return { content: [{ type: "text", text: [`Focused spec: ${spec.id}`, `Title: ${spec.title}`, `Path: ${spec.path}`].join("\n") }], details: { spec: spec.id } };
		},
	});

	pi.registerTool({
		name: "spec_unfocus",
		label: "Spec Unfocus",
		description: "Clear the focused spec in specs/SPECS.yaml.",
		promptSnippet: "Clear spec focus.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const { registry, registryPath } = await loadRegistry(ctx.cwd);
			const previous = registry.focused;
			setFocused(registry, null);
			await saveRegistry(registryPath, registry);
			await updateSpecUI(ctx);
			return { content: [{ type: "text", text: previous ? `Cleared focused spec: ${previous}` : "No focused spec was set." }], details: { previous } };
		},
	});

	pi.registerTool({
		name: "spec_status",
		label: "Spec Status",
		description: "Summarize lifecycle state and key artifacts for a spec.",
		promptSnippet: "Show spec lifecycle status and artifact readiness.",
		parameters: Type.Object({ spec: Type.Optional(Type.String({ description: "Spec id, path, basename, or title. Defaults to focused spec." })) }),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { spec } = await resolveSpecTarget(ctx.cwd, params.spec);
			const state = await artifactState(resolve(ctx.cwd, spec.path));
			const lines = [
				`Spec: ${spec.id}`,
				`Title: ${spec.title}`,
				`Status: ${spec.status}${spec.focused ? " (focused)" : ""}`,
				`Path: ${spec.path}`,
				`PRODUCT.md: ${state.product ? "yes" : "missing"}`,
				`TECH.md: ${state.tech ? "yes" : "missing"}`,
				`MILESTONES.md: ${state.milestones ? "yes" : "missing"}`,
				`Latest audit: ${spec.last_audit ?? state.latestAudit ?? "none"}`,
				`Updated: ${spec.updated}`,
			];
			return { content: [{ type: "text", text: lines.join("\n") }], details: { spec: spec.id, state } };
		},
	});

	pi.registerTool({
		name: "spec_finish",
		label: "Spec Finish",
		description: "Run local completion checks and mark a spec completed when required artifacts exist. Audit is intentionally separate.",
		promptSnippet: "Finish a spec after implementation and validation evidence are in place.",
		parameters: Type.Object({ spec: Type.Optional(Type.String({ description: "Spec id, path, basename, or title. Defaults to focused spec." })) }),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { registry, registryPath, spec } = await resolveSpecTarget(ctx.cwd, params.spec);
			const state = await artifactState(resolve(ctx.cwd, spec.path));
			const missing = [];
			if (!state.product) missing.push("PRODUCT.md");
			if (!state.milestones) missing.push("MILESTONES.md");
			if (missing.length > 0) {
				return { content: [{ type: "text", text: [`Spec cannot finish: ${spec.id}`, `Missing: ${missing.join(", ")}`].join("\n") }], isError: true };
			}
			spec.status = "completed";
			spec.updated = today();
			await saveRegistry(registryPath, registry);
			await updateSpecUI(ctx);
			const warnings = [!state.tech ? "TECH.md is missing; accepted only if implementation was trivial." : undefined, "Spec audit was not run; use the future spec_audit flow when available."].filter(Boolean);
			return {
				content: [{ type: "text", text: [`Spec completed: ${spec.id}`, `Path: ${spec.path}`, warnings.length ? `Notes:\n${warnings.map((warning) => `- ${warning}`).join("\n")}` : "Notes: none"].join("\n") }],
				details: { spec: spec.id, warnings },
			};
		},
	});

	pi.registerTool({
		name: "spec_append_milestone",
		label: "Spec Append Milestone",
		description: "Append a free-form milestone paragraph to the focused spec's MILESTONES.md file with a timestamp heading down to seconds.",
		promptSnippet: "Append an implementation milestone to the currently focused spec.",
		promptGuidelines: [
			"When a focused spec exists, ALWAYS use spec_append_milestone to record milestones. Do NOT directly edit or write MILESTONES.md.",
			"Trigger this tool after any meaningful work on the focused spec: code changes, design decisions, test adjustments, completed phases, failed attempts, setbacks, fixes, validation notes, or user-steering pivots.",
			"Pass the focused spec id or name as current_spec_name so the TUI clearly shows which spec is being updated.",
			"Keep milestone_content as a concise paragraph unless more detail is useful; the tool adds a ### YYYY-MM-DD HH:mm:ss heading automatically unless one is already present.",
			"This tool also refreshes the spec widget after appending, so milestones appear immediately in the persistent footer UI. Directly editing MILESTONES.md leaves the widget stale until another refresh happens.",
		],
		parameters: Type.Object({
			current_spec_name: Type.String({ description: "The current focused spec id, path, basename, or title shown in the tool call." }),
			milestone_content: Type.String({ description: "Free-form milestone paragraph to append to MILESTONES.md." }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { spec } = await resolveSpecTarget(ctx.cwd, undefined);
			if (!matchesFocusedSpecName(params.current_spec_name, spec)) {
				return { content: [{ type: "text", text: `Focused spec is ${spec.id}; got current_spec_name=${params.current_spec_name}.` }], isError: true };
			}
			const content = params.milestone_content.trim();
			if (!content) return { content: [{ type: "text", text: "milestone_content is required." }], isError: true };
			const cwd = resolve(ctx.cwd);
			const specDir = resolve(cwd, spec.path);
			if (!specDir.startsWith(cwd)) return { content: [{ type: "text", text: "Refusing to append milestones outside the current project." }], isError: true };
			await mkdir(specDir, { recursive: true });
			const milestonesPath = join(specDir, "MILESTONES.md");
			if (!(await exists(milestonesPath))) await writeFile(milestonesPath, milestonesTemplate(spec.id, spec.title));
			await appendFile(milestonesPath, formatMilestoneEntry(content));
			await updateSpecUI(ctx);
			return { content: [{ type: "text", text: [`Milestone appended: ${spec.id}`, `File: ${relative(cwd, milestonesPath)}`].join("\n") }], details: { spec: spec.id, path: milestonesPath } };
		},
	});

	pi.registerTool({
		name: "specs_settings_get",
		label: "Specs Settings Get",
		description: "Read spec-root settings for future audit provider/model defaults.",
		promptSnippet: "Read specs settings.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const { specRoot } = await resolveSpecRoot(ctx.cwd);
			const settings = await readSettings(specRoot);
			return { content: [{ type: "text", text: [`Specs settings: ${relative(resolve(ctx.cwd), join(specRoot, "SPECS.settings.yaml"))}`, `audit_provider: ${settings.audit_provider ?? "current-session fallback"}`, `audit_model: ${settings.audit_model ?? "current-session fallback"}`].join("\n") }], details: settings };
		},
	});

	pi.registerTool({
		name: "specs_settings_update",
		label: "Specs Settings Update",
		description: "Update spec-root settings for future audit provider/model defaults.",
		promptSnippet: "Update specs settings.",
		parameters: Type.Object({
			audit_provider: Type.Optional(Type.String({ description: "Audit provider. Empty string clears to current-session fallback." })),
			audit_model: Type.Optional(Type.String({ description: "Audit model. Empty string clears to current-session fallback." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { specRoot } = await resolveSpecRoot(ctx.cwd);
			const settings = await readSettings(specRoot);
			if (params.audit_provider !== undefined) settings.audit_provider = params.audit_provider.trim() || undefined;
			if (params.audit_model !== undefined) settings.audit_model = params.audit_model.trim() || undefined;
			await writeSettings(specRoot, settings);
			await updateSpecUI(ctx);
			return { content: [{ type: "text", text: [`Specs settings updated`, `audit_provider: ${settings.audit_provider ?? "current-session fallback"}`, `audit_model: ${settings.audit_model ?? "current-session fallback"}`].join("\n") }], details: settings };
		},
	});

	pi.registerTool({
		name: "specs_list",
		label: "Specs List",
		description: "List spec directories under the AGENTS.md-documented spec root and report which contain PRODUCT.md, TECH.md, and MILESTONES.md.",
		promptSnippet: "List existing spec directories and whether PRODUCT.md / TECH.md / MILESTONES.md exists.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const { registry, specRoot } = await loadRegistry(ctx.cwd);
			const rows = [];
			for (const spec of registry.specs) {
				const state = await artifactState(resolve(ctx.cwd, spec.path));
				rows.push(`${spec.focused ? "*" : " "} ${spec.id}: status=${spec.status}, product=${state.product ? "yes" : "no"}, tech=${state.tech ? "yes" : "no"}, milestones=${state.milestones ? "yes" : "no"}`);
			}
			const text = rows.length ? rows.join("\n") : `${specRoot} exists but has no registered specs.`;
			return { content: [{ type: "text", text }], details: { specs: registry.specs } };
		},
	});
}
