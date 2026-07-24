// The supported CLI adapter around exportFlowContract: writes a validated
// shadow-flow-export/1.0 artifact, deterministically, offline, with no
// credentials, and never leaves a partial file behind. These tests spawn the
// real CLI (no shell) and also import its validator directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { exportFlowContract, FLOW_EXPORT_VERSION } from "../apps/shadow-lens/flow/flow-export-contract.mjs";
import { validateFlowExport } from "../bin/shadow-flow-export.mjs";

const CLI = join(process.cwd(), "bin", "shadow-flow-export.mjs");
// minimal env: PATH only — proves no model credentials are required
const BARE_ENV = { PATH: process.env.PATH };

function run(args, env = BARE_ENV) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env });
}

const dir = () => mkdtempSync(join(tmpdir(), "shadow-flow-export-"));

test("fixture mode writes a valid shadow-flow-export/1.0 artifact (exit 0, stdout only)", () => {
  const out = join(dir(), "artifact.json");
  const r = run(["--fixture", "banking", "--output", out]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /wrote .*artifact\.json/);
  const ex = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(ex.schema_version, FLOW_EXPORT_VERSION);
  assert.deepEqual(validateFlowExport(ex), []);
});

test("output is byte-deterministic across repeated runs", () => {
  const d = dir();
  const a = join(d, "a.json"), b = join(d, "b.json");
  assert.equal(run(["--fixture", "banking", "--output", a]).status, 0);
  assert.equal(run(["--fixture", "banking", "--output", b]).status, 0);
  assert.equal(readFileSync(a, "utf8"), readFileSync(b, "utf8"));
});

test("artifact matches direct exportFlowContract output semantically", () => {
  const out = join(dir(), "artifact.json");
  assert.equal(run(["--fixture", "banking", "--output", out]).status, 0);
  const fromCli = JSON.parse(readFileSync(out, "utf8"));
  const direct = JSON.parse(JSON.stringify(exportFlowContract(BANKING_NARRATIVE)));
  assert.deepEqual(fromCli, direct);
});

test("input mode accepts a supported narrative JSON file and equals fixture mode", () => {
  const d = dir();
  const input = join(d, "narrative.json");
  writeFileSync(input, JSON.stringify(BANKING_NARRATIVE, null, 2), "utf8");
  const before = readFileSync(input, "utf8");
  const out = join(d, "artifact.json");
  const r = run(["--input", input, "--output", out]);
  assert.equal(r.status, 0, r.stderr);
  const viaFixture = join(d, "fixture.json");
  assert.equal(run(["--fixture", "banking", "--output", viaFixture]).status, 0);
  assert.equal(readFileSync(out, "utf8"), readFileSync(viaFixture, "utf8"));
  // the source input is never mutated
  assert.equal(readFileSync(input, "utf8"), before);
});

test("neither --input nor --fixture is a usage error (exit 2, stderr only, no file)", () => {
  const out = join(dir(), "artifact.json");
  const r = run(["--output", out]);
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /exactly one of --input .* or --fixture/);
  assert.equal(existsSync(out), false);
});

test("both --input and --fixture together are rejected (exit 2)", () => {
  const d = dir();
  const input = join(d, "n.json");
  writeFileSync(input, JSON.stringify(BANKING_NARRATIVE), "utf8");
  const r = run(["--input", input, "--fixture", "banking", "--output", join(d, "o.json")]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /mutually exclusive/);
});

test("missing --output is a usage error (exit 2)", () => {
  const r = run(["--fixture", "banking"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--output .* is required/);
});

test("unknown fixture name is rejected against the closed allowlist (exit 2)", () => {
  const r = run(["--fixture", "nope", "--output", join(dir(), "o.json")]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown fixture "nope" \(supported: banking\)/);
});

test("malformed input JSON is exit 3 and leaves no partial artifact", () => {
  const d = dir();
  const input = join(d, "broken.json");
  writeFileSync(input, "{ not json", "utf8");
  const out = join(d, "artifact.json");
  const r = run(["--input", input, "--output", out]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not valid JSON/);
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(d).filter((f) => f.includes(".tmp-")), []);
});

test("unsupported narrative shape is exit 3 with named shape errors, no file", () => {
  const d = dir();
  const input = join(d, "wrong.json");
  writeFileSync(input, JSON.stringify({ case_id: "x", council: "not-an-array" }), "utf8");
  const out = join(d, "artifact.json");
  const r = run(["--input", input, "--output", out]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /unsupported narrative shape/);
  assert.match(r.stderr, /council must be an array/);
  assert.equal(existsSync(out), false);
});

test("unreadable input path is exit 3", () => {
  const r = run(["--input", join(dir(), "does-not-exist.json"), "--output", join(dir(), "o.json")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /cannot read --input/);
});

test("invalid output path (parent is a file) is exit 3, no partial file", () => {
  const d = dir();
  const blocker = join(d, "blocker");
  writeFileSync(blocker, "x", "utf8");
  const r = run(["--fixture", "banking", "--output", join(blocker, "o.json")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /cannot write output/);
  assert.deepEqual(readdirSync(d).filter((f) => f.includes(".tmp-")), []);
});

test("missing parent directories are created (repo keypair convention)", () => {
  const out = join(dir(), "nested", "deeper", "artifact.json");
  const r = run(["--fixture", "banking", "--output", out]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(out), true);
});

test("existing output is refused without --force and replaced with it", () => {
  const out = join(dir(), "artifact.json");
  assert.equal(run(["--fixture", "banking", "--output", out]).status, 0);
  const first = readFileSync(out, "utf8");
  const refused = run(["--fixture", "banking", "--output", out]);
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /already exists.*--force/s);
  assert.equal(readFileSync(out, "utf8"), first); // untouched
  assert.equal(run(["--fixture", "banking", "--output", out, "--force"]).status, 0);
});

test("--json emits a one-line machine summary on stdout", () => {
  const out = join(dir(), "artifact.json");
  const r = run(["--fixture", "banking", "--output", out, "--json"]);
  assert.equal(r.status, 0);
  const summary = JSON.parse(r.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.schema_version, FLOW_EXPORT_VERSION);
  assert.equal(summary.case_id, "case-2026-Q3-0042");
  assert.equal(summary.row_count, JSON.parse(readFileSync(out, "utf8")).row_count);
});

test("runs with a bare environment: no model credentials, no Flow key", () => {
  const out = join(dir(), "artifact.json");
  const r = run(["--fixture", "banking", "--output", out], { PATH: process.env.PATH });
  assert.equal(r.status, 0, r.stderr);
});

test("CLI source imports no network-capable modules", () => {
  const src = readFileSync(CLI, "utf8");
  assert.equal(/from ["'](node:)?(http|https|net|dgram|tls|dns)["']/.test(src), false);
  assert.equal(/\bfetch\s*\(/.test(src), false);
});

test("artifact preserves honest absence: no synthesized failure/approval/trust/signature fields", () => {
  const out = join(dir(), "artifact.json");
  assert.equal(run(["--fixture", "banking", "--output", out]).status, 0);
  const ex = JSON.parse(readFileSync(out, "utf8"));
  const allKeys = Object.keys(ex).concat(ex.rows.flatMap((r) => Object.keys(r)));
  assert.equal(allKeys.some((k) => /first_failure|downstream|approval|trust_posture|signature|physical/i.test(k)), false);
  // and the fixture honesty label survives the round trip
  assert.ok(ex.rows.every((r) => r.mode_label === "FIXTURE MODEL"));
});

test("rows keep stable grouped ordering and unique identities", () => {
  const out = join(dir(), "artifact.json");
  assert.equal(run(["--fixture", "banking", "--output", out]).status, 0);
  const ex = JSON.parse(readFileSync(out, "utf8"));
  const order = ["council", "metric", "evidence", "relationship"];
  const seq = ex.rows.map((r) => order.indexOf(r.row_type));
  assert.ok(seq.every((t, i) => i === 0 || t >= seq[i - 1]), "rows not grouped in producer order");
  assert.deepEqual(validateFlowExport(ex), []); // includes identity-uniqueness checks
});

test("validator rejects a tampered export (wrong version, duplicate identity, bad reference)", () => {
  const good = exportFlowContract(BANKING_NARRATIVE);
  const wrongVersion = { ...good, schema_version: "shadow-flow-export/2.0" };
  assert.ok(validateFlowExport(wrongVersion).length > 0);
  const dup = JSON.parse(JSON.stringify(good));
  dup.rows.splice(1, 0, JSON.parse(JSON.stringify(dup.rows[0])));
  dup.row_count = dup.rows.length;
  assert.ok(validateFlowExport(dup).some((e) => /duplicate row identity/.test(e)));
  const badRef = JSON.parse(JSON.stringify(good));
  const rel = badRef.rows.find((r) => r.row_type === "relationship");
  rel.relationship_to = "GHOST-REF";
  assert.ok(validateFlowExport(badRef).some((e) => /resolves to no council voice or evidence id/.test(e)));
});
