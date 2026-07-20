// apps/shadow-lens/backend/lens-api.mjs
// The staged Shadow Lens session lifecycle, as pure async functions over a store + token.
// One HTTP endpoint dispatches to these by stage; they're testable without a server.
//
// Lifecycle: create → capture/register → source-map/validate → analyze → review → seal → verify.
// Each mutating stage requires a valid ephemeral session token (request auth, NOT the
// evidence key). The final seal produces a REAL attest-core bundle server-side.

import { validateImageInput, gateFindings } from "./input-guards.mjs";
import { computeSourceMapHash, sourceCoverage, analyzeSourceBound } from "./analyze.mjs";
import { buildShadowLensSession } from "./build-session.mjs";
import { validateShadowLensSession } from "../contracts/validate.mjs";
import {
  InMemoryLensStore, issueSessionToken, verifySessionToken,
  resolveSessionSecret, newSessionId,
} from "./session-store.mjs";

const err = (code, message, extra = {}) => ({ ok: false, code, error: message, ...extra });

function authed(token, secret) {
  const v = verifySessionToken(token, { secret });
  return v.valid ? v : null;
}

// Optimistic concurrency: bump session_version on every mutation; if the caller passed a
// stale expected_version, refuse (a restarted/racing client can't silently clobber state).
async function mutate(store, id, patch, expectedVersion) {
  const s = await store.get(id);
  if (!s) return { conflict: "not_found" };
  const cur = s.session_version ?? 0;
  if (expectedVersion != null && expectedVersion !== cur) return { conflict: "version", current: cur };
  const next = await store.update(id, { ...patch, session_version: cur + 1 });
  return { next };
}

// 1 ── create ─────────────────────────────────────────────────────────────
export async function createSession({ device = null, build = null, store, env } = {}) {
  const s = store ?? new InMemoryLensStore();
  const { secret, ephemeral } = resolveSessionSecret(env);
  const session_id = newSessionId();
  await s.create({ session_id, stage: "created", session_version: 0, device, build, capture: null, source_map: null, analysis: null, reviewers: null, decision: null });
  const token = issueSessionToken(session_id, { secret });
  return { ok: true, session_id, token, store: s, session_token_ephemeral: ephemeral };
}

// A missing session (e.g. a serverless cold start) must fail HONESTLY, never throw and never
// silently recreate. Returns an err() for the two conflict kinds, or null on success.
function conflictErr(r) {
  if (r.conflict === "not_found") return err("unauthorized", "session not found for this token (a restart cannot silently recreate it)", { http: 401 });
  if (r.conflict === "version") return err("version_conflict", `stale session_version (have ${r.current})`, { current_version: r.current, http: 409 });
  return null;
}

// 2 ── capture/register (magic-byte + size + sha256; never the raw image into the session) ──
export async function registerCapture({ token, base64, bytes, capture_method = "xreal-eye-still", expected_version, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  const img = validateImageInput({ base64, bytes });
  if (!img.ok) return err("bad_image", img.error);
  const capture = { capture_id: `cap_${a.session_id.slice(4, 12)}`, capture_sha256: img.sha256, capture_method, format: img.mime, byte_length: img.byte_length };
  const r = await mutate(store, a.session_id, { stage: "captured", capture }, expected_version);
  const ce = conflictErr(r); if (ce) return ce;
  return { ok: true, capture, session_version: r.next.session_version };
}

// 3 ── source-map/validate (OCR-authored geometry; readiness for the resolveClaims gate) ──
export async function validateSourceMap({ token, sourceMap, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  if (!Array.isArray(sourceMap) || sourceMap.length === 0) return err("empty_source_map", "source_map must be a non-empty array");
  const ids = new Set();
  for (const e of sourceMap) {
    if (!e || typeof e.source_id !== "string" || typeof e.text !== "string") return err("bad_entry", "each entry needs source_id + text");
    if (ids.has(e.source_id)) return err("dup_source_id", `duplicate source_id ${e.source_id}`);
    ids.add(e.source_id);
  }
  const source_map_hash = computeSourceMapHash(sourceMap);
  const r = await mutate(store, a.session_id, { stage: "source_mapped", source_map: sourceMap, source_map_hash });
  const ce = conflictErr(r); if (ce) return ce;
  return { ok: true, source_map_hash, entries: sourceMap.length };
}

// 4 ── analyze (source-bound; findings citing unknown source_ids are dropped by the gate) ──
export async function analyze({ token, findings, llm, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  const s = await store.get(a.session_id);
  if (!s?.source_map) return err("no_source_map", "call source-map/validate first");

  let analysisResult;
  if (Array.isArray(findings)) {
    // fixture path: gate provided findings against the real source_map.
    const gated = gateFindings(findings, s.source_map);
    const source_bound = gated.filter((f) => f.validation_status === "source_bound");
    analysisResult = {
      findings: gated, source_bound_count: source_bound.length,
      source_map_hash: s.source_map_hash, model_id: "fixture", prompt_hash: null,
      source_coverage_pct: sourceCoverage(source_bound, s.source_map),
    };
  } else if (llm) {
    analysisResult = await analyzeSourceBound(s.source_map, { llm });
  } else {
    return err("no_provider", "provide findings (fixture) or an llm (live)", { http: 503 });
  }
  const r = await mutate(store, a.session_id, { stage: "analyzed", analysis: analysisResult });
  const ce = conflictErr(r); if (ce) return ce;
  return { ok: true, analysis: { source_bound_count: analysisResult.source_bound_count, source_coverage_pct: analysisResult.source_coverage_pct, model_id: analysisResult.model_id } };
}

// 5 ── review (human decision; modified/rejected REQUIRES override_rationale — CAAT) ──
export async function review({ token, reviewer, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  if (!reviewer || typeof reviewer.decision !== "string") return err("bad_reviewer", "reviewer.decision required");
  const needsRationale = reviewer.decision === "modified" || reviewer.decision === "rejected";
  if (needsRationale && !reviewer.override_rationale) return err("rationale_required", `${reviewer.decision} decision requires override_rationale`);
  const reviewers = [{ reviewer_id: reviewer.reviewer_id ?? "reviewer-1", decision: reviewer.decision, override_rationale: reviewer.override_rationale ?? null }];
  const r = await mutate(store, a.session_id, { stage: "reviewed", reviewers, decision: { outcome: reviewer.decision } });
  const ce = conflictErr(r); if (ce) return ce;
  return { ok: true, reviewers };
}

// 6 ── seal (REAL attest-core bundle, server-side signing key; verify immediately) ──
// Idempotent: re-sealing with the same idempotency_key returns the pristine sealed result
// (never a fresh bundle); re-sealing WITHOUT that key after a session is already sealed is
// refused, so the pristine bundle can never be silently overwritten.
export async function sealEvidence({ token, signingKeyPem, publicKeyPem, keyId, idempotency_key, expected_version, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  if (!signingKeyPem || !publicKeyPem) return err("no_key", "server signing key not configured");
  const s = await store.get(a.session_id);
  if (!s) return err("not_found", "session not found (a restart cannot silently recreate it)");
  if (s.stage === "sealed") {
    if (idempotency_key && s.sealed_idempotency_key === idempotency_key) {
      return { ok: true, idempotent_replay: true, session: s.session, bundle: s.sealed_bundle, verified: s.verification?.record_integrity === "verified", valid: true };
    }
    return err("already_sealed", "session already sealed; re-seal is refused to protect the pristine bundle (pass the original idempotency_key to replay)");
  }
  if (!s.analysis) return err("not_analyzed", "call analyze first");
  if (expected_version != null && expected_version !== (s.session_version ?? 0)) return err("version_conflict", `stale session_version (have ${s.session_version ?? 0})`, { current_version: s.session_version ?? 0 });

  const built = buildShadowLensSession({
    session_id: s.session_id, device: s.device, build: s.build, capture: s.capture,
    sourceMap: s.source_map, analysisResult: s.analysis,
    reviewers: s.reviewers, decision: s.decision,
    reviewer_interaction: s.reviewers?.[0] ? { decision: s.reviewers[0].decision, override_rationale: s.reviewers[0].override_rationale } : null,
    signingKeyPem, publicKeyPem, keyId,
  });
  const r = await mutate(store, a.session_id, {
    stage: "sealed", session: built.session, verification: built.session.verification,
    sealed_bundle: built.bundle, sealed_idempotency_key: idempotency_key ?? null,
  }, expected_version);
  if (r.conflict === "version") return err("version_conflict", `stale session_version (have ${r.current})`, { current_version: r.current });
  return { ok: true, session: built.session, bundle: built.bundle, verified: built.verified.ok, valid: built.valid, validation_errors: built.validation_errors };
}

// 7 ── verify (re-verify the sealed session record; contract-valid + record integrity) ──
export async function verify({ token, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  const s = await store.get(a.session_id);
  if (!s?.session) return err("not_sealed", "call seal first");
  const v = validateShadowLensSession(s.session);
  return { ok: true, contract_valid: v.valid, record_integrity: s.session.verification?.record_integrity, verification: s.session.verification };
}

export const STAGES = ["create", "capture", "source-map", "analyze", "review", "seal", "verify"];
