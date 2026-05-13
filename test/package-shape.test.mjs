import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf-8");
const removedSurfacePatterns = [
  new RegExp(`${["TAS", "KS"].join("")}\\.yaml`),
  new RegExp(`@tintinweb/pi-${["tas", "ks"].join("")}`),
  new RegExp(["Create", "List", "Get", "Update", "Output", "Stop", "Execute"].map((suffix) => `${["Ta", "sk"].join("")}${suffix}`).join("|")),
  new RegExp(`/${["tas", "ks"].join("")}`),
];

function assertRemovedSurfaceAbsent(text) {
  for (const pattern of removedSurfacePatterns) {
    assert.doesNotMatch(text, pattern);
  }
}

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
  assert.equal(pkg.files.includes("THIRD_PARTY_NOTICES.md"), false);
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

test("extension registers spec commands and no legacy progress surface", async () => {
  const extension = await readText("extensions/pi-specs.ts");
  for (const command of ["specs", "specs-product", "specs-tech", "specs-implement", "specs-audit", "specs-help"]) {
    assert.match(extension, new RegExp(command));
  }
  assert.match(extension, /specs\/SPECS\.yaml/);
  assert.match(extension, /focused spec/);
  assert.match(extension, /MILESTONES\.md/);
  for (const tool of ["spec_scaffold", "spec_focus", "spec_unfocus", "spec_status", "spec_finish", "spec_append_milestone", "specs_settings_get", "specs_settings_update"]) {
    assert.match(extension, new RegExp(tool));
  }
  assert.doesNotMatch(extension, new RegExp("append_" + "spec_milestones"));
  assert.match(extension, /current_spec_name/);
  assert.match(extension, /milestone_content/);
  assert.match(extension, /formatLocalTimestamp/);
  assert.match(extension, /### \$\{formatLocalTimestamp\(\)\} - Milestone/);
  assertRemovedSurfaceAbsent(extension);

  const prompts = await readdir(new URL("prompts/", root)).catch((err) => err.code === "ENOENT" ? [] : Promise.reject(err));
  assert.deepEqual(prompts.filter((name) => name.endsWith(".md")), []);
});

test("README documents commands, validation, and progress-free workflow", async () => {
  const readme = await readText("README.md");
  for (const snippet of [
    "/specs <feature, issue, or goal>",
    "spec_scaffold",
    "spec_focus",
    "spec_unfocus",
    "spec_status",
    "spec_finish",
    "spec_append_milestone",
    "specs_settings_get",
    "specs_settings_update",
    "AGENTS.md",
    "YYYY-MM-DD-kebab-feature",
    "PRODUCT.md",
    "TECH.md",
    "MILESTONES.md",
    "npm test",
  ]) {
    assert.match(readme, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assertRemovedSurfaceAbsent(readme);
});

test("AGENTS and skills document convention discovery and steering alignment", async () => {
  const agents = await readText("AGENTS.md");
  assert.match(agents, /Spec directories live under `specs`/);
  assert.match(agents, /YYYY-MM-DD-kebab-feature/);
  assert.match(agents, /PRODUCT\.md.*TECH\.md.*MILESTONES\.md/s);
  assertRemovedSurfaceAbsent(agents);
  assert.match(agents, /Before every commit, bump the package patch version by exactly one/);

  for (const skill of ["specs", "specs-product", "specs-tech", "specs-implement", "specs-audit"]) {
    const text = await readText(`skills/${skill}/SKILL.md`);
    assert.match(text, /AGENTS\.md|PRODUCT\.md/s);
    if (skill !== "specs-product") assert.match(text, /MILESTONES\.md/);
    if (["specs", "specs-implement"].includes(skill)) assert.match(text, /spec_append_milestone/);
    assertRemovedSurfaceAbsent(text);
  }
  for (const skill of ["specs-implement", "specs-audit"]) {
    const text = await readText(`skills/${skill}/SKILL.md`);
    assert.match(text, /without arguments/);
    assert.match(text, /SPECS\.yaml/);
    assert.match(text, /focused spec/);
  }
});
