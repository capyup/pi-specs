import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf-8");

test("package manifest exposes local pi resources and task runtime peers", async () => {
  const pkg = JSON.parse(await readText("package.json"));

  assert.equal(pkg.name, "pi-spec-driven-dev");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/*.ts"]);
  assert.deepEqual(pkg.pi.skills, ["./skills"]);
  assert.deepEqual(pkg.pi.prompts, ["./prompts"]);
  assert.equal(pkg.peerDependencies["@mariozechner/pi-coding-agent"], "*");
  assert.equal(pkg.peerDependencies["@mariozechner/pi-tui"], "*");
  assert.equal(pkg.peerDependencies.typebox, "*");
  assert.match(pkg.scripts.test, /node --test --experimental-strip-types test\/\*\.test\.mjs/);
  assert.equal(pkg.scripts["tasks:check"], "node --experimental-strip-types scripts/sync-tasks.mjs --check");
  assert.equal(pkg.scripts["tasks:repair"], "node --experimental-strip-types scripts/sync-tasks.mjs --write");
});

test("skills have matching frontmatter names", async () => {
  const skills = await readdir(new URL("skills/", root), { withFileTypes: true });
  for (const entry of skills) {
    if (!entry.isDirectory()) continue;
    const text = await readText(`skills/${entry.name}/SKILL.md`);
    const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = text.match(/^description:\s*(.+)$/m)?.[1] ?? "";
    assert.equal(name, entry.name, `${entry.name} frontmatter name should match directory`);
    assert.ok(description.length > 0, `${entry.name} should have a description`);
    assert.ok(description.length <= 1024, `${entry.name} description should fit pi prompt budget`);
  }
});

test("extension registers spec commands, task manager, and no duplicate spec-workflow prompt remains", async () => {
  const extension = await readText("extensions/spec-driven-dev.ts");
  assert.match(extension, /registerTasks\(pi\)/);
  for (const command of ["spec-workflow", "spec-product", "spec-tech", "spec-implement", "spec-audit", "spec-help"]) {
    assert.match(extension, new RegExp(command));
  }

  const prompts = await readdir(new URL("prompts/", root));
  assert.ok(!prompts.includes("spec-workflow.md"), "spec-workflow prompt would duplicate the extension command");
});

test("built-in task manager source covers documented tools and storage behavior", async () => {
  const taskIndex = await readText("src/tasks/index.ts");
  for (const name of ["TaskCreate", "TaskList", "TaskGet", "TaskUpdate", "TaskOutput", "TaskStop", "TaskExecute"]) {
    assert.match(taskIndex, new RegExp(`name: \\\"${name}\\\"`));
  }
  assert.match(taskIndex, /registerCommand\("tasks"/);
  assert.match(taskIndex, /PI_TASKS/);
  assert.match(taskIndex, /TASKS\.md/);
  assert.match(taskIndex, /specDir/);
  assert.match(taskIndex, /subagents:rpc:spawn/);
  assert.match(taskIndex, /SYSTEM_REMINDER/);

  const store = await readText("src/tasks/task-store.ts");
  assert.match(store, /acquireLock/);
  assert.match(store, /renderMarkdownTaskFile/);
  assert.match(store, /parseMarkdownTaskFile/);
  assert.match(store, /clearCompleted/);
  assert.match(store, /addBlockedBy/);
});

test("README documents commands, task tools, validation, and attribution", async () => {
  const readme = await readText("README.md");
  for (const snippet of [
    "/spec-workflow <feature, issue, or goal>",
    "/tasks",
    "TaskCreate",
    "TaskExecute",
    "TASKS.md",
    "specDir",
    "AGENTS.md",
    "YYYY-MM-DD-kebab-feature",
    "pure Markdown",
    "npm run tasks:check",
    "npm test",
    "THIRD_PARTY_NOTICES.md",
    "@tintinweb/pi-tasks",
  ]) {
    assert.match(readme, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("builtin task workflow specs are checked in and behavior-focused", async () => {
  const product = await readText("specs/2026-05-01-builtin-task-workflow/PRODUCT.md");
  const tech = await readText("specs/2026-05-01-builtin-task-workflow/TECH.md");
  const tasks = await readText("specs/2026-05-01-builtin-task-workflow/TASKS.md");

  assert.match(product, /## Behavior/);
  assert.match(product, /built-in task manager/i);
  assert.match(product, /TaskCreate/);
  assert.match(product, /TASKS\.md/);
  assert.match(product, /1:1 task database/i);
  assert.match(product, /without installing a separate task package/i);
  assert.match(product, /steers the work mid-stream/i);
  assert.match(tech, /src\/tasks/);
  assert.match(tech, /Testing and validation/);
  assert.match(tasks, /- \[x\] #1 \[completed\]/);
  assert.doesNotMatch(tasks, /pi-spec-tasks-db/);
});

test("AGENTS and prompts document convention discovery and steering alignment", async () => {
  const agents = await readText("AGENTS.md");
  assert.match(agents, /Spec directories live under `specs`/);
  assert.match(agents, /YYYY-MM-DD-kebab-feature/);
  assert.match(agents, /PRODUCT\.md.*TECH\.md.*TASKS\.md/);

  for (const prompt of ["write-product-spec.md", "write-tech-spec.md", "implement-spec.md", "audit-specs.md"]) {
    const text = await readText(`prompts/${prompt}`);
    assert.match(text, /AGENTS\.md/);
    assert.match(text, /TASKS\.md|TASKS/i);
  }
});
