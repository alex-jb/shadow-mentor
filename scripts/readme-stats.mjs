#!/usr/bin/env node
// scripts/readme-stats.mjs
// Emits the four numbers README.md is allowed to publish. These are the
// only stats permitted in README.md — every occurrence must be checked
// against this script's output at CI time.
//
// Usage:
//   node scripts/readme-stats.mjs          # print numbers
//   node scripts/readme-stats.mjs --check  # exit 1 if README.md drifted

import { readFileSync, readdirSync } from "fs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");


function testCount() {
  const out = spawnSync("node", ["--test", ...testFiles()], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = out.stdout || "";
  const m = stdout.match(/^ℹ tests (\d+)/m);
  const p = stdout.match(/^ℹ pass (\d+)/m);
  const f = stdout.match(/^ℹ fail (\d+)/m);
  if (!m || !p || !f) throw new Error("could not parse node --test output");
  return { total: +m[1], pass: +p[1], fail: +f[1] };
}


function testFiles() {
  return readdirSync(join(REPO_ROOT, "test"))
    .filter((f) => f.endsWith(".test.js"))
    .map((f) => join("test", f));
}


function signedFieldCount() {
  const src = readFileSync(join(REPO_ROOT, "lib/attestation.js"), "utf-8");
  const sig = src.match(/function _signingPayload\(\{([^}]+)\}/);
  if (!sig) throw new Error("could not locate _signingPayload signature");
  const params = sig[1].split(",").map((s) => s.trim()).filter(Boolean);
  const conditionals = (src.match(/if \(\w+\) parts\.push\(\w+\);/g) || []).length;
  return { total_parameters: params.length, conditional_appends: conditionals };
}


function releaseTagCount() {
  const out = spawnSync("git", ["tag", "-l", "v*"], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  const tags = (out.stdout || "").split("\n").filter((s) => /^v\d/.test(s));
  return tags.length;
}


function packageVersion() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8"));
  return pkg.version;
}


function report() {
  const tests = testCount();
  const fields = signedFieldCount();
  return {
    version: packageVersion(),
    tests_total: tests.total,
    tests_pass: tests.pass,
    tests_fail: tests.fail,
    signed_field_parameters: fields.total_parameters,
    signed_field_conditional_appends: fields.conditional_appends,
    release_tags: releaseTagCount(),
  };
}


function readmeText() {
  return readFileSync(join(REPO_ROOT, "README.md"), "utf-8");
}


// The stats block README.md must expose verbatim. Any number in README.md
// that doesn't match this template is a drift.
function expectedStatsBlock(r) {
  return [
    "<!-- readme-stats:begin -->",
    `**Version**: ${r.version}`,
    `**Tests**: ${r.tests_pass}/${r.tests_total} passing (${r.tests_fail} failing)`,
    `**Attestation signed fields**: ${r.signed_field_parameters} parameters, ${r.signed_field_conditional_appends} append-only conditional bindings`,
    `**Release tags**: ${r.release_tags}`,
    "<!-- readme-stats:end -->",
  ].join("\n");
}


const args = process.argv.slice(2);
const r = report();

if (args.includes("--check")) {
  const text = readmeText();
  const want = expectedStatsBlock(r);
  if (!text.includes(want)) {
    console.error("README.md stats drift detected. Expected block:");
    console.error(want);
    console.error("");
    console.error("Regenerate via: node scripts/readme-stats.mjs --write");
    process.exit(1);
  }
  console.log("OK — README stats block matches current repo state.");
  process.exit(0);
}

if (args.includes("--write")) {
  const text = readmeText();
  const want = expectedStatsBlock(r);
  const re = /<!-- readme-stats:begin -->[\s\S]*?<!-- readme-stats:end -->/;
  if (!re.test(text)) {
    console.error("README.md does not contain a readme-stats block. Add one.");
    process.exit(1);
  }
  const next = text.replace(re, want);
  const { writeFileSync } = await import("fs");
  writeFileSync(join(REPO_ROOT, "README.md"), next);
  console.log("Updated README.md stats block.");
  console.log(want);
  process.exit(0);
}

// Default: print
console.log(JSON.stringify(r, null, 2));
console.log("");
console.log("--- readme block ---");
console.log(expectedStatsBlock(r));
