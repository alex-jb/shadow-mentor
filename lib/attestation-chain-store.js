// lib/attestation-chain-store.js
// ──────────────────────────────────────────────────────────────────
// Cross-vertical attestation chain persistence (v1.5.16, 2026-07-07).
//
// The `previous_hash` field in every Shadow attestation is chained: each
// decision points back to the SHA-256 of the previous one. Until v1.5.16
// this was a per-request concept — the caller had to remember the last
// hash and thread it in. In practice that meant `previous_hash` was
// always `null` on the /api/deliberate dispatch path, because the
// endpoint had no persistent state.
//
// This module ships a lightweight process-scoped chain store so that
// subsequent /api/deliberate calls automatically thread previous_hash
// from the last decision, **across all three verticals**:
//
//   banking (default)  ─┐
//   trading (mode=trading) ─┼──> one monotone chain
//   ds      (mode=ds)  ─┘
//
// A bank counsel can now curl /api/deliberate a mixture of banking +
// trading + ds requests, then hand the response log to a verifier and
// receive one machine-readable "chain intact / broken" verdict spanning
// the mixed vertical sequence. Reordering, insertion, or deletion of
// any decision — regardless of which vertical it came from — breaks
// the chain.
//
// Design decisions:
//
// 1. **In-memory by default.** No filesystem persistence in v1.5.16 —
//    a container restart resets the chain to null. This is intentional:
//    the primary purpose of cross-vertical chaining is procurement
//    demonstrability, not multi-restart replay. v0.5 will add
//    optional JSONL persistence for banks that want it.
//
// 2. **Per-process singleton.** Vercel serverless functions get a fresh
//    process per cold start; warm invocations share the chain. This
//    means the chain is contiguous within a warm-function window but
//    starts fresh across cold starts. Documented; not a bug.
//
// 3. **Not thread-safe for concurrent writers.** Node.js is
//    single-threaded per event loop so this is fine for the primary
//    dispatch path. If future work adds worker threads, this needs a
//    mutex.
//
// 4. **Test-injectable.** `createStore()` exported for unit tests that
//    need isolated chains. `defaultStore` is the module-level singleton
//    consumed by api/deliberate.js.

import { computeAttestationHash } from "./attestation-chain.js";

/**
 * Factory — returns a fresh chain store. Public for tests that need
 * per-test isolation. Production code uses `defaultStore` below.
 *
 * @returns {{
 *   getPreviousHash: () => string|null,
 *   recordAttestation: (attestation: object) => string,
 *   reset: () => void,
 *   size: () => number,
 * }}
 */
export function createStore() {
  let previousHash = null;
  let count = 0;

  return {
    /**
     * Return the SHA-256 of the last recorded attestation, or null if
     * this is the genesis entry. Called BEFORE buildAttestation() so
     * the new attestation's previous_hash field can be populated.
     */
    getPreviousHash() {
      return previousHash;
    },

    /**
     * Advance the chain. Called AFTER buildAttestation() with the
     * fully-formed attestation object (including its signature). The
     * SHA-256 of this attestation becomes the previous_hash for the
     * NEXT decision.
     *
     * @returns {string} the new head hash
     */
    recordAttestation(attestation) {
      const hash = computeAttestationHash(attestation);
      previousHash = hash;
      count++;
      return hash;
    },

    /**
     * Reset the chain. Intended for tests + operator use ("start a new
     * audit epoch"). Production callers should not touch this without
     * documenting the reset in the audit log.
     */
    reset() {
      previousHash = null;
      count = 0;
    },

    /**
     * Number of attestations recorded since last reset. Diagnostic
     * only — the SHA-256 chain is the authoritative record.
     */
    size() {
      return count;
    },
  };
}

/**
 * Module-level singleton consumed by api/deliberate.js. All three
 * vertical dispatch paths (banking / trading / ds) share this one
 * store so their attestations form a single monotone chain.
 */
export const defaultStore = createStore();
