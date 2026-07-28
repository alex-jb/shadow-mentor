#!/usr/bin/env node
// scripts/run-tests.mjs
//
// Cross-platform test runner. `node --test test/*.test.js` relies on
// shell glob expansion, which doesn't work in PowerShell / cmd.exe.
// This script enumerates test/*.test.js in-process and invokes the
// runtime test runner directly.

import { readdirSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// Test roots: the repo test/ dir (.test.js) + the web spatial-agent client tests
// (.test.ts — Node 24 strips types). Both run in one unified suite.
const ROOTS = [
  { dir: "test", exts: [".test.js"] },
  { dir: "apps/shadow-lens/web/spatial-agent/src/tests", exts: [".test.ts", ".test.mjs", ".test.js"] },
];

const files = [];
for (const { dir, exts } of ROOTS) {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)) if (exts.some((e) => f.endsWith(e))) files.push(join(dir, f));
}
files.sort();

if (files.length === 0) {
  console.error("no test files found");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
