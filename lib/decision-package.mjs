// lib/decision-package.mjs
//
// Decision-successor package assembly (shadow-portable-audit-package/1.2) and
// decision-chain verification with lifecycle derivation. Companion to
// lib/decision-amendment.mjs (contract semantics) and
// lib/portable-audit-package.mjs (packaging + verification core).
//
// Assembly rules (fail-closed):
//   - the predecessor is verified FIRST and never touched;
//   - presentation / evidence / attestation / verification / key members are
//     carried forward from the predecessor BYTE-FOR-BYTE (a decision changes
//     no analytical content — Override never erases the original conclusion);
//   - the ONLY new content members are the signed decision member and the
//     provenance/1.2 member;
//   - every binding field in the decision member is derived by Core from the
//     verified predecessor — never copied from operator input;
//   - fixture keys only; deterministic bytes for identical inputs; the
//     signing key never appears in any member or output.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalize, sha256Hex, signManifest } from "../verify/verify-manifest.mjs";
import {
  verifyPackageDir, computePackageId, fullKeyFingerprint,
  MEMBER_PATHS, PACKAGE_VERSION_1_2, PROVENANCE_SCHEMA_1_2,
  SUPERSESSION_RELATION, SUPPORTED_PACKAGE_VERSIONS,
  CANON_VERSION, SIGNING_PROFILE, EVIDENCE_SCHEMA, ATTESTATION_SCHEMA, VERIFICATION_SCHEMA, PUBLIC_KEY_SCHEMA,
} from "./portable-audit-package.mjs";
import { FLOW_EXPORT_VERSION } from "../apps/shadow-lens/flow/flow-export-contract.mjs";
import { verifyPackageChain } from "./portable-audit-package-chain.mjs";
import {
  DECISION_SCHEMA, DECISION_STATUS_TOKENS, DECISION_BOUNDARY_STATEMENT,
  COUNCIL_EXTRACT_SCHEMA, deriveCouncilDecisionExtract, computeDecisionId,
  validateDecisionIntent, validateDecisionMember, packageDecisionState,
  transitionError, deriveDecisionLifecycle, normalizeText,
} from "./decision-amendment.mjs";

export const DECISION_MARKER = "DECISION_AMENDMENT";

// mirror of the assembly privacy gate in lib/portable-audit-package.mjs
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const SECRET_PATTERN = /sk-ant-|AIza[0-9A-Za-z_-]{10}|aws_secret|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + "\n"; // UTF-8, LF, trailing newline — repo convention
}

function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function memberBytesByRole(dir, manifest, role) {
  const asset = manifest.assets.find((a) => a.role === role);
  return asset ? { asset, bytes: readFileSync(join(dir, asset.path)) } : null;
}

// ---------------------------------------------------------------------------
// assembly
// ---------------------------------------------------------------------------

// Assemble a 1.2 decision-successor package in memory from a VERIFIED
// predecessor directory and a strictly validated decision intent.
// Returns { files: Map<relPath, Buffer>, manifest, decisionMember,
//           predecessor: {package_id, manifest_sha256, state} }.
// Throws { code ∈ INPUT | SELF_VALIDATION, message } (CLI exit 3 / 4).
export function assembleDecisionPackage({
  predecessorDir,
  intent,
  builtAt,                 // caller-supplied ISO string (never wall clock)
  buildCommit,
  producerVersion,
  packagePrivateKeyPem,    // fixture signing key — never persisted, never printed
  packagePublicKeyPem,
  keyLabel = "FIXTURE RELEASE KEY",
}) {
  if (typeof builtAt !== "string" || !builtAt) throw fail("INPUT", "built_at must be a caller-supplied string (never wall clock)");

  // 1 · intent gate — the intent is an operator REQUEST, never evidence
  const intentErrs = validateDecisionIntent(intent);
  if (intentErrs.length) throw fail("INPUT", `decision intent failed ${"shadow-decision-intent/1"} validation:\n  - ${intentErrs.join("\n  - ")}`);

  // 2 · predecessor gate — verified first, read-only, never mutated
  let prior;
  try { prior = verifyPackageDir(predecessorDir); }
  catch (e) { throw fail("INPUT", `cannot read the predecessor package: ${e.message}`); }
  if (!prior.ok) {
    throw fail("INPUT", `PREDECESSOR_INVALID — refusing to record a decision over a package that does not verify:\n  - ${prior.failures.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
  }
  if (!SUPPORTED_PACKAGE_VERSIONS.includes(prior.manifest_version)) {
    throw fail("INPUT", `UNSUPPORTED_TRANSITION — cannot decide over a ${prior.manifest_version} package`);
  }
  const priorManifestBytes = readFileSync(join(predecessorDir, MEMBER_PATHS.manifest));
  const priorManifest = JSON.parse(priorManifestBytes.toString("utf8"));
  const priorManifestSha256 = sha256Hex(priorManifestBytes);

  // predecessor decision member (when the predecessor is itself a 1.2 package)
  const priorDecisionEntry = memberBytesByRole(predecessorDir, priorManifest, "decision");
  const priorDecision = priorDecisionEntry ? JSON.parse(priorDecisionEntry.bytes.toString("utf8")) : null;
  const priorState = packageDecisionState(priorDecision);

  // 3 · transition gate — only committed state-machine transitions, fail closed
  const terr = transitionError(priorState, { decision_type: intent.decision_type, policy: intent.policy });
  if (terr) throw fail("INPUT", `${terr.code}: ${terr.detail}`);

  // 4 · target resolution — derived from the VERIFIED predecessor, never from input
  const presEntry = memberBytesByRole(predecessorDir, priorManifest, "presentation");
  if (!presEntry) throw fail("INPUT", "predecessor has no presentation member — the council decision target cannot be derived");
  const presentation = JSON.parse(presEntry.bytes.toString("utf8"));
  const extractResult = deriveCouncilDecisionExtract(presentation);
  if (extractResult.error) throw fail("INPUT", `cannot derive the council decision target: ${extractResult.error}`);

  let target;
  if (intent.target.type === "council_decision") {
    target = {
      type: "council_decision",
      object_id: extractResult.object_id,
      object_sha256: extractResult.sha256,
      object_schema_version: COUNCIL_EXTRACT_SCHEMA,
      prior_effective_decision_id: priorState === "OVERRIDDEN" ? priorDecision?.decision_id ?? null : null,
    };
  } else {
    // prior_decision: this increment only supports deciding on the IMMEDIATE
    // predecessor's decision (deeper targets need chain context at decide time)
    if (!priorDecision) throw fail("INPUT", "MISSING_DECISION_TARGET: target.type is prior_decision but the predecessor package carries no decision member");
    if (priorDecision.decision_id !== intent.target.decision_id) {
      throw fail("INPUT", `DECISION_TARGET_MISMATCH: target.decision_id ${intent.target.decision_id} is not the predecessor's decision (${priorDecision.decision_id}) — only the immediate predecessor decision can be decided on in this increment`);
    }
    target = {
      type: "prior_decision",
      object_id: priorDecision.decision_id,
      object_sha256: sha256Hex(priorDecisionEntry.bytes),
      object_schema_version: DECISION_SCHEMA,
      prior_effective_decision_id: priorDecision.decision_id,
    };
  }

  // 5 · type-specific semantic gates
  if (intent.decision_type === "DECISION_OVERRIDDEN") {
    if (intent.target.type !== "council_decision") throw fail("INPUT", "DECISION_TARGET_MISMATCH: an override targets the council_decision whose disposition it replaces");
    if (intent.content.previous_disposition !== extractResult.extract.recommendation) {
      throw fail("INPUT", `content.previous_disposition ${JSON.stringify(intent.content.previous_disposition)} does not match the predecessor's effective disposition ${JSON.stringify(extractResult.extract.recommendation)} — an override must state exactly what it replaces`);
    }
  }
  if (intent.decision_type === "DECISION_REJECTED" && intent.target.type !== "prior_decision") {
    throw fail("INPUT", "DECISION_TARGET_MISMATCH: a rejection targets a specific prior_decision, never the council decision itself");
  }

  // 6 · separation-of-duties (STRUCTURAL check against the DECLARED policy only —
  // fixture mode records, it never claims organizational enforcement)
  if ((intent.decision_type === "APPROVAL_GRANTED" || intent.decision_type === "DECISION_REJECTED")
      && intent.policy.separation_of_duties === "enforced"
      && priorDecision && priorDecision.actor?.actor_id === intent.actor.actor_id) {
    throw fail("INPUT", `SEPARATION_OF_DUTIES_VIOLATION: actor ${intent.actor.actor_id} authored the predecessor decision and cannot also ${intent.decision_type === "APPROVAL_GRANTED" ? "approve" : "reject"} it while the signed policy declares separation_of_duties=enforced (structural check only — organizational enforcement is NOT claimed)`);
  }

  // 7 · the signed decision member — generated field by field, nothing copied blindly
  const c = intent.content;
  const content = {
    reason_code: c.reason_code,
    reason_text: normalizeText(c.reason_text),
    ...(intent.decision_type === "HUMAN_REVIEW_COMPLETED" ? { review_outcome: c.review_outcome, reviewer_findings: normalizeText(c.reviewer_findings) } : {}),
    ...(intent.decision_type === "DECISION_OVERRIDDEN" ? { previous_disposition: c.previous_disposition, new_disposition: c.new_disposition } : {}),
    ...(intent.decision_type === "APPROVAL_GRANTED" && c.approval_conditions !== undefined ? { approval_conditions: normalizeText(c.approval_conditions) } : {}),
    ...(intent.decision_type === "DECISION_REJECTED" ? { rejection_basis: normalizeText(c.rejection_basis) } : {}),
  };
  const decisionMember = {
    decision_schema: DECISION_SCHEMA,
    decision_id: "0".repeat(64), // placeholder — derived below, excluded from content hash
    decision_type: intent.decision_type,
    predecessor: {
      package_id: prior.package_id,
      manifest_sha256: priorManifestSha256,
      manifest_version: prior.manifest_version,
    },
    case_id: prior.case_id,
    evidence_session_id: prior.evidence_session_id,
    target,
    actor: {
      actor_id: intent.actor.actor_id,
      display_name: normalizeText(intent.actor.display_name),
      role: intent.actor.role,
      identity_class: "operator_declared", // set by Core — an intent may not claim identity
    },
    authorization: { status: "DECISION_AUTHORITY_UNVERIFIED", authorization_ref: null },
    content,
    referenced_evidence: intent.referenced_evidence ?? [],
    policy: {
      review_required: intent.policy.review_required,
      approval_required: intent.policy.approval_required,
      separation_of_duties: intent.policy.separation_of_duties,
    },
    status_tokens: [...DECISION_STATUS_TOKENS],
    decided_at_utc: intent.decided_at_utc,
    effective_scope: "this_case_only",
    boundary: DECISION_BOUNDARY_STATEMENT,
  };
  decisionMember.decision_id = computeDecisionId(decisionMember);
  const memberErrs = validateDecisionMember(decisionMember);
  if (memberErrs.length) {
    throw fail("SELF_VALIDATION", `generated decision member failed ${DECISION_SCHEMA} self-validation:\n  - ${memberErrs.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
  }
  const decisionBytes = Buffer.from(stableStringify(decisionMember), "utf8");

  // 8 · carry-forward members (byte-for-byte — the original conclusion is never rewritten)
  const carried = {};
  for (const role of ["presentation", "evidence", "attestation", "verification-derived"]) {
    const entry = memberBytesByRole(predecessorDir, priorManifest, role);
    if (entry) carried[role] = entry;
  }
  const evidenceKeyAsset = priorManifest.assets.find((a) => a.path === priorManifest.signing.evidence_public_key_path);
  const evidenceKeyBytes = readFileSync(join(predecessorDir, evidenceKeyAsset.path));
  const packageKeyBytes = Buffer.from(packagePublicKeyPem.endsWith("\n") ? packagePublicKeyPem : packagePublicKeyPem + "\n", "utf8");

  // 9 · supersession link (same shape as 1.1; the marker is neutral — semantics
  // live ONLY in the decision member)
  const supersedesBlock = {
    relation: SUPERSESSION_RELATION,
    predecessor_package_id: prior.package_id,
    predecessor_manifest_sha256: priorManifestSha256,
    predecessor_manifest_version: prior.manifest_version,
    predecessor_case_id: prior.case_id,
    predecessor_evidence_session_id: prior.evidence_session_id ?? null,
    marker: DECISION_MARKER,
  };

  // 10 · provenance/1.2 member
  const provenance = {
    schema_version: PROVENANCE_SCHEMA_1_2,
    producer: { name: "shadow-mentor", cli: "shadow-audit-package", version: producerVersion },
    build_commit: buildCommit,
    built_at: builtAt,
    source: priorManifest.source,
    key_provenance: "fixture",
    member_contracts: {
      presentation: FLOW_EXPORT_VERSION,
      evidence: EVIDENCE_SCHEMA,
      ...(carried.attestation ? { attestation: ATTESTATION_SCHEMA } : {}),
      "verification-derived": VERIFICATION_SCHEMA,
      decision: DECISION_SCHEMA,
    },
    supersession: supersedesBlock,
  };
  const provenanceBytes = Buffer.from(stableStringify(provenance), "utf8");

  const files = new Map([
    [MEMBER_PATHS.presentation, Buffer.from(carried.presentation.bytes)],
    [MEMBER_PATHS.evidence, Buffer.from(carried.evidence.bytes)],
    ...(carried.attestation ? [[MEMBER_PATHS.attestation, Buffer.from(carried.attestation.bytes)]] : []),
    [MEMBER_PATHS.verification, Buffer.from(carried["verification-derived"].bytes)],
    [MEMBER_PATHS.provenance, provenanceBytes],
    [MEMBER_PATHS.decision, decisionBytes],
    [MEMBER_PATHS.evidenceKey, Buffer.from(evidenceKeyBytes)],
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
    [MEMBER_PATHS.provenance]: ["provenance", PROVENANCE_SCHEMA_1_2],
    [MEMBER_PATHS.decision]: ["decision", DECISION_SCHEMA],
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
  const packageId = computePackageId(assets);
  if (packageId === prior.package_id) throw fail("SELF_VALIDATION", "SELF_REFERENCE: successor package_id equals the predecessor package_id");

  const unsigned = {
    manifest_version: PACKAGE_VERSION_1_2,
    package_id: packageId,
    case_id: prior.case_id,
    bindings: { case_id: prior.case_id, evidence_session_id: prior.evidence_session_id },
    supersedes: supersedesBlock,
    source: priorManifest.source,
    built_at: builtAt,
    producer: { name: "shadow-mentor", cli: "shadow-audit-package", version: producerVersion, build_commit: buildCommit },
    canonicalization_version: CANON_VERSION,
    signing: {
      profile: SIGNING_PROFILE,
      key_provenance: "fixture",
      key_label: keyLabel,
      package_public_key_path: MEMBER_PATHS.packageKey,
      package_public_key_fingerprint_sha256: fullKeyFingerprint(packagePublicKeyPem),
      evidence_public_key_path: MEMBER_PATHS.evidenceKey,
      evidence_public_key_fingerprint_sha256: fullKeyFingerprint(evidenceKeyBytes.toString("utf8")),
    },
    capability_boundary: [
      "FIXTURE_ONLY",
      "TAMPER_EVIDENCE_ONLY",
      "SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS",
      "NO_PHYSICAL_CLAIM",
      "KEY_ROTATION_NOT_IMPLEMENTED",
      "KEY_REVOCATION_NOT_IMPLEMENTED",
      "SUPERSESSION_IS_NOT_GLOBAL_LATEST",
    ],
    assets,
  };
  const manifest = signManifest(unsigned, packagePrivateKeyPem);
  files.set(MEMBER_PATHS.manifest, Buffer.from(stableStringify(manifest), "utf8"));
  return {
    files,
    manifest,
    decisionMember,
    predecessor: { package_id: prior.package_id, manifest_sha256: priorManifestSha256, state: priorState },
  };
}

// ---------------------------------------------------------------------------
// decision-chain verification + lifecycle derivation
// ---------------------------------------------------------------------------

// Verify a supplied package set as a supersession chain AND derive the
// business decision lifecycle as a separate axis. Returns:
//   { ok, chain, decisions[], decision_failures[], lifecycle }
// where ok = chain valid AND no decision binding failures AND no lifecycle
// failures. Integrity, actor-identity/authorization, and lifecycle remain
// distinct axes throughout.
export function verifyDecisionChain(dirs, { publicKeyPem = null, requireCompleteChain = true } = {}) {
  const chain = verifyPackageChain(dirs, { publicKeyPem, requireCompleteChain });
  const decisionFailures = [];
  const addFail = (code, detail) => decisionFailures.push({ code, detail });

  // collect decision members from supplied 1.2 packages
  const decisions = [];
  for (const p of chain.packages) {
    if (p.manifest_version !== PACKAGE_VERSION_1_2) continue;
    let member = null, bytes = null;
    try {
      bytes = readFileSync(join(p.dir, MEMBER_PATHS.decision));
      member = JSON.parse(bytes.toString("utf8"));
    } catch { /* the package verifier already reported the broken member */ }
    decisions.push({ package_id: p.package_id, dir: p.dir, decision: member, bytes, package_ok: p.package_ok });
  }

  // duplicates / replays across the supplied set (same id may never appear twice)
  const byDecisionId = new Map();
  for (const d of decisions) {
    if (!d.decision?.decision_id) continue;
    const prev = byDecisionId.get(d.decision.decision_id);
    if (prev) {
      const identical = prev.bytes && d.bytes && prev.bytes.equals(d.bytes);
      addFail(identical ? "DECISION_REPLAYED" : "DECISION_DUPLICATE",
        `decision ${d.decision.decision_id} appears in more than one supplied package (${prev.dir}, ${d.dir})${identical ? " with identical bytes — a decision may be recorded once" : " with DIFFERENT bytes"}`);
    } else byDecisionId.set(d.decision.decision_id, d);
  }

  // target-object verification against the ACTUAL predecessor bytes (only
  // possible when the predecessor was supplied and its manifest matches)
  const pkgById = new Map(chain.packages.filter((p) => p.package_id).map((p) => [p.package_id, p]));
  for (const d of decisions) {
    const m = d.decision;
    if (!m?.target || !m?.predecessor) continue;
    const pred = pkgById.get(m.predecessor.package_id);
    if (!pred || pred.manifest_sha256 !== m.predecessor.manifest_sha256) continue; // absence already reported by the chain layer
    if (m.target.type === "council_decision") {
      try {
        const predManifest = JSON.parse(readFileSync(join(pred.dir, MEMBER_PATHS.manifest), "utf8"));
        const presAsset = predManifest.assets.find((a) => a.role === "presentation");
        const pres = JSON.parse(readFileSync(join(pred.dir, presAsset.path), "utf8"));
        const ex = deriveCouncilDecisionExtract(pres);
        if (ex.error) addFail("TARGET_OBJECT_MISMATCH", `${d.dir}: predecessor council decision cannot be re-derived (${ex.error})`);
        else if (ex.sha256 !== m.target.object_sha256 || ex.object_id !== m.target.object_id) {
          addFail("TARGET_OBJECT_MISMATCH", `${d.dir}: the signed target hash does not match the council decision re-derived from the predecessor's presentation member — a substituted council result is rejected`);
        }
      } catch (e) {
        addFail("TARGET_OBJECT_MISMATCH", `${d.dir}: predecessor presentation member unreadable (${e.message})`);
      }
    } else if (m.target.type === "prior_decision") {
      try {
        const predBytes = readFileSync(join(pred.dir, MEMBER_PATHS.decision));
        const predDecision = JSON.parse(predBytes.toString("utf8"));
        if (sha256Hex(predBytes) !== m.target.object_sha256 || predDecision.decision_id !== m.target.object_id) {
          addFail("TARGET_OBJECT_MISMATCH", `${d.dir}: the signed prior_decision target does not match the predecessor's decision member — a substituted decision is rejected`);
        }
      } catch {
        addFail("TARGET_OBJECT_MISMATCH", `${d.dir}: target.type is prior_decision but the predecessor has no readable decision member`);
      }
    }
  }

  // conflicting decision branches (a fork where ≥2 heads carry decisions)
  const forked = chain.chain_failures.some((f) => f.code === "CHAIN_FORK");
  if (forked) {
    const forkDecisions = decisions.filter((d) => d.decision);
    if (forkDecisions.length >= 2) {
      addFail("DECISION_CONFLICT", "conflicting decision branches share one predecessor — both are displayed; neither is chosen (no timestamp or import-order tiebreak)");
    }
  }

  // business lifecycle — a separate derived axis, computed ONLY over a chain
  // whose integrity and bindings fully verify
  const bindingOk = decisionFailures.length === 0;
  let originalDisposition = null;
  let nodes = [];
  if (chain.ok && chain.order.length) {
    nodes = chain.order.map((id) => {
      const entry = decisions.find((d) => d.package_id === id);
      return { package_id: id, decision: entry?.decision ?? null };
    });
    try {
      const rootPkg = pkgById.get(chain.order[0]);
      const rootManifest = JSON.parse(readFileSync(join(rootPkg.dir, MEMBER_PATHS.manifest), "utf8"));
      const presAsset = rootManifest.assets.find((a) => a.role === "presentation");
      const pres = JSON.parse(readFileSync(join(rootPkg.dir, presAsset.path), "utf8"));
      const ex = deriveCouncilDecisionExtract(pres);
      if (!ex.error) originalDisposition = ex.extract.recommendation;
    } catch { /* lifecycle falls back to a null original disposition */ }
  }
  const lifecycle = deriveDecisionLifecycle(nodes, {
    chain_ok: chain.ok && bindingOk,
    forked,
    original_disposition: originalDisposition,
  });

  return {
    ok: chain.ok && bindingOk && lifecycle.failures.length === 0,
    chain,
    decisions: decisions.map(({ package_id, dir, decision, package_ok }) => ({
      package_id, dir, package_ok,
      decision_id: decision?.decision_id ?? null,
      decision_type: decision?.decision_type ?? null,
      actor_id: decision?.actor?.actor_id ?? null,
      actor_role: decision?.actor?.role ?? null,
      status_tokens: decision?.status_tokens ?? [],
    })),
    decision_failures: decisionFailures,
    lifecycle,
  };
}
