import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";

type SpecWidgetColor = Extract<ThemeColor, "accent" | "warning" | "success" | "error" | "dim" | "muted" | "text">;

export interface SpecWidgetArtifactState {
	product: boolean;
	tech: boolean;
	milestones: boolean;
	researchReports: number;
}

export interface SpecWidgetRecord {
	id: string;
	title: string;
	status: string;
	focused: boolean;
	path: string;
	artifacts: SpecWidgetArtifactState;
	lastAudit?: string | null;
	latestMilestones?: Array<{ date: string; summary: string }>;
	milestonesTotal?: number;
	createdTimestamp?: number;
}

export interface SpecWidgetOptions {
	theme: Theme;
	tui: TUI;
	getSpec: () => SpecWidgetRecord | null;
	getSpecCount?: () => number;
}

const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;

function visibleWidth(value: string): number {
	return Array.from(value.replace(ANSI_PATTERN, "")).reduce((width, char) => width + (/[^\u0000-\u00ff]/.test(char) ? 2 : 1), 0);
}

function truncateToWidth(value: string, width: number, ellipsis = "…"): string {
	const safeWidth = Math.max(0, width);
	if (visibleWidth(value) <= safeWidth) return value;
	const target = Math.max(0, safeWidth - visibleWidth(ellipsis));
	let output = "";
	let used = 0;
	let index = 0;
	while (index < value.length) {
		if (value[index] === "\u001b") {
			const slice = value.slice(index);
			const match = slice.match(/^(?:\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\))/);
			if (match) {
				output += match[0];
				index += match[0].length;
				continue;
			}
		}
		const char = Array.from(value.slice(index))[0] ?? "";
		const charWidth = visibleWidth(char);
		if (used + charWidth > target) break;
		output += char;
		used += charWidth;
		index += char.length;
	}
	return `${output}${ellipsis}`;
}

export function specWidgetVisibleWidth(value: string): number {
	return visibleWidth(value);
}

function fit(value: string, width: number): string {
	return visibleWidth(value) > width ? truncateToWidth(value, width, "…") : value;
}

function heading(theme: Theme, width: number, left: string, right = ""): string {
	if (!right) return fit(left, width);
	const rightPart = ` ${right}`;
	const fill = Math.max(1, width - visibleWidth(left) - visibleWidth(rightPart));
	return fit(`${left}${theme.fg("dim", " ".repeat(fill))}${rightPart}`, width);
}

function branchLine(theme: Theme, width: number, isLast: boolean, content: string): string {
	const prefix = isLast ? "└─" : "├─";
	return fit(`${theme.fg("dim", prefix)} ${content}`, width);
}

function displayIconAndColor(spec: SpecWidgetRecord): { icon: string; color: SpecWidgetColor } {
	if (spec.status === "completed") return { icon: "✓", color: "success" };
	if (spec.status === "audit_running") return { icon: "◐", color: "warning" };
	if (spec.status === "implementing") return { icon: "●", color: "accent" };
	return { icon: "◆", color: "muted" };
}

export function specFooterStatus(spec: SpecWidgetRecord | null, options: { specCount?: number } = {}): string | undefined {
	const specCount = options.specCount ?? (spec ? 1 : 0);
	if (!spec) return specCount > 0 ? `specs: unfocused [${specCount}]` : undefined;
	return `specs: ${spec.id} · ${spec.status}`;
}

function formatElapsed(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${days}DAY ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function renderSpecWidgetLines(spec: SpecWidgetRecord | null, theme: Theme, width: number, options: { specCount?: number; now?: number } = {}): string[] {
	const specCount = options.specCount ?? (spec ? 1 : 0);
	const now = options.now ?? Date.now();
	const safeWidth = Math.max(1, width);

	if (!spec) {
		if (specCount <= 0) return [];
		const meta = specCount === 1 ? "1 spec" : `${specCount} specs`;
		return [
			heading(theme, safeWidth, `${theme.fg("warning", "◇")} ${theme.fg("warning", theme.bold("Specs"))} ${theme.fg("muted", "unfocused")}`, theme.fg("muted", meta)),
			branchLine(theme, safeWidth, true, theme.fg("muted", "Run /spec-status or spec_focus to choose this session's spec")),
		];
	}

	const { icon, color } = displayIconAndColor(spec);

	// Heading: left = icon + Spec + id + status, right = elapsed time
	const headingLeft = `${theme.fg(color, icon)} ${theme.fg(color, theme.bold("Spec"))} ${theme.fg("text", spec.id)} ${theme.fg("dim", "·")} ${theme.fg("muted", spec.status)}`;
	const elapsedMs = now - (spec.createdTimestamp ?? now);
	const headingRight = formatElapsed(elapsedMs);
	const lines = [heading(theme, safeWidth, headingLeft, headingRight)];

	const body: string[] = [];

	// Milestone lines (latest 3, newest first)
	const milestones = spec.latestMilestones ?? [];
	for (const { date, summary } of milestones) {
		body.push(`${theme.fg("dim", date)} ${theme.fg("dim", "–")} ${theme.fg("text", summary)}`);
	}

	for (const [index, content] of body.entries()) {
		lines.push(branchLine(theme, safeWidth, index === body.length - 1, content));
	}

	return lines;
}

export class SpecWidgetComponent implements Component {
	private theme: Theme;
	private tui: TUI;
	private getSpec: () => SpecWidgetRecord | null;
	private getSpecCount: () => number;

	constructor(options: SpecWidgetOptions) {
		this.theme = options.theme;
		this.tui = options.tui;
		this.getSpec = options.getSpec;
		this.getSpecCount = options.getSpecCount ?? (() => (this.getSpec() ? 1 : 0));
	}

	update(): void {
		this.tui.requestRender();
	}

	render(width: number): string[] {
		return renderSpecWidgetLines(this.getSpec(), this.theme, width, { specCount: this.getSpecCount() });
	}

	invalidate(): void {
		this.tui.requestRender();
	}
}
