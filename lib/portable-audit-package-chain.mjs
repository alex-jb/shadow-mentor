// lib/portable-audit-package-chain.mjs
//
// Supersession chain verification over a SUPPLIED SET of portable audit package
// directories (shadow-portable-audit-package/1.0 + /1.1). Companion to
// lib/portable-audit-package.mjs per the committed ADR
// (docs/portable-audit-package/PACKAGE_SUPERSESSION_ADR.md).
//
// Semantics (fail-closed, deterministic, order-insensitive):
//   1. Every supplied package is verified independently first (verifyPackageDir).
//   2. Links come ONLY from each 1.1 package's signed `supersedes` block.
//      A 1.0 package is never a successor; a supersedes-shaped field inside a 1.0
//      manifest is reported (SUPERSESSION_MALFORMED) — standalone 1.0 verification
//      is deliberately untouched.
//   3. Predecessor resolution: match by predecessor_package_id, then confirm
//      predecessor_manifest_sha256 over the actual manifest.json bytes. A manifest-hash
//      match under a different package_id is PREDECESSOR_ID_MISMATCH; an id match with
//      different manifest bytes is PREDECESSOR_MANIFEST_MISMATCH; neither is
//      PREDECESSOR_NOT_SUPPLIED (reported honestly, never guessed around).
//   4. Cycles, forks, duplicates, disconnected/broken chains, and unsupported version
//      transitions are reported — never silently resolved.
//   5. The head of a valid chain is the LOCALLY OBSERVED head of the supplied set only.
//      It is NEVER a claim of global latest/freshest: any number of newer packages may
//      exist outside the supplied set.
//
// A valid chain proves linkage + tamper-evidence only — never business correctness,
// never Human Review or Approval (no such semantics exist in this contract), and never
// that any package is the globally current one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalize, sha256Hex } from "../verify/verify-manifest.mjs";
import {
  verifyPackageDir, MEMBER_PATHS, PACKAGE_VERSION, PACKAGE_VERSION_1_1,
  SUPPORTED_PREDECESSOR_VERSIONS,
} from "./portable-audit-package.mjs";

// Closed chain-verification failure vocabulary — deterministic, never extended ad hoc.
export const CHAIN_FAILURE_CODES = Object.freeze([
  "PREDECESSOR_NOT_SUPPLIED",     // a signed claim references a package absent from the supplied set
  "PREDECESSOR_INVALID",          // the resolved predecessor fails its own package verification
  "PREDECESSOR_ID_MISMATCH",      // manifest bytes match the claim but the package_id claim does not
  "PREDECESSOR_MANIFEST_MISMATCH",// package_id matches but the predecessor manifest bytes differ
  "CASE_MISMATCH",                // resolved predecessor's case != the signed same-case claim
  "SESSION_RELATION_MISMATCH",    // resolved predecessor's evidence session != the signed claim
  "SELF_REFERENCE",               // a package claims itself as its own predecessor
  "CHAIN_BROKEN",                 // supplied set does not form one connected linear chain
  "CHAIN_CYCLE",                  // supersession claims form a cycle
  "CHAIN_FORK",                   // two or more supplied packages claim the same predecessor
  "DUPLICATE_PACKAGE",            // the same package_id supplied more than once
  "UNSUPPORTED_TRANSITION",       // claimed/actual predecessor contract version outside the closed set
  "SUPERSESSION_MALFORMED",       // supersedes-shaped data where the contract defines none (e.g. 1.0)
  "PACKAGE_TAMPERED",             // a supplied package failed verification with TAMPERED
  "PACKAGE_UNSUPPORTED",          // a supplied package failed verification with UNSUPPORTED
  "PACKAGE_INVALID",              // a supplied package failed verification for any other reason
]);

export const CHAIN_VERDICTS = Object.freeze(["SUPERSESSION_VALID", "SUPERSESSION_FAILED"]);

export const CHAIN_BOUNDARY_STATEMENT =
  "A valid supersession chain proves linkage and tamper-evidence over the SUPPLIED packages only — " +
  "never business correctness, and never that the local chain head is the globally latest package.";

function classifyPackageFailure(failures) {
  const codes = new Set(failures.map((f) => f.code));
  if (codes.has("TAMPERED")) return "PACKAGE_TAMPERED";
  if (codes.has("UNSUPPORTED")) return "PACKAGE_UNSUPPORTED";
  return "PACKAGE_INVALID";
}

// Verify a supersession chain across package directories.
// dirs: string[] of package directories (order-insensitive; 1..N).
// Options:
//   publicKeyPem          — optional out-of-band package key (as in verifyPackageDir)
//   requireCompleteChain  — default true: a signed claim whose predecessor is absent
//     from the supplied set is a chain failure (PREDECESSOR_NOT_SUPPLIED). When false
//     (used by `create --supersedes` self-checks, where only the NEW link's predecessor
//     is supplied), such claims are reported in `unresolved_references` instead — they
//     are still never treated as verified links.
// Returns a deterministic result object:
//   { ok, verdict, packages[], links[], chain_failures[], unresolved_references[],
//     local_head, local_heads[], order[], boundary }
export function verifyPackageChain(dirs, { publicKeyPem = null, requireCompleteChain = true } = {}) {
  if (!Array.isArray(dirs) || dirs.length === 0) {
    const err = new Error("verifyPackageChain requires at least one package directory");
    err.code = "USAGE";
    throw err;
  }

  const chainFailures = [];
  const unresolvedReferences = [];
  const addChainFail = (code, detail) => chainFailures.push({ code, detail });

  // 1 · independent per-package verification + immutable manifest identity
  const entries = dirs.map((dir) => {
    const res = verifyPackageDir(dir, { publicKeyPem }); // may throw I/O — caller's class
    let manifestSha256 = null;
    let manifest = null;
    try {
      const bytes = readFileSync(join(dir, MEMBER_PATHS.manifest));
      manifestSha256 = sha256Hex(bytes);
      manifest = JSON.parse(bytes.toString("utf8"));
    } catch { /* unreadable manifest already reported by verifyPackageDir */ }
    return {
      dir,
      package_id: res.package_id ?? manifest?.package_id ?? null,
      manifest_version: res.manifest_version ?? manifest?.manifest_version ?? null,
      case_id: res.case_id ?? manifest?.case_id ?? null,
      evidence_session_id: res.evidence_session_id ?? manifest?.bindings?.evidence_session_id ?? null,
      manifest_sha256: manifestSha256,
      supersedes: manifest?.supersedes ?? null,
      package_ok: res.ok,
      package_verdict: res.verdict,
      package_failures: res.failures,
      is_local_head: false,
    };
  });

  for (const e of entries) {
    if (!e.package_ok) addChainFail(classifyPackageFailure(e.package_failures),
      `${e.dir}: package verification failed (${e.package_failures.map((f) => f.code).join(", ") || "no manifest"})`);
    // supersession is only DEFINED for 1.1 — a 1.0 manifest carrying supersedes-shaped
    // data is never interpreted as a link (and standalone 1.0 verification is untouched).
    if (e.manifest_version === PACKAGE_VERSION && e.supersedes != null) {
      addChainFail("SUPERSESSION_MALFORMED",
        `${e.dir}: a ${PACKAGE_VERSION} manifest carries a supersedes field — supersession is not part of the 1.0 contract`);
      e.supersedes = null;
    }
  }

  // 2 · duplicates (by package_id; unidentifiable packages cannot be deduplicated)
  const byId = new Map();
  for (const e of entries) {
    if (!e.package_id) continue;
    if (byId.has(e.package_id)) addChainFail("DUPLICATE_PACKAGE", `package ${e.package_id} supplied more than once (${byId.get(e.package_id).dir}, ${e.dir})`);
    else byId.set(e.package_id, e);
  }
  const byManifestSha = new Map();
  for (const e of entries) {
    if (e.manifest_sha256 && !byManifestSha.has(e.manifest_sha256)) byManifestSha.set(e.manifest_sha256, e);
  }

  // 3 · link resolution from signed claims (successors are 1.1 packages only)
  const links = [];
  for (const e of entries) {
    if (e.manifest_version !== PACKAGE_VERSION_1_1 || !e.supersedes) continue;
    const sup = e.supersedes;
    const link = {
      successor_package_id: e.package_id,
      successor_dir: e.dir,
      predecessor_package_id: sup.predecessor_package_id ?? null,
      resolved: false,
      failures: [],
    };
    const linkFail = (code, detail) => { link.failures.push({ code, detail }); addChainFail(code, detail); };

    if (sup.predecessor_package_id === e.package_id) {
      // also a package-level SELF_REFERENCE failure; restated here so the chain
      // result is complete on its own
      linkFail("SELF_REFERENCE", `${e.dir}: package claims itself as its own predecessor`);
      links.push(link);
      continue;
    }
    if (!SUPPORTED_PREDECESSOR_VERSIONS.includes(sup.predecessor_manifest_version)) {
      linkFail("UNSUPPORTED_TRANSITION",
        `${e.dir}: claims a ${JSON.stringify(sup.predecessor_manifest_version)} predecessor (supported: ${SUPPORTED_PREDECESSOR_VERSIONS.join(", ")})`);
    }

    const target = byId.get(sup.predecessor_package_id) ?? null;
    if (target) {
      if (target.manifest_sha256 !== sup.predecessor_manifest_sha256) {
        linkFail("PREDECESSOR_MANIFEST_MISMATCH",
          `${e.dir}: predecessor ${sup.predecessor_package_id} was supplied but its manifest bytes do not match the signed claim — a changed or substituted predecessor is rejected`);
        links.push(link);
        continue;
      }
      if (!target.package_ok) {
        linkFail("PREDECESSOR_INVALID", `${e.dir}: predecessor ${target.dir} fails its own package verification`);
        links.push(link);
        continue;
      }
      if (target.manifest_version !== sup.predecessor_manifest_version) {
        linkFail("UNSUPPORTED_TRANSITION",
          `${e.dir}: signed claim says predecessor is ${sup.predecessor_manifest_version} but the supplied predecessor is ${target.manifest_version}`);
      }
      if (target.case_id !== sup.predecessor_case_id) {
        linkFail("CASE_MISMATCH",
          `${e.dir}: predecessor case ${JSON.stringify(target.case_id)} != signed claim ${JSON.stringify(sup.predecessor_case_id)} — packages of different cases can never supersede each other`);
      }
      if (sup.predecessor_evidence_session_id !== null && target.evidence_session_id !== sup.predecessor_evidence_session_id) {
        linkFail("SESSION_RELATION_MISMATCH",
          `${e.dir}: predecessor evidence session ${JSON.stringify(target.evidence_session_id)} != signed claim ${JSON.stringify(sup.predecessor_evidence_session_id)}`);
      }
      link.resolved = link.failures.length === 0;
      links.push(link);
      continue;
    }

    // no package_id match — was the RIGHT manifest supplied under a WRONG id claim?
    const shaMatch = byManifestSha.get(sup.predecessor_manifest_sha256) ?? null;
    if (shaMatch) {
      linkFail("PREDECESSOR_ID_MISMATCH",
        `${e.dir}: signed predecessor_package_id ${sup.predecessor_package_id} does not match the supplied package ${shaMatch.package_id} whose manifest bytes match the signed manifest hash`);
    } else if (requireCompleteChain) {
      linkFail("PREDECESSOR_NOT_SUPPLIED",
        `${e.dir}: predecessor ${sup.predecessor_package_id} is not among the supplied packages — the chain cannot be confirmed (this is an honest report, not a package failure)`);
    } else {
      link.unresolved = true;
      unresolvedReferences.push({
        successor_package_id: e.package_id,
        predecessor_package_id: sup.predecessor_package_id,
        detail: `${e.dir}: predecessor ${sup.predecessor_package_id} was not supplied — link not confirmed`,
      });
    }
    links.push(link);
  }

  // 4 · graph shape over CLAIMED links (cycle/fork detection must not depend on
  //     hash checks passing — a forged claim graph is still a reported cycle/fork)
  const claimedEdges = new Map(); // successor id → claimed predecessor id
  for (const l of links) {
    if (l.successor_package_id && l.predecessor_package_id) claimedEdges.set(l.successor_package_id, l.predecessor_package_id);
  }
  // forks: >1 supplied successor claiming the same predecessor
  const claimants = new Map();
  for (const [succ, pred] of claimedEdges) claimants.set(pred, (claimants.get(pred) || []).concat([succ]));
  for (const [pred, succs] of [...claimants.entries()].sort()) {
    if (succs.length > 1 && byId.has(pred)) {
      addChainFail("CHAIN_FORK", `package ${pred} is claimed as predecessor by ${succs.length} supplied packages (${succs.sort().join(", ")}) — forks are reported, never silently resolved`);
    }
  }
  // cycles: walk claimed edges within the supplied set
  const inCycle = new Set();
  for (const start of [...claimedEdges.keys()].sort()) {
    let cur = start;
    const seen = new Set();
    while (claimedEdges.has(cur) && byId.has(claimedEdges.get(cur))) {
      if (seen.has(cur)) {
        if (!inCycle.has(cur)) {
          addChainFail("CHAIN_CYCLE", `supersession claims form a cycle through package ${cur}`);
          for (const s of seen) inCycle.add(s);
        }
        break;
      }
      seen.add(cur);
      cur = claimedEdges.get(cur);
    }
  }

  // 5 · local-head + linearity over the supplied set
  const referenced = new Set([...claimedEdges.values()].filter((id) => byId.has(id)));
  const heads = [...byId.values()].filter((e) => !referenced.has(e.package_id));
  for (const h of heads) h.is_local_head = true;
  const localHeads = heads.map((h) => h.package_id).sort();

  if (byId.size > 0 && localHeads.length === 0) {
    // every supplied package is referenced → pure cycle; already reported above
  } else if (localHeads.length > 1) {
    addChainFail("CHAIN_BROKEN",
      `supplied packages do not form one connected chain — ${localHeads.length} possible local heads observed (${localHeads.join(", ")})`);
  }

  // root→head order (only meaningful when the chain is a single linear sequence);
  // the walk never follows a claimed edge OUT of the supplied set
  let order = [];
  if (localHeads.length === 1 && chainFailures.length === 0) {
    let cur = localHeads[0];
    const seq = [cur];
    while (claimedEdges.has(cur) && byId.has(claimedEdges.get(cur))) { cur = claimedEdges.get(cur); seq.push(cur); }
    order = seq.reverse();
    if (order.length !== byId.size) {
      addChainFail("CHAIN_BROKEN", "supplied packages are not all part of one linear chain");
      order = [];
    }
  }

  const ok = chainFailures.length === 0;
  return {
    ok,
    verdict: ok ? "SUPERSESSION_VALID" : "SUPERSESSION_FAILED",
    // deterministic + order-insensitive: sort by package_id (unidentifiable last, by dir)
    packages: [...entries].sort((a, b) =>
      String(a.package_id ?? `~${a.dir}`).localeCompare(String(b.package_id ?? `~${b.dir}`)))
      .map(({ dir, package_id, manifest_version, case_id, evidence_session_id, manifest_sha256, supersedes, package_ok, package_verdict, package_failures, is_local_head }) =>
        ({ dir, package_id, manifest_version, case_id, evidence_session_id, manifest_sha256, supersedes, package_ok, package_verdict, package_failures, is_local_head })),
    links: [...links].sort((a, b) => String(a.successor_package_id).localeCompare(String(b.successor_package_id))),
    chain_failures: dedupeFailures(chainFailures),
    unresolved_references: unresolvedReferences,
    local_head: ok && localHeads.length === 1 ? localHeads[0] : null,
    local_heads: localHeads,
    order,
    boundary: CHAIN_BOUNDARY_STATEMENT,
  };
}

function dedupeFailures(failures) {
  const seen = new Set();
  return failures.filter((f) => {
    const k = canonicalize(f);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
