/**
 * Built-in task manager for pi-spec-driven-dev.
 * Adapted from @tintinweb/pi-tasks (MIT) and integrated locally so spec workflows do not need an external task package.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { AutoClearManager } from "./auto-clear.js";
import { ProcessTracker } from "./process-tracker.js";
import { TaskStore } from "./task-store.js";
import { loadTasksConfig } from "./tasks-config.js";
import { openSettingsMenu } from "./ui/settings-menu.js";
import { TaskWidget, type UICtx } from "./ui/task-widget.js";

const DEBUG = Boolean(process.env.PI_TASKS_DEBUG);
const TASK_TOOL_NAMES = new Set(["TaskCreate", "TaskList", "TaskGet", "TaskUpdate", "TaskOutput", "TaskStop", "TaskExecute"]);
const REMINDER_INTERVAL = 4;
const AUTO_CLEAR_DELAY = 4;
const PROTOCOL_VERSION = 2;

const SYSTEM_REMINDER = `<system-reminder>
The task tools have not been used recently. If you are working on tasks that benefit from tracking progress, consider using TaskCreate and TaskUpdate to keep status current. Ignore this reminder if it is not relevant. Never mention this reminder to the user.
</system-reminder>`;

function debug(...args: unknown[]): void {
  if (DEBUG) console.error("[pi-spec-tasks]", ...args);
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined as any };
}

type RpcReply<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export function registerTasks(pi: ExtensionAPI): void {
  const cfg = loadTasksConfig();
  const piTasks = process.env.PI_TASKS;
  const taskScope = cfg.taskScope ?? "spec";

  function resolveSpecTasksPath(cwd: string, specDir?: string): string | undefined {
    const taskFileName = "TASKS.yaml";
    const isTaskFile = (path: string) => path.endsWith("TASKS.yaml") || path.endsWith("TASKS.yml") || path.endsWith("TASKS.md");
    if (specDir) {
      const resolved = resolve(cwd, specDir);
      return isTaskFile(resolved) ? resolved : join(resolved, taskFileName);
    }

    const cwdParts = resolve(cwd).split("/");
    const specsIndex = cwdParts.lastIndexOf("specs");
    if (specsIndex >= 0 && cwdParts.length > specsIndex + 1) {
      return join(cwdParts.slice(0, specsIndex + 2).join("/"), taskFileName);
    }

    if (cfg.activeSpecDir) return join(resolve(cwd, cfg.activeSpecDir), taskFileName);

    const specsDir = join(cwd, "specs");
    if (!existsSync(specsDir)) return undefined;
    const candidates = readdirSync(specsDir)
      .map((entry) => join(specsDir, entry))
      .filter((entry) => statSync(entry).isDirectory() && (existsSync(join(entry, "TASKS.yaml")) || existsSync(join(entry, "TASKS.yml"))));
    return candidates.length === 1 ? join(candidates[0], taskFileName) : undefined;
  }

  function resolveStorePath(sessionId?: string, cwd = process.cwd(), specDir?: string): string | undefined {
    if (piTasks === "off") return undefined;
    if (piTasks?.startsWith("/")) return piTasks;
    if (piTasks?.startsWith(".")) return resolve(piTasks);
    if (piTasks) return piTasks;
    if (taskScope === "spec") return resolveSpecTasksPath(cwd, specDir);
    if (taskScope === "memory") return undefined;
    if (taskScope === "session" && sessionId) return join(process.cwd(), ".pi", "tasks", `tasks-${sessionId}.json`);
    if (taskScope === "session") return undefined;
    return join(process.cwd(), ".pi", "tasks", "tasks.json");
  }

  let store = new TaskStore(resolveStorePath());
  let activeStorePath = resolveStorePath();
  const tracker = new ProcessTracker();
  const widget = new TaskWidget(store);
  const defaultAutoClear = () => taskScope === "spec" ? "never" : "on_list_complete";
  const autoClear = new AutoClearManager(() => store, () => cfg.autoClearCompleted ?? defaultAutoClear(), AUTO_CLEAR_DELAY);

  let latestCtx: ExtensionContext | undefined;
  let cascadeConfig: { additionalContext?: string; model?: string; maxTurns?: number } | undefined;
  const agentTaskMap = new Map<string, string>();
  let subagentsAvailable = false;
  let pendingWarning: string | undefined;

  function useStoreForContext(ctx?: ExtensionContext, specDir?: string): void {
    if (piTasks === "off" || taskScope === "memory") return;
    const nextPath = resolveStorePath(ctx?.sessionManager.getSessionId(), ctx?.cwd ?? process.cwd(), specDir);
    if (!nextPath || nextPath === activeStorePath) return;
    activeStorePath = nextPath;
    store = new TaskStore(nextPath);
    widget.setStore(store);
  }

  function rpcCall<T>(channel: string, params: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const requestId = randomUUID();
    return new Promise<T>((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        debug(`rpc timeout ${channel}`, requestId);
        reject(new Error(`${channel} timeout`));
      }, timeoutMs);
      const unsubscribe = pi.events.on(`${channel}:reply:${requestId}`, (raw: unknown) => {
        unsubscribe();
        clearTimeout(timer);
        const reply = raw as RpcReply<T>;
        if (reply.success) resolvePromise(reply.data as T);
        else reject(new Error(reply.error));
      });
      pi.events.emit(channel, { requestId, ...params });
    });
  }

  function spawnSubagent(type: string, prompt: string, options?: any): Promise<string> {
    return rpcCall<{ id: string }>("subagents:rpc:spawn", { type, prompt, options }, 30_000).then((data) => data.id);
  }

  function stopSubagent(agentId: string): Promise<void> {
    return rpcCall<void>("subagents:rpc:stop", { agentId }, 10_000).catch(() => undefined);
  }

  function checkSubagentsVersion(): void {
    const requestId = randomUUID();
    const timer = setTimeout(() => unsubscribe(), 5_000);
    const unsubscribe = pi.events.on(`subagents:rpc:ping:reply:${requestId}`, (raw: unknown) => {
      unsubscribe();
      clearTimeout(timer);
      const remoteVersion = (raw as any)?.data?.version as number | undefined;
      if (remoteVersion === undefined) {
        pendingWarning = "A compatible subagents extension is required for TaskExecute.";
      } else if (remoteVersion !== PROTOCOL_VERSION) {
        pendingWarning = `Subagent protocol mismatch: tasks use v${PROTOCOL_VERSION}, subagents use v${remoteVersion}.`;
      } else {
        subagentsAvailable = true;
        pendingWarning = undefined;
      }
    });
    pi.events.emit("subagents:rpc:ping", { requestId });
  }

  checkSubagentsVersion();
  pi.events.on("subagents:ready", () => checkSubagentsVersion());

  function buildTaskPrompt(task: { id: string; subject: string; description: string; blockedBy?: string[] }, additionalContext?: string): string {
    let prompt = `You are executing task #${task.id}: "${task.subject}"\n\n${task.description}`;
    if (task.blockedBy && task.blockedBy.length > 0) {
      const dependencyResults: string[] = [];
      for (const dependencyId of task.blockedBy) {
        const dependency = store.get(dependencyId);
        if (dependency?.metadata?.result) {
          const rawResult = String(dependency.metadata.result);
          const result = rawResult.length > 4000 ? `${rawResult.slice(0, 4000)}\n\n[... truncated; use TaskGet for full output]` : rawResult;
          dependencyResults.push(`### Task #${dependencyId}: ${dependency.subject}\n${result}`);
        }
      }
      if (dependencyResults.length > 0) prompt += `\n\n## Prerequisite task results\n\n${dependencyResults.join("\n\n")}`;
    }
    if (additionalContext) prompt += `\n\n${additionalContext}`;
    prompt += "\n\nComplete this task fully. Do not attempt to manage tasks yourself.";
    return prompt;
  }

  pi.events.on("subagents:completed", async (data) => {
    const { id, result } = data as { id: string; result?: string };
    const taskId = agentTaskMap.get(id);
    if (!taskId) return;
    agentTaskMap.delete(id);
    const task = store.get(taskId);
    if (!task) return;

    store.update(task.id, { status: "completed", metadata: { ...task.metadata, result } });
    widget.setActiveTask(task.id, false);

    if ((cfg.autoCascade ?? false) && cascadeConfig && latestCtx) {
      const unblocked = store.list().filter((candidate) =>
        candidate.status === "pending" &&
        candidate.metadata?.agentType &&
        candidate.blockedBy.includes(task.id) &&
        candidate.blockedBy.every((dependencyId) => store.get(dependencyId)?.status === "completed")
      );
      for (const next of unblocked) {
        store.update(next.id, { status: "in_progress" });
        try {
          const agentId = await spawnSubagent(next.metadata.agentType, buildTaskPrompt(next, cascadeConfig.additionalContext), {
            description: next.subject,
            isBackground: true,
            maxTurns: cascadeConfig.maxTurns,
            ...(cascadeConfig.model ? { model: cascadeConfig.model } : {}),
          });
          agentTaskMap.set(agentId, next.id);
          store.update(next.id, { owner: agentId, metadata: { ...next.metadata, agentId } });
          widget.setActiveTask(next.id);
        } catch (err: any) {
          store.update(next.id, { status: "pending", metadata: { ...next.metadata, lastError: err.message } });
        }
      }
    }

    autoClear.trackCompletion(task.id, currentTurn);
    widget.update();
  });

  pi.events.on("subagents:failed", (data) => {
    const { id, error, result, status } = data as { id: string; error?: string; result?: string; status: string };
    const taskId = agentTaskMap.get(id);
    if (!taskId) return;
    agentTaskMap.delete(id);
    const task = store.get(taskId);
    if (!task) return;

    if (status === "stopped") {
      store.update(task.id, { status: "completed", metadata: { ...task.metadata, result: result || task.metadata?.result } });
      autoClear.trackCompletion(task.id, currentTurn);
    } else {
      store.update(task.id, { status: "pending", metadata: { ...task.metadata, lastError: error || status } });
      autoClear.resetBatchCountdown();
    }
    widget.setActiveTask(task.id, false);
    widget.update();
  });

  let storeUpgraded = false;
  let persistedTasksShown = false;
  function upgradeStoreIfNeeded(ctx: ExtensionContext): void {
    if (storeUpgraded) return;
    useStoreForContext(ctx);
    storeUpgraded = true;
  }

  function showPersistedTasks(isResume = false): void {
    if (persistedTasksShown) return;
    persistedTasksShown = true;
    const tasks = store.list();
    if (tasks.length === 0) return;
    if (taskScope !== "spec" && !isResume && tasks.every((task) => task.status === "completed")) {
      store.clearCompleted();
      if (taskScope === "session") store.deleteFileIfEmpty();
    } else {
      widget.update();
    }
  }

  let currentTurn = 0;
  let lastTaskToolUseTurn = 0;
  let reminderInjectedThisCycle = false;

  pi.on("turn_start", async (_event, ctx) => {
    currentTurn++;
    latestCtx = ctx;
    widget.setUICtx(ctx.ui as UICtx);
    upgradeStoreIfNeeded(ctx);
    if (autoClear.onTurnStart(currentTurn)) widget.update();
  });

  pi.on("turn_end", async (event) => {
    const message = event.message as any;
    if (message?.role === "assistant" && message.usage) {
      widget.addTokenUsage(message.usage.input ?? 0, message.usage.output ?? 0);
    }
  });

  pi.on("tool_result", async (event) => {
    if (TASK_TOOL_NAMES.has(event.toolName)) {
      lastTaskToolUseTurn = currentTurn;
      reminderInjectedThisCycle = false;
      return {};
    }
    if (currentTurn - lastTaskToolUseTurn < REMINDER_INTERVAL) return {};
    if (reminderInjectedThisCycle) return {};
    if (store.list().length === 0) return {};

    reminderInjectedThisCycle = true;
    lastTaskToolUseTurn = currentTurn;
    return { content: [...event.content, { type: "text" as const, text: SYSTEM_REMINDER }] };
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    latestCtx = ctx;
    widget.setUICtx(ctx.ui as UICtx);
    upgradeStoreIfNeeded(ctx);
    showPersistedTasks();
    if (pendingWarning) {
      ctx.ui.notify(pendingWarning, "warning");
      pendingWarning = undefined;
    }
  });

  pi.on("session_switch" as any, async (event: any, ctx: ExtensionContext) => {
    latestCtx = ctx;
    widget.setUICtx(ctx.ui as UICtx);
    const isResume = event?.reason === "resume";
    storeUpgraded = false;
    persistedTasksShown = false;
    currentTurn = 0;
    lastTaskToolUseTurn = 0;
    reminderInjectedThisCycle = false;
    autoClear.reset();
    if (!isResume && taskScope === "memory") store.clearAll();
    upgradeStoreIfNeeded(ctx);
    showPersistedTasks(isResume);
  });

  pi.on("tool_execution_start", async (_event, ctx) => {
    latestCtx = ctx;
    widget.setUICtx(ctx.ui as UICtx);
    upgradeStoreIfNeeded(ctx);
    widget.update();
  });

  pi.on("session_shutdown", async () => {
    widget.dispose();
  });

  pi.registerTool({
    name: "TaskCreate",
    label: "TaskCreate",
    description: `Create a structured task for the current coding or spec-driven session.

Use proactively for complex multi-step work, plan mode, user-provided task lists, and spec-driven workflows that need progress tracking. Do not use it for a single trivial task.

Tasks start as pending. Use TaskUpdate to mark tasks in_progress before starting and completed when finished. Use dependencies when one task blocks another.`,
    promptGuidelines: [
      "For non-trivial spec-driven workflows, use TaskCreate to track product spec, tech spec, implementation, and validation work.",
      "Mark tasks as in_progress before starting and completed only when the work is actually done.",
      "Use TaskList after completing a task to find newly unblocked work.",
    ],
    parameters: Type.Object({
      subject: Type.String({ description: "Brief actionable task title" }),
      description: Type.String({ description: "Detailed context and acceptance criteria" }),
      activeForm: Type.Optional(Type.String({ description: "Present continuous text shown while active, e.g. 'Running tests'" })),
      agentType: Type.Optional(Type.String({ description: "Subagent type for TaskExecute, if a compatible subagent extension is loaded" })),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Arbitrary task metadata" })),
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should back this task list, e.g. specs/builtin-task-workflow" })),
    }),
    execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      autoClear.resetBatchCountdown();
      const metadata = params.metadata ?? {};
      if (params.agentType) metadata.agentType = params.agentType;
      const task = store.create(params.subject, params.description, params.activeForm, Object.keys(metadata).length > 0 ? metadata : undefined);
      widget.update();
      return Promise.resolve(textResult(`Task #${task.id} created successfully: ${task.subject}`));
    },
  });

  pi.registerTool({
    name: "TaskList",
    label: "TaskList",
    description: "List all tasks with status, owner, and open blockers. Use after completing work to find the next available task.",
    parameters: Type.Object({
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should be listed" })),
    }),
    execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      const tasks = store.list();
      if (tasks.length === 0) return Promise.resolve(textResult("No tasks found"));
      const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, completed: 2 };
      const lines = [...tasks]
        .sort((a, b) => (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0) || Number(a.id) - Number(b.id))
        .map((task) => {
          let line = `#${task.id} [${task.status}] ${task.subject}`;
          if (task.owner) line += ` (${task.owner})`;
          const openBlockers = task.blockedBy.filter((id) => {
            const blocker = store.get(id);
            return blocker && blocker.status !== "completed";
          });
          if (openBlockers.length > 0) line += ` [blocked by ${openBlockers.map((id) => `#${id}`).join(", ")}]`;
          return line;
        });
      return Promise.resolve(textResult(lines.join("\n")));
    },
  });

  pi.registerTool({
    name: "TaskGet",
    label: "TaskGet",
    description: "Get full details for a specific task, including description, owner, dependencies, and metadata.",
    parameters: Type.Object({
      taskId: Type.String({ description: "Task ID to retrieve" }),
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should be read" })),
    }),
    execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      const task = store.get(params.taskId);
      if (!task) return Promise.resolve(textResult("Task not found"));
      const lines = [`Task #${task.id}: ${task.subject}`, `Status: ${task.status}`];
      if (task.owner) lines.push(`Owner: ${task.owner}`);
      lines.push(`Description: ${task.description.replace(/\\n/g, "\n")}`);
      const openBlockers = task.blockedBy.filter((id) => {
        const blocker = store.get(id);
        return blocker && blocker.status !== "completed";
      });
      if (openBlockers.length > 0) lines.push(`Blocked by: ${openBlockers.map((id) => `#${id}`).join(", ")}`);
      if (task.blocks.length > 0) lines.push(`Blocks: ${task.blocks.map((id) => `#${id}`).join(", ")}`);
      if (Object.keys(task.metadata).length > 0) lines.push(`Metadata: ${JSON.stringify(task.metadata)}`);
      return Promise.resolve(textResult(lines.join("\n")));
    },
  });

  pi.registerTool({
    name: "TaskUpdate",
    label: "TaskUpdate",
    description: `Update task fields, status, owner, metadata, or dependencies.

Status workflow: pending -> in_progress -> completed. Use deleted to permanently remove a task. Only mark completed when the task is fully accomplished and relevant validation is done or explicitly reported.`,
    parameters: Type.Object({
      taskId: Type.String({ description: "Task ID to update" }),
      status: Type.Optional(Type.Unsafe<"pending" | "in_progress" | "completed" | "deleted">({ type: "string", enum: ["pending", "in_progress", "completed", "deleted"] })),
      subject: Type.Optional(Type.String({ description: "New subject" })),
      description: Type.Optional(Type.String({ description: "New description" })),
      activeForm: Type.Optional(Type.String({ description: "Active spinner text" })),
      owner: Type.Optional(Type.String({ description: "Task owner" })),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Metadata merge; null deletes a key" })),
      addBlocks: Type.Optional(Type.Array(Type.String(), { description: "Task IDs this task blocks" })),
      addBlockedBy: Type.Optional(Type.Array(Type.String(), { description: "Task IDs blocking this task" })),
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should be updated" })),
    }),
    execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      const { taskId, specDir: _specDir, ...fields } = params;
      const { task, changedFields, warnings } = store.update(taskId, fields);
      if (changedFields.length === 0 && !task) return Promise.resolve(textResult(`Task #${taskId} not found`));

      if (fields.status === "in_progress") {
        widget.setActiveTask(taskId);
        autoClear.resetBatchCountdown();
      } else if (fields.status === "pending") {
        autoClear.resetBatchCountdown();
      } else if (fields.status === "completed" || fields.status === "deleted") {
        widget.setActiveTask(taskId, false);
        if (fields.status === "completed") autoClear.trackCompletion(taskId, currentTurn);
      }

      widget.update();
      let message = `Updated task #${taskId} ${changedFields.join(", ")}`;
      if (warnings.length > 0) message += ` (warning: ${warnings.join("; ")})`;
      return Promise.resolve(textResult(message));
    },
  });

  pi.registerTool({
    name: "TaskOutput",
    label: "TaskOutput",
    description: "Retrieve output/status from a running or completed background task or subagent task.",
    parameters: Type.Object({
      task_id: Type.String({ description: "Task ID or agent ID" }),
      block: Type.Boolean({ description: "Whether to wait for completion", default: true }),
      timeout: Type.Number({ description: "Max wait time in ms", default: 30000, minimum: 0, maximum: 600000 }),
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should be read" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      const processOutput = tracker.getOutput(params.task_id);
      if (processOutput) {
        if (params.block && processOutput.status === "running") {
          const result = await tracker.waitForCompletion(params.task_id, params.timeout ?? 30000, signal ?? undefined);
          if (result) return textResult(`Task #${params.task_id} (${result.status})${result.exitCode !== undefined ? ` exit code: ${result.exitCode}` : ""}\n\n${result.output}`);
        }
        return textResult(`Task #${params.task_id} (${processOutput.status})${processOutput.exitCode !== undefined ? ` exit code: ${processOutput.exitCode}` : ""}\n\n${processOutput.output}`);
      }

      let resolvedId = params.task_id;
      if (!store.get(resolvedId)) {
        for (const [agentId, taskId] of agentTaskMap) {
          if (agentId === params.task_id || agentId.startsWith(params.task_id)) {
            resolvedId = taskId;
            break;
          }
        }
      }
      const task = store.get(resolvedId);
      if (!task) throw new Error(`No task found with ID ${params.task_id}`);
      if (!task.metadata?.agentId) throw new Error(`No background process for task ${params.task_id}`);

      if (params.block && task.status === "in_progress") {
        await new Promise<void>((resolvePromise) => {
          const timer = setTimeout(cleanup, params.timeout ?? 30000);
          const cleanup = () => {
            clearTimeout(timer);
            ok();
            fail();
            resolvePromise();
          };
          const ok = pi.events.on("subagents:completed", (data: unknown) => {
            if ((data as any).id === task.metadata?.agentId) cleanup();
          });
          const fail = pi.events.on("subagents:failed", (data: unknown) => {
            if ((data as any).id === task.metadata?.agentId) cleanup();
          });
          signal?.addEventListener("abort", cleanup, { once: true });
        });
      }
      const updated = store.get(resolvedId) ?? task;
      return textResult(`Task #${resolvedId} [${updated.status}] - subagent ${task.metadata.agentId}`);
    },
  });

  pi.registerTool({
    name: "TaskStop",
    label: "TaskStop",
    description: "Stop a running background task or subagent task by ID.",
    parameters: Type.Object({
      task_id: Type.Optional(Type.String({ description: "Task ID or agent ID" })),
      shell_id: Type.Optional(Type.String({ description: "Deprecated alias for task_id" })),
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should be updated" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      const taskId = params.task_id ?? params.shell_id;
      if (!taskId) throw new Error("task_id is required");

      const stopped = await tracker.stop(taskId);
      if (stopped) {
        store.update(taskId, { status: "completed" });
        autoClear.trackCompletion(taskId, currentTurn);
        widget.setActiveTask(taskId, false);
        widget.update();
        return textResult(`Task #${taskId} stopped successfully`);
      }

      let resolvedId = taskId;
      if (!store.get(resolvedId)) {
        for (const [agentId, mappedTaskId] of agentTaskMap) {
          if (agentId === taskId || agentId.startsWith(taskId)) {
            resolvedId = mappedTaskId;
            break;
          }
        }
      }
      const task = store.get(resolvedId);
      if (task?.metadata?.agentId && task.status === "in_progress") {
        store.update(resolvedId, { status: "completed" });
        autoClear.trackCompletion(resolvedId, currentTurn);
        await stopSubagent(task.metadata.agentId);
        widget.setActiveTask(resolvedId, false);
        widget.update();
        return textResult(`Task #${resolvedId} stopped successfully`);
      }
      throw new Error(`No running background process for task ${taskId}`);
    },
  });

  pi.registerTool({
    name: "TaskExecute",
    label: "TaskExecute",
    description: "Execute pending tasks with agentType metadata as background subagents when a compatible subagent extension is loaded.",
    promptGuidelines: ["Never launch a second agent for tasks already launched via TaskExecute."],
    parameters: Type.Object({
      task_ids: Type.Array(Type.String(), { description: "Task IDs to execute" }),
      additional_context: Type.Optional(Type.String({ description: "Extra context appended to each task prompt" })),
      model: Type.Optional(Type.String({ description: "Model override for subagents" })),
      max_turns: Type.Optional(Type.Number({ description: "Maximum turns per agent", minimum: 1 })),
      specDir: Type.Optional(Type.String({ description: "Spec directory whose TASKS.yaml should be updated" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      useStoreForContext(ctx, params.specDir);
      if (!subagentsAvailable) return textResult("Subagent execution is unavailable. Load a compatible subagents extension and try again.");

      const results: string[] = [];
      const launched: string[] = [];
      for (const taskId of params.task_ids) {
        const task = store.get(taskId);
        if (!task) {
          results.push(`#${taskId}: not found`);
          continue;
        }
        if (task.status !== "pending") {
          results.push(`#${taskId}: not pending (status: ${task.status})`);
          continue;
        }
        if (!task.metadata?.agentType) {
          results.push(`#${taskId}: no agentType set`);
          continue;
        }
        const openBlockers = task.blockedBy.filter((id) => store.get(id)?.status !== "completed");
        if (openBlockers.length > 0) {
          results.push(`#${taskId}: blocked by ${openBlockers.map((id) => `#${id}`).join(", ")}`);
          continue;
        }

        store.update(taskId, { status: "in_progress" });
        try {
          const agentId = await spawnSubagent(task.metadata.agentType, buildTaskPrompt(task, params.additional_context), {
            description: task.subject,
            isBackground: true,
            maxTurns: params.max_turns,
            ...(params.model ? { model: params.model } : {}),
          });
          agentTaskMap.set(agentId, taskId);
          store.update(taskId, { owner: agentId, metadata: { ...task.metadata, agentId } });
          widget.setActiveTask(taskId);
          launched.push(`#${taskId} -> agent ${agentId}`);
        } catch (err: any) {
          store.update(taskId, { status: "pending", metadata: { ...task.metadata, lastError: err.message } });
          results.push(`#${taskId}: spawn failed - ${err.message}`);
        }
      }

      cascadeConfig = { additionalContext: params.additional_context, model: params.model, maxTurns: params.max_turns };
      widget.update();
      const lines: string[] = [];
      if (launched.length > 0) lines.push(`Launched ${launched.length} agent(s):\n${launched.join("\n")}\nUse TaskOutput to check progress.`);
      if (results.length > 0) lines.push(`Skipped:\n${results.join("\n")}`);
      return textResult(lines.length > 0 ? lines.join("\n\n") : "No tasks to execute.");
    },
  });

  pi.registerCommand("tasks", {
    description: "Manage built-in task workflow - view, create, clear, and configure tasks",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const ui = ctx.ui;

      const mainMenu = async (): Promise<void> => {
        const tasks = store.list();
        const completedCount = tasks.filter((task) => task.status === "completed").length;
        const choices = [`View all tasks (${tasks.length})`, "Create task"];
        if (completedCount > 0) choices.push(`Clear completed (${completedCount})`);
        if (tasks.length > 0) choices.push(`Clear all (${tasks.length})`);
        choices.push("Settings");

        const choice = await ui.select("Tasks", choices);
        if (!choice) return;
        if (choice.startsWith("View")) return viewTasks();
        if (choice === "Create task") return createTask();
        if (choice === "Settings") return openSettingsMenu(ui, cfg, mainMenu, AUTO_CLEAR_DELAY);
        if (choice.startsWith("Clear completed")) {
          store.clearCompleted();
          if (taskScope === "session") store.deleteFileIfEmpty();
          widget.update();
          return mainMenu();
        }
        if (choice.startsWith("Clear all")) {
          store.clearAll();
          if (taskScope === "session") store.deleteFileIfEmpty();
          widget.update();
          return mainMenu();
        }
      };

      const viewTasks = async (): Promise<void> => {
        const tasks = store.list();
        if (tasks.length === 0) {
          await ui.select("No tasks", ["Back"]);
          return mainMenu();
        }
        const choices = tasks.map((task) => `${task.status === "completed" ? "✔" : task.status === "in_progress" ? "◼" : "◻"} #${task.id} [${task.status}] ${task.subject}`);
        choices.push("Back");
        const selected = await ui.select("Tasks", choices);
        if (!selected || selected === "Back") return mainMenu();
        const match = selected.match(/#(\d+)/);
        if (match) return viewTaskDetail(match[1]);
        return viewTasks();
      };

      const viewTaskDetail = async (taskId: string): Promise<void> => {
        const task = store.get(taskId);
        if (!task) return viewTasks();
        const actions: string[] = [];
        if (task.status === "pending") actions.push("Start (in_progress)");
        if (task.status === "in_progress") actions.push("Complete");
        actions.push("Delete", "Back");
        const action = await ui.select(`#${task.id} [${task.status}] ${task.subject}\n${task.description}`, actions);
        if (action === "Start (in_progress)") {
          store.update(taskId, { status: "in_progress" });
          widget.setActiveTask(taskId);
          widget.update();
          return viewTasks();
        }
        if (action === "Complete") {
          store.update(taskId, { status: "completed" });
          autoClear.trackCompletion(taskId, currentTurn);
          widget.setActiveTask(taskId, false);
          widget.update();
          return viewTasks();
        }
        if (action === "Delete") {
          store.update(taskId, { status: "deleted" });
          widget.setActiveTask(taskId, false);
          widget.update();
          return viewTasks();
        }
        return viewTasks();
      };

      const createTask = async (): Promise<void> => {
        const subject = await ui.input("Task subject");
        if (!subject) return mainMenu();
        const description = await ui.input("Task description");
        if (!description) return mainMenu();
        store.create(subject, description);
        widget.update();
        return mainMenu();
      };

      await mainMenu();
    },
  });
}
