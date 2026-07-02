// lib/presentation-order.js
// ──────────────────────────────────────────────────────────────────
// Deterministic-but-order-scrambled persona presentation.
//
// Ships 2026-07-02 based on "Hidden Anchors in Multi-Agent LLM
// Deliberation" (arXiv:2606.19494) which showed order-of-
// presentation biases downstream reviewers. Shadow's current fixed
// voice ordering (Credit → Risk → Compliance → Advocate →
// Contrarian) systematically anchors the first-read reviewer on
// Credit's opinion.
//
// Design
// ------
// The `voices[]` array in the response STAYS in canonical order so
// that:
//   1. Hash + attestation are deterministic
//   2. Bank auditors can eye-check the mapping voice[i] ↔ persona[i]
//   3. Serialized response bodies are byte-identical for the same
//      input (necessary for the attestation contract)
//
// A NEW field `presentation_order` is added: an array of indices
// telling a UI/report how to shuffle voices for HUMAN display. The
// shuffle seed is derived from the request commitment so the same
// input always produces the same presentation order — auditable +
// reproducible.
//
// This decouples audit determinism from human-anchor bias
// mitigation. UIs that render the reviewer view should honor
// presentation_order; UIs that render the auditor view should use
// canonical order.
//
// Refs
// ----
// - arXiv:2606.19494 Hidden Anchors in Multi-Agent LLM Deliberation
// - brain 2026-07-02 EVENING entry (Shadow deferred queue #7)

import { createHash } from "node:crypto";

/**
 * Generate a stable-but-scrambled presentation order for N voices.
 *
 * @param {number} n — number of voices
 * @param {string|object} seed — anything JSON-serializable. Same seed
 *   → same order. Different seed → different order.
 * @returns {number[]} array of indices 0..n-1 in scrambled order
 */
export function stablePresentationOrder(n, seed) {
  if (!Number.isInteger(n) || n <= 0) return [];
  const indices = Array.from({ length: n }, (_, i) => i);
  if (n === 1) return indices;

  // Fisher-Yates with a seeded PRNG. The seed comes from hashing the
  // seed argument to give a 256-bit input to the PRNG.
  const seedString = typeof seed === "string" ? seed : JSON.stringify(seed);
  const seedHex = createHash("sha256").update(seedString).digest("hex");

  // xorshift64* PRNG seeded from the first 16 hex chars (64 bits).
  // Vendored PRNG because Math.random() is not seedable and pulling
  // in a full seeded-random dep would violate we-dont-do #7.
  let state = BigInt("0x" + seedHex.slice(0, 16));
  if (state === 0n) state = 1n;  // xorshift can't start at 0

  const nextInt = (max) => {
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    // Mask to 64 bits + convert to Number for the modulo
    state &= 0xffffffffffffffffn;
    return Number(state % BigInt(max));
  };

  // Fisher-Yates in-place shuffle
  for (let i = n - 1; i > 0; i--) {
    const j = nextInt(i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}


/**
 * Attach a stable presentation_order field to a council response.
 * The voices array is untouched.
 *
 * @param {object} response — must have `.voices` array
 * @param {string|object} [seedContent] — content whose hash seeds the
 *   shuffle. Defaults to the loan_id + voices verdicts so equivalent
 *   decisions produce the same order. Callers can pass their own
 *   seed (e.g. the request commitment) for tighter audit binding.
 * @returns {object} the same response with presentation_order added
 */
export function attachPresentationOrder(response, seedContent = null) {
  if (!response || !Array.isArray(response.voices)) return response;
  const seed = seedContent ?? {
    loan_id: response.loan_id,
    verdicts: response.voices.map((v) => v.verdict),
  };
  response.presentation_order = stablePresentationOrder(
    response.voices.length, seed,
  );
  return response;
}
