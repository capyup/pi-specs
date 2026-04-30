/**
 * File-backed task store with CRUD, dependency management, and file locking.
 * Adapted from @tintinweb/pi-tasks (MIT).
 *
 * `TASKS.md` uses pure Markdown todo lines as the source of truth. No hidden JSON block.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join } from "node:path";
import type { Task, TaskStatus, TaskStoreData } from "./types.js";

const TASKS_DIR = join(homedir(), ".pi", "tasks");
const LOCK_RETRY_MS = 50;
const LOCK_MAX_RETRIES = 100;
const LEGACY_MARKDOWN_DB_START = "<!-- pi-spec-tasks-db";
const LEGACY_MARKDOWN_DB_END = "-->";

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(lockPath: string): void {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    try {
      writeFileSync(lockPath, `${process.pid}`, { flag: "wx" });
      return;
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
      try {
        const pid = Number.parseInt(readFileSync(lockPath, "utf-8"), 10);
        if (pid && !isProcessRunning(pid)) {
          unlinkSync(lockPath);
          continue;
        }
      } catch {
        // Ignore unreadable stale locks and retry briefly.
      }
      const start = Date.now();
      while (Date.now() - start < LOCK_RETRY_MS) {}
    }
  }
  throw new Error(`Failed to acquire lock: ${lockPath}`);
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // Best-effort cleanup.
  }
}

function isMarkdownTaskFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".md";
}

function escapeInline(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/;/g, ",").trim();
}

function parseIdList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function formatIdList(ids: string[]): string {
  return ids.map((id) => `#${id}`).join(", ");
}

function coerceTaskArray(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  const tasks: Task[] = [];
  for (const raw of value as any[]) {
    if (!raw || raw.id === undefined || raw.subject === undefined) continue;
    const status = ["pending", "in_progress", "completed"].includes(raw.status) ? raw.status : "pending";
    const now = Date.now();
    tasks.push({
      id: String(raw.id).replace(/^#/, ""),
      subject: String(raw.subject).trim(),
      description: String(raw.description ?? raw.subject).trim(),
      status,
      activeForm: raw.activeForm === undefined ? undefined : String(raw.activeForm),
      owner: raw.owner === undefined ? undefined : String(raw.owner),
      metadata: raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata) ? raw.metadata : {},
      blocks: Array.isArray(raw.blocks) ? raw.blocks.map((id: unknown) => String(id).replace(/^#/, "")) : [],
      blockedBy: Array.isArray(raw.blockedBy) ? raw.blockedBy.map((id: unknown) => String(id).replace(/^#/, "")) : [],
      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
    });
  }
  return tasks;
}

export function normalizeTaskStoreData(input: Partial<TaskStoreData> | undefined): { data: TaskStoreData; warnings: string[] } {
  const warnings: string[] = [];
  const deduped = new Map<string, Task>();
  for (const task of coerceTaskArray(input?.tasks)) {
    if (!task.id || !task.subject) continue;
    if (deduped.has(task.id)) warnings.push(`duplicate task id #${task.id}; kept the last entry`);
    deduped.set(task.id, task);
  }

  const tasks = Array.from(deduped.values()).sort((a, b) => Number(a.id) - Number(b.id));
  const validIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    const cleanBlocks = new Set<string>();
    const cleanBlockedBy = new Set<string>();
    for (const id of task.blocks) {
      if (id === task.id) warnings.push(`#${task.id} cannot block itself`);
      else if (!validIds.has(id)) warnings.push(`#${task.id} references missing blocked task #${id}`);
      else cleanBlocks.add(id);
    }
    for (const id of task.blockedBy) {
      if (id === task.id) warnings.push(`#${task.id} cannot be blocked by itself`);
      else if (!validIds.has(id)) warnings.push(`#${task.id} references missing blocker #${id}`);
      else cleanBlockedBy.add(id);
    }
    task.blocks = Array.from(cleanBlocks);
    task.blockedBy = Array.from(cleanBlockedBy);
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    for (const blockedId of task.blocks) {
      const blocked = byId.get(blockedId);
      if (blocked && !blocked.blockedBy.includes(task.id)) {
        blocked.blockedBy.push(task.id);
        warnings.push(`repaired missing blockedBy edge #${blockedId} <- #${task.id}`);
      }
    }
    for (const blockerId of task.blockedBy) {
      const blocker = byId.get(blockerId);
      if (blocker && !blocker.blocks.includes(task.id)) {
        blocker.blocks.push(task.id);
        warnings.push(`repaired missing blocks edge #${blockerId} -> #${task.id}`);
      }
    }
  }

  const maxId = tasks.reduce((max, task) => Math.max(max, Number.parseInt(task.id, 10) || 0), 0);
  const nextId = Math.max(typeof input?.nextId === "number" ? input.nextId : 1, maxId + 1);
  return { data: { nextId, tasks }, warnings };
}

export function renderMarkdownTaskFile(data: TaskStoreData): string {
  const normalized = normalizeTaskStoreData(data).data;
  const lines = [
    "# TASKS",
    "",
    "Pure Markdown task database for the sibling `PRODUCT.md` / `TECH.md` spec. Keep task text compact; details belong in the specs.",
    "",
    "Legend: `[ ]` pending, `[ ] [in_progress]` in progress, `[x]` completed.",
    "",
  ];

  if (normalized.tasks.length === 0) {
    lines.push("No tasks yet.");
    return `${lines.join("\n")}\n`;
  }

  for (const task of normalized.tasks) {
    const checkbox = task.status === "completed" ? "x" : " ";
    const parts = [`- [${checkbox}] #${task.id} [${task.status}] ${escapeInline(task.subject)}`];
    const attrs: string[] = [];
    if (task.blockedBy.length > 0) attrs.push(`blocked by ${formatIdList(task.blockedBy)}`);
    if (task.blocks.length > 0) attrs.push(`blocks ${formatIdList(task.blocks)}`);
    if (task.owner) attrs.push(`owner: ${escapeInline(task.owner)}`);
    if (task.activeForm) attrs.push(`active: ${escapeInline(task.activeForm)}`);
    if (task.metadata.agentType) attrs.push(`agent: ${escapeInline(String(task.metadata.agentType))}`);
    if (task.metadata.agentId) attrs.push(`agent_id: ${escapeInline(String(task.metadata.agentId))}`);
    if (task.metadata.lastError) attrs.push(`error: ${escapeInline(String(task.metadata.lastError))}`);
    if (attrs.length > 0) parts.push(`; ${attrs.join("; ")}`);
    lines.push(parts.join(""));
  }

  return `${lines.join("\n")}\n`;
}

export function parseMarkdownTaskFile(text: string): TaskStoreData | undefined {
  const legacyStart = text.indexOf(LEGACY_MARKDOWN_DB_START);
  if (legacyStart !== -1) {
    const jsonStart = text.indexOf("\n", legacyStart);
    const legacyEnd = text.indexOf(LEGACY_MARKDOWN_DB_END, jsonStart);
    if (jsonStart !== -1 && legacyEnd !== -1) {
      return JSON.parse(text.slice(jsonStart + 1, legacyEnd).trim()) as TaskStoreData;
    }
  }

  const tasks: Task[] = [];
  const now = Date.now();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s+\[( |x|X)\]\s+#([A-Za-z0-9._-]+)\s+(?:\[(pending|in_progress|completed)\]\s+)?(.+)$/);
    if (!match) continue;

    const checkbox = match[1].toLowerCase();
    const id = match[2];
    const explicitStatus = match[3] as TaskStatus | undefined;
    const status: TaskStatus = explicitStatus ?? (checkbox === "x" ? "completed" : "pending");
    const segments = match[4].split(";").map((segment) => segment.trim()).filter(Boolean);
    const subject = segments.shift() ?? `Task ${id}`;
    const task: Task = {
      id,
      subject,
      description: subject,
      status,
      metadata: {},
      blocks: [],
      blockedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    for (const segment of segments) {
      const lower = segment.toLowerCase();
      if (lower.startsWith("blocked by ")) task.blockedBy = parseIdList(segment.slice("blocked by ".length));
      else if (lower.startsWith("blocks ")) task.blocks = parseIdList(segment.slice("blocks ".length));
      else if (lower.startsWith("owner:")) task.owner = segment.slice("owner:".length).trim();
      else if (lower.startsWith("active:")) task.activeForm = segment.slice("active:".length).trim();
      else if (lower.startsWith("agent:")) task.metadata.agentType = segment.slice("agent:".length).trim();
      else if (lower.startsWith("agent_id:")) task.metadata.agentId = segment.slice("agent_id:".length).trim();
      else if (lower.startsWith("error:")) task.metadata.lastError = segment.slice("error:".length).trim();
    }
    tasks.push(task);
  }

  if (tasks.length === 0) return undefined;
  const maxId = tasks.reduce((max, task) => Math.max(max, Number.parseInt(task.id, 10) || 0), 0);
  return { nextId: maxId + 1, tasks };
}

export function readTaskStoreDataFile(filePath: string): TaskStoreData | undefined {
  if (!existsSync(filePath)) return undefined;
  const text = readFileSync(filePath, "utf-8");
  const data = isMarkdownTaskFile(filePath) ? parseMarkdownTaskFile(text) : JSON.parse(text) as TaskStoreData;
  return normalizeTaskStoreData(data).data;
}

export function syncTaskStoreFile(filePath: string, write = false): { changed: boolean; warnings: string[]; content: string } {
  const original = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  const parsed = original ? (isMarkdownTaskFile(filePath) ? parseMarkdownTaskFile(original) : JSON.parse(original) as TaskStoreData) : { nextId: 1, tasks: [] };
  const { data, warnings } = normalizeTaskStoreData(parsed);
  const content = isMarkdownTaskFile(filePath) ? renderMarkdownTaskFile(data) : JSON.stringify(data, null, 2);
  const changed = content !== original;
  if (write && changed) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  return { changed, warnings, content };
}

export class TaskStore {
  private filePath: string | undefined;
  private lockPath: string | undefined;
  private nextId = 1;
  private tasks = new Map<string, Task>();

  constructor(listIdOrPath?: string) {
    if (!listIdOrPath) return;
    const filePath = isAbsolute(listIdOrPath)
      ? listIdOrPath
      : extname(listIdOrPath)
        ? listIdOrPath
        : join(TASKS_DIR, `${listIdOrPath}.json`);
    mkdirSync(dirname(filePath), { recursive: true });
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.load();
  }

  private load(): void {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const data = readTaskStoreDataFile(this.filePath);
      if (!data) return;
      this.nextId = data.nextId;
      this.tasks.clear();
      for (const task of data.tasks) this.tasks.set(task.id, task);
    } catch {
      // Corrupt task files should not block the agent; start with an empty store.
    }
  }

  private save(): void {
    if (!this.filePath) return;
    const data: TaskStoreData = { nextId: this.nextId, tasks: Array.from(this.tasks.values()) };
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, isMarkdownTaskFile(this.filePath) ? renderMarkdownTaskFile(data) : JSON.stringify(normalizeTaskStoreData(data).data, null, 2));
    renameSync(tmpPath, this.filePath);
  }

  private withLock<T>(fn: () => T): T {
    if (!this.lockPath) return fn();
    acquireLock(this.lockPath);
    try {
      this.load();
      const result = fn();
      this.save();
      return result;
    } finally {
      releaseLock(this.lockPath);
    }
  }

  create(subject: string, description: string, activeForm?: string, metadata?: Record<string, any>): Task {
    return this.withLock(() => {
      const now = Date.now();
      const task: Task = {
        id: String(this.nextId++),
        subject,
        description,
        status: "pending",
        activeForm,
        owner: undefined,
        metadata: metadata ?? {},
        blocks: [],
        blockedBy: [],
        createdAt: now,
        updatedAt: now,
      };
      this.tasks.set(task.id, task);
      return task;
    });
  }

  get(id: string): Task | undefined {
    if (this.filePath) this.load();
    return this.tasks.get(id);
  }

  list(): Task[] {
    if (this.filePath) this.load();
    return Array.from(this.tasks.values()).sort((a, b) => Number(a.id) - Number(b.id));
  }

  update(id: string, fields: {
    status?: TaskStatus | "deleted";
    subject?: string;
    description?: string;
    activeForm?: string;
    owner?: string;
    metadata?: Record<string, any>;
    addBlocks?: string[];
    addBlockedBy?: string[];
  }): { task: Task | undefined; changedFields: string[]; warnings: string[] } {
    return this.withLock(() => {
      const task = this.tasks.get(id);
      if (!task) return { task: undefined, changedFields: [], warnings: [] };

      const changedFields: string[] = [];
      const warnings: string[] = [];

      if (fields.status === "deleted") {
        this.tasks.delete(id);
        for (const other of this.tasks.values()) {
          other.blocks = other.blocks.filter((taskId) => taskId !== id);
          other.blockedBy = other.blockedBy.filter((taskId) => taskId !== id);
        }
        return { task: undefined, changedFields: ["deleted"], warnings };
      }

      if (fields.status !== undefined) {
        task.status = fields.status;
        changedFields.push("status");
      }
      if (fields.subject !== undefined) {
        task.subject = fields.subject;
        changedFields.push("subject");
      }
      if (fields.description !== undefined) {
        task.description = fields.description;
        changedFields.push("description");
      }
      if (fields.activeForm !== undefined) {
        task.activeForm = fields.activeForm;
        changedFields.push("activeForm");
      }
      if (fields.owner !== undefined) {
        task.owner = fields.owner;
        changedFields.push("owner");
      }
      if (fields.metadata !== undefined) {
        for (const [key, value] of Object.entries(fields.metadata)) {
          if (value === null) delete task.metadata[key];
          else task.metadata[key] = value;
        }
        changedFields.push("metadata");
      }

      if (fields.addBlocks && fields.addBlocks.length > 0) {
        for (const targetId of fields.addBlocks) {
          if (!task.blocks.includes(targetId)) task.blocks.push(targetId);
          const target = this.tasks.get(targetId);
          if (target && !target.blockedBy.includes(id)) {
            target.blockedBy.push(id);
            target.updatedAt = Date.now();
          }
          if (targetId === id) warnings.push(`#${id} blocks itself`);
          else if (!target) warnings.push(`#${targetId} does not exist`);
          else if (target.blocks.includes(id)) warnings.push(`cycle: #${id} and #${targetId} block each other`);
        }
        changedFields.push("blocks");
      }

      if (fields.addBlockedBy && fields.addBlockedBy.length > 0) {
        for (const targetId of fields.addBlockedBy) {
          if (!task.blockedBy.includes(targetId)) task.blockedBy.push(targetId);
          const target = this.tasks.get(targetId);
          if (target && !target.blocks.includes(id)) {
            target.blocks.push(id);
            target.updatedAt = Date.now();
          }
          if (targetId === id) warnings.push(`#${id} blocks itself`);
          else if (!target) warnings.push(`#${targetId} does not exist`);
          else if (task.blocks.includes(targetId)) warnings.push(`cycle: #${id} and #${targetId} block each other`);
        }
        changedFields.push("blockedBy");
      }

      task.updatedAt = Date.now();
      return { task, changedFields, warnings };
    });
  }

  delete(id: string): boolean {
    return this.withLock(() => {
      if (!this.tasks.has(id)) return false;
      this.tasks.delete(id);
      for (const task of this.tasks.values()) {
        task.blocks = task.blocks.filter((taskId) => taskId !== id);
        task.blockedBy = task.blockedBy.filter((taskId) => taskId !== id);
      }
      return true;
    });
  }

  clearAll(): number {
    return this.withLock(() => {
      const count = this.tasks.size;
      this.tasks.clear();
      return count;
    });
  }

  deleteFileIfEmpty(): boolean {
    if (!this.filePath || this.tasks.size > 0) return false;
    try {
      unlinkSync(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  clearCompleted(): number {
    return this.withLock(() => {
      let count = 0;
      for (const [id, task] of this.tasks) {
        if (task.status === "completed") {
          this.tasks.delete(id);
          count++;
        }
      }
      if (count > 0) {
        const validIds = new Set(this.tasks.keys());
        for (const task of this.tasks.values()) {
          task.blocks = task.blocks.filter((taskId) => validIds.has(taskId));
          task.blockedBy = task.blockedBy.filter((taskId) => validIds.has(taskId));
        }
      }
      return count;
    });
  }
}
