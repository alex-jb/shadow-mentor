// Supersession chain verification — adversarial link/graph matrix.
// Uses a `reforge` helper that clones a package, mutates it, recomputes member
// hashes + package_id, and RE-SIGNS with the committed fixture key. This models
// the strongest in-scope attacker: one who holds the (public, fixture-only)
// signing key and can produce validly signed but dishonest packages. The chain
// verifier must catch every broken binding anyway; what it cannot catch —
// a full coherent re-forge by a key holder — is the documented key-compromise
// limitation (PACKAGE_SUPERSESSION_LIMITATIONS.md), inherent to any signature scheme.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { sha256Hex, signManifest } from "../verify/verify-manifest.mjs";
import { FIXTURE_RELEASE_PRIVATE_PEM } from "../verify/fixture-release-key.mjs";
import {
  verifyPackageDir, computePackageId, MEMBER_PATHS,
  PACKAGE_VERSION, PACKAGE_VERSION_1_1, PROVENANCE_SCHEMA_1_1,
} from "../lib/portable-audit-package.mjs";
import { verifyPackageChain, CHAIN_FAILURE_CODES, CHAIN_BOUNDARY_STATEMENT } from "../lib/portable-audit-package-chain.mjs";

const ROOT = process.cwd();
const CLI = join(ROOT, "bin", "shadow-audit-package.mjs");
const BARE_ENV = { PATH: process.env.PATH };
const dir = () => mkdtempSync(join(tmpdir(), "shadow-chain-"));

function create(out, extra = []) {
  const r = spawnSync(process.execPath, [CLI, "create", "--fixture", "banking", "--output-dir", out, ...extra], { encoding: "utf8", env: BARE_ENV });
  assert.equal(r.status, 0, r.stderr);
  return out;
}
const manifestOf = (pkg) => JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
const manifestShaOf = (pkg) => sha256Hex(readFileSync(join(pkg, "manifest.json")));
const stable = (obj) => JSON.stringify(obj, null, 2) + "\n";

// Clone srcDir → a fresh dir, apply `mutate(ctx)`, recompute assets + package_id,
// re-sign with the fixture key, and return the new directory.
// ctx = { manifest, editJson(memberPath, fn), setBytes(memberPath, buf) }
function reforge(srcDir, mutate) {
  const dest = join(dir(), basename(srcDir) + "-forged");
  cpSync(srcDir, dest, { recursive: true });
  const manifest = manifestOf(dest);
  const members = new Map();
  for (const a of manifest.assets) members.set(a.path, readFileSync(join(dest, a.path)));
  const ctx = {
    manifest,
    editJson(path, fn) {
      const obj = JSON.parse(members.get(path).toString("utf8"));
      members.set(path, Buffer.from(stable(fn(obj) ?? obj), "utf8"));
    },
    setBytes(path, buf) { members.set(path, buf); },
  };
  mutate(ctx);
  manifest.assets = manifest.assets.map((a) => {
    const bytes = members.get(a.path);
    return { ...a, byte_size: bytes.length, sha256: sha256Hex(bytes) };
  });
  manifest.package_id = computePackageId(manifest.assets);
  delete manifest.signature;
  const signed = signManifest(manifest, FIXTURE_RELEASE_PRIVATE_PEM);
  for (const [p, b] of members) writeFileSync(join(dest, p), b);
  writeFileSync(join(dest, "manifest.json"), stable(signed), "utf8");
  return dest;
}

// Edit the supersedes claim coherently (manifest + provenance member stay in sync,
// so only the CHAIN-level check under test fires — not a package-level binding error).
function editClaim(ctx, edit) {
  edit(ctx.manifest.supersedes);
  ctx.editJson(MEMBER_PATHS.provenance, (p) => { p.supersession = ctx.manifest.supersedes; return p; });
}

const codes = (res) => res.chain_failures.map((f) => f.code);

// shared fixtures: honest A → B → C plus a fork sibling B2 and a standalone variant A2
const FIX = dir();
const A = create(join(FIX, "A"));
const B = create(join(FIX, "B"), ["--supersedes", A]);
const C = create(join(FIX, "C"), ["--supersedes", B]);
const B2 = create(join(FIX, "B2"), ["--supersedes", A, "--built-at", "2026-07-23T00:00:00.000Z"]);
const A2 = create(join(FIX, "A2"), ["--built-at", "2026-07-24T00:00:00.000Z"]);
const idA = manifestOf(A).package_id, idB = manifestOf(B).package_id, idC = manifestOf(C).package_id;

// ---------------------------------------------------------------------------
// closed vocabulary + happy paths
// ---------------------------------------------------------------------------

test("chain failure vocabulary is closed and every emitted code is in it", () => {
  assert.equal(new Set(CHAIN_FAILURE_CODES).size, CHAIN_FAILURE_CODES.length);
  // exercise a maximally broken supplied set and check every code is in-vocabulary
  const res = verifyPackageChain([B, C, A2]);
  for (const f of res.chain_failures) assert.ok(CHAIN_FAILURE_CODES.includes(f.code), f.code);
});

test("A → B → C verifies: linear order, single local head, boundary statement", () => {
  const res = verifyPackageChain([A, B, C]);
  assert.equal(res.ok, true);
  assert.equal(res.verdict, "SUPERSESSION_VALID");
  assert.deepEqual(res.order, [idA, idB, idC]);
  assert.equal(res.local_head, idC);
  assert.deepEqual(res.local_heads, [idC]);
  assert.equal(res.boundary, CHAIN_BOUNDARY_STATEMENT);
  assert.match(res.boundary, /never business correctness/);
  assert.match(res.boundary, /never that the local chain head is the globally latest/);
});

test("verifyPackageChain is deterministic and order-insensitive", () => {
  const a = verifyPackageChain([A, B, C]);
  const b = verifyPackageChain([C, A, B]);
  assert.deepEqual(a, b);
  assert.deepEqual(verifyPackageChain([A, B, C]), a); // repeatable
});

test("A → B (partial prefix of a longer chain) is itself a valid supplied chain", () => {
  const res = verifyPackageChain([A, B]);
  assert.equal(res.ok, true);
  assert.equal(res.local_head, idB); // head of the SUPPLIED set — C exists but was not supplied
});

// ---------------------------------------------------------------------------
// identity and binding
// ---------------------------------------------------------------------------

test("wrong predecessor package ID (manifest hash matches) → PREDECESSOR_ID_MISMATCH", () => {
  const wrongId = "ab".repeat(32);
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_package_id = wrongId; }));
  assert.equal(verifyPackageDir(forged).ok, true, "forged claim is validly signed — only the chain catches it");
  const res = verifyPackageChain([A, forged]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PREDECESSOR_ID_MISMATCH"), codes(res).join(","));
});

test("wrong predecessor manifest hash (package id matches) → PREDECESSOR_MANIFEST_MISMATCH", () => {
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_manifest_sha256 = "cd".repeat(32); }));
  const res = verifyPackageChain([A, forged]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PREDECESSOR_MANIFEST_MISMATCH"));
});

test("changed predecessor manifest bytes (even signature-preserving whitespace) → PREDECESSOR_MANIFEST_MISMATCH", () => {
  const aTouched = join(dir(), "A-touched");
  cpSync(A, aTouched, { recursive: true });
  // whitespace keeps JSON.parse + canonical signature valid — the package still verifies…
  writeFileSync(join(aTouched, "manifest.json"), readFileSync(join(aTouched, "manifest.json"), "utf8") + "\n", "utf8");
  assert.equal(verifyPackageDir(aTouched).ok, true);
  // …but it is no longer the byte-identical predecessor B signed for
  const res = verifyPackageChain([aTouched, B]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PREDECESSOR_MANIFEST_MISMATCH"));
});

test("predecessor from another case → CASE_MISMATCH (never silently accepted)", () => {
  // forge a validly signed variant of A that belongs to a different case
  const otherCase = reforge(A, (ctx) => {
    ctx.manifest.case_id = "case-other-9999";
    ctx.manifest.bindings.case_id = "case-other-9999";
    ctx.editJson(MEMBER_PATHS.presentation, (p) => { p.case_id = "case-other-9999"; return p; });
  });
  assert.equal(verifyPackageDir(otherCase).ok, true);
  const forgedB = reforge(B, (ctx) => editClaim(ctx, (s) => {
    s.predecessor_package_id = manifestOf(otherCase).package_id;
    s.predecessor_manifest_sha256 = manifestShaOf(otherCase);
    // claim keeps B's own case (self-consistent) — the resolved predecessor disagrees
  }));
  const res = verifyPackageChain([otherCase, forgedB]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("CASE_MISMATCH"));
});

test("self-inconsistent predecessor_case_id is rejected standalone → SUPERSESSION_MALFORMED", () => {
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_case_id = "case-other-9999"; }));
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "SUPERSESSION_MALFORMED" && /same-case/.test(f.detail)));
});

test("changed current evidence session breaks the existing binding check (1.0 semantics intact)", () => {
  const forged = reforge(B, (ctx) => { ctx.manifest.bindings.evidence_session_id = "session-forged"; });
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "BINDING_MISMATCH"));
});

test("changed predecessor evidence session claim → SESSION_RELATION_MISMATCH at chain level", () => {
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_evidence_session_id = "some-other-session"; }));
  assert.equal(verifyPackageDir(forged).ok, true, "not self-checkable — a predecessor may legitimately have a different session");
  const res = verifyPackageChain([A, forged]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("SESSION_RELATION_MISMATCH"));
});

test("null predecessor session claim means 'not asserted' and the chain stays valid", () => {
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_evidence_session_id = null; }));
  const res = verifyPackageChain([A, forged]);
  assert.equal(res.ok, true);
});

test("substituted valid predecessor (same fixture, different build) → honest NOT_SUPPLIED + broken chain", () => {
  const res = verifyPackageChain([A2, B]); // B signed for A, not A2
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PREDECESSOR_NOT_SUPPLIED"));
  assert.ok(codes(res).includes("CHAIN_BROKEN"));
});

test("self-reference is rejected both standalone and at chain level", () => {
  const forged = reforge(B, (ctx) => {
    // manifest-only edit: claim id == own (member-derived, unchanged) package_id
    ctx.manifest.supersedes.predecessor_package_id = ctx.manifest.package_id;
  });
  const standalone = verifyPackageDir(forged);
  assert.equal(standalone.ok, false);
  assert.ok(standalone.failures.some((f) => f.code === "SELF_REFERENCE"));
  const res = verifyPackageChain([forged]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("SELF_REFERENCE"));
});

// ---------------------------------------------------------------------------
// chain integrity
// ---------------------------------------------------------------------------

test("missing predecessor is reported honestly, never invented", () => {
  const res = verifyPackageChain([B, C]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PREDECESSOR_NOT_SUPPLIED"));
  for (const p of res.packages) assert.equal(p.package_ok, true); // both packages themselves are fine
});

test("broken middle link (A and C supplied, B missing) → NOT_SUPPLIED + CHAIN_BROKEN", () => {
  const res = verifyPackageChain([A, C]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PREDECESSOR_NOT_SUPPLIED"));
  assert.ok(codes(res).includes("CHAIN_BROKEN"));
  assert.deepEqual(res.local_heads, [idA, idC].sort());
});

test("duplicated package → DUPLICATE_PACKAGE", () => {
  const copy = join(dir(), "A-copy");
  cpSync(A, copy, { recursive: true });
  const res = verifyPackageChain([A, B, copy]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("DUPLICATE_PACKAGE"));
});

test("two-package cycle (forged claims) → CHAIN_CYCLE", () => {
  // Forge A into a 1.1 claiming B, WITHOUT touching members: its package_id stays A's,
  // producing claims A→B and B→A among the supplied ids. The forged package is invalid
  // (declared provenance schema no longer matches) — cycle detection must fire anyway.
  const forgedA = reforge(A, (ctx) => {
    ctx.manifest.manifest_version = PACKAGE_VERSION_1_1;
    ctx.manifest.capability_boundary.push("SUPERSESSION_IS_NOT_GLOBAL_LATEST");
    ctx.manifest.supersedes = { ...manifestOf(B).supersedes, predecessor_package_id: idB, predecessor_manifest_sha256: manifestShaOf(B), predecessor_manifest_version: PACKAGE_VERSION_1_1 };
  });
  const res = verifyPackageChain([forgedA, B]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("CHAIN_CYCLE"), codes(res).join(","));
});

test("three-package cycle → CHAIN_CYCLE", () => {
  const forgedA = reforge(A, (ctx) => {
    ctx.manifest.manifest_version = PACKAGE_VERSION_1_1;
    ctx.manifest.capability_boundary.push("SUPERSESSION_IS_NOT_GLOBAL_LATEST");
    ctx.manifest.supersedes = { ...manifestOf(B).supersedes, predecessor_package_id: idC, predecessor_manifest_sha256: manifestShaOf(C), predecessor_manifest_version: PACKAGE_VERSION_1_1 };
  });
  const res = verifyPackageChain([forgedA, B, C]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("CHAIN_CYCLE"));
});

test("fork (B and B2 both supersede A) → CHAIN_FORK, reported never silently resolved", () => {
  const res = verifyPackageChain([A, B, B2]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("CHAIN_FORK"));
  assert.equal(res.local_head, null);
  assert.deepEqual(res.local_heads, [manifestOf(B).package_id, manifestOf(B2).package_id].sort());
});

test("multiple unrelated possible heads → CHAIN_BROKEN with every head named", () => {
  const res = verifyPackageChain([A, B, A2]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("CHAIN_BROKEN"));
  assert.deepEqual(res.local_heads, [idB, manifestOf(A2).package_id].sort());
});

test("unsupported claimed predecessor contract version → UNSUPPORTED_TRANSITION", () => {
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_manifest_version = "shadow-portable-audit-package/0.9"; }));
  const res = verifyPackageChain([A, forged]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("UNSUPPORTED_TRANSITION"));
});

test("claimed predecessor version disagreeing with the actual predecessor → UNSUPPORTED_TRANSITION", () => {
  const forged = reforge(B, (ctx) => editClaim(ctx, (s) => { s.predecessor_manifest_version = PACKAGE_VERSION_1_1; }));
  const res = verifyPackageChain([A, forged]); // A is really 1.0
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("UNSUPPORTED_TRANSITION"));
});

// ---------------------------------------------------------------------------
// tampering
// ---------------------------------------------------------------------------

test("tampered predecessor member → PACKAGE_TAMPERED + PREDECESSOR_INVALID", () => {
  const aTampered = join(dir(), "A-tampered");
  cpSync(A, aTampered, { recursive: true });
  const p = join(aTampered, MEMBER_PATHS.evidence);
  writeFileSync(p, readFileSync(p, "utf8").replace("session_id", "session_1d"), "utf8");
  const res = verifyPackageChain([aTampered, B]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PACKAGE_TAMPERED"));
  assert.ok(codes(res).includes("PREDECESSOR_INVALID"));
});

test("supersedes reference edited without re-signing → signature failure, PACKAGE_INVALID", () => {
  const bEdited = join(dir(), "B-edited");
  cpSync(B, bEdited, { recursive: true });
  const m = manifestOf(bEdited);
  m.supersedes.predecessor_package_id = "ef".repeat(32);
  writeFileSync(join(bEdited, "manifest.json"), stable(m), "utf8");
  const standalone = verifyPackageDir(bEdited);
  assert.equal(standalone.ok, false);
  assert.ok(standalone.failures.some((f) => f.code === "MANIFEST_SIGNATURE_FAILED"));
  const res = verifyPackageChain([A, bEdited]);
  assert.ok(codes(res).includes("PACKAGE_INVALID"));
});

test("removed supersession data on a 1.1 package → SUPERSESSION_MALFORMED", () => {
  const forged = reforge(B, (ctx) => { delete ctx.manifest.supersedes; });
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "SUPERSESSION_MALFORMED"));
});

test("malformed relation and malformed predecessor identity → SUPERSESSION_MALFORMED", () => {
  for (const edit of [
    (s) => { s.relation = "shadow-package-supersession/99"; },
    (s) => { s.predecessor_package_id = "not-hex"; },
    (s) => { s.marker = "APPROVED"; }, // review/approval semantics DO NOT exist in this contract
  ]) {
    const forged = reforge(B, (ctx) => editClaim(ctx, edit));
    const res = verifyPackageDir(forged);
    assert.equal(res.ok, false);
    assert.ok(res.failures.some((f) => f.code === "SUPERSESSION_MALFORMED"), JSON.stringify(res.failures));
  }
});

test("provenance member diverging from the signed supersedes block → BINDING_MISMATCH", () => {
  const forged = reforge(B, (ctx) => {
    ctx.editJson(MEMBER_PATHS.provenance, (p) => { p.supersession = { ...p.supersession, predecessor_package_id: "ab".repeat(32) }; return p; });
  });
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "BINDING_MISMATCH" && /supersession/.test(f.detail)));
});

test("missing SUPERSESSION_IS_NOT_GLOBAL_LATEST honesty token on a 1.1 package → SUPERSESSION_MALFORMED", () => {
  const forged = reforge(B, (ctx) => {
    ctx.manifest.capability_boundary = ctx.manifest.capability_boundary.filter((t) => t !== "SUPERSESSION_IS_NOT_GLOBAL_LATEST");
  });
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "SUPERSESSION_MALFORMED" && /SUPERSESSION_IS_NOT_GLOBAL_LATEST/.test(f.detail)));
});

test("extra undeclared file in a successor → PACKAGE_INVALID at chain level (UNEXPECTED_MEMBER underneath)", () => {
  const bExtra = join(dir(), "B-extra");
  cpSync(B, bExtra, { recursive: true });
  writeFileSync(join(bExtra, "smuggled.txt"), "not declared\n", "utf8");
  const res = verifyPackageChain([A, bExtra]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("PACKAGE_INVALID"));
});

test("symlink inside a successor → PATH_UNSAFE underneath, chain fails (traversal regression)", () => {
  const bLink = join(dir(), "B-symlink");
  cpSync(B, bLink, { recursive: true });
  symlinkSync("/etc/hosts", join(bLink, "keys", "escape.pem"));
  const res = verifyPackageChain([A, bLink]);
  assert.equal(res.ok, false);
  const b = res.packages.find((p) => p.dir === bLink);
  assert.ok(b.package_failures.some((f) => f.code === "PATH_UNSAFE"));
});

// ---------------------------------------------------------------------------
// 1.0 boundary: standalone semantics untouched, chain refuses to interpret
// ---------------------------------------------------------------------------

test("a 1.0 manifest carrying supersedes-shaped data still verifies standalone (baseline semantics preserved) but the chain reports SUPERSESSION_MALFORMED", () => {
  const forged = reforge(A, (ctx) => {
    ctx.manifest.supersedes = manifestOf(B).supersedes; // smuggle a claim into a 1.0 manifest
  });
  const standalone = verifyPackageDir(forged);
  assert.equal(standalone.ok, true, "standalone 1.0 verification must behave exactly as at ced8c2c");
  const res = verifyPackageChain([forged]);
  assert.equal(res.ok, false);
  assert.ok(codes(res).includes("SUPERSESSION_MALFORMED"));
  // and the smuggled claim is never interpreted as a link
  assert.equal(res.links.length, 0);
});

test("old 1.0 packages remain valid, unchanged, and never require fields that did not exist", () => {
  const res = verifyPackageDir(A);
  assert.equal(res.ok, true);
  assert.equal(res.manifest_version, PACKAGE_VERSION);
  assert.equal("supersedes" in res, false);
  const m = manifestOf(A);
  assert.equal("supersedes" in m, false);
});
