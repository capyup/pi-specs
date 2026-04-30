import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AutoClearManager } from "../src/tasks/auto-clear.ts";
import { syncTaskStoreFile, TaskStore } from "../src/tasks/task-store.ts";

test("TaskStore creates tasks with stable IDs and default pending status", () => {
  const store = new TaskStore();
  const first = store.create("Write product spec", "Capture observable behavior");
  const second = store.create("Write tech spec", "Ground the plan in code", "Writing tech spec");

  assert.equal(first.id, "1");
  assert.equal(first.status, "pending");
  assert.equal(first.subject, "Write product spec");
  assert.equal(second.id, "2");
  assert.equal(second.activeForm, "Writing tech spec");
  assert.deepEqual(store.list().map((task) => task.id), ["1", "2"]);
});

test("TaskStore updates status, owner, and metadata with null deletion", () => {
  const store = new TaskStore();
  const task = store.create("Implement feature", "Edit code", undefined, { spec: "PRODUCT.md", stale: true });

  const result = store.update(task.id, {
    status: "in_progress",
    owner: "agent-1",
    metadata: { stale: null, tech: "TECH.md" },
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(store.get(task.id)?.status, "in_progress");
  assert.equal(store.get(task.id)?.owner, "agent-1");
  assert.deepEqual(store.get(task.id)?.metadata, { spec: "PRODUCT.md", tech: "TECH.md" });
});

test("TaskStore keeps dependency edges bidirectional and warns on problematic edges", () => {
  const store = new TaskStore();
  const product = store.create("Write PRODUCT.md", "Behavior source of truth");
  const tech = store.create("Write TECH.md", "Implementation plan");
  const implementation = store.create("Implement", "Code changes");

  const dependency = store.update(implementation.id, { addBlockedBy: [product.id, tech.id] });
  assert.deepEqual(dependency.warnings, []);
  assert.deepEqual(store.get(implementation.id)?.blockedBy, [product.id, tech.id]);
  assert.deepEqual(store.get(product.id)?.blocks, [implementation.id]);
  assert.deepEqual(store.get(tech.id)?.blocks, [implementation.id]);

  const warning = store.update(product.id, { addBlockedBy: [product.id, "999", implementation.id] });
  assert.ok(warning.warnings.includes("#1 blocks itself"));
  assert.ok(warning.warnings.includes("#999 does not exist"));
  assert.ok(warning.warnings.includes("cycle: #1 and #3 block each other"));
});

test("TaskStore deletes tasks and cleans dependency edges", () => {
  const store = new TaskStore();
  const first = store.create("First", "First task");
  const second = store.create("Second", "Second task");
  store.update(second.id, { addBlockedBy: [first.id] });

  const result = store.update(first.id, { status: "deleted" });

  assert.deepEqual(result.changedFields, ["deleted"]);
  assert.equal(store.get(first.id), undefined);
  assert.deepEqual(store.get(second.id)?.blockedBy, []);
  assert.deepEqual(store.get(second.id)?.blocks, []);
});

test("TaskStore persists JSON file-backed task lists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-spec-tasks-"));
  const file = join(dir, "tasks.json");
  try {
    const store = new TaskStore(file);
    const task = store.create("Persist task", "Save to disk");
    store.update(task.id, { status: "completed" });

    const restored = new TaskStore(file);
    assert.equal(restored.get(task.id)?.status, "completed");

    const raw = JSON.parse(await readFile(file, "utf-8"));
    assert.equal(raw.nextId, 2);
    assert.equal(raw.tasks[0].subject, "Persist task");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("TaskStore persists TASKS.md as pure Markdown todos", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-spec-tasks-md-"));
  const file = join(dir, "TASKS.md");
  try {
    const store = new TaskStore(file);
    const task = store.create("Update README", "Document TASKS.md persistence");
    store.update(task.id, { status: "completed" });

    const text = await readFile(file, "utf-8");
    assert.match(text, /# TASKS/);
    assert.match(text, /- \[x\] #1 \[completed\] Update README/);
    assert.doesNotMatch(text, /pi-spec-tasks-db/);
    assert.doesNotMatch(text, /\{\s*"nextId"/);

    const restored = new TaskStore(file);
    assert.equal(restored.get(task.id)?.subject, "Update README");
    assert.equal(restored.get(task.id)?.status, "completed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("syncTaskStoreFile repairs malformed Markdown task dependencies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-spec-tasks-repair-"));
  const file = join(dir, "TASKS.md");
  try {
    await writeFile(file, [
      "# TASKS",
      "",
      "- [ ] #1 [pending] Product spec; blocks #2; blocked by #999",
      "- [ ] #2 [pending] Tech spec",
      "",
    ].join("\n"));

    const check = syncTaskStoreFile(file, false);
    assert.equal(check.changed, true);
    assert.ok(check.warnings.some((warning) => warning.includes("missing blocker #999")));

    syncTaskStoreFile(file, true);
    const repaired = await readFile(file, "utf-8");
    assert.match(repaired, /- \[ \] #1 \[pending\] Product spec; blocks #2/);
    assert.match(repaired, /- \[ \] #2 \[pending\] Tech spec; blocked by #1/);
    assert.doesNotMatch(repaired, /#999/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("AutoClearManager clears completed tasks after the configured turn delay", () => {
  const store = new TaskStore();
  const task = store.create("Validate", "Run tests");
  const manager = new AutoClearManager(() => store, () => "on_task_complete", 2);

  store.update(task.id, { status: "completed" });
  manager.trackCompletion(task.id, 1);

  assert.equal(manager.onTurnStart(2), false);
  assert.equal(store.get(task.id)?.status, "completed");
  assert.equal(manager.onTurnStart(3), true);
  assert.equal(store.get(task.id), undefined);
});
