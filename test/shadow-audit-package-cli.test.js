// Portable signed audit package CLI (fixture mode) — creation, determinism,
// CLI behavior, filesystem safety, privacy. These tests spawn the real CLI
// (no shell, bare PATH-only env — proves no credentials are required) and
// also import the assembly/verification module directly.
// Tamper/binding/replay matrix lives in test/shadow-audit-package-verify.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256Hex } from "../verify/verify-manifest.mjs";
import { verifyBundle } from "../packages/attest-core/index.js";
import { PACKAGE_VERSION, MEMBER_PATHS, computePackageId, MANDATORY_CAPABILITY_TOKENS } from "../lib/portable-audit-package.mjs";

const ROOT = process.cwd();
const CLI = join(ROOT, "bin", "shadow-audit-package.mjs");
const FLOW_CLI = join(ROOT, "bin", "shadow-flow-export.mjs");
const BARE_ENV = { PATH: process.env.PATH };

function run(args, env = BARE_ENV) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env });
}
const dir = () => mkdtempSync(join(tmpdir(), "shadow-audit-package-"));

function walk(root, rel = "") {
  const out = [];
  for (const name of readdirSync(rel ? join(root, rel) : root).sort()) {
    const childRel = rel ? `${rel}/${name}` : name;
    if (lstatSync(join(root, childRel)).isDirectory()) out.push(...walk(root, childRel));
    else out.push(childRel);
  }
  return out;
}

function createPkg(extra = []) {
  const out = join(dir(), "pkg");
  const r = run(["create", "--fixture", "banking", "--output-dir", out, ...extra]);
  assert.equal(r.status, 0, r.stderr);
  return out;
}

// ---------------------------------------------------------------------------
// A · successful creation
// ---------------------------------------------------------------------------

test("create writes a complete shadow-portable-audit-package/1.0 with the canonical layout", () => {
  const pkg = createPkg();
  assert.deepEqual(walk(pkg), [
    "evidence/evidence-bundle.json",
    "keys/evidence-public-key.pem",
    "keys/package-public-key.pem",
    "manifest.json",
    "presentation/shadow-flow-export.json",
    "provenance/runtime-manifest.json",
    "verification/verification-result.json",
  ]);
  const m = JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
  assert.equal(m.manifest_version, PACKAGE_VERSION);
  assert.equal(m.case_id, "case-2026-Q3-0042");
  assert.deepEqual(m.bindings, { case_id: "case-2026-Q3-0042", evidence_session_id: "reference-banking-decision-2026-001" });
  assert.equal(m.source, "fixture:banking");
  assert.equal(m.built_at, "2026-07-22T00:00:00.000Z"); // fixture timestamp, never wall clock
  assert.equal(m.canonicalization_version, "shadow-canon/1");
  // every member parses / is well-formed
  for (const a of m.assets) {
    const bytes = readFileSync(join(pkg, a.path));
    assert.equal(bytes.length, a.byte_size, a.path);
    assert.equal(sha256Hex(bytes), a.sha256, a.path);
    if (a.path.endsWith(".json")) JSON.parse(bytes.toString("utf8"));
  }
});

test("manifest binds signing profile, full-length key fingerprints, producer identity and capability boundary", () => {
  const pkg = createPkg();
  const m = JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
  assert.equal(m.signing.profile, "ed25519");
  assert.equal(m.signing.key_provenance, "fixture");
  assert.equal(m.signing.key_label, "FIXTURE RELEASE KEY");
  assert.match(m.signing.package_public_key_fingerprint_sha256, /^[0-9a-f]{64}$/); // full-length, not the 16-char precedent
  assert.match(m.signing.evidence_public_key_fingerprint_sha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof m.producer.version, "string");
  assert.ok(m.producer.build_commit.length > 0);
  for (const t of MANDATORY_CAPABILITY_TOKENS) assert.ok(m.capability_boundary.includes(t), t);
  assert.ok(m.capability_boundary.includes("FIXTURE_ONLY"));
  assert.ok(m.capability_boundary.includes("KEY_REVOCATION_NOT_IMPLEMENTED"));
  assert.equal(typeof m.signature, "string");
});

test("creation is byte-deterministic across repeated runs (every member + manifest)", () => {
  const a = createPkg(), b = createPkg();
  assert.deepEqual(walk(a), walk(b));
  for (const rel of walk(a)) {
    assert.ok(readFileSync(join(a, rel)).equals(readFileSync(join(b, rel))), `bytes differ: ${rel}`);
  }
});

test("assets are sorted by path and package_id derives from the sorted member hashes", () => {
  const pkg = createPkg();
  const m = JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
  const paths = m.assets.map((x) => x.path);
  assert.deepEqual(paths, [...paths].sort((x, y) => x.localeCompare(y)));
  assert.equal(m.package_id, computePackageId(m.assets));
  assert.equal(m.package_id, sha256Hex(m.assets.map((x) => x.sha256).sort().join("\n")));
});

test("presentation member is byte-identical to the existing Flow export CLI output (parity + regression pin)", () => {
  const pkg = createPkg();
  const flowOut = join(dir(), "flow.json");
  const r = spawnSync(process.execPath, [FLOW_CLI, "--fixture", "banking", "--output", flowOut], { encoding: "utf8", env: BARE_ENV });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(readFileSync(flowOut).equals(readFileSync(join(pkg, MEMBER_PATHS.presentation))),
    "presentation member must stay byte-compatible with bin/shadow-flow-export.mjs");
});

test("shipped verification-result equals a fresh independent verifyBundle re-derivation", () => {
  const pkg = createPkg();
  const shipped = JSON.parse(readFileSync(join(pkg, MEMBER_PATHS.verification), "utf8"));
  assert.equal(shipped.derived, true);
  const bundle = JSON.parse(readFileSync(join(pkg, MEMBER_PATHS.evidence), "utf8"));
  const pub = readFileSync(join(pkg, MEMBER_PATHS.evidenceKey), "utf8");
  const fresh = verifyBundle(bundle, { publicKey: pub });
  assert.deepEqual(shipped.result, { ok: fresh.ok, trust_level: fresh.trustLevel, anchors: fresh.anchors });
});

test("verify accepts the created package: exit 0, VERIFIED_FIXTURE_KEY, boundary stated", () => {
  const pkg = createPkg();
  const r = run(["verify", "--package", pkg]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /package verified/);
  assert.match(r.stdout, /VERIFIED_FIXTURE_KEY/);
  assert.match(r.stdout, /never analytical or business correctness/);
  const j = run(["verify", "--package", pkg, "--json"]);
  assert.equal(j.status, 0);
  const res = JSON.parse(j.stdout);
  assert.equal(res.ok, true);
  assert.equal(res.verdict, "VERIFIED_FIXTURE_KEY");
  assert.equal(res.key_provenance, "fixture");
  assert.deepEqual(res.failures, []);
});

// ---------------------------------------------------------------------------
// F · CLI behavior
// ---------------------------------------------------------------------------

test("--json create emits a one-line machine-readable summary on stdout only", () => {
  const out = join(dir(), "pkg");
  const r = run(["create", "--fixture", "banking", "--output-dir", out, "--json"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  const s = JSON.parse(r.stdout);
  assert.equal(s.ok, true);
  assert.equal(s.manifest_version, PACKAGE_VERSION);
  assert.equal(s.case_id, "case-2026-Q3-0042");
  assert.equal(s.evidence_session_id, "reference-banking-decision-2026-001");
  assert.equal(s.key_provenance, "fixture");
});

test("help and usage errors: documented exit codes, stderr for errors", () => {
  assert.equal(run(["--help"]).status, 0);
  assert.match(run(["--help"]).stdout, /Exit codes/);
  assert.equal(run(["create", "--help"]).status, 0);
  assert.equal(run([]).status, 2);                                     // no subcommand
  assert.equal(run(["frobnicate"]).status, 2);                          // unknown subcommand
  assert.equal(run(["create", "--fixture", "banking"]).status, 2);      // missing --output-dir
  assert.equal(run(["create", "--output-dir", join(dir(), "x")]).status, 2); // missing --fixture
  assert.equal(run(["verify"]).status, 2);                              // missing --package
  const unk = run(["create", "--fixture", "banking", "--output-dir", join(dir(), "x"), "--bogus"]);
  assert.equal(unk.status, 2);
  assert.match(unk.stderr, /unknown argument/);
});

test("fixture allowlist is closed: unknown fixture exits 2 and names the supported set", () => {
  const r = run(["create", "--fixture", "trading", "--output-dir", join(dir(), "x")]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown fixture "trading"/);
  assert.match(r.stderr, /supported: banking/);
});

test("--evidence and --evidence-public-key must be given together", () => {
  const r = run(["create", "--fixture", "banking", "--output-dir", join(dir(), "x"), "--evidence", "whatever.json"]);
  assert.equal(r.status, 2);
});

test("verify of a missing package directory is an I/O error (exit 3)", () => {
  const r = run(["verify", "--package", join(dir(), "nope")]);
  assert.equal(r.status, 3);
});

test("malformed manifest JSON is an I/O-class exit (3), never best-effort acceptance", () => {
  const pkg = createPkg();
  writeFileSync(join(pkg, "manifest.json"), "{ not json", "utf8");
  const r = run(["verify", "--package", pkg]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /not valid JSON/);
});

// ---------------------------------------------------------------------------
// E · filesystem safety / atomicity
// ---------------------------------------------------------------------------

test("existing output directory is refused without --force and replaced with it", () => {
  const parent = dir();
  const out = join(parent, "pkg");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", out]).status, 0);
  const r = run(["create", "--fixture", "banking", "--output-dir", out]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Refusing to overwrite/);
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", out, "--force"]).status, 0);
  assert.equal(run(["verify", "--package", out]).status, 0);
});

test("a failed create leaves no output directory and no temp directory behind", () => {
  const parent = dir();
  const out = join(parent, "pkg");
  const badBundle = join(parent, "bad.json");
  writeFileSync(badBundle, "{ not json", "utf8");
  const r = run(["create", "--fixture", "banking", "--output-dir", out,
    "--evidence", badBundle, "--evidence-public-key", join(ROOT, "docs", "reference", "banking-decision.public.pem")]);
  assert.equal(r.status, 3);
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(parent).filter((n) => n.includes(".tmp-")), []);
});

test("successful create completes atomically (no temp sibling remains)", () => {
  const parent = dir();
  const out = join(parent, "pkg");
  assert.equal(run(["create", "--fixture", "banking", "--output-dir", out]).status, 0);
  assert.deepEqual(readdirSync(parent), ["pkg"]);
});

test("unverifiable evidence is refused at create time (exit 3, nothing written)", () => {
  const parent = dir();
  const out = join(parent, "pkg");
  const bundle = JSON.parse(readFileSync(join(ROOT, "docs", "reference", "banking-decision.bundle.json"), "utf8"));
  bundle.events[1].actor = "tampered";
  const tampered = join(parent, "tampered.json");
  writeFileSync(tampered, JSON.stringify(bundle, null, 2), "utf8");
  const r = run(["create", "--fixture", "banking", "--output-dir", out,
    "--evidence", tampered, "--evidence-public-key", join(ROOT, "docs", "reference", "banking-decision.public.pem")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /refusing to package evidence that does not verify/);
  assert.equal(existsSync(out), false);
});

// ---------------------------------------------------------------------------
// D/offline · privacy, keys, network
// ---------------------------------------------------------------------------

test("no private key material anywhere: package members, manifest, stdout, stderr", () => {
  const out = join(dir(), "pkg");
  const r = run(["create", "--fixture", "banking", "--output-dir", out, "--json"]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout + r.stderr, /PRIVATE KEY/);
  for (const rel of walk(out)) {
    assert.doesNotMatch(readFileSync(join(out, rel), "utf8"), /PRIVATE KEY/, rel);
  }
});

test("HMAC-signed evidence is rejected as NOT_PORTABLE at create time", () => {
  const parent = dir();
  const bundle = JSON.parse(readFileSync(join(ROOT, "docs", "reference", "banking-decision.bundle.json"), "utf8"));
  bundle.signatures[0].algorithm = "hmac-sha256";
  const p = join(parent, "hmac.json");
  writeFileSync(p, JSON.stringify(bundle), "utf8");
  const r = run(["create", "--fixture", "banking", "--output-dir", join(parent, "pkg"),
    "--evidence", p, "--evidence-public-key", join(ROOT, "docs", "reference", "banking-decision.public.pem")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /NOT_PORTABLE/);
});

test("identity_ref in evidence is refused by default (flag-gated privacy boundary)", () => {
  const parent = dir();
  const bundle = JSON.parse(readFileSync(join(ROOT, "docs", "reference", "banking-decision.bundle.json"), "utf8"));
  bundle.header.agent.identity_ref = "user:alex";
  const p = join(parent, "ident.json");
  writeFileSync(p, JSON.stringify(bundle), "utf8");
  const r = run(["create", "--fixture", "banking", "--output-dir", join(parent, "pkg"),
    "--evidence", p, "--evidence-public-key", join(ROOT, "docs", "reference", "banking-decision.public.pem")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /identity_ref/);
});

test("static scan: the package CLI and module import no network-capable APIs", () => {
  for (const f of ["bin/shadow-audit-package.mjs", "lib/portable-audit-package.mjs"]) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.doesNotMatch(src, /node:https?|node:net|node:tls|node:dgram|fetch\(|XMLHttpRequest|WebSocket/, f);
  }
});

test("bare env (PATH only): create + verify need no credentials and write errors only to stderr", () => {
  const out = join(dir(), "pkg");
  const c = run(["create", "--fixture", "banking", "--output-dir", out]); // BARE_ENV throughout
  assert.equal(c.status, 0);
  assert.equal(c.stderr, "");
  const v = run(["verify", "--package", out]);
  assert.equal(v.status, 0);
  assert.equal(v.stderr, "");
});
