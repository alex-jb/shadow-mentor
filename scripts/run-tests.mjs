#!/usr/bin/env node
// scripts/run-tests.mjs
//
// Cross-platform test runner. `node --test test/*.test.js` relies on
// shell glob expansion, which doesn't work in PowerShell / cmd.exe.
// This script enumerates test/*.test.js in-process and invokes the
// runtime test runner directly.

import { readdirSync, statSync } from "fs";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const TEST_DIR = join(REPO_ROOT, "test");

const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => join("test", f))
  .sort();

if (files.length === 0) {
  console.error("no test files found under test/");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
