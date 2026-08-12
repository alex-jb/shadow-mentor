// packages/adapter-ocsf/index.js
// ─────────────────────────────────────────────────────────────────
// Shadow evidence bundle → OCSF 1.9.0 `record_integrity` events.
//
// OCSF 1.9.0 (published 2026-08-03) added a `record_integrity` profile to
// `base_event`, an `attestation` object (fingerprint + signatures + a
// tamper-evident chain via prev_event / chain_uid / authority_uid), and an
// `ai_agent` object with a `charter`. That is precisely what a sealed Shadow
// bundle already computes. This adapter is a one-way FIELD MAPPING: it takes a
// SEALED bundle and emits OCSF events a bank SIEM (Splunk/AWS-backed OCSF
// consumers) ingests natively — turning "Shadow uses a bespoke format" into
// "Shadow emits the OCSF record_integrity profile."
//
// It does NOT re-sign, re-hash, or mutate the bundle. `attestation.fingerprint`
// is computed with attest-core's own `eventOwnHash` (the identical leaf that
// folds into `batch_root`) so there is zero hashing drift between the signed
// bundle and the OCSF projection.
//
// Honesty / scope (see docs/STANDARDS_MAP.md §5):
//   - This maps the record_integrity + ai_agent attributes. It does NOT claim a
//     precise per-event OCSF `class_uid` taxonomy — Shadow's event vocabulary is
//     carried in `type_name` + `metadata.labels`, and mapping each event type to
//     an authoritative OCSF class is deliberately left as a documented follow-up
//     rather than guessed. Any consumer relying on class_uid should treat these
//     as base_events.
//   - The session-level Ed25519 signature is over `batch_root` (all leaves), so
//     it is attached to the terminal event's `attestation.signatures[]`, and
//     `batch_root` is surfaced there too. Every event still carries its own
//     `fingerprint` + `prev_event` chain.
//
// Refs: OCSF 1.9.0 release (ocsf/ocsf-schema, PRs #1661 record_integrity,
// #1641 ai_agent). RFC 8032 Ed25519.
// ─────────────────────────────────────────────────────────────────

import { eventOwnHash } from "shadow-attest-core";

export const OCSF_SCHEMA_VERSION = "1.9.0";
export const ADAPTER_MAPPING_VERSION = "1.0";

// OCSF Fingerprint.algorithm_id: 3 = SHA-256.
const SHA256_ALGORITHM_ID = 3;

function fingerprint(hexHash) {
  return { algorithm: "SHA-256", algorithm_id: SHA256_ALGORITHM_ID, value: hexHash };
}

function epochMs(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
}

/**
 * Map ONE sealed-bundle event to one OCSF event carrying the record_integrity
 * profile. Pure; no crypto side effects.
 *
 * @param {object} event   — a sealed bundle event (has seq, prev_hash, ...)
 * @param {object} ctx     — { header, sessionSignature, batchRoot, isTerminal, charter }
 * @returns {object} OCSF-shaped event
 */
export function mapEvent(event, ctx) {
  const { header, sessionSignature, batchRoot, isTerminal, charter } = ctx;

  const attestation = {
    fingerprint: fingerprint(eventOwnHash(event)),
    chain_uid: header.session_id,
    authority_uid: sessionSignature ? sessionSignature.key_id : undefined,
  };

  // prev_event content-binding (skip genesis: seq 0's prev_hash is the header seed).
  if (event.seq > 0 && event.prev_hash) {
    attestation.prev_event = {
      fingerprint: fingerprint(event.prev_hash),
      uid: String(event.seq - 1),
    };
  }

  // The Ed25519 signature attests batch_root (the whole chain), so it rides on
  // the terminal event, alongside the root it covers.
  if (isTerminal && sessionSignature) {
    attestation.signatures = [{
      algorithm: sessionSignature.algorithm,
      key_id: sessionSignature.key_id,
      value: sessionSignature.signature,
      created_time: epochMs(sessionSignature.signed_at_utc),
    }];
    attestation.batch_root = batchRoot;
  }

  const ai_agent = {
    uid: header.agent.identity_ref ?? header.agent.name,
    name: header.agent.name,
    version: header.agent.version,
  };
  if (charter) ai_agent.charter = charter;

  return {
    metadata: {
      version: OCSF_SCHEMA_VERSION,
      profiles: ["record_integrity", "ai_operation"],
      product: { name: "Shadow", vendor_name: "shadow-mentor" },
      labels: [`shadow.event_type:${event.event_type}`],
    },
    time: epochMs(event.ts_utc),
    type_name: event.event_type,          // Shadow's frozen vocabulary; not an OCSF class_uid.
    actor: { app_name: String(event.actor) },
    attestation,
    ai_agent,
    // Retrieval keys so a SIEM can correlate back to the source bundle.
    unmapped: {
      shadow_seq: event.seq,
      shadow_payload_hash: event.payload_hash,
    },
  };
}

/**
 * Project a whole SEALED Shadow bundle to OCSF 1.9.0 events.
 *
 * @param {object} bundle  — output of sealSession() / a verified bundle
 * @param {object} [opts]
 * @param {string} [opts.charter] — the agent's governing system prompt / constitution
 * @returns {{ events: object[], warnings: string[] }}
 */
export function bundleToOcsf(bundle, opts = {}) {
  const warnings = [];
  if (!bundle || typeof bundle !== "object") {
    throw new TypeError("bundleToOcsf: bundle object required");
  }
  if (!Array.isArray(bundle.events) || bundle.events.length === 0) {
    throw new TypeError("bundleToOcsf: bundle.events[] required (seal the session first)");
  }
  if (!bundle.header || !bundle.header.agent) {
    throw new TypeError("bundleToOcsf: bundle.header.agent required");
  }
  if (!Array.isArray(bundle.signatures) || bundle.signatures.length === 0) {
    warnings.push("bundle has no signatures[]; emitted attestation carries fingerprints + chain but no signature");
  }

  const sessionSignature = bundle.signatures && bundle.signatures[0];
  const lastSeq = bundle.events[bundle.events.length - 1].seq;

  const events = bundle.events.map(ev => mapEvent(ev, {
    header: bundle.header,
    sessionSignature,
    batchRoot: bundle.batch_root,
    isTerminal: ev.seq === lastSeq,
    charter: opts.charter,
  }));

  return { events, warnings };
}
