// apps/shadow-lens/backend/build-evidence-session.mjs
// GENERIC (profile-agnostic) evidence-session builder. Seals a REAL attest-core bundle from a
// provided event list — no banking/document assumptions — then assembles a base Shadow Lens
// session and attaches the profile extension. Banking's build-session.mjs is one caller shape;
// this is the shape data-science + coding-agent replays use. Signing is server-side only.
import { createSession, appendEvent, sealSession, verifyBundle } from "../../../packages/attest-core/session.js";
import { CONTRACT_VERSION } from "../contracts/validate.mjs";
import { validateSession } from "../contracts/profiles.mjs";
import { computeSourceMapHash } from "./analyze.mjs";

/**
 * @param {object} spec
 *  - session_id, agent:{name,version}, models:[{model_id,provider}], platform
 *  - events: [{event_type, actor, payload, extensions?}]  (the real recorded chain)
 *  - source_map, claims, profile:{name,data}
 *  - signingKeyPem (PKCS8), publicKeyPem (SPKI), keyId?
 * @returns {{session, bundle, verified, valid, validation_errors, profile}}
 */
export function buildEvidenceSession(spec) {
  const {
    session_id, agent, models = [], platform = "cli", events = [],
    source_map = [], claims = [], profile = null,
    signingKeyPem, publicKeyPem, keyId = "shadow-evidence-demo",
  } = spec;

  const s = createSession({
    agent, models, environmentFingerprint: { os: platform, node_version: "n/a" },
    keyId, privateKey: signingKeyPem,
  });
  for (const e of events) appendEvent(s, e);
  const bundle = sealSession(s);
  const verified = verifyBundle(bundle, { publicKey: publicKeyPem });

  const source_map_hash = computeSourceMapHash(source_map);
  const session = {
    contract_version: CONTRACT_VERSION,
    session_id,
    build: { app_commit: agent?.version ?? "0" },
    device: { platform },
    source_map,
    claims,
    provenance: { source_map_hash, ...(profile ? { profile: profile.name } : {}) },
    verification: {
      record_integrity: verified.ok ? "verified" : "failed",
      failed_seq: verified.ok ? null : (verified.failedSeq ?? null),
      external_anchor: "none",
      source_coverage_pct: coverage(claims, source_map),
      human_review: profile?.data?.human_approval ? "approved" : "pending",
    },
    ...(profile ? { profile } : {}),
  };

  const v = validateSession(session);
  return { session, bundle, verified, valid: v.valid, validation_errors: v.errors, profile: v.profile };
}

function coverage(claims, sourceMap) {
  const total = (sourceMap || []).length;
  if (!total) return 0;
  const cited = new Set();
  for (const c of claims || []) if (c.validation_status === "source_bound") for (const id of c.source_ids || []) cited.add(id);
  return +((100 * cited.size) / total).toFixed(1);
}
