import { access, appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { registerTasks } from "../src/tasks/index.js";

const COMMANDS = [
	{
		name: "spec-workflow",
		skill: "spec-driven-dev",
		description: "Start a full spec-driven workflow for a feature or risky change",
		usage: "/spec-workflow <feature, issue, or goal>",
	},
	{
		name: "spec-product",
		skill: "spec-product",
		description: "Write or revise a behavior-first PRODUCT.md spec",
		usage: "/spec-product <ticket/feature and desired behavior>",
	},
	{
		name: "spec-tech",
		skill: "spec-tech",
		description: "Write or revise an implementation-focused TECH.md spec",
		usage: "/spec-tech <spec path or feature>",
	},
	{
		name: "spec-implement",
		skill: "spec-implement",
		description: "Implement approved PRODUCT.md and TECH.md specs while keeping them current",
		usage: "/spec-implement <spec directory or feature>",
	},
	{
		name: "spec-audit",
		skill: "spec-audit",
		description: "Audit a repository's spec-driven development workflow or spec/code alignment",
		usage: "/spec-audit [spec directory, issue, or area]",
	},
] as const;

function buildSkillPrompt(skill: string, args: string, usage: string): string {
	const trimmed = args.trim();
	return [
		`Use the ${skill} skill for this task.`,
		"Read that skill's SKILL.md before taking action if it is available.",
		trimmed ? `User request: ${trimmed}` : `No arguments were provided. Ask for the missing details needed for ${usage}.`,
	].join("\n\n");
}

function sendSkillMessage(pi: ExtensionAPI, ctx: ExtensionCommandContext, skill: string, args: string, usage: string) {
	const prompt = buildSkillPrompt(skill, args, usage);
	if (ctx.isIdle()) {
		pi.sendUserMessage(prompt);
		return;
	}
	pi.sendUserMessage(prompt, { deliverAs: "followUp" });
	ctx.ui.notify(`Queued ${skill} as a follow-up task.`, "info");
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
	const nameLine = "Spec directory names use `YYYY-MM-DD-kebab-feature`, for example `2026-05-01-builtin-task-workflow`.";
	let current = "";
	try {
		current = await readFile(agentsPath, "utf-8");
	} catch {
		await writeFile(agentsPath, `# AGENTS.md\n\n${rootLine}\n${nameLine}\n`);
		return agentsPath;
	}
	const additions = [];
	if (!extractSpecRootFromAgents(current)) additions.push(rootLine);
	if (!current.includes("YYYY-MM-DD-kebab-feature")) additions.push(nameLine);
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

function tasksTemplate(): string {
	return `# TASKS

Pure Markdown task database for the sibling \`PRODUCT.md\` / \`TECH.md\` spec. Keep task text compact; details belong in the specs.

Legend: \`[ ]\` pending, \`[ ] [in_progress]\` in progress, \`[x]\` completed.

No tasks yet.
`;
}

export default function specDrivenDevExtension(pi: ExtensionAPI) {
	registerTasks(pi);

	for (const command of COMMANDS) {
		pi.registerCommand(command.name, {
			description: command.description,
			handler: async (args, ctx) => {
				sendSkillMessage(pi, ctx, command.skill, args, command.usage);
			},
		});
	}

	pi.registerCommand("spec-help", {
		description: "Show spec-driven development commands from pi-spec-driven-dev",
		handler: async (_args, ctx) => {
			const lines = COMMANDS.map((command) => `${command.usage} - ${command.description}`);
			lines.push("/tasks - Manage built-in workflow tasks");
			lines.push("Task tools: TaskCreate, TaskList, TaskGet, TaskUpdate, TaskOutput, TaskStop, TaskExecute");
			lines.push("/spec-help - Show this help");
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerTool({
		name: "spec_scaffold",
		label: "Spec Scaffold",
		description: "Create a specs/<id>/PRODUCT.md, TASKS.md, and optional TECH.md scaffold in the current project without overwriting existing files.",
		promptSnippet: "Create spec directory scaffolds for spec-driven development.",
		promptGuidelines: [
			"Use spec_scaffold when starting a new spec-driven feature and the user has provided a ticket id or short feature id.",
			"Do not use spec_scaffold to overwrite existing PRODUCT.md, TECH.md, or TASKS.md; read existing specs first when they already exist.",
		],
		parameters: Type.Object({
			id: Type.String({ description: "Ticket id or short feature id, e.g. APP-1234 or markdown-tables" }),
			title: Type.Optional(Type.String({ description: "Human-readable spec title" })),
			includeTech: Type.Optional(Type.Boolean({ description: "Whether to create TECH.md as well as PRODUCT.md" })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const error = validateSpecId(params.id);
			if (error) {
				return { content: [{ type: "text", text: `Invalid spec id: ${error}` }], isError: true };
			}

			const resolved = await resolveSpecRoot(ctx.cwd);
			const specId = defaultSpecId(params.id.trim());
			const specRoot = resolve(resolved.specRoot, specId);
			const cwd = resolve(ctx.cwd);
			if (!specRoot.startsWith(cwd)) {
				return { content: [{ type: "text", text: "Refusing to create files outside the current project." }], isError: true };
			}

			await mkdir(specRoot, { recursive: true });
			const title = params.title?.trim() || specId;
			const created: string[] = [];
			const skipped: string[] = [];

			async function createOnce(filename: string, content: string) {
				const filePath = join(specRoot, filename);
				try {
					await writeFile(filePath, content, { flag: "wx" });
					created.push(filePath);
				} catch (err) {
					if ((err as NodeJS.ErrnoException).code === "EEXIST") {
						skipped.push(filePath);
						return;
					}
					throw err;
				}
			}

			const relativeSpecDir = specRoot.startsWith(cwd) ? specRoot.slice(cwd.length + 1) : specRoot;
			await createOnce("PRODUCT.md", productTemplate(specId, title));
			if (params.includeTech ?? true) {
				await createOnce("TECH.md", techTemplate(specId, title, `${relativeSpecDir}/PRODUCT.md`));
			}
			await createOnce("TASKS.md", tasksTemplate());

			return {
				content: [
					{
						type: "text",
						text: [`Spec scaffold: ${relativeSpecDir}`, resolved.agentsUpdated ? `Updated AGENTS.md: ${resolved.agentsUpdated}` : "AGENTS.md: existing convention used", created.length ? `Created:\n${created.join("\n")}` : "Created: none", skipped.length ? `Skipped existing:\n${skipped.join("\n")}` : "Skipped existing: none"].join("\n\n"),
					},
				],
				details: { specRoot, created, skipped },
			};
		},
	});

	pi.registerTool({
		name: "spec_list",
		label: "Spec List",
		description: "List spec directories under the AGENTS.md-documented spec root and report which contain PRODUCT.md, TECH.md, and TASKS.md.",
		promptSnippet: "List existing spec directories and whether PRODUCT.md / TECH.md / TASKS.md exists.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const resolved = await resolveSpecRoot(ctx.cwd);
			const specsDir = resolved.specRoot;
			let entries: string[];
			try {
				entries = await readdir(specsDir);
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === "ENOENT") {
					return { content: [{ type: "text", text: "No specs/ directory found in the current project." }], details: { specs: [] } };
				}
				throw err;
			}

			const rows = [];
			for (const entry of entries.sort()) {
				const dir = join(specsDir, entry);
				let children: string[];
				try {
					children = await readdir(dir);
				} catch {
					continue;
				}
				const product = children.includes("PRODUCT.md") || children.includes("product.md");
				const tech = children.includes("TECH.md") || children.includes("tech.md");
				const tasks = children.includes("TASKS.md") || children.includes("tasks.md");
				rows.push({ id: entry, product, tech, tasks });
			}

			const text = rows.length
				? rows.map((row) => `${row.id}: product=${row.product ? "yes" : "no"}, tech=${row.tech ? "yes" : "no"}, tasks=${row.tasks ? "yes" : "no"}`).join("\n")
				: `${specsDir} exists but has no spec directories.`;
			return { content: [{ type: "text", text }], details: { specs: rows } };
		},
	});
}
