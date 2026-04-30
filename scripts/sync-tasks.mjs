#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { syncTaskStoreFile } from "../src/tasks/task-store.ts";

const args = process.argv.slice(2);
const write = args.includes("--write") || args.includes("--repair");
const check = args.includes("--check") || !write;
const explicitPaths = args.filter((arg) => !arg.startsWith("--"));

function walk(dir, results) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, results);
    else if (entry.isFile() && (entry.name === "TASKS.yaml" || entry.name === "TASKS.yml")) results.push(path);
  }
}

function discoverTaskFiles() {
  if (explicitPaths.length > 0) return explicitPaths.map((path) => resolve(path));
  const roots = ["specs", "docs/specs", ".pi/specs"];
  const results = [];
  for (const root of roots) walk(resolve(root), results);
  return results;
}

const files = discoverTaskFiles();
if (files.length === 0) {
  console.log("No TASKS.yaml files found.");
  process.exit(0);
}

let hasChanges = false;
for (const file of files) {
  const result = syncTaskStoreFile(file, write);
  const status = result.changed ? (write ? "repaired" : "needs repair") : "ok";
  console.log(`${status}: ${file}`);
  for (const warning of result.warnings) console.log(`  warning: ${warning}`);
  if (result.changed) hasChanges = true;
}

if (check && hasChanges) {
  console.error("TASKS.yaml files are not normalized. Run `npm run tasks:repair`.");
  process.exit(1);
}
