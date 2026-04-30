import { truncateToWidth } from "@mariozechner/pi-tui";
import type { TaskStore } from "../task-store.js";

export type Theme = {
  fg(color: string, text: string): string;
  bold(text: string): string;
  strikethrough(text: string): string;
};

export type UICtx = {
  setStatus(key: string, text: string | undefined): void;
  setWidget(
    key: string,
    content: undefined | ((tui: any, theme: Theme) => { render(): string[]; invalidate(): void }),
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ): void;
};

const SPINNER = ["✳", "✴", "✵", "✶", "✷", "✸", "✹", "✺", "✻", "✼", "✽"];
const MAX_VISIBLE_TASKS = 10;

export interface TaskMetrics {
  startedAt: number;
  inputTokens: number;
  outputTokens: number;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export class TaskWidget {
  private uiCtx: UICtx | undefined;
  private widgetFrame = 0;
  private widgetInterval: ReturnType<typeof setInterval> | undefined;
  private activeTaskIds = new Set<string>();
  private metrics = new Map<string, TaskMetrics>();
  private tui: any | undefined;
  private widgetRegistered = false;
  private store: TaskStore;

  constructor(store: TaskStore) {
    this.store = store;
  }

  setStore(store: TaskStore): void {
    this.store = store;
  }

  setUICtx(ctx: UICtx): void {
    this.uiCtx = ctx;
  }

  setActiveTask(taskId: string | undefined, active = true): void {
    if (taskId && active) {
      this.activeTaskIds.add(taskId);
      if (!this.metrics.has(taskId)) {
        this.metrics.set(taskId, { startedAt: Date.now(), inputTokens: 0, outputTokens: 0 });
      }
      this.ensureTimer();
    } else if (taskId) {
      this.activeTaskIds.delete(taskId);
    }
    this.update();
  }

  addTokenUsage(inputTokens: number, outputTokens: number): void {
    for (const id of this.activeTaskIds) {
      const metrics = this.metrics.get(id);
      if (metrics) {
        metrics.inputTokens += inputTokens;
        metrics.outputTokens += outputTokens;
      }
    }
  }

  private ensureTimer(): void {
    if (!this.widgetInterval) this.widgetInterval = setInterval(() => this.update(), 150);
  }

  private renderWidget(tui: any, theme: Theme): string[] {
    const tasks = this.store.list();
    const width = tui.terminal.columns;
    const truncate = (line: string) => truncateToWidth(line, width);

    if (tasks.length === 0) return [];

    const completed = tasks.filter((task) => task.status === "completed");
    const inProgress = tasks.filter((task) => task.status === "in_progress");
    const pending = tasks.filter((task) => task.status === "pending");

    const parts: string[] = [];
    if (completed.length > 0) parts.push(`${completed.length} done`);
    if (inProgress.length > 0) parts.push(`${inProgress.length} in progress`);
    if (pending.length > 0) parts.push(`${pending.length} open`);

    const spinnerChar = SPINNER[this.widgetFrame % SPINNER.length];
    const lines = [truncate(`${theme.fg("accent", "●")} ${theme.fg("accent", `${tasks.length} tasks (${parts.join(", ")})`)}`)];

    for (const task of tasks.slice(0, MAX_VISIBLE_TASKS)) {
      const isActive = this.activeTaskIds.has(task.id) && task.status === "in_progress";
      const icon = isActive
        ? theme.fg("accent", spinnerChar)
        : task.status === "completed"
          ? theme.fg("success", "✔")
          : task.status === "in_progress"
            ? theme.fg("accent", "◼")
            : "◻";

      let suffix = "";
      if (task.status === "pending" && task.blockedBy.length > 0) {
        const openBlockers = task.blockedBy.filter((id) => {
          const blocker = this.store.get(id);
          return blocker && blocker.status !== "completed";
        });
        if (openBlockers.length > 0) suffix = theme.fg("dim", ` › blocked by ${openBlockers.map((id) => `#${id}`).join(", ")}`);
      }

      if (isActive) {
        const form = task.activeForm || task.subject;
        const agentId = task.metadata?.agentId;
        const agentLabel = agentId ? ` (agent ${String(agentId).slice(0, 5)})` : "";
        const metrics = this.metrics.get(task.id);
        let stats = "";
        if (metrics) {
          const elapsed = formatDuration(Date.now() - metrics.startedAt);
          const tokenParts: string[] = [];
          if (metrics.inputTokens > 0) tokenParts.push(`↑ ${formatTokens(metrics.inputTokens)}`);
          if (metrics.outputTokens > 0) tokenParts.push(`↓ ${formatTokens(metrics.outputTokens)}`);
          stats = tokenParts.length > 0
            ? ` ${theme.fg("dim", `(${elapsed} · ${tokenParts.join(" ")})`)}`
            : ` ${theme.fg("dim", `(${elapsed})`)}`;
        }
        lines.push(truncate(`  ${icon} ${theme.fg("dim", `#${task.id}`)} ${theme.fg("accent", `${form}${agentLabel}...`)}${stats}${suffix}`));
      } else if (task.status === "completed") {
        lines.push(truncate(`  ${icon} ${theme.fg("dim", theme.strikethrough(`#${task.id} ${task.subject}`))}${suffix}`));
      } else {
        const agentSuffix = task.status === "in_progress" && task.metadata?.agentId
          ? theme.fg("dim", ` (agent ${String(task.metadata.agentId).slice(0, 5)})`)
          : "";
        lines.push(truncate(`  ${icon} ${theme.fg("dim", `#${task.id}`)} ${task.subject}${agentSuffix}${suffix}`));
      }
    }

    if (tasks.length > MAX_VISIBLE_TASKS) {
      lines.push(truncate(theme.fg("dim", `    ... and ${tasks.length - MAX_VISIBLE_TASKS} more`)));
    }

    return lines;
  }

  update(): void {
    if (!this.uiCtx) return;
    const tasks = this.store.list();

    if (tasks.length === 0) {
      if (this.widgetRegistered) {
        this.uiCtx.setWidget("tasks", undefined);
        this.widgetRegistered = false;
      }
      if (this.widgetInterval) {
        clearInterval(this.widgetInterval);
        this.widgetInterval = undefined;
      }
      return;
    }

    for (const id of this.activeTaskIds) {
      const task = this.store.get(id);
      if (!task || task.status !== "in_progress") {
        this.activeTaskIds.delete(id);
        this.metrics.delete(id);
      }
    }

    const hasActiveSpinner = tasks.some((task) => this.activeTaskIds.has(task.id) && task.status === "in_progress");
    if (hasActiveSpinner) this.ensureTimer();
    else if (this.widgetInterval) {
      clearInterval(this.widgetInterval);
      this.widgetInterval = undefined;
    }

    this.widgetFrame++;

    if (!this.widgetRegistered) {
      this.uiCtx.setWidget("tasks", (tui, theme) => {
        this.tui = tui;
        return { render: () => this.renderWidget(tui, theme), invalidate: () => {} };
      }, { placement: "aboveEditor" });
      this.widgetRegistered = true;
    } else if (this.tui) {
      this.tui.requestRender();
    }
  }

  dispose(): void {
    if (this.widgetInterval) {
      clearInterval(this.widgetInterval);
      this.widgetInterval = undefined;
    }
    if (this.uiCtx) this.uiCtx.setWidget("tasks", undefined);
    this.widgetRegistered = false;
    this.tui = undefined;
  }
}
