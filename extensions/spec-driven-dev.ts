import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

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

function techTemplate(id: string, title: string): string {
	return `# Tech Spec: ${title || id}

Product spec: \`specs/${id}/PRODUCT.md\`

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

export default function specDrivenDevExtension(pi: ExtensionAPI) {
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
			lines.push("/spec-help - Show this help");
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerTool({
		name: "spec_scaffold",
		label: "Spec Scaffold",
		description: "Create a specs/<id>/PRODUCT.md and optional TECH.md scaffold in the current project without overwriting existing files.",
		promptSnippet: "Create spec directory scaffolds for spec-driven development.",
		promptGuidelines: [
			"Use spec_scaffold when starting a new spec-driven feature and the user has provided a ticket id or short feature id.",
			"Do not use spec_scaffold to overwrite existing PRODUCT.md or TECH.md; read existing specs first when they already exist.",
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

			const specRoot = resolve(ctx.cwd, "specs", params.id.trim());
			const cwd = resolve(ctx.cwd);
			if (!specRoot.startsWith(cwd)) {
				return { content: [{ type: "text", text: "Refusing to create files outside the current project." }], isError: true };
			}

			await mkdir(specRoot, { recursive: true });
			const title = params.title?.trim() || params.id.trim();
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

			await createOnce("PRODUCT.md", productTemplate(params.id.trim(), title));
			if (params.includeTech ?? true) {
				await createOnce("TECH.md", techTemplate(params.id.trim(), title));
			}

			return {
				content: [
					{
						type: "text",
						text: [`Spec scaffold: specs/${params.id.trim()}`, created.length ? `Created:\n${created.join("\n")}` : "Created: none", skipped.length ? `Skipped existing:\n${skipped.join("\n")}` : "Skipped existing: none"].join("\n\n"),
					},
				],
				details: { specRoot, created, skipped },
			};
		},
	});

	pi.registerTool({
		name: "spec_list",
		label: "Spec List",
		description: "List spec directories under specs/ and report which contain PRODUCT.md and TECH.md.",
		promptSnippet: "List existing spec directories and whether PRODUCT.md / TECH.md exists.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const specsDir = resolve(ctx.cwd, "specs");
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
				rows.push({ id: entry, product, tech });
			}

			const text = rows.length
				? rows.map((row) => `${row.id}: product=${row.product ? "yes" : "no"}, tech=${row.tech ? "yes" : "no"}`).join("\n")
				: "specs/ exists but has no spec directories.";
			return { content: [{ type: "text", text }], details: { specs: rows } };
		},
	});
}
