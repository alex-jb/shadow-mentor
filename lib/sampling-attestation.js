// lib/sampling-attestation.js
// ──────────────────────────────────────────────────────────────────
// v1.5.28 (2026-07-08): Invisible-Manipulation-Channel defense via
// sampling-seed attestation.
//
// Reference: arXiv:2606.16121 (2026-06-25) "Invisible Manipulation
// Channels in AI-Assisted Financial Advisory." The attack class:
// an inference proxy silently swaps the model's sampling seed or
// temperature between council calls. Output-based audits fail
// because KL-divergence from clean output is arbitrarily small
// (1.8-1.9x directional-keyword amplification with no visible
// artifact).
//
// The paper's proposed complete defense is QRNG + TEE hardware
// isolation. Shadow does not run in a TEE. What Shadow CAN do —
// and what this module ships — is close the specific attack
// vector where the inference proxy silently substitutes the seed /
// temperature between calls. It cannot defend against a proxy
// that returns adversarial samples with the CORRECT seed pinned,
// but it does force any such attack to either (a) commit to a
// visible tampered seed, or (b) fail the recomputable
// `sampling_seed_commitment_sha256` check post-hoc.
//
// This is a partial defense, not a complete one. The docs are
// honest about this per brain rule "no AI voice / no overclaim."
//
// Design invariants
// -----------------
// 1. `sampling_seed_commitment_sha256` is the SHA-256 of a
//    canonical JSON serialization of the sampling parameters
//    Shadow requested + the provider-reported system fingerprint.
// 2. Callers who cannot obtain a system fingerprint pass `null`
//    for that field; the commitment still binds the request-side
//    seed + temperature.
// 3. Same seed + same temperature + same fingerprint → same
//    commitment. Deterministic.
// 4. The commitment goes into `buildAttestation({ ..., samplingSeedCommitmentSha256 })`
//    as the 8th append-only field (after v1.5.27 tenant support,
//    which does not add a new attestation field).

import { createHash } from "node:crypto";

/**
 * Canonical serialization: JSON with sorted keys, no whitespace.
 * A deterministic byte-representation is required so a downstream
 * auditor recomputes the exact same SHA-256 from stored samples.
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj ?? null);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((v) => canonicalize(v)).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]));
  return "{" + parts.join(",") + "}";
}

/**
 * Compute the sampling-seed commitment hash.
 *
 * @param {object} params
 * @param {string|number|null} params.seed — the seed value Shadow
 *   requested. Anthropic uses `temperature: 0` for determinism;
 *   OpenAI uses `seed: <int>`; GLM uses `top_k: 1`. Pass whichever
 *   deterministic-sampling parameter the provider accepts.
 * @param {number|null} params.temperature
 * @param {number|null} params.top_p
 * @param {number|null} params.top_k
 * @param {string|null} params.provider — "anthropic" | "openai" | "glm"
 * @param {string|null} params.model_id — model identifier
 * @param {string|null} params.system_fingerprint — provider-reported
 *   system fingerprint (OpenAI ships this as `system_fingerprint`
 *   in the response; Anthropic returns nothing equivalent so pass
 *   null and the commitment still binds request-side params).
 * @returns {string} SHA-256 hex.
 */
export function computeSamplingSeedCommitment({
  seed = null,
  temperature = null,
  top_p = null,
  top_k = null,
  provider = null,
  model_id = null,
  system_fingerprint = null,
} = {}) {
  const canonical = canonicalize({
    seed,
    temperature,
    top_p,
    top_k,
    provider,
    model_id,
    system_fingerprint,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Extract the deterministic-sampling parameters Shadow can request
 * for a given provider. Returns the object caller passes to the
 * provider SDK as request options.
 *
 * The provider-specific parameter names vary. Anthropic wants
 * `temperature: 0`. OpenAI supports `seed` explicitly. GLM's
 * OpenAI-compatible endpoint uses `top_k: 1` for near-deterministic
 * sampling (GLM does not accept `seed`).
 *
 * A caller that wants tamper detection sets both the returned
 * options on the request AND records what they set into the
 * attestation via `computeSamplingSeedCommitment`.
 */
export function deterministicSamplingOptionsFor(provider) {
  switch ((provider || "").toLowerCase()) {
    case "anthropic":
      return { temperature: 0 };
    case "openai":
      return { temperature: 0, seed: 42 };
    case "glm":
      return { temperature: 0, top_k: 1 };
    default:
      return { temperature: 0 };
  }
}

/**
 * Convenience: given a provider + response object, extract the
 * commitment inputs and return the SHA-256 commitment. Useful for
 * callers who don't want to hand-thread each parameter.
 */
export function commitFromProviderResponse({ provider, model_id, sampling, response } = {}) {
  const system_fingerprint =
    response?.system_fingerprint ?? response?.systemFingerprint ?? null;
  return computeSamplingSeedCommitment({
    seed: sampling?.seed ?? null,
    temperature: sampling?.temperature ?? null,
    top_p: sampling?.top_p ?? null,
    top_k: sampling?.top_k ?? null,
    provider: provider ?? null,
    model_id: model_id ?? null,
    system_fingerprint,
  });
}
