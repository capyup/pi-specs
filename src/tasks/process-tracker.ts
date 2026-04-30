import type { ChildProcess } from "node:child_process";
import type { BackgroundProcess } from "./types.js";

export interface ProcessOutput {
  output: string;
  status: BackgroundProcess["status"];
  exitCode?: number;
  startedAt: number;
  completedAt?: number;
  command?: string;
}

export class ProcessTracker {
  private processes = new Map<string, BackgroundProcess>();

  track(taskId: string, proc: ChildProcess, command?: string): void {
    const tracked: BackgroundProcess = {
      taskId,
      pid: proc.pid!,
      command,
      output: [],
      status: "running",
      startedAt: Date.now(),
      proc,
      abortController: new AbortController(),
      waiters: [],
    };

    proc.stdout?.on("data", (data: Buffer) => tracked.output.push(data.toString()));
    proc.stderr?.on("data", (data: Buffer) => tracked.output.push(data.toString()));

    proc.on("close", (code) => {
      if (tracked.status === "running") tracked.status = code === 0 ? "completed" : "error";
      tracked.exitCode = code ?? undefined;
      tracked.completedAt = Date.now();
      for (const resolve of tracked.waiters) resolve();
      tracked.waiters = [];
    });

    proc.on("error", (err) => {
      if (tracked.status === "running") {
        tracked.status = "error";
        tracked.output.push(`Process error: ${err.message}`);
        tracked.completedAt = Date.now();
        for (const resolve of tracked.waiters) resolve();
        tracked.waiters = [];
      }
    });

    this.processes.set(taskId, tracked);
  }

  getOutput(taskId: string): ProcessOutput | undefined {
    const tracked = this.processes.get(taskId);
    if (!tracked) return undefined;
    return {
      output: tracked.output.join(""),
      status: tracked.status,
      exitCode: tracked.exitCode,
      startedAt: tracked.startedAt,
      completedAt: tracked.completedAt,
      command: tracked.command,
    };
  }

  waitForCompletion(taskId: string, timeout: number, signal?: AbortSignal): Promise<ProcessOutput | undefined> {
    const tracked = this.processes.get(taskId);
    if (!tracked) return Promise.resolve(undefined);
    if (tracked.status !== "running") return Promise.resolve(this.getOutput(taskId));

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(this.getOutput(taskId));
      };
      const timer = setTimeout(finish, timeout);
      tracked.waiters.push(finish);
      signal?.addEventListener("abort", finish, { once: true });
    });
  }

  async stop(taskId: string): Promise<boolean> {
    const tracked = this.processes.get(taskId);
    if (!tracked || tracked.status !== "running") return false;

    tracked.status = "stopped";
    tracked.proc.kill("SIGTERM");

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          tracked.proc.kill("SIGKILL");
        } catch {
          // Process may already be gone.
        }
        resolve();
      }, 5000);

      tracked.proc.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    tracked.completedAt = Date.now();
    for (const resolve of tracked.waiters) resolve();
    tracked.waiters = [];
    return true;
  }

  getProcess(taskId: string): BackgroundProcess | undefined {
    return this.processes.get(taskId);
  }
}
