// packages/attest-core/session.js
// ─────────────────────────────────────────────────────────────────
// Streaming session API for v3 evidence bundles.
//
// Contract: createSession() → appendEvent() (many) → sealSession().
// Each append extends the hash chain in memory; sealSession signs
// the batch root and returns a bundle matching spec/evidence-bundle.schema.json.
//
// This module deliberately does NOT persist to disk. Persistence + signer-
// daemon integration + crash recovery ship in a follow-up chunk. What ships
// here is the pure primitive: given a stream of events, produce a signed
// evidence bundle whose chain, batch root, and signature all verify.
//
// Design constraints (mirror spec/EVIDENCE_BUNDLE.md):
//   - Event type enum is frozen at 13 kinds.
//   - Payload content is hashed here; the payload_ref points to a
//     content-addressed store the caller manages. If the caller passes no
//     store adapter, payload_ref is set to a `sha256:<hex>` self-reference.
//   - Chain seed for seq=0 is sha256(canonicalized header).
//   - Session is mutable until sealed; sealed sessions throw on any append.

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomFillSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { canonicalize } from "./attestation.js";

// Frozen event enum. If this list changes, bump bundle_version.
export const EVENT_TYPES = Object.freeze([
  "session_start",
  "user_message",
  "model_call",
  "model_output",
  "tool_call",
  "tool_result",
  "file_read",
  "file_write",
  "shell_exec",
  "network_request",
  "human_approval",
  "error",
  "session_end",
]);

const ACTOR_TYPES = Object.freeze(["agent", "user", "model", "tool", "system"]);

const BUNDLE_VERSION = 1;
const SPEC_VERSION = "shadow-evidence/v1";

const ATTEST_CORE_VERSION = "2.0.0";

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalBytes(value) {
  return Buffer.from(canonicalize(value));
}

// Chain-seed hash MUST be stable across the session lifecycle. The
// header's `session_ended_at_utc` is filled in at seal time, so we
// exclude it from the seed hash. Both createSession and verifyBundle
// use this same normalization.
function headerSeedHash(header) {
  const normalized = { ...header, session_ended_at_utc: null };
  return sha256Hex(canonicalBytes(normalized));
}

// `payload_ref` is a hint about where the content-addressed payload lives.
// Its value is EXCLUDED from the signed record shape so the operator can
// null it out during a GDPR erasure without invalidating the chain. The
// authenticator is `payload_hash`, which stays in the signed shape.
function signedShape(event) {
  const { payload_ref, ...rest } = event;
  return rest;
}

/**
 * Create a new evidence-bundle session.
 *
 * @param {object} params
 * @param {object} params.agent          — { name, version, identity_ref? }
 * @param {Array<object>} params.models  — model manifest per header schema
 * @param {object} params.environmentFingerprint — { os, node_version, hostname_hash? }
 * @param {string} params.keyId          — signing key identifier (opaque to this module)
 * @param {string|object} params.privateKey — Ed25519 private key (PEM string or KeyObject)
 * @param {string} [params.sessionId]    — override; default is a random 128-bit id
 * @param {string} [params.startedAtUtc] — override; default is new Date().toISOString()
 * @param {string} [params.signingAlgorithm] — "ed25519" (default) or "hmac-sha256" (future)
 * @param {object} [params.attestCoreVersion] — override for tests
 * @returns {object} session state
 */
export function createSession(params) {
  const {
    agent,
    models = [],
    environmentFingerprint,
    keyId,
    privateKey,
    sessionId,
    startedAtUtc,
    signingAlgorithm = "ed25519",
    attestCoreVersion = ATTEST_CORE_VERSION,
  } = params ?? {};

  if (!agent || typeof agent !== "object") throw new Error("createSession: agent required");
  if (!agent.name || !agent.version) throw new Error("createSession: agent.name and agent.version required");
  if (!environmentFingerprint) throw new Error("createSession: environmentFingerprint required");
  if (!environmentFingerprint.os || !environmentFingerprint.node_version) {
    throw new Error("createSession: environmentFingerprint.os and .node_version required");
  }
  if (!keyId) throw new Error("createSession: keyId required");
  if (!privateKey) throw new Error("createSession: privateKey required");
  if (signingAlgorithm !== "ed25519") {
    throw new Error(`createSession: signingAlgorithm "${signingAlgorithm}" not yet implemented`);
  }

  const header = {
    session_id: sessionId ?? cryptoRandomHex(32),
    session_started_at_utc: startedAtUtc ?? new Date().toISOString(),
    session_ended_at_utc: null,
    agent: {
      name: agent.name,
      version: agent.version,
      identity_ref: agent.identity_ref ?? null,
    },
    models: models.map(m => ({
      model_id: m.model_id,
      provider: m.provider ?? null,
      sampling_params_hash: m.sampling_params_hash ?? null,
    })),
    environment_fingerprint: {
      os: environmentFingerprint.os,
      node_version: environmentFingerprint.node_version,
      hostname_hash: environmentFingerprint.hostname_hash ?? null,
    },
    schema_versions: {
      bundle: BUNDLE_VERSION,
      attest_core: attestCoreVersion,
    },
  };

  const headerHash = headerSeedHash(header);

  return {
    _sealed: false,
    header,
    events: [],
    _headerHash: headerHash,
    _lastEventHash: headerHash, // seed prev_hash for seq=0
    _signing: {
      algorithm: signingAlgorithm,
      keyId,
      privateKey: normalizePrivateKey(privateKey),
    },
  };
}

/**
 * Append an event to the session. Extends the hash chain in place.
 *
 * @param {object} session — from createSession()
 * @param {object} event
 * @param {string} event.event_type — must be in EVENT_TYPES
 * @param {string} event.actor — must be in ACTOR_TYPES
 * @param {*} [event.payload] — arbitrary JSON-serializable; will be canonicalized + hashed
 * @param {string} [event.payload_ref] — override the default self-reference
 * @param {object} [event.extensions] — additive metadata bag
 * @param {string} [event.ts_utc] — override; default is new Date().toISOString()
 * @returns {object} the appended event (frozen copy)
 */
export function appendEvent(session, event) {
  if (!session || typeof session !== "object") throw new Error("appendEvent: session required");
  if (session._sealed) throw new Error("appendEvent: session already sealed");
  if (!event || typeof event !== "object") throw new Error("appendEvent: event required");
  if (!EVENT_TYPES.includes(event.event_type)) {
    throw new Error(`appendEvent: unknown event_type "${event.event_type}"`);
  }
  if (!ACTOR_TYPES.includes(event.actor)) {
    throw new Error(`appendEvent: unknown actor "${event.actor}"`);
  }

  const payload = event.payload ?? {};
  const payloadHash = sha256Hex(canonicalBytes(payload));
  const payloadRef = event.payload_ref === null
    ? null
    : (event.payload_ref ?? `sha256:${payloadHash}`);

  const record = {
    seq: session.events.length,
    ts_utc: event.ts_utc ?? new Date().toISOString(),
    event_type: event.event_type,
    actor: event.actor,
    payload_hash: payloadHash,
    payload_ref: payloadRef,
    prev_hash: session._lastEventHash,
    extensions: event.extensions ?? {},
  };

  const ownHash = sha256Hex(canonicalBytes(signedShape(record)));
  session.events.push(record);
  session._lastEventHash = ownHash;

  return Object.freeze({ ...record });
}

/**
 * Seal the session — computes batch root, signs it, and returns the bundle.
 * The session becomes immutable; further appendEvent calls throw.
 *
 * @param {object} session
 * @param {object} [options]
 * @param {string} [options.endedAtUtc] — override; default is new Date().toISOString()
 * @param {boolean} [options.omitSessionEnd] — if true, don't auto-append a session_end event
 * @returns {object} evidence bundle matching spec/evidence-bundle.schema.json
 */
export function sealSession(session, options = {}) {
  if (!session || typeof session !== "object") throw new Error("sealSession: session required");
  if (session._sealed) throw new Error("sealSession: session already sealed");

  const endedAtUtc = options.endedAtUtc ?? new Date().toISOString();

  if (!options.omitSessionEnd) {
    const alreadyEnded = session.events.length > 0 &&
      session.events[session.events.length - 1].event_type === "session_end";
    if (!alreadyEnded) {
      appendEvent(session, {
        event_type: "session_end",
        actor: "system",
        payload: {
          event_count: session.events.length,
          session_duration_ms: Date.parse(endedAtUtc) - Date.parse(session.header.session_started_at_utc),
        },
        ts_utc: endedAtUtc,
      });
    }
  }

  session.header.session_ended_at_utc = endedAtUtc;

  // Recompute event own-hashes to compute batch_root. This is O(N).
  // We keep every event's own hash internally so the batch root is
  // sha256 of the concatenation.
  const eventHashes = session.events.map(e => sha256Hex(canonicalBytes(signedShape(e))));
  const batchRoot = sha256Hex(Buffer.concat(eventHashes.map(h => Buffer.from(h, "hex"))));

  const signature = signEd25519(session._signing.privateKey, Buffer.from(batchRoot, "hex"));

  const bundle = {
    bundle_version: BUNDLE_VERSION,
    spec_version: SPEC_VERSION,
    header: session.header,
    events: session.events,
    batch_root: batchRoot,
    signatures: [
      {
        algorithm: session._signing.algorithm,
        key_id: session._signing.keyId,
        signature,
        signed_at_utc: new Date().toISOString(),
      },
    ],
  };

  session._sealed = true;
  return bundle;
}

// ── helpers ──────────────────────────────────────────────────

function normalizePrivateKey(pk) {
  if (typeof pk === "string") {
    return createPrivateKey(pk);
  }
  return pk;
}

function signEd25519(privateKeyObject, bytes) {
  const sig = cryptoSign(null, bytes, privateKeyObject);
  return sig.toString("base64url");
}

function cryptoRandomHex(byteLen) {
  const buf = Buffer.alloc(byteLen);
  return randomFillSync(buf).toString("hex");
}

/**
 * Verify an evidence bundle. Recomputes the header hash, walks the event
 * chain, recomputes each event's own hash, checks prev_hash linkage,
 * recomputes the batch root, and verifies the signature.
 *
 * @param {object} bundle
 * @param {object} params
 * @param {string|object} params.publicKey — Ed25519 public key (PEM or KeyObject)
 * @returns {{ok: boolean, reason?: string, failedSeq?: number}}
 */
export function verifyBundle(bundle, params) {
  const { publicKey } = params ?? {};
  if (!publicKey) return { ok: false, reason: "publicKey required" };
  if (!bundle || typeof bundle !== "object") return { ok: false, reason: "bundle required" };
  if (bundle.bundle_version !== BUNDLE_VERSION) {
    return { ok: false, reason: `unsupported bundle_version ${bundle.bundle_version}` };
  }
  if (!Array.isArray(bundle.events)) return { ok: false, reason: "events must be array" };
  if (!Array.isArray(bundle.signatures) || bundle.signatures.length === 0) {
    return { ok: false, reason: "signatures required" };
  }

  const headerHash = headerSeedHash(bundle.header);
  let expectedPrev = headerHash;
  const eventHashes = [];

  for (let i = 0; i < bundle.events.length; i++) {
    const ev = bundle.events[i];
    if (ev.seq !== i) return { ok: false, reason: `seq gap at index ${i}`, failedSeq: i };
    if (ev.prev_hash !== expectedPrev) {
      return { ok: false, reason: "prev_hash mismatch", failedSeq: i };
    }
    const own = sha256Hex(canonicalBytes(signedShape(ev)));
    eventHashes.push(own);
    expectedPrev = own;
  }

  const batchRoot = sha256Hex(Buffer.concat(eventHashes.map(h => Buffer.from(h, "hex"))));
  if (batchRoot !== bundle.batch_root) {
    return { ok: false, reason: "batch_root mismatch" };
  }

  const sig = bundle.signatures[0];
  if (sig.algorithm !== "ed25519") {
    return { ok: false, reason: `unsupported signature algorithm "${sig.algorithm}"` };
  }
  const keyObj = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  const sigOk = cryptoVerify(
    null,
    Buffer.from(batchRoot, "hex"),
    keyObj,
    Buffer.from(sig.signature, "base64url"),
  );
  if (!sigOk) return { ok: false, reason: "signature verification failed" };

  return { ok: true };
}
