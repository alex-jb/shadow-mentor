// Decision-amendment successor packages — CLI + package + chain surface.
// `decide` records a signed human decision as a NEW immutable 1.2 successor;
// verify/verify-chain gain 1.2 + lifecycle support. Contract-pure tests live in
// test/decision-amendment-contract.test.js. Uses the chain tests' `reforge`
// pattern (fixture-key attacker) for the tamper/replay matrix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { tmpdir } from "node:os";
import { sha256Hex, signManifest, canonicalize } from "../verify/verify-manifest.mjs";
import { FIXTURE_RELEASE_PRIVATE_PEM } from "../verify/fixture-release-key.mjs";
import {
  verifyPackageDir, computePackageId, MEMBER_PATHS,
  PACKAGE_VERSION, PACKAGE_VERSION_1_1, PACKAGE_VERSION_1_2,
  PROVENANCE_SCHEMA_1_2, SUPERSESSION_RELATION,
} from "../lib/portable-audit-package.mjs";
import { verifyDecisionChain } from "../lib/decision-package.mjs";
import { DECISION_SCHEMA, DECISION_STATUS_TOKENS, computeDecisionId } from "../lib/decision-amendment.mjs";

const ROOT = process.cwd();
const CLI = join(ROOT, "bin", "shadow-audit-package.mjs");
const FIXDIR = join(ROOT, "test", "fixtures", "decision");
const BARE_ENV = { PATH: process.env.PATH };
const dir = () => mkdtempSync(join(tmpdir(), "shadow-decide-"));
const COMMIT = "decisiontest"; // fixed build commit → fully deterministic bytes

function run(args, env = BARE_ENV) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env });
}
const manifestOf = (pkg) => JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
const decisionOf = (pkg) => JSON.parse(readFileSync(join(pkg, MEMBER_PATHS.decision), "utf8"));
const stable = (obj) => JSON.stringify(obj, null, 2) + "\n";
const intentPath = (name) => join(FIXDIR, name);

function writeIntent(parent, name, mutate) {
  const base = JSON.parse(readFileSync(intentPath(name), "utf8"));
  mutate?.(base);
  const p = join(parent, `${basename(name, ".json")}-${Math.abs(JSON.stringify(base).length)}.json`);
  writeFileSync(p, JSON.stringify(base, null, 2));
  return p;
}

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

// Build the canonical decision arc once:
//   A (1.0 original) → B (review, OVERRIDE_PROPOSED) → C (override, pending)
//   → D (approval → OVERRIDDEN)  plus the rejection branch C → R.
function createArc(parent) {
  const A = join(parent, "A"), B = join(parent, "B"), C = join(parent, "C"), D = join(parent, "D"), R = join(parent, "R");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  const decide = (pred, intentFile, out) => {
    const r = run(["decide", "--predecessor", pred, "--intent", intentFile, "--output-dir", out, "--build-commit", COMMIT]);
    assert.equal(r.status, 0, r.stderr);
    return r;
  };
  decide(A, intentPath("review-override-proposed.intent.json"), B);
  decide(B, intentPath("override.intent.json"), C);
  const cId = decisionOf(C).decision_id;
  decide(C, writeIntent(parent, "approval.intent.template.json", (i) => { i.target.decision_id = cId; }), D);
  decide(C, writeIntent(parent, "rejection.intent.template.json", (i) => { i.target.decision_id = cId; }), R);
  return { A, B, C, D, R };
}

const SHARED = createArc(dir());

// Re-forge helper (clone → mutate → re-hash → re-sign with the fixture key).
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
  for (const [p, b] of members) {
    mkdirSync(join(dest, dirname(p)), { recursive: true });
    writeFileSync(join(dest, p), b);
  }
  writeFileSync(join(dest, "manifest.json"), stable(signed), "utf8");
  return dest;
}

// Coherent decision-member edit: recompute decision_id + keep manifest/provenance in sync,
// so ONLY the semantic check under test fires (models the strongest fixture-key attacker).
function reforgeDecision(srcDir, editMember) {
  return reforge(srcDir, (ctx) => {
    ctx.editJson(MEMBER_PATHS.decision, (d) => {
      editMember(d, ctx);
      d.decision_id = computeDecisionId(d);
      return d;
    });
  });
}

// ---------------------------------------------------------------------------
// A · package format + contract versions
// ---------------------------------------------------------------------------

test("decide writes a 1.2 package: decision member, DECISION_AMENDMENT marker, provenance/1.2, honest tokens", () => {
  const { A, B } = SHARED;
  const a = manifestOf(A), b = manifestOf(B);
  assert.equal(a.manifest_version, PACKAGE_VERSION);        // original stays 1.0
  assert.equal(b.manifest_version, PACKAGE_VERSION_1_2);
  assert.equal(b.supersedes.marker, "DECISION_AMENDMENT");  // neutral — semantics live in the member
  assert.equal(b.supersedes.relation, SUPERSESSION_RELATION);
  assert.equal(b.supersedes.predecessor_package_id, a.package_id);
  assert.equal(b.supersedes.predecessor_manifest_sha256, sha256Hex(readFileSync(join(A, "manifest.json"))));
  const decAsset = b.assets.find((x) => x.role === "decision");
  assert.equal(decAsset.path, MEMBER_PATHS.decision);
  assert.equal(decAsset.schema_version, DECISION_SCHEMA);
  const prov = JSON.parse(readFileSync(join(B, MEMBER_PATHS.provenance), "utf8"));
  assert.equal(prov.schema_version, PROVENANCE_SCHEMA_1_2);
  assert.equal(prov.member_contracts.decision, DECISION_SCHEMA);
  assert.equal(canonicalize(prov.supersession), canonicalize(b.supersedes));
  const d = decisionOf(B);
  assert.equal(d.decision_schema, DECISION_SCHEMA);
  assert.deepEqual(d.status_tokens, [...DECISION_STATUS_TOKENS]); // FIXTURE_DECISION_ONLY + identity/authority/SoD honesty, signed
  assert.equal(d.actor.identity_class, "operator_declared");
  assert.equal(d.authorization.status, "DECISION_AUTHORITY_UNVERIFIED");
});

test("the decision actor is NEVER the package signer: signer identity and actor identity are disjoint fields", () => {
  const b = manifestOf(SHARED.B);
  const d = decisionOf(SHARED.B);
  assert.equal(b.signing.key_label, "FIXTURE RELEASE KEY");
  assert.equal(d.actor.actor_id, "fixture:reviewer-1");
  assert.ok(!JSON.stringify(b.signing).includes(d.actor.actor_id));
  assert.ok(!JSON.stringify(d.actor).includes(b.signing.package_public_key_fingerprint_sha256));
});

test("analytical members are carried forward BYTE-FOR-BYTE: the original conclusion is never rewritten", () => {
  const { A, B, C, D } = SHARED;
  for (const rel of [MEMBER_PATHS.presentation, MEMBER_PATHS.evidence]) {
    const orig = readFileSync(join(A, rel));
    for (const pkg of [B, C, D]) assert.ok(orig.equals(readFileSync(join(pkg, rel))), `${pkg}/${rel}`);
  }
});

test("every package in the arc verifies independently as VERIFIED_FIXTURE_KEY (invalid decision never yields success)", () => {
  for (const pkg of Object.values(SHARED)) {
    const res = JSON.parse(run(["verify", "--package", pkg, "--json"]).stdout);
    assert.equal(res.ok, true, pkg);
    assert.equal(res.verdict, "VERIFIED_FIXTURE_KEY");
  }
  // 1.2 verify --json reports the decision summary with unverified-identity annotations
  const res = JSON.parse(run(["verify", "--package", SHARED.C, "--json"]).stdout);
  assert.equal(res.decision.decision_type, "DECISION_OVERRIDDEN");
  assert.deepEqual(res.decision.annotations, ["ACTOR_IDENTITY_UNVERIFIED", "DECISION_AUTHORITY_UNVERIFIED"]);
});

test("deciding NEVER touches the predecessor: prior packages stay byte-for-byte identical", () => {
  const parent = dir();
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  const before = snapshot(A);
  assert.equal(run(["decide", "--predecessor", A, "--intent", intentPath("review-no-change.intent.json"), "--output-dir", join(parent, "B"), "--build-commit", COMMIT]).status, 0);
  const after = snapshot(A);
  assert.deepEqual([...after.keys()], [...before.keys()]);
  for (const [rel, bytes] of before) assert.ok(bytes.equals(after.get(rel)), `predecessor mutated: ${rel}`);
});

test("decision generation is byte-deterministic: two identical arcs are byte-identical", () => {
  const one = createArc(dir()), two = createArc(dir());
  for (const k of ["A", "B", "C", "D", "R"]) {
    const s1 = snapshot(one[k]), s2 = snapshot(two[k]);
    assert.deepEqual([...s1.keys()], [...s2.keys()]);
    for (const [rel, bytes] of s1) assert.ok(bytes.equals(s2.get(rel)), `bytes differ: ${k}/${rel}`);
  }
});

// ---------------------------------------------------------------------------
// B · lifecycle over the chain
// ---------------------------------------------------------------------------

test("verify-chain derives the lifecycle: A→B→C→D = OVERRIDDEN with the override's disposition, local-set qualified", () => {
  const { A, B, C, D } = SHARED;
  const r = run(["verify-chain", "--package", A, "--package", B, "--package", C, "--package", D, "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const res = JSON.parse(r.stdout);
  assert.equal(res.ok, true);
  assert.equal(res.decision_lifecycle.state, "OVERRIDDEN");
  assert.equal(res.decision_lifecycle.effective_disposition, "APPROVE_WITH_CONDITIONS");
  assert.equal(res.decision_lifecycle.effective_decision_id, decisionOf(C).decision_id);
  assert.equal(res.decision_lifecycle.qualifier, "DERIVED_FROM_LOCAL_SET");
  assert.deepEqual(res.decision_failures, []);
  // no global-latest claim anywhere in the output
  assert.doesNotMatch(r.stdout, /globally latest(?!.*never)/);
});

test("verify-chain lifecycle: intermediate states (proposal, pending approval) and the rejection branch", () => {
  const { A, B, C, R } = SHARED;
  const at = (dirs) => JSON.parse(run(["verify-chain", ...dirs.flatMap((d) => ["--package", d]), "--json"]).stdout).decision_lifecycle;
  assert.equal(at([A, B]).state, "REVIEW_COMPLETED_OVERRIDE_PROPOSED");
  assert.equal(at([A, B]).effective_disposition, "REVIEW");           // review changes nothing
  assert.equal(at([A, B, C]).state, "OVERRIDE_PENDING_APPROVAL");
  assert.equal(at([A, B, C]).effective_disposition, "REVIEW");        // pending override changes nothing yet
  const rej = at([A, B, C, R]);
  assert.equal(rej.state, "REJECTED");
  assert.equal(rej.effective_disposition, "REVIEW");                  // reverts to the original — never erased
});

test("verify-chain lifecycle output is import-order insensitive (no timestamp or order tiebreaks)", () => {
  const { A, B, C, D } = SHARED;
  const one = JSON.parse(run(["verify-chain", "--package", A, "--package", B, "--package", C, "--package", D, "--json"]).stdout);
  const two = JSON.parse(run(["verify-chain", "--package", D, "--package", B, "--package", A, "--package", C, "--json"]).stdout);
  assert.deepEqual(two, one);
});

test("fork: approval branch + rejection branch together → CHAIN_FORK + DECISION_CONFLICT + FORKED, nothing resolved", () => {
  const { A, B, C, D, R } = SHARED;
  const r = run(["verify-chain", "--package", A, "--package", B, "--package", C, "--package", D, "--package", R, "--json"]);
  assert.equal(r.status, 1);
  const res = JSON.parse(r.stdout);
  assert.equal(res.ok, false);
  assert.ok(res.chain_failures.some((f) => f.code === "CHAIN_FORK"));
  assert.ok(res.decision_failures.some((f) => f.code === "DECISION_CONFLICT"));
  assert.equal(res.decision_lifecycle.state, "FORKED");
  assert.equal(res.decision_lifecycle.effective_disposition, null);
  assert.match(res.decision_failures.find((f) => f.code === "DECISION_CONFLICT").detail, /neither is chosen/);
});

test("chains WITHOUT decision packages keep the exact pre-1.2 verify-chain JSON shape (regression)", () => {
  const parent = dir();
  const A = join(parent, "A"), B = join(parent, "B");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", B, "--supersedes", A, "--build-commit", COMMIT]).status, 0);
  const res = JSON.parse(run(["verify-chain", "--package", A, "--package", B, "--json"]).stdout);
  assert.equal(res.ok, true);
  assert.equal("decision_lifecycle" in res, false);
  assert.equal("decisions" in res, false);
});

// ---------------------------------------------------------------------------
// C · transitions + SoD at decide time
// ---------------------------------------------------------------------------

test("unsupported transitions fail closed at decide time (exit 3, nothing written)", () => {
  const parent = dir();
  const { A, B, D } = SHARED;
  // override with no proposal in the predecessor
  const out1 = join(parent, "bad1");
  const r1 = run(["decide", "--predecessor", A, "--intent", intentPath("override.intent.json"), "--output-dir", out1, "--build-commit", COMMIT]);
  assert.equal(r1.status, 3);
  assert.match(r1.stderr, /DECISION_TRANSITION_UNSUPPORTED/);
  assert.equal(existsSync(out1), false);
  // approval when the predecessor is only a completed proposal review (no override yet)
  const cId = decisionOf(SHARED.C).decision_id;
  const out2 = join(parent, "bad2");
  const r2 = run(["decide", "--predecessor", B, "--intent", writeIntent(parent, "approval.intent.template.json", (i) => { i.target.decision_id = cId; }), "--output-dir", out2, "--build-commit", COMMIT]);
  assert.equal(r2.status, 3);
  assert.match(r2.stderr, /DECISION_TRANSITION_UNSUPPORTED/);
  // approval after approval (already OVERRIDDEN, only review/rejection may follow)
  const out3 = join(parent, "bad3");
  const r3 = run(["decide", "--predecessor", D, "--intent", writeIntent(parent, "approval.intent.template.json", (i) => { i.target.decision_id = decisionOf(D).decision_id; }), "--output-dir", out3, "--build-commit", COMMIT]);
  assert.equal(r3.status, 3);
  assert.match(r3.stderr, /DECISION_TRANSITION_UNSUPPORTED/);
});

test("approval without required review is refused UNLESS the signed policy exception review_required=false is declared", () => {
  const parent = dir();
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  const mkIntent = (reviewRequired) => writeIntent(parent, "approval.intent.template.json", (i) => {
    i.target = { type: "council_decision" };
    i.policy.review_required = reviewRequired;
    i.policy.separation_of_duties = "not_enforced";
  });
  const refused = run(["decide", "--predecessor", A, "--intent", mkIntent(true), "--output-dir", join(parent, "no"), "--build-commit", COMMIT]);
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /DECISION_TRANSITION_UNSUPPORTED/);
  const allowed = run(["decide", "--predecessor", A, "--intent", mkIntent(false), "--output-dir", join(parent, "yes"), "--build-commit", COMMIT, "--json"]);
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(JSON.parse(allowed.stdout).lifecycle.state, "APPROVED"); // approve-as-is: original disposition ratified
});

test("SoD enforced: the override author cannot approve or reject their own decision; different actor and not_enforced both pass", () => {
  const parent = dir();
  const { C } = SHARED;
  const cId = decisionOf(C).decision_id;
  const selfApprove = writeIntent(parent, "approval.intent.template.json", (i) => {
    i.target.decision_id = cId;
    i.actor = { actor_id: "fixture:reviewer-1", display_name: "Fixture Reviewer One", role: "approver" };
  });
  const r = run(["decide", "--predecessor", C, "--intent", selfApprove, "--output-dir", join(parent, "sod"), "--build-commit", COMMIT]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /SEPARATION_OF_DUTIES_VIOLATION/);
  assert.match(r.stderr, /organizational enforcement is NOT claimed/); // honesty in the refusal itself
  assert.equal(existsSync(join(parent, "sod")), false);
  // same actor but declared not_enforced → structurally accepted
  const selfNotEnforced = writeIntent(parent, "approval.intent.template.json", (i) => {
    i.target.decision_id = cId;
    i.actor = { actor_id: "fixture:reviewer-1", display_name: "Fixture Reviewer One", role: "approver" };
    i.policy.separation_of_duties = "not_enforced";
  });
  const ok = run(["decide", "--predecessor", C, "--intent", selfNotEnforced, "--output-dir", join(parent, "sod-ok"), "--build-commit", COMMIT, "--json"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(JSON.parse(ok.stdout).decision.status_tokens.includes("SEPARATION_OF_DUTIES_NOT_ENFORCED"));
});

test("override must state exactly the disposition it replaces (previous_disposition anchored to the predecessor)", () => {
  const parent = dir();
  const wrong = writeIntent(parent, "override.intent.json", (i) => { i.content.previous_disposition = "APPROVE"; i.content.new_disposition = "DECLINE"; });
  const r = run(["decide", "--predecessor", SHARED.B, "--intent", wrong, "--output-dir", join(parent, "x"), "--build-commit", COMMIT]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /previous_disposition/);
});

// ---------------------------------------------------------------------------
// D · binding / tamper / replay matrix (fixture-key attacker via reforge)
// ---------------------------------------------------------------------------

test("tampered reason/actor WITHOUT re-hash → member hash mismatch (TAMPERED); package fails, chain reports PACKAGE_TAMPERED", () => {
  const dest = join(dir(), "tampered");
  cpSync(SHARED.C, dest, { recursive: true });
  const d = JSON.parse(readFileSync(join(dest, MEMBER_PATHS.decision), "utf8"));
  d.content.reason_text = "Silently edited reason.";
  writeFileSync(join(dest, MEMBER_PATHS.decision), stable(d));
  const res = verifyPackageDir(dest);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "TAMPERED"));
});

test("changed actor/reason/type AFTER signing with stale decision_id (coherent re-forge) → rejected", () => {
  // actor/reason edits keep an otherwise-valid member: the stale id fails re-derivation
  for (const edit of [
    (d) => { d.actor.actor_id = "fixture:reviewer-9"; },
    (d) => { d.content.reason_text = "Edited after signing."; },
  ]) {
    const forged = reforge(SHARED.B, (ctx) => ctx.editJson(MEMBER_PATHS.decision, (d) => { edit(d); return d; })); // keeps the OLD decision_id
    const res = verifyPackageDir(forged);
    assert.equal(res.ok, false);
    assert.ok(res.failures.some((f) => f.code === "DECISION_MALFORMED" && /decision_id does not re-derive/.test(f.detail)), JSON.stringify(res.failures));
  }
  // a swapped decision_type additionally breaks the type-specific content contract
  const forged = reforge(SHARED.B, (ctx) => ctx.editJson(MEMBER_PATHS.decision, (d) => { d.decision_type = "APPROVAL_GRANTED"; return d; }));
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "DECISION_MALFORMED"), JSON.stringify(res.failures));
});

test("decision member predecessor/case/session diverging from the signed manifest → DECISION_TARGET_MISMATCH / CASE_MISMATCH / SESSION_MISMATCH", () => {
  const cases = [
    [(d) => { d.predecessor.package_id = "ab".repeat(32); }, "DECISION_TARGET_MISMATCH"],
    [(d) => { d.predecessor.manifest_sha256 = "cd".repeat(32); }, "DECISION_TARGET_MISMATCH"],
    [(d) => { d.case_id = "case-2026-Q3-9999"; }, "CASE_MISMATCH"],
    [(d) => { d.evidence_session_id = "another-session"; }, "SESSION_MISMATCH"],
  ];
  for (const [edit, code] of cases) {
    const forged = reforgeDecision(SHARED.B, edit);
    const res = verifyPackageDir(forged);
    assert.equal(res.ok, false, code);
    assert.ok(res.failures.some((f) => f.code === code), `${code}: ${JSON.stringify(res.failures.map((f) => f.code))}`);
  }
});

test("substituted council target hash (coherent re-forge) → TARGET_OBJECT_MISMATCH at chain level", () => {
  const forged = reforgeDecision(SHARED.B, (d) => { d.target.object_sha256 = "ee".repeat(32); });
  assert.equal(verifyPackageDir(forged).ok, true); // standalone cannot see the predecessor bytes…
  const res = verifyDecisionChain([SHARED.A, forged]);
  assert.equal(res.ok, false); // …the chain layer catches the substitution
  assert.ok(res.decision_failures.some((f) => f.code === "TARGET_OBJECT_MISMATCH"));
  assert.equal(res.lifecycle.state, null); // no business state from a broken binding
});

test("substituted prior_decision target (approval re-pointed) → TARGET_OBJECT_MISMATCH", () => {
  const forged = reforgeDecision(SHARED.D, (d) => { d.target.object_sha256 = "aa".repeat(32); });
  const res = verifyDecisionChain([SHARED.C, forged], { requireCompleteChain: false });
  assert.equal(res.ok, false);
  assert.ok(res.decision_failures.some((f) => f.code === "TARGET_OBJECT_MISMATCH"));
});

test("replay across cases is structurally impossible: the case is bound in manifest + member + supersedes + decision_id", () => {
  // a coherent forger changing case_id everywhere still fails: the signed
  // supersedes block's same-case rule fires first, and even if it were aligned,
  // the carried presentation member and the decision member both pin the case
  const forged = reforge(SHARED.B, (ctx) => {
    ctx.manifest.case_id = "case-2026-Q3-9999";
    ctx.manifest.bindings.case_id = "case-2026-Q3-9999";
  });
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => ["SUPERSESSION_MALFORMED", "BINDING_MISMATCH", "CASE_MISMATCH"].includes(f.code)), JSON.stringify(res.failures));
  // aligning the supersedes claim too still leaves the member/presentation case pins
  const forged2 = reforge(SHARED.B, (ctx) => {
    ctx.manifest.case_id = "case-2026-Q3-9999";
    ctx.manifest.bindings.case_id = "case-2026-Q3-9999";
    ctx.manifest.supersedes.predecessor_case_id = "case-2026-Q3-9999";
    ctx.editJson(MEMBER_PATHS.provenance, (p) => { p.supersession = ctx.manifest.supersedes; return p; });
  });
  const res2 = verifyPackageDir(forged2);
  assert.equal(res2.ok, false);
  assert.ok(res2.failures.some((f) => ["BINDING_MISMATCH", "CASE_MISMATCH"].includes(f.code)), JSON.stringify(res2.failures));
});

test("the same decision presented twice / two decisions with one id → DECISION_REPLAYED / DECISION_DUPLICATE", () => {
  // byte-identical decision member in a re-forged sibling package → replay
  const replayed = reforge(SHARED.B, (ctx) => {
    ctx.editJson(MEMBER_PATHS.provenance, (p) => { p.built_at = "2026-07-23T00:00:00.000Z"; return p; });
  });
  const res = verifyDecisionChain([SHARED.A, SHARED.B, replayed]);
  assert.equal(res.ok, false);
  assert.ok(res.decision_failures.some((f) => f.code === "DECISION_REPLAYED"), JSON.stringify(res.decision_failures));
});

test("missing predecessor: honest PREDECESSOR_NOT_SUPPLIED; the decision package itself remains valid; no lifecycle derived", () => {
  const r = run(["verify-chain", "--package", SHARED.C, "--json"]);
  assert.equal(r.status, 1);
  const res = JSON.parse(r.stdout);
  assert.ok(res.chain_failures.some((f) => f.code === "PREDECESSOR_NOT_SUPPLIED"));
  assert.equal(res.packages[0].package_ok, true);
  assert.equal(res.decision_lifecycle.state, null);
  assert.match(res.decision_lifecycle.note, /not derived/);
});

// ---------------------------------------------------------------------------
// E · CLI behavior, exit codes, filesystem safety, privacy
// ---------------------------------------------------------------------------

test("help documents decide, the intent contract, fixture honesty and exit codes", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /decide --predecessor <prior-package-dir>/);
  assert.match(r.stdout, /shadow-decision-intent\/1/);
  assert.match(r.stdout, /DECISION_AUTHORITY_UNVERIFIED/);
  assert.match(r.stdout, /decide: {7}0 ok · 2 usage · 3 input\/I-O error/);
});

test("usage errors exit 2; missing predecessor/unreadable intent exit 3; invalid intent exits 3 with named problems", () => {
  const parent = dir();
  assert.equal(run(["decide"]).status, 2);
  assert.equal(run(["decide", "--predecessor", SHARED.A, "--intent", intentPath("review-no-change.intent.json")]).status, 2); // no --output-dir
  assert.equal(run(["decide", "--predecessor", join(parent, "nope"), "--intent", intentPath("review-no-change.intent.json"), "--output-dir", join(parent, "o")]).status, 3);
  const badIntent = writeIntent(parent, "review-no-change.intent.json", (i) => { i.actor.actor_id = "not-a-fixture-actor"; i.content.reason_code = "VIBES"; });
  const r = run(["decide", "--predecessor", SHARED.A, "--intent", badIntent, "--output-dir", join(parent, "o2")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /fixture:<slug>/);
  assert.match(r.stderr, /reason_code/);
  assert.equal(existsSync(join(parent, "o2")), false);
});

test("tampered predecessor is refused (exit 3) and atomicity holds: no output, no temp residue", () => {
  const parent = dir();
  const A = join(parent, "A");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  const evPath = join(A, MEMBER_PATHS.evidence);
  writeFileSync(evPath, readFileSync(evPath, "utf8").replace("shadow", "shadOw"), "utf8");
  const out = join(parent, "next");
  const r = run(["decide", "--predecessor", A, "--intent", intentPath("review-no-change.intent.json"), "--output-dir", out, "--build-commit", COMMIT]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /PREDECESSOR_INVALID/);
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(parent).filter((n) => n.includes(".tmp-")), []);
});

test("the predecessor can never be the output directory — not even with --force", () => {
  const r = run(["decide", "--predecessor", SHARED.A, "--intent", intentPath("review-no-change.intent.json"), "--output-dir", SHARED.A, "--force"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /immutable and is never overwritten/);
  assert.equal(run(["verify", "--package", SHARED.A]).status, 0);
});

test("--force replaces an existing output dir; --json reports on stdout only; stderr stays empty on success", () => {
  const parent = dir();
  const out = join(parent, "B");
  assert.equal(run(["decide", "--predecessor", SHARED.A, "--intent", intentPath("review-no-change.intent.json"), "--output-dir", out, "--build-commit", COMMIT]).status, 0);
  const r = run(["decide", "--predecessor", SHARED.A, "--intent", intentPath("review-no-change.intent.json"), "--output-dir", out, "--build-commit", COMMIT, "--force", "--json"]);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  const s = JSON.parse(r.stdout);
  assert.equal(s.manifest_version, PACKAGE_VERSION_1_2);
  assert.equal(s.lifecycle.state, "REVIEW_COMPLETED_NO_CHANGE");
  assert.equal(s.decision.identity_class, "operator_declared");
});

test("bare env (PATH only): the full decision arc needs no credentials and no network", () => {
  const arc = createArc(dir()); // createArc already runs with BARE_ENV
  const v = run(["verify-chain", "--package", arc.A, "--package", arc.B, "--package", arc.C, "--package", arc.D]);
  assert.equal(v.status, 0);
  assert.equal(v.stderr, "");
});

test("no private key material or credential patterns in decision packages, JSON output, stdout or stderr", () => {
  for (const pkg of [SHARED.B, SHARED.C, SHARED.D, SHARED.R]) {
    for (const rel of walk(pkg)) assert.doesNotMatch(readFileSync(join(pkg, rel), "utf8"), /PRIVATE KEY|sk-ant-/, rel);
  }
  const r = run(["verify-chain", "--package", SHARED.A, "--package", SHARED.B, "--json"]);
  assert.doesNotMatch(r.stdout + r.stderr, /PRIVATE KEY/);
});

test("static scan: decision modules import no network-capable APIs and no eval/dynamic execution", () => {
  for (const f of ["lib/decision-amendment.mjs", "lib/decision-package.mjs"]) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.doesNotMatch(src, /node:https?|node:net|node:tls|node:dgram|fetch\(|XMLHttpRequest|WebSocket/, f);
    assert.doesNotMatch(src, /\beval\(|new Function\(|child_process/, f);
  }
});

// ---------------------------------------------------------------------------
// F · regression pins: earlier contracts unchanged
// ---------------------------------------------------------------------------

test("1.0 and 1.1 packages are untouched: no decision member, old markers, old provenance schemas", () => {
  const parent = dir();
  const A = join(parent, "A"), B = join(parent, "B");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", B, "--supersedes", A, "--build-commit", COMMIT]).status, 0);
  const a = manifestOf(A), b = manifestOf(B);
  assert.equal(a.manifest_version, PACKAGE_VERSION);
  assert.equal(b.manifest_version, PACKAGE_VERSION_1_1);
  assert.equal(b.supersedes.marker, "FIXTURE_SUCCESSOR");
  assert.equal(a.assets.some((x) => x.role === "decision"), false);
  assert.equal(b.assets.some((x) => x.role === "decision"), false);
});

test("a decision member smuggled into a 1.1 package is UNSUPPORTED; marker APPROVED still never parses anywhere", () => {
  // decision role requires 1.2
  const parent = dir();
  const A = join(parent, "A"), B = join(parent, "B");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", A, "--build-commit", COMMIT]).status, 0);
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", B, "--supersedes", A, "--build-commit", COMMIT]).status, 0);
  const smuggled = reforge(B, (ctx) => {
    const d = decisionOf(SHARED.B);
    ctx.setBytes(MEMBER_PATHS.decision, Buffer.from(stable(d), "utf8"));
    ctx.manifest.assets.push({ path: MEMBER_PATHS.decision, role: "decision", schema_version: DECISION_SCHEMA, byte_size: 0, sha256: "0".repeat(64) });
  });
  const res = verifyPackageDir(smuggled);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "UNSUPPORTED" && /requires manifest_version/.test(f.detail)));

  // non-neutral markers stay rejected in BOTH successor versions
  for (const src of [B, SHARED.B]) {
    const forged = reforge(src, (ctx) => {
      ctx.manifest.supersedes.marker = "APPROVED";
      ctx.editJson(MEMBER_PATHS.provenance, (p) => { p.supersession = ctx.manifest.supersedes; return p; });
    });
    const r2 = verifyPackageDir(forged);
    assert.equal(r2.ok, false, src);
    assert.ok(r2.failures.some((f) => f.code === "SUPERSESSION_MALFORMED"), src);
  }
});

test("a 1.2 package whose marker is FIXTURE_SUCCESSOR (wrong vocabulary for the version) is rejected", () => {
  const forged = reforge(SHARED.B, (ctx) => {
    ctx.manifest.supersedes.marker = "FIXTURE_SUCCESSOR";
    ctx.editJson(MEMBER_PATHS.provenance, (p) => { p.supersession = ctx.manifest.supersedes; return p; });
  });
  const res = verifyPackageDir(forged);
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === "SUPERSESSION_MALFORMED" && /1\.2 vocabulary/.test(f.detail)));
});
