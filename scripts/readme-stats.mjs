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
  // Node --test summary uses "ℹ tests N" on Node 24+ and "# tests N" on
  // Node 22. Accept either. Match on the summary section only (after
  // "1..N" TAP plan line) so we don't pick up test bodies that happen to
  // contain the pattern.
  const summary = stdout.split(/^1\.\.\d+$/m).pop() ?? stdout;
  const rx = (label) => new RegExp(`^(?:ℹ|#)\\s*${label}\\s+(\\d+)`, "m");
  const m = summary.match(rx("tests"));
  const p = summary.match(rx("pass"));
  const f = summary.match(rx("fail"));
  if (!m || !p || !f) {
    throw new Error(
      "could not parse node --test output — tail: " +
      JSON.stringify(stdout.slice(-500)),
    );
  }
  return { total: +m[1], pass: +p[1], fail: +f[1] };
}


function testFiles() {
  return readdirSync(join(REPO_ROOT, "test"))
    .filter((f) => f.endsWith(".test.js"))
    .map((f) => join("test", f));
}


function signedFieldCount() {
  // v2.0.0: source lives in packages/attest-core/attestation.js; lib/ path is a shim.
  const src = readFileSync(join(REPO_ROOT, "packages/attest-core/attestation.js"), "utf-8");
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

// Extract the numbers the README currently claims. `--check` succeeds if:
//   1. version matches package.json exactly
//   2. fail count in the README is 0 AND live fail count is 0
//   3. attestation signed field counts match code exactly
//   4. release tag count matches git tag exactly
//   5. total-tests in the README is within ±10 of live (env-dependent skips
//      between Node 22 CI and Node 24 local; policy: the block is
//      informational for the exact test count, load-bearing for 0-failing)
function parseReadmeStats(text) {
  const rx = {
    version: /\*\*Version\*\*:\s*(\S+)/,
    tests: /\*\*Tests\*\*:\s*(\d+)\/(\d+)\s+passing\s+\((\d+)\s+failing\)/,
    fields: /\*\*Attestation signed fields\*\*:\s*(\d+)\s+parameters,\s*(\d+)\s+append-only conditional bindings/,
    tags: /\*\*Release tags\*\*:\s*(\d+)/,
  };
  const v = text.match(rx.version);
  const t = text.match(rx.tests);
  const f = text.match(rx.fields);
  const tg = text.match(rx.tags);
  if (!v || !t || !f || !tg) return null;
  return {
    version: v[1],
    tests_pass: +t[1],
    tests_total: +t[2],
    tests_fail: +t[3],
    signed_field_parameters: +f[1],
    signed_field_conditional_appends: +f[2],
    release_tags: +tg[1],
  };
}

if (args.includes("--check")) {
  const text = readmeText();
  const claimed = parseReadmeStats(text);
  if (!claimed) {
    console.error("README.md does not contain a parseable readme-stats block.");
    console.error("Regenerate via: node scripts/readme-stats.mjs --write");
    process.exit(1);
  }
  const errors = [];
  if (claimed.version !== r.version) {
    errors.push(`version: README says ${claimed.version}, package.json says ${r.version}`);
  }
  if (claimed.tests_fail !== 0 || r.tests_fail !== 0) {
    errors.push(`tests_fail: README says ${claimed.tests_fail}, live says ${r.tests_fail} — both must be 0`);
  }
  if (Math.abs(claimed.tests_total - r.tests_total) > 10) {
    errors.push(`tests_total: README says ${claimed.tests_total}, live says ${r.tests_total} — drift > ±10 tolerance`);
  }
  if (claimed.signed_field_parameters !== r.signed_field_parameters
      || claimed.signed_field_conditional_appends !== r.signed_field_conditional_appends) {
    errors.push(
      `signed fields: README says ${claimed.signed_field_parameters}/${claimed.signed_field_conditional_appends}, ` +
      `live says ${r.signed_field_parameters}/${r.signed_field_conditional_appends}`,
    );
  }
  if (claimed.release_tags !== r.release_tags) {
    errors.push(`release_tags: README says ${claimed.release_tags}, live says ${r.release_tags}`);
  }
  if (errors.length > 0) {
    console.error("README.md stats drift detected:");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("");
    console.error("Regenerate via: node scripts/readme-stats.mjs --write");
    process.exit(1);
  }
  console.log("OK — README stats block matches current repo state (test-count within ±10 tolerance).");
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
