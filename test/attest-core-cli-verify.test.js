// B3 — the shippable `npx shadow-verify`. Locks that shadow-attest-core exposes an
// installable CLI (bin + files) that imports RELATIVELY (works outside the monorepo)
// and returns CI-friendly exit codes over the corrected verifier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = resolve(ROOT, "packages/attest-core/cli-verify.mjs");
const BUNDLE = resolve(ROOT, "demos/adverse-action/sample-bundle.json");
const PUB = resolve(ROOT, "demos/adverse-action/sample-bundle.pub.pem");
const run = (args) => spawnSync("node", [CLI, ...args], { encoding: "utf8" });

test("package.json exposes bin.shadow-verify and ships the CLI in files[]", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "packages/attest-core/package.json"), "utf8"));
  assert.equal(pkg.bin?.["shadow-verify"], "./cli-verify.mjs");
  assert.ok(pkg.files.includes("cli-verify.mjs"), "cli-verify.mjs must be in files[] or npm won't ship it");
});

test("the CLI imports the verifier relatively (no monorepo path)", () => {
  const src = readFileSync(CLI, "utf8");
  assert.match(src, /from "\.\/session\.js"/, "must import ./session.js, not the package name");
  assert.doesNotMatch(src, /shadow-attest-core\//, "no self-referential package import (breaks standalone install)");
});

test("a clean bundle verifies → exit 0 + source_resolution VERIFIED", () => {
  const r = run([BUNDLE, "--public-key", PUB]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Bundle verified/);
  assert.match(r.stdout, /source_resolution: VERIFIED/);
});

test("a plaintext tamper → exit 1 + payload_hash_mismatch (B1 through the CLI)", () => {
  const b = JSON.parse(readFileSync(BUNDLE, "utf8"));
  const ev = b.events.find((e) => e.payload && e.payload.kind === "council_verdict");
  ev.payload.final_verdict = "approve";
  const tmp = resolve(ROOT, "test", ".tmp-tampered-bundle.json");
  writeFileSync(tmp, JSON.stringify(b));
  const r = run([tmp, "--public-key", PUB]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /payload_hash_mismatch/);
});

test("--json emits a machine-readable report", () => {
  const r = run([BUNDLE, "--public-key", PUB, "--json"]);
  const j = JSON.parse(r.stdout.trim());
  assert.equal(j.ok, true);
  assert.equal(j.source_resolution, "VERIFIED");
});

test("missing args → usage exit 2; missing file → I/O exit 3", () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(["nope.json", "--public-key", "nope.pem"]).status, 3);
});
