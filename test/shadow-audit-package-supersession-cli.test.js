// Portable package supersession — CLI surface (fixture mode).
// create --supersedes produces a NEW immutable shadow-portable-audit-package/1.1
// whose signed manifest binds the predecessor by content identity; verify-chain
// verifies a supplied set of packages as a locally observed supersession chain.
// The adversarial link/graph matrix lives in test/shadow-audit-package-chain.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256Hex, canonicalize } from "../verify/verify-manifest.mjs";
import {
  PACKAGE_VERSION, PACKAGE_VERSION_1_1, PROVENANCE_SCHEMA_1_1, SUPERSESSION_RELATION,
  MEMBER_PATHS, computePackageId,
} from "../lib/portable-audit-package.mjs";

const ROOT = process.cwd();
const CLI = join(ROOT, "bin", "shadow-audit-package.mjs");
const BARE_ENV = { PATH: process.env.PATH };

function run(args, env = BARE_ENV) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env });
}
const dir = () => mkdtempSync(join(tmpdir(), "shadow-supersession-"));

function walk(root, rel = "") {
  const out = [];
  for (const name of readdirSync(rel ? join(root, rel) : root).sort()) {
    const childRel = rel ? `${rel}/${name}` : name;
    if (lstatSync(join(root, childRel)).isDirectory()) out.push(...walk(root, childRel));
    else out.push(childRel);
  }
  return out;
}
function snapshot(pkg) {
  const m = new Map();
  for (const rel of walk(pkg)) m.set(rel, readFileSync(join(pkg, rel)));
  return m;
}
function manifestOf(pkg) {
  return JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
}

function createChain(parent) {
  const A = join(parent, "A"), B = join(parent, "B"), C = join(parent, "C");
  for (const [out, extra] of [[A, []], [B, ["--supersedes", A]], [C, ["--supersedes", B]]]) {
    const r = run(["create", "--fixture", "banking", "--output-dir", out, ...extra]);
    assert.equal(r.status, 0, r.stderr);
  }
  return { A, B, C };
}

// one shared happy-path chain for the read-only assertions below
const SHARED = createChain(dir());

// ---------------------------------------------------------------------------
// A · successor creation
// ---------------------------------------------------------------------------

test("create --supersedes writes a 1.1 package whose signed manifest binds the predecessor by content identity", () => {
  const { A, B } = SHARED;
  const a = manifestOf(A), b = manifestOf(B);
  assert.equal(a.manifest_version, PACKAGE_VERSION);            // standalone stays 1.0
  assert.equal(b.manifest_version, PACKAGE_VERSION_1_1);
  assert.deepEqual(b.supersedes, {
    relation: SUPERSESSION_RELATION,
    predecessor_package_id: a.package_id,
    predecessor_manifest_sha256: sha256Hex(readFileSync(join(A, "manifest.json"))),
    predecessor_manifest_version: PACKAGE_VERSION,
    predecessor_case_id: a.case_id,
    predecessor_evidence_session_id: a.bindings.evidence_session_id,
    marker: "FIXTURE_SUCCESSOR",                                // neutral — never Review/Approval
  });
  assert.ok(b.capability_boundary.includes("SUPERSESSION_IS_NOT_GLOBAL_LATEST"));
  assert.notEqual(b.package_id, a.package_id);                  // a successor is never its predecessor
  assert.equal(b.case_id, a.case_id);                           // same-case rule
  assert.equal(b.package_id, computePackageId(b.assets));
});

test("successor provenance member uses provenance/1.1 and repeats the signed supersedes block verbatim", () => {
  const { B } = SHARED;
  const b = manifestOf(B);
  const prov = JSON.parse(readFileSync(join(B, MEMBER_PATHS.provenance), "utf8"));
  assert.equal(prov.schema_version, PROVENANCE_SCHEMA_1_1);
  assert.equal(canonicalize(prov.supersession), canonicalize(b.supersedes));
  assert.equal(b.assets.find((x) => x.path === MEMBER_PATHS.provenance).schema_version, PROVENANCE_SCHEMA_1_1);
});

test("a three-package chain A → B → C binds each successor to its immediate predecessor", () => {
  const { A, B, C } = SHARED;
  const a = manifestOf(A), b = manifestOf(B), c = manifestOf(C);
  assert.equal(c.manifest_version, PACKAGE_VERSION_1_1);
  assert.equal(c.supersedes.predecessor_package_id, b.package_id);
  assert.equal(c.supersedes.predecessor_manifest_version, PACKAGE_VERSION_1_1); // 1.1 → 1.1 transition
  assert.equal(c.supersedes.predecessor_manifest_sha256, sha256Hex(readFileSync(join(B, "manifest.json"))));
  assert.equal(new Set([a.package_id, b.package_id, c.package_id]).size, 3);
});

test("creating a successor NEVER touches the predecessor: prior packages stay byte-for-byte identical", () => {
  const parent = dir();
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A]).status, 0);
  const before = snapshot(A);
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", join(parent, "B"), "--supersedes", A]).status, 0);
  const after = snapshot(A);
  assert.deepEqual([...after.keys()], [...before.keys()]);
  for (const [rel, bytes] of before) assert.ok(bytes.equals(after.get(rel)), `predecessor mutated: ${rel}`);
});

test("chain generation is byte-deterministic: two A/B/C chains from identical inputs are identical", () => {
  const one = createChain(dir()), two = createChain(dir());
  for (const k of ["A", "B", "C"]) {
    const s1 = snapshot(one[k]), s2 = snapshot(two[k]);
    assert.deepEqual([...s1.keys()], [...s2.keys()]);
    for (const [rel, bytes] of s1) assert.ok(bytes.equals(s2.get(rel)), `bytes differ: ${k}/${rel}`);
  }
});

// ---------------------------------------------------------------------------
// B · verification surfaces
// ---------------------------------------------------------------------------

test("every package in the chain verifies independently (standalone verification never needs the chain)", () => {
  for (const pkg of [SHARED.A, SHARED.B, SHARED.C]) {
    const r = run(["verify", "--package", pkg, "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const res = JSON.parse(r.stdout);
    assert.equal(res.ok, true);
    assert.equal(res.verdict, "VERIFIED_FIXTURE_KEY");
  }
});

test("verify --json surfaces the supersedes block for 1.1 packages and omits it for 1.0", () => {
  const a = JSON.parse(run(["verify", "--package", SHARED.A, "--json"]).stdout);
  const b = JSON.parse(run(["verify", "--package", SHARED.B, "--json"]).stdout);
  assert.equal("supersedes" in a, false);
  assert.equal(b.supersedes.predecessor_package_id, manifestOf(SHARED.A).package_id);
});

test("verify-chain accepts the full chain: exit 0, root→head order, honest local-head language", () => {
  const { A, B, C } = SHARED;
  const r = run(["verify-chain", "--package", A, "--package", B, "--package", C]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /supersession chain verified/);
  assert.match(r.stdout, /head of the SUPPLIED chain only, never a claim of globally latest/);
  assert.match(r.stdout, /every predecessor remains a valid, unchanged, independently verifiable package/);

  const j = run(["verify-chain", "--package", A, "--package", B, "--package", C, "--json"]);
  assert.equal(j.status, 0);
  const res = JSON.parse(j.stdout);
  assert.equal(res.ok, true);
  assert.equal(res.verdict, "SUPERSESSION_VALID");
  assert.deepEqual(res.order, [manifestOf(A).package_id, manifestOf(B).package_id, manifestOf(C).package_id]);
  assert.equal(res.local_head, manifestOf(C).package_id);
  assert.deepEqual(res.chain_failures, []);
  assert.deepEqual(res.unresolved_references, []);
  // valid-but-not-head packages are reported as such, not hidden
  const byId = new Map(res.packages.map((p) => [p.package_id, p]));
  assert.equal(byId.get(manifestOf(A).package_id).is_local_head, false);
  assert.equal(byId.get(manifestOf(B).package_id).is_local_head, false);
  assert.equal(byId.get(manifestOf(C).package_id).is_local_head, true);
});

test("verify-chain of a single standalone package is a valid chain of one", () => {
  const r = run(["verify-chain", "--package", SHARED.A, "--json"]);
  assert.equal(r.status, 0);
  const res = JSON.parse(r.stdout);
  assert.equal(res.ok, true);
  assert.equal(res.local_head, manifestOf(SHARED.A).package_id);
  assert.deepEqual(res.order, [manifestOf(SHARED.A).package_id]);
});

test("verify-chain result is order-insensitive: reordering the supplied packages changes nothing", () => {
  const { A, B, C } = SHARED;
  const one = JSON.parse(run(["verify-chain", "--package", A, "--package", B, "--package", C, "--json"]).stdout);
  const two = JSON.parse(run(["verify-chain", "--package", C, "--package", A, "--package", B, "--json"]).stdout);
  assert.deepEqual(two, one);
});

test("verify-chain with a successor alone reports the missing predecessor honestly (exit 1, package itself still valid)", () => {
  const r = run(["verify-chain", "--package", SHARED.B, "--json"]);
  assert.equal(r.status, 1);
  const res = JSON.parse(r.stdout);
  assert.equal(res.ok, false);
  assert.equal(res.verdict, "SUPERSESSION_FAILED");
  assert.ok(res.chain_failures.some((f) => f.code === "PREDECESSOR_NOT_SUPPLIED"));
  assert.equal(res.packages[0].package_ok, true); // honest: the package is fine, the chain is unconfirmed
});

// ---------------------------------------------------------------------------
// C · CLI behavior, exit codes, filesystem safety
// ---------------------------------------------------------------------------

test("help documents --supersedes, verify-chain and the chain exit codes", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--supersedes <prior-package-dir>/);
  assert.match(r.stdout, /verify-chain/);
  assert.match(r.stdout, /verify-chain: 0 chain valid · 1 chain verification failed · 2 usage · 3 I\/O error/);
});

test("verify-chain usage errors exit 2; missing package directory exits 3", () => {
  assert.equal(run(["verify-chain"]).status, 2);
  const unk = run(["verify-chain", "--package", SHARED.A, "--bogus"]);
  assert.equal(unk.status, 2);
  assert.match(unk.stderr, /unknown argument/);
  assert.equal(run(["verify-chain", "--package", join(dir(), "nope")]).status, 3);
});

test("create --supersedes with a missing or invalid predecessor exits 3 and writes nothing", () => {
  const parent = dir();
  const out = join(parent, "next");
  const missing = run(["create", "--fixture", "banking", "--output-dir", out, "--supersedes", join(parent, "nope")]);
  assert.equal(missing.status, 3);
  assert.equal(existsSync(out), false);

  // tampered predecessor: refuse to build on top of a package that does not verify
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A]).status, 0);
  const evPath = join(A, MEMBER_PATHS.evidence);
  writeFileSync(evPath, readFileSync(evPath, "utf8").replace("shadow", "shadOw"), "utf8");
  const r = run(["create", "--fixture", "banking", "--output-dir", out, "--supersedes", A]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /PREDECESSOR_INVALID/);
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(parent).filter((n) => n.includes(".tmp-")), []); // atomic: no temp residue
});

test("the predecessor can never be the output directory — not even with --force", () => {
  const parent = dir();
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A]).status, 0);
  const r = run(["create", "--fixture", "banking", "--output-dir", A, "--supersedes", A, "--force"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /the predecessor is immutable and is never overwritten/);
  assert.equal(run(["verify", "--package", A]).status, 0); // untouched
});

test("--json create for a successor reports the supersedes binding on stdout only", () => {
  const parent = dir();
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A]).status, 0);
  const r = run(["create", "--fixture", "banking", "--output-dir", join(parent, "B"), "--supersedes", A, "--json"]);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  const s = JSON.parse(r.stdout);
  assert.equal(s.manifest_version, PACKAGE_VERSION_1_1);
  assert.equal(s.supersedes.predecessor_package_id, manifestOf(A).package_id);
});

test("bare env (PATH only): the whole chain lifecycle needs no credentials and no network", () => {
  const parent = dir();
  const { A, B, C } = createChain(parent); // createChain already runs with BARE_ENV
  const v = run(["verify-chain", "--package", A, "--package", B, "--package", C]);
  assert.equal(v.status, 0);
  assert.equal(v.stderr, "");
});

// ---------------------------------------------------------------------------
// D · privacy / keys / no-network
// ---------------------------------------------------------------------------

test("no private key material in successor members, chain output, stdout or stderr", () => {
  const { B, C } = SHARED;
  for (const pkg of [B, C]) {
    for (const rel of walk(pkg)) assert.doesNotMatch(readFileSync(join(pkg, rel), "utf8"), /PRIVATE KEY/, rel);
  }
  const r = run(["verify-chain", "--package", SHARED.A, "--package", B, "--package", C, "--json"]);
  assert.doesNotMatch(r.stdout + r.stderr, /PRIVATE KEY/);
});

test("static scan: the chain module imports no network-capable APIs", () => {
  const src = readFileSync(join(ROOT, "lib", "portable-audit-package-chain.mjs"), "utf8");
  assert.doesNotMatch(src, /node:https?|node:net|node:tls|node:dgram|fetch\(|XMLHttpRequest|WebSocket/);
});

// ---------------------------------------------------------------------------
// E · 1.0 regression pins (existing behavior unchanged)
// ---------------------------------------------------------------------------

test("create without --supersedes still emits an unchanged 1.0 package (no supersedes, no new capability token)", () => {
  const m = manifestOf(SHARED.A);
  assert.equal(m.manifest_version, PACKAGE_VERSION);
  assert.equal("supersedes" in m, false);
  assert.equal(m.capability_boundary.includes("SUPERSESSION_IS_NOT_GLOBAL_LATEST"), false);
  const prov = JSON.parse(readFileSync(join(SHARED.A, MEMBER_PATHS.provenance), "utf8"));
  assert.equal(prov.schema_version, "shadow-audit-package-provenance/1.0");
  assert.equal("supersession" in prov, false);
});
