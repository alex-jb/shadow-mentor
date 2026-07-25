// lib/portable-audit-package.mjs
//
// shadow-portable-audit-package/1.0 — assembly + verification core for the
// portable signed audit package (fixture mode). Implements the committed
// discovery decision SEPARATE_PORTABLE_PACKAGE_CLI_RECOMMENDED
// (docs/portable-audit-package/PORTABLE_AUDIT_PACKAGE_RECOMMENDATION.md):
// one signed canonical manifest binds every member through
// {path, role, schema_version, byte_size, sha256}; the manifest — not any
// member — creates the case_id ↔ evidence_session_id binding; completeness is
// two-way (every declared member present AND no undeclared file tolerated).
//
// Reused authoritative primitives (never forked):
//   - canonicalize / sha256Hex / signManifest  → verify/verify-manifest.mjs
//   - verifyBundle (shadow-evidence/v1)        → packages/attest-core
//   - exportFlowContract + validateFlowExport  → flow export producer + CLI validator
//   - FIXTURE_RELEASE_* key                    → verify/fixture-release-key.mjs
//
// BOUNDARY (do not weaken): a valid package signature proves tamper-evidence
// only. It never proves analytical or business correctness, Flow vendor
// import success, native Shadow Lens behavior, or any physical XR capability.
// Fixture keys are demo keys — never production. Rotation and revocation are
// NOT implemented (documented future requirements).
import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { readdirSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalize, sha256Hex, signManifest } from "../verify/verify-manifest.mjs";
import { verifyBundle } from "../packages/attest-core/index.js";
import { FLOW_EXPORT_VERSION, exportFlowContract } from "../apps/shadow-lens/flow/flow-export-contract.mjs";
import { validateFlowExport } from "../bin/shadow-flow-export.mjs";

export const PACKAGE_VERSION = "shadow-portable-audit-package/1.0";
export const CANON_VERSION = "shadow-canon/1";
export const EVIDENCE_SCHEMA = "shadow-evidence/v1";
export const ATTESTATION_SCHEMA = "aex-attestation/v1";
export const VERIFICATION_SCHEMA = "shadow-audit-package-verification/1.0";
export const PROVENANCE_SCHEMA = "shadow-audit-package-provenance/1.0";
export const PUBLIC_KEY_SCHEMA = "spki-pem";

// Canonical member layout (discovery PORTABLE_AUDIT_PACKAGE_OPTIONS.md shape).
export const MEMBER_PATHS = Object.freeze({
  manifest: "manifest.json",
  presentation: "presentation/shadow-flow-export.json",
  evidence: "evidence/evidence-bundle.json",
  attestation: "attestation/attestation.json",
  verification: "verification/verification-result.json",
  provenance: "provenance/runtime-manifest.json",
  evidenceKey: "keys/evidence-public-key.pem",
  packageKey: "keys/package-public-key.pem",
});

// Closed role vocabulary (recommendation §manifest additions).
export const ROLES = Object.freeze([
  "presentation", "evidence", "attestation", "verification-derived", "provenance", "public-key",
]);
// Roles that must appear exactly once. "public-key" may appear twice
// (evidence key + package key); "attestation" is optional (0 or 1).
const UNIQUE_ROLES = ["presentation", "evidence", "attestation", "verification-derived", "provenance"];
const REQUIRED_ROLES = ["presentation", "evidence", "verification-derived", "provenance", "public-key"];

// Allowed schema versions per role — anything else is UNSUPPORTED, never best-effort.
const ROLE_SCHEMAS = Object.freeze({
  presentation: [FLOW_EXPORT_VERSION],
  evidence: [EVIDENCE_SCHEMA],
  attestation: [ATTESTATION_SCHEMA],
  "verification-derived": [VERIFICATION_SCHEMA],
  provenance: [PROVENANCE_SCHEMA],
  "public-key": [PUBLIC_KEY_SCHEMA],
});

export const KEY_PROVENANCES = Object.freeze(["fixture", "operator", "production"]);
export const SIGNING_PROFILE = "ed25519";

// Signed capability boundary: closed vocabulary; the two honesty tokens are mandatory.
export const CAPABILITY_TOKENS = Object.freeze([
  "FIXTURE_ONLY",
  "TAMPER_EVIDENCE_ONLY",
  "SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS",
  "NO_PHYSICAL_CLAIM",
  "KEY_ROTATION_NOT_IMPLEMENTED",
  "KEY_REVOCATION_NOT_IMPLEMENTED",
]);
export const MANDATORY_CAPABILITY_TOKENS = Object.freeze([
  "TAMPER_EVIDENCE_ONLY",
  "SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS",
]);

// Closed verification-failure vocabulary (deterministic; never extended ad hoc).
export const FAILURE_CODES = Object.freeze([
  "MANIFEST_MISSING",          // no manifest.json in the package directory
  "MANIFEST_MALFORMED",        // manifest parses but violates the contract structure
  "UNSUPPORTED",               // unknown manifest/member schema version, role, or signing profile
  "PATH_UNSAFE",               // traversal / absolute / duplicate / symlink / reserved path
  "MANIFEST_SIGNATURE_MISSING",
  "MANIFEST_SIGNATURE_FAILED",
  "UNVERIFIABLE",              // no usable public key material
  "KEY_FINGERPRINT_MISMATCH",  // supplied/embedded key ≠ signed fingerprint
  "INCOMPLETE",                // declared member missing, or a required role absent
  "UNEXPECTED_MEMBER",         // file present that the signed manifest does not declare
  "TAMPERED",                  // member byte_size or sha256 mismatch
  "MEMBER_MALFORMED",          // hash-intact member fails to parse as its declared format
  "BINDING_MISMATCH",          // case/session/package_id/schema binding inconsistency
  "NOT_PORTABLE",              // HMAC-signed material — verification would need the secret
  "EVIDENCE_VERIFICATION_FAILED", // internal shadow-evidence/v1 verification failed
  "ATTESTATION_INCONSISTENT",  // attestation member violates its declared envelope
  "VERIFIER_DISAGREEMENT",     // shipped verification-result ≠ independently re-derived result
]);

export const BOUNDARY_STATEMENT =
  "A valid package signature proves tamper-evidence only — never analytical or business correctness.";

const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const SECRET_PATTERN = /sk-ant-|AIza[0-9A-Za-z_-]{10}|aws_secret|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function fullKeyFingerprint(publicKeyPem) {
  // full-length SHA-256 over the SPKI DER (the discovery prefers full-length
  // over the 16-char precedent in verify-manifest.mjs — different field, not a fork).
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256Hex(der);
}

export function computePackageId(assets) {
  // content-derived: sha256 over the sorted member hashes (recommendation §manifest additions).
  return sha256Hex(assets.map((a) => a.sha256).sort().join("\n"));
}

export function memberPathError(p) {
  if (typeof p !== "string" || p.length === 0) return "empty path";
  if (p.includes("\\")) return "backslash in path";
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return "absolute path";
  const segs = p.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) return "traversal or empty segment";
  if (p === MEMBER_PATHS.manifest) return "reserved path (manifest.json)";
  if (!/^[A-Za-z0-9._/-]+$/.test(p)) return "unsupported character";
  return null;
}

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + "\n"; // UTF-8, LF, trailing newline — repo convention
}

function signedBytesOf(manifest) {
  const { signature, ...rest } = manifest;
  return Buffer.from(canonicalize(rest), "utf8");
}

// ---------------------------------------------------------------------------
// assembly (pure, in-memory — the CLI owns all filesystem writes)
// ---------------------------------------------------------------------------

// Returns { files: Map<relPath, Buffer>, manifest } or throws { code, message }.
// `code` ∈ { INPUT, SELF_VALIDATION } mapping to the CLI's exit 3 / exit 4.
function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export function assemblePackage({
  narrative,               // supported narrative object (BANKING_NARRATIVE shape)
  source,                  // e.g. "fixture:banking"
  evidenceBytes,           // Buffer — existing sealed shadow-evidence/v1 bundle, byte-preserved
  evidencePublicKeyPem,    // string — SPKI PEM for the bundle signature
  attestationBytes = null, // Buffer|null — optional existing aex-attestation/v1 artifact
  builtAt,                 // caller-supplied ISO string (never wall clock)
  buildCommit,             // producer commit identity (or "unknown")
  producerVersion,         // package.json version of this repo
  packagePrivateKeyPem,    // fixture signing key (never persisted, never printed)
  packagePublicKeyPem,     // its public half — embedded as a member
  keyProvenance = "fixture",
  keyLabel = "FIXTURE RELEASE KEY",
  allowIdentityRef = false,
}) {
  if (typeof builtAt !== "string" || !builtAt) throw fail("INPUT", "built_at must be a caller-supplied string (never wall clock)");
  if (keyProvenance !== "fixture") throw fail("INPUT", "this increment supports fixture signing only (key_provenance=fixture)");

  // --- presentation member: the unchanged authoritative producer + validator ---
  const flowExport = exportFlowContract(deepFreeze(narrative));
  const flowErrs = validateFlowExport(flowExport);
  if (flowErrs.length) throw fail("SELF_VALIDATION", `presentation member failed ${FLOW_EXPORT_VERSION} validation:\n  - ${flowErrs.join("\n  - ")}`);
  const presentationBytes = Buffer.from(stableStringify(flowExport), "utf8");

  // --- evidence member: accepted as-is, never re-sealed, byte-preserved ---
  let bundle;
  try { bundle = JSON.parse(evidenceBytes.toString("utf8")); }
  catch (e) { throw fail("INPUT", `evidence bundle is not valid JSON: ${e.message}`); }
  if (bundle?.spec_version !== EVIDENCE_SCHEMA) throw fail("INPUT", `evidence bundle spec_version must be ${EVIDENCE_SCHEMA}`);
  const sessionId = bundle?.header?.session_id;
  if (typeof sessionId !== "string" || !sessionId) throw fail("INPUT", "evidence bundle header.session_id missing — the case↔session binding cannot be created");
  const alg = bundle?.signatures?.[0]?.algorithm;
  if (typeof alg === "string" && alg.startsWith("hmac")) {
    throw fail("INPUT", "NOT_PORTABLE: HMAC-signed bundles cannot ride a portable package (verification would require sharing the signing secret)");
  }
  if (!allowIdentityRef && bundle?.header?.agent?.identity_ref != null) {
    throw fail("INPUT", "evidence header.agent.identity_ref is set — refusing to package identity data (pass --allow-identity-ref to opt in explicitly)");
  }
  const bundleVerdict = verifyBundle(bundle, { publicKey: evidencePublicKeyPem });
  if (!bundleVerdict.ok) {
    throw fail("INPUT", `refusing to package evidence that does not verify: ${bundleVerdict.reason} — ${bundleVerdict.detail ?? ""}`);
  }

  // --- optional attestation member: passthrough, hash-bound, ed25519-only ---
  if (attestationBytes) {
    let att;
    try { att = JSON.parse(attestationBytes.toString("utf8")); }
    catch (e) { throw fail("INPUT", `attestation is not valid JSON: ${e.message}`); }
    if (att?.version !== ATTESTATION_SCHEMA) throw fail("INPUT", `attestation version must be ${ATTESTATION_SCHEMA}`);
    if (att?.mode !== "ed25519") throw fail("INPUT", "NOT_PORTABLE: only ed25519-mode attestations are portable");
    if (typeof att?.signature !== "string" || !att.signature) throw fail("INPUT", "attestation has no signature");
  }

  // --- derived verification member: reproducible view, never evidence ---
  const verificationView = {
    schema_version: VERIFICATION_SCHEMA,
    derived: true,
    note: "Reproducible derived view. Consumers MUST re-derive verification independently; this shipped copy is never evidence. " + BOUNDARY_STATEMENT,
    verifier: { name: "attest-core/verifyBundle", invoked_via: "shadow-audit-package" },
    evidence_member: MEMBER_PATHS.evidence,
    evidence_session_id: sessionId,
    result: { ok: true, trust_level: bundleVerdict.trustLevel, anchors: bundleVerdict.anchors },
  };
  const verificationBytes = Buffer.from(stableStringify(verificationView), "utf8");

  // --- provenance member ---
  const provenance = {
    schema_version: PROVENANCE_SCHEMA,
    producer: { name: "shadow-mentor", cli: "shadow-audit-package", version: producerVersion },
    build_commit: buildCommit,
    built_at: builtAt,
    source,
    key_provenance: keyProvenance,
    member_contracts: {
      presentation: FLOW_EXPORT_VERSION,
      evidence: EVIDENCE_SCHEMA,
      ...(attestationBytes ? { attestation: ATTESTATION_SCHEMA } : {}),
      "verification-derived": VERIFICATION_SCHEMA,
    },
  };
  const provenanceBytes = Buffer.from(stableStringify(provenance), "utf8");

  // --- key members (public halves only) ---
  const evidenceKeyBytes = Buffer.from(evidencePublicKeyPem.endsWith("\n") ? evidencePublicKeyPem : evidencePublicKeyPem + "\n", "utf8");
  const packageKeyBytes = Buffer.from(packagePublicKeyPem.endsWith("\n") ? packagePublicKeyPem : packagePublicKeyPem + "\n", "utf8");

  const files = new Map([
    [MEMBER_PATHS.presentation, presentationBytes],
    [MEMBER_PATHS.evidence, Buffer.from(evidenceBytes)],
    ...(attestationBytes ? [[MEMBER_PATHS.attestation, Buffer.from(attestationBytes)]] : []),
    [MEMBER_PATHS.verification, verificationBytes],
    [MEMBER_PATHS.provenance, provenanceBytes],
    [MEMBER_PATHS.evidenceKey, evidenceKeyBytes],
    [MEMBER_PATHS.packageKey, packageKeyBytes],
  ]);

  // privacy gate: no private key material, no credential patterns, in any member
  for (const [path, bytes] of files) {
    const s = bytes.toString("utf8");
    if (PRIVATE_KEY_PATTERN.test(s)) throw fail("SELF_VALIDATION", `member ${path} contains private key material — refusing to package`);
    if (SECRET_PATTERN.test(s)) throw fail("SELF_VALIDATION", `member ${path} matches a credential pattern — refusing to package`);
  }

  const roleOf = {
    [MEMBER_PATHS.presentation]: ["presentation", FLOW_EXPORT_VERSION],
    [MEMBER_PATHS.evidence]: ["evidence", EVIDENCE_SCHEMA],
    [MEMBER_PATHS.attestation]: ["attestation", ATTESTATION_SCHEMA],
    [MEMBER_PATHS.verification]: ["verification-derived", VERIFICATION_SCHEMA],
    [MEMBER_PATHS.provenance]: ["provenance", PROVENANCE_SCHEMA],
    [MEMBER_PATHS.evidenceKey]: ["public-key", PUBLIC_KEY_SCHEMA],
    [MEMBER_PATHS.packageKey]: ["public-key", PUBLIC_KEY_SCHEMA],
  };
  const assets = [...files.entries()]
    .map(([path, bytes]) => ({
      path,
      role: roleOf[path][0],
      schema_version: roleOf[path][1],
      byte_size: bytes.length,
      sha256: sha256Hex(bytes),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const unsigned = {
    manifest_version: PACKAGE_VERSION,
    package_id: computePackageId(assets),
    case_id: flowExport.case_id,
    bindings: { case_id: flowExport.case_id, evidence_session_id: sessionId },
    source,
    built_at: builtAt,
    producer: { name: "shadow-mentor", cli: "shadow-audit-package", version: producerVersion, build_commit: buildCommit },
    canonicalization_version: CANON_VERSION,
    signing: {
      profile: SIGNING_PROFILE,
      key_provenance: keyProvenance,
      key_label: keyLabel,
      package_public_key_path: MEMBER_PATHS.packageKey,
      package_public_key_fingerprint_sha256: fullKeyFingerprint(packagePublicKeyPem),
      evidence_public_key_path: MEMBER_PATHS.evidenceKey,
      evidence_public_key_fingerprint_sha256: fullKeyFingerprint(evidencePublicKeyPem),
    },
    capability_boundary: [
      "FIXTURE_ONLY",
      "TAMPER_EVIDENCE_ONLY",
      "SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS",
      "NO_PHYSICAL_CLAIM",
      "KEY_ROTATION_NOT_IMPLEMENTED",
      "KEY_REVOCATION_NOT_IMPLEMENTED",
    ],
    assets,
  };
  // reuse the existing manifest-signing precedent: Ed25519 over canonicalize(manifest minus signature)
  const manifest = signManifest(unsigned, packagePrivateKeyPem);
  files.set(MEMBER_PATHS.manifest, Buffer.from(stableStringify(manifest), "utf8"));
  return { files, manifest };
}

function deepFreeze(x) {
  if (x && typeof x === "object") { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}

// ---------------------------------------------------------------------------
// verification (independent path — reads a package directory, fail-closed)
// ---------------------------------------------------------------------------

function walkDir(root) {
  const out = [];
  const walk = (rel) => {
    const abs = rel ? join(root, rel) : root;
    for (const name of readdirSync(abs).sort()) {
      const childRel = rel ? `${rel}/${name}` : name;
      const st = lstatSync(join(root, childRel));
      if (st.isSymbolicLink()) out.push({ path: childRel, symlink: true });
      else if (st.isDirectory()) walk(childRel);
      else out.push({ path: childRel, size: st.size });
    }
  };
  walk("");
  return out;
}

// Verify a package directory. Returns a deterministic result object:
//   { ok, verdict, failures[], manifest_version, package_id, case_id,
//     evidence_session_id, key_provenance, checks[], boundary }
// `publicKeyPem` (optional) is an out-of-band package key; when omitted the
// embedded key member is used — which supports TAMPER-EVIDENCE ONLY, never
// key-identity trust (out-of-band fingerprint comparison stays the operator's job).
export function verifyPackageDir(dir, { publicKeyPem = null } = {}) {
  const failures = [];
  const checks = [];
  const addFail = (code, detail) => failures.push({ code, detail });
  const check = (name, ok) => checks.push({ check: name, ok });
  const result = (extra = {}) => ({
    ok: failures.length === 0,
    verdict: failures.length === 0
      ? (extra.key_provenance === "fixture" ? "VERIFIED_FIXTURE_KEY" : "VERIFIED")
      : "FAILED",
    failures,
    checks,
    boundary: BOUNDARY_STATEMENT,
    ...extra,
  });

  // 1 · manifest presence + parse (parse errors are the caller's I/O class)
  let manifestBytes;
  try { manifestBytes = readFileSync(join(dir, MEMBER_PATHS.manifest)); }
  catch { addFail("MANIFEST_MISSING", "manifest.json not found in package directory"); return result(); }
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString("utf8")); }
  catch (e) { const err = new Error(`manifest.json is not valid JSON: ${e.message}`); err.code = "IO"; throw err; }

  // 2 · version gate — never best-effort
  if (manifest?.manifest_version !== PACKAGE_VERSION) {
    addFail("UNSUPPORTED", `manifest_version ${JSON.stringify(manifest?.manifest_version)} is not ${PACKAGE_VERSION}`);
    return result();
  }
  check("manifest_version", true);

  // 3 · structural validation
  const structural = [];
  if (typeof manifest.package_id !== "string" || !/^[0-9a-f]{64}$/.test(manifest.package_id)) structural.push("package_id must be a 64-hex sha256");
  if (typeof manifest.case_id !== "string" || !manifest.case_id) structural.push("case_id missing");
  if (typeof manifest.bindings !== "object" || manifest.bindings === null) structural.push("bindings missing");
  else {
    if (typeof manifest.bindings.case_id !== "string" || !manifest.bindings.case_id) structural.push("bindings.case_id missing");
    if (typeof manifest.bindings.evidence_session_id !== "string" || !manifest.bindings.evidence_session_id) structural.push("bindings.evidence_session_id missing");
  }
  if (typeof manifest.built_at !== "string" || !manifest.built_at) structural.push("built_at missing");
  if (typeof manifest.source !== "string" || !manifest.source) structural.push("source missing");
  if (typeof manifest.producer !== "object" || manifest.producer === null || typeof manifest.producer.version !== "string") structural.push("producer identity missing");
  if (manifest.canonicalization_version !== CANON_VERSION) structural.push(`canonicalization_version must be ${CANON_VERSION}`);
  if (typeof manifest.signing !== "object" || manifest.signing === null) structural.push("signing block missing");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) structural.push("assets must be a non-empty array");
  if (!Array.isArray(manifest.capability_boundary)) structural.push("capability_boundary missing");
  else {
    for (const t of MANDATORY_CAPABILITY_TOKENS) if (!manifest.capability_boundary.includes(t)) structural.push(`capability_boundary must declare ${t}`);
  }
  if (structural.length) { for (const s of structural) addFail("MANIFEST_MALFORMED", s); return result(); }
  check("manifest_structure", true);

  // capability boundary: closed vocabulary — an unknown claim is unsupported, never ignored
  for (const t of manifest.capability_boundary) {
    if (!CAPABILITY_TOKENS.includes(t)) addFail("UNSUPPORTED", `unknown capability claim: ${t}`);
  }

  // 4 · declared-path safety (before touching any member on disk)
  const seenExact = new Set(), seenFolded = new Set();
  for (const a of manifest.assets) {
    const pathErr = memberPathError(a?.path);
    if (pathErr) { addFail("PATH_UNSAFE", `${JSON.stringify(a?.path)}: ${pathErr}`); continue; }
    if (seenExact.has(a.path)) addFail("PATH_UNSAFE", `duplicate member declaration: ${a.path}`);
    else if (seenFolded.has(a.path.toLowerCase())) addFail("PATH_UNSAFE", `case-colliding member declaration: ${a.path}`);
    seenExact.add(a.path); seenFolded.add(a.path.toLowerCase());
    if (!Number.isInteger(a.byte_size) || a.byte_size < 0) addFail("MANIFEST_MALFORMED", `${a.path}: byte_size must be a non-negative integer`);
    if (typeof a.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(a.sha256)) addFail("MANIFEST_MALFORMED", `${a.path}: sha256 must be 64-hex`);
  }
  if (failures.length) return result();
  check("member_paths_safe", true);

  // 5 · roles + schema versions (closed sets); uniqueness; required roles
  const byRole = new Map();
  for (const a of manifest.assets) {
    if (!ROLES.includes(a.role)) { addFail("UNSUPPORTED", `unknown member role: ${a.role} (${a.path})`); continue; }
    if (!(ROLE_SCHEMAS[a.role] || []).includes(a.schema_version)) addFail("UNSUPPORTED", `unsupported schema_version ${JSON.stringify(a.schema_version)} for role ${a.role} (${a.path})`);
    byRole.set(a.role, (byRole.get(a.role) || []).concat([a]));
  }
  for (const role of UNIQUE_ROLES) if ((byRole.get(role) || []).length > 1) addFail("MANIFEST_MALFORMED", `role ${role} declared more than once`);
  for (const role of REQUIRED_ROLES) if (!(byRole.get(role) || []).length) addFail("INCOMPLETE", `required role missing from manifest: ${role}`);
  if (failures.length) return result();
  check("roles_and_schemas", true);

  // 6 · signing profile
  const signing = manifest.signing;
  if (typeof signing.profile === "string" && signing.profile.startsWith("hmac")) {
    addFail("NOT_PORTABLE", "HMAC-signed packages are not portable (verification would require the signing secret)");
    return result();
  }
  if (signing.profile !== SIGNING_PROFILE) { addFail("UNSUPPORTED", `unsupported signing profile: ${signing.profile}`); return result(); }
  if (!KEY_PROVENANCES.includes(signing.key_provenance)) { addFail("UNSUPPORTED", `unknown key_provenance: ${signing.key_provenance}`); return result(); }
  check("signing_profile", true);

  // 7 · package public key (out-of-band override, else embedded member)
  let pkPem = publicKeyPem;
  if (!pkPem) {
    try { pkPem = readFileSync(join(dir, signing.package_public_key_path), "utf8"); }
    catch { addFail("UNVERIFIABLE", `declared package public key not readable: ${signing.package_public_key_path}`); return result(); }
  }
  let pkFingerprint;
  try { pkFingerprint = fullKeyFingerprint(pkPem); }
  catch { addFail("UNVERIFIABLE", "package public key is not a usable SPKI PEM"); return result(); }
  if (pkFingerprint !== signing.package_public_key_fingerprint_sha256) {
    addFail("KEY_FINGERPRINT_MISMATCH", "package public key fingerprint does not match the signed manifest");
  }
  check("key_fingerprint", pkFingerprint === signing.package_public_key_fingerprint_sha256);

  // 8 · manifest signature (Ed25519 over canonical manifest minus signature)
  if (typeof manifest.signature !== "string" || !manifest.signature) {
    addFail("MANIFEST_SIGNATURE_MISSING", "manifest.signature is missing");
    return result();
  }
  let sigOk = false;
  try { sigOk = edVerify(null, signedBytesOf(manifest), createPublicKey(pkPem), Buffer.from(manifest.signature, "base64")); }
  catch { sigOk = false; }
  if (!sigOk) { addFail("MANIFEST_SIGNATURE_FAILED", "Ed25519 signature does not verify over the canonical manifest"); return result(); }
  check("manifest_signature", true);

  // 9 · two-way completeness (walk actual files; symlinks are never members)
  const actual = walkDir(dir);
  for (const f of actual) if (f.symlink) addFail("PATH_UNSAFE", `symlink inside package: ${f.path}`);
  const actualPaths = new Set(actual.filter((f) => !f.symlink).map((f) => f.path));
  const declaredPaths = new Set(manifest.assets.map((a) => a.path));
  for (const a of manifest.assets) if (!actualPaths.has(a.path)) addFail("INCOMPLETE", `declared member missing: ${a.path}`);
  for (const p of actualPaths) if (p !== MEMBER_PATHS.manifest && !declaredPaths.has(p)) addFail("UNEXPECTED_MEMBER", `undeclared file in package: ${p}`);
  if (failures.length) return result({ package_id: manifest.package_id, case_id: manifest.case_id, key_provenance: signing.key_provenance });
  check("two_way_completeness", true);

  // 10 · per-member byte size + sha256
  const memberBytes = new Map();
  for (const a of manifest.assets) {
    const bytes = readFileSync(join(dir, a.path));
    memberBytes.set(a.path, bytes);
    if (bytes.length !== a.byte_size) addFail("TAMPERED", `${a.path}: byte_size ${bytes.length} != declared ${a.byte_size}`);
    else if (sha256Hex(bytes) !== a.sha256) addFail("TAMPERED", `${a.path}: sha256 mismatch`);
  }
  if (failures.length) return result({ package_id: manifest.package_id, case_id: manifest.case_id, key_provenance: signing.key_provenance });
  check("member_hashes", true);

  // 11 · bindings: package_id, case↔session, cross-member consistency
  if (computePackageId(manifest.assets) !== manifest.package_id) addFail("BINDING_MISMATCH", "package_id does not derive from the member hashes");
  if (manifest.bindings.case_id !== manifest.case_id) addFail("BINDING_MISMATCH", "bindings.case_id != case_id");

  const parseMember = (path, label) => {
    try { return JSON.parse(memberBytes.get(path).toString("utf8")); }
    catch (e) { addFail("MEMBER_MALFORMED", `${label} member is not valid JSON: ${e.message}`); return null; }
  };
  const presPath = byRole.get("presentation")[0].path;
  const evPath = byRole.get("evidence")[0].path;
  const presentation = parseMember(presPath, "presentation");
  const bundle = parseMember(evPath, "evidence");
  if (presentation) {
    if (presentation.schema_version !== FLOW_EXPORT_VERSION) addFail("BINDING_MISMATCH", "presentation member schema_version != declared");
    if (presentation.case_id !== manifest.case_id) addFail("BINDING_MISMATCH", `presentation case_id ${JSON.stringify(presentation.case_id)} != manifest case_id`);
  }
  if (bundle) {
    if (bundle.spec_version !== EVIDENCE_SCHEMA) addFail("BINDING_MISMATCH", "evidence member spec_version != declared");
    if (bundle?.header?.session_id !== manifest.bindings.evidence_session_id) {
      addFail("BINDING_MISMATCH", `evidence session_id ${JSON.stringify(bundle?.header?.session_id)} != bindings.evidence_session_id`);
    }
  }
  check("bindings", failures.length === 0);
  if (failures.length) return result({ package_id: manifest.package_id, case_id: manifest.case_id, key_provenance: signing.key_provenance });

  const summary = {
    manifest_version: manifest.manifest_version,
    package_id: manifest.package_id,
    case_id: manifest.case_id,
    evidence_session_id: manifest.bindings.evidence_session_id,
    key_provenance: signing.key_provenance,
  };

  // 12 · internal evidence verification (independent re-derivation)
  const evAlg = bundle?.signatures?.[0]?.algorithm;
  if (typeof evAlg === "string" && evAlg.startsWith("hmac")) {
    addFail("NOT_PORTABLE", "evidence bundle is HMAC-signed — not portable");
    return result(summary);
  }
  let evidenceKeyPem = null;
  try { evidenceKeyPem = memberBytes.get(signing.evidence_public_key_path).toString("utf8"); }
  catch { addFail("UNVERIFIABLE", "declared evidence public key member missing"); return result(summary); }
  if (fullKeyFingerprint(evidenceKeyPem) !== signing.evidence_public_key_fingerprint_sha256) {
    addFail("KEY_FINGERPRINT_MISMATCH", "evidence public key fingerprint does not match the signed manifest");
    return result(summary);
  }
  const derived = verifyBundle(bundle, { publicKey: evidenceKeyPem });
  if (!derived.ok) {
    addFail("EVIDENCE_VERIFICATION_FAILED", `${derived.reason}: ${derived.detail ?? ""}`);
    return result(summary);
  }
  check("evidence_bundle", true);

  // 13 · attestation consistency (where present)
  const attAssets = byRole.get("attestation") || [];
  if (attAssets.length === 1) {
    const att = parseMember(attAssets[0].path, "attestation");
    if (att) {
      if (att.version !== ATTESTATION_SCHEMA) addFail("ATTESTATION_INCONSISTENT", `attestation version ${JSON.stringify(att.version)} != declared ${ATTESTATION_SCHEMA}`);
      if (att.mode === "hmac-sha256") addFail("NOT_PORTABLE", "attestation is HMAC-mode — not portable");
      else if (att.mode !== "ed25519") addFail("ATTESTATION_INCONSISTENT", `attestation mode ${JSON.stringify(att.mode)} unsupported`);
      if (typeof att.signature !== "string" || !att.signature) addFail("ATTESTATION_INCONSISTENT", "attestation has no signature");
    }
    check("attestation_consistency", failures.length === 0);
  }

  // 14 · shipped verification-result vs independent re-derivation
  const verPath = byRole.get("verification-derived")[0].path;
  const shipped = parseMember(verPath, "verification-derived");
  if (shipped) {
    if (shipped.derived !== true) addFail("VERIFIER_DISAGREEMENT", "shipped verification-result does not declare itself derived");
    const fresh = { ok: derived.ok, trust_level: derived.trustLevel, anchors: derived.anchors };
    if (canonicalize(shipped.result) !== canonicalize(fresh)) {
      addFail("VERIFIER_DISAGREEMENT", "shipped verification-result disagrees with independent re-derivation — never trust the shipped copy");
    }
    if (shipped.evidence_session_id !== manifest.bindings.evidence_session_id) {
      addFail("VERIFIER_DISAGREEMENT", "shipped verification-result names a different evidence session");
    }
  }
  check("verification_rederived", failures.length === 0);

  return result(summary);
}
