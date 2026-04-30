import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface TasksConfig {
  taskScope?: "spec" | "memory" | "session" | "project";
  activeSpecDir?: string;
  autoCascade?: boolean;
  autoClearCompleted?: "never" | "on_list_complete" | "on_task_complete";
}

const CONFIG_PATH = join(process.cwd(), ".pi", "tasks-config.json");

export function loadTasksConfig(): TasksConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as TasksConfig;
  } catch {
    return {};
  }
}

export function saveTasksConfig(config: TasksConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
