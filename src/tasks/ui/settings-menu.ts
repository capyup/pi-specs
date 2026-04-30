import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Spacer, Text } from "@mariozechner/pi-tui";
import { saveTasksConfig, type TasksConfig } from "../tasks-config.js";

export type SettingsUI = {
  custom<T>(
    factory: (tui: any, theme: any, keybindings: any, done: (result: T) => void) => any,
    options?: { overlay?: boolean; overlayOptions?: any },
  ): Promise<T>;
};

export async function openSettingsMenu(
  ui: SettingsUI,
  cfg: TasksConfig,
  onBack: () => Promise<void>,
  clearDelayTurns: number,
): Promise<void> {
  await ui.custom((_tui, theme, _keybindings, done) => {
    const items: SettingItem[] = [
      {
        id: "taskScope",
        label: "Task storage",
        description:
          "spec: TASKS.yaml inside the active spec directory. memory: in-memory only. " +
          "session: per-session file. project: shared project file. Takes effect on next session start.",
        currentValue: cfg.taskScope ?? "spec",
        values: ["spec", "memory", "session", "project"],
      },
      {
        id: "autoCascade",
        label: "Auto-execute with agents",
        description:
          "When ON, pending agent tasks start automatically once dependencies complete. " +
          "When OFF, use TaskExecute to launch them manually.",
        currentValue: (cfg.autoCascade ?? false) ? "on" : "off",
        values: ["on", "off"],
      },
      {
        id: "autoClearCompleted",
        label: "Auto-clear completed tasks",
        description:
          "never: keep completed tasks. on_list_complete: clear after all tasks are done. " +
          "on_task_complete: clear each task shortly after it completes. " +
          `Clearing lags ~${clearDelayTurns} turns.`,
        currentValue: cfg.autoClearCompleted ?? "on_list_complete",
        values: ["never", "on_list_complete", "on_task_complete"],
      },
    ];

    const list = new SettingsList(
      items,
      10,
      getSettingsListTheme(),
      (id, newValue) => {
        if (id === "autoCascade") cfg.autoCascade = newValue === "on";
        if (id === "taskScope") cfg.taskScope = newValue as "spec" | "memory" | "session" | "project";
        if (id === "autoClearCompleted") cfg.autoClearCompleted = newValue as TasksConfig["autoClearCompleted"];
        saveTasksConfig(cfg);
      },
      () => done(undefined),
    );

    class SettingsPanel extends Container {
      handleInput(data: string): void {
        list.handleInput(data);
      }
    }

    const root = new SettingsPanel();
    root.addChild(new Text(theme.bold(theme.fg("accent", "Task Settings")), 0, 0));
    root.addChild(new Spacer(1));
    root.addChild(list);
    return root;
  });

  return onBack();
}
