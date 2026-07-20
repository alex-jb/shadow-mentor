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

// 1 ── create ─────────────────────────────────────────────────────────────
export async function createSession({ device = null, build = null, store, env } = {}) {
  const s = store ?? new InMemoryLensStore();
  const { secret, ephemeral } = resolveSessionSecret(env);
  const session_id = newSessionId();
  await s.create({ session_id, stage: "created", device, build, capture: null, source_map: null, analysis: null, reviewers: null, decision: null });
  const token = issueSessionToken(session_id, { secret });
  return { ok: true, session_id, token, store: s, session_token_ephemeral: ephemeral };
}

// 2 ── capture/register (magic-byte + size + sha256; never the raw image into the session) ──
export async function registerCapture({ token, base64, bytes, capture_method = "xreal-eye-still", store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  const img = validateImageInput({ base64, bytes });
  if (!img.ok) return err("bad_image", img.error);
  const capture = { capture_id: `cap_${a.session_id.slice(4, 12)}`, capture_sha256: img.sha256, capture_method, format: img.mime, byte_length: img.byte_length };
  await store.update(a.session_id, { stage: "captured", capture });
  return { ok: true, capture };
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
  await store.update(a.session_id, { stage: "source_mapped", source_map: sourceMap, source_map_hash });
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
  await store.update(a.session_id, { stage: "analyzed", analysis: analysisResult });
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
  await store.update(a.session_id, { stage: "reviewed", reviewers, decision: { outcome: reviewer.decision } });
  return { ok: true, reviewers };
}

// 6 ── seal (REAL attest-core bundle, server-side signing key; verify immediately) ──
export async function sealEvidence({ token, signingKeyPem, publicKeyPem, keyId, store, env } = {}) {
  const { secret } = resolveSessionSecret(env);
  const a = authed(token, secret); if (!a) return err("unauthorized", "invalid or expired session token");
  if (!signingKeyPem || !publicKeyPem) return err("no_key", "server signing key not configured");
  const s = await store.get(a.session_id);
  if (!s?.analysis) return err("not_analyzed", "call analyze first");

  const built = buildShadowLensSession({
    session_id: s.session_id, device: s.device, build: s.build, capture: s.capture,
    sourceMap: s.source_map, analysisResult: s.analysis,
    reviewers: s.reviewers, decision: s.decision,
    reviewer_interaction: s.reviewers?.[0] ? { decision: s.reviewers[0].decision, override_rationale: s.reviewers[0].override_rationale } : null,
    signingKeyPem, publicKeyPem, keyId,
  });
  await store.update(a.session_id, { stage: "sealed", session: built.session, verification: built.session.verification });
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
