import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf-8");

test("package manifest exposes local pi resources and standard peers", async () => {
  const pkg = JSON.parse(await readText("package.json"));

  assert.equal(pkg.name, "@capyup/pi-specs");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/*.ts"]);
  assert.deepEqual(pkg.pi.skills, ["./skills"]);
  assert.equal(pkg.pi.prompts, undefined);
  assert.equal(pkg.peerDependencies["@earendil-works/pi-coding-agent"], "*");
  assert.equal(pkg.peerDependencies["@earendil-works/pi-tui"], "*");
  assert.equal(pkg.peerDependencies.typebox, "*");
  assert.match(pkg.scripts.test, /node --test --experimental-strip-types test\/\*\.test\.mjs/);
  // Task tracking now lives in @tintinweb/pi-tasks; this package should not
  // ship its own sync-tasks scripts anymore.
  assert.equal(pkg.scripts["tasks:check"], undefined);
  assert.equal(pkg.scripts["tasks:repair"], undefined);
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

test("extension registers spec commands and no longer registers tasks itself", async () => {
  const extension = await readText("extensions/pi-specs.ts");
  // Tasks are provided by @tintinweb/pi-tasks now, the extension must not register them.
  assert.doesNotMatch(extension, /registerTasks\(pi\)/);
  assert.doesNotMatch(extension, /from "\.\.\/src\/tasks/);
  for (const command of ["specs", "specs-product", "specs-tech", "specs-implement", "specs-audit", "specs-help"]) {
    assert.match(extension, new RegExp(command));
  }
  assert.match(extension, /specs\/SPECS\.yaml/);
  assert.match(extension, /focused spec/);
  assert.doesNotMatch(extension, /Ask for the missing details needed/);

  const prompts = await readdir(new URL("prompts/", root)).catch((err) => err.code === "ENOENT" ? [] : Promise.reject(err));
  assert.deepEqual(prompts.filter((name) => name.endsWith(".md")), []);
});

test("README documents commands, validation, and the pi-tasks dependency", async () => {
  const readme = await readText("README.md");
  for (const snippet of [
    "/specs <feature, issue, or goal>",
    "/tasks",
    "TaskCreate",
    "TaskExecute",
    "TASKS.yaml",
    "specDir",
    "AGENTS.md",
    "YYYY-MM-DD-kebab-feature",
    "YAML",
    "npm test",
    "THIRD_PARTY_NOTICES.md",
    "@tintinweb/pi-tasks",
  ]) {
    assert.match(readme, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  // Old internal task runtime must no longer be advertised as bundled.
  assert.doesNotMatch(readme, /npm run tasks:check/);
});

test("AGENTS and skills document convention discovery and steering alignment", async () => {
  const agents = await readText("AGENTS.md");
  assert.match(agents, /Spec directories live under `specs`/);
  assert.match(agents, /YYYY-MM-DD-kebab-feature/);
  assert.match(agents, /PRODUCT\.md.*TECH\.md.*TASKS\.yaml/);
  assert.match(agents, /Before every commit, bump the package patch version by exactly one/);

  for (const skill of ["specs", "specs-product", "specs-tech", "specs-implement", "specs-audit"]) {
    const text = await readText(`skills/${skill}/SKILL.md`);
    assert.match(text, /AGENTS\.md|TASKS\.yaml|PRODUCT\.md/s);
  }
  for (const skill of ["specs-implement", "specs-audit"]) {
    const text = await readText(`skills/${skill}/SKILL.md`);
    assert.match(text, /without arguments/);
    assert.match(text, /SPECS\.yaml/);
    assert.match(text, /focused spec/);
  }
});
