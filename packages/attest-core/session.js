// packages/attest-core/session.js
// ─────────────────────────────────────────────────────────────────
// Streaming session API for v3 evidence bundles.
//
// Contract: createSession() → appendEvent() (many) → sealSession().
// Each append extends the hash chain in memory; sealSession signs
// the batch root and returns a bundle matching spec/evidence-bundle.schema.json.
//
// v3 M1.2 shipped in-memory primitive. Crash-recovery via an optional
// JSONL append store (2026-07-10): pass `store` to createSession and every
// header/event/seal write is durable. On process crash, `recoverSession`
// reads the store back and returns a session that can be either resumed
// (if it wasn't sealed) or sealed post-hoc via `sealPartialBundle` to
// produce a verifiable evidence bundle covering everything up to the
// crash. Store interface is minimal: {appendLine(text), readLines()}.
// Default FileStore lives in packages/attest-core/store-file.js.
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
import { TRUST_LEVELS, trustLevelRank, verifyRfc3161Anchor, verifyRekorAnchor, requestTimestamp, submitRekorEntry } from "./anchors.js";

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
  // Claude Code adapter (M2.1, 2026-07-13) — carry hook-specific names so
  // the bundle keeps the distinction between "user prompt", "tool failure",
  // "sub-agent stop", "main-agent stop", and "context compaction gate"
  // instead of collapsing them into user_message + error + model_output.
  "prompt",
  "tool_error",
  "subagent_stop",
  "turn_end",
  "pre_compact",
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
 * @param {object} [params.store]        — durable append store {appendLine, readLines}. When provided, every header/event/seal write is persisted synchronously; a mid-session crash leaves a JSONL log that recoverSession can rebuild into a verifiable partial bundle.
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
    store = null,
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

  const session = {
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
    _store: store,
  };

  if (store) {
    store.appendLine(JSON.stringify({ kind: "header", header }));
  }

  return session;
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

  if (session._store) {
    session._store.appendLine(JSON.stringify({ kind: "event", event: record }));
  }

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

  if (session._store) {
    session._store.appendLine(JSON.stringify({
      kind: "seal",
      batch_root: batchRoot,
      signatures: bundle.signatures,
      session_ended_at_utc: endedAtUtc,
    }));
  }

  return bundle;
}

/**
 * Seal a session AND anchor its batch_root externally in one call — the seal
 * produces the Ed25519-signed bundle, then external anchors (RFC 3161 TSA and/or
 * a Rekor transparency-log entry) are requested for that batch_root and embedded
 * in bundle.external_anchors[]. The signature covers batch_root, so anchors sit
 * OUTSIDE the signature as independent attestations of it — no re-signing.
 *
 * Additive + back-compat: sealSession() is unchanged and stays sync/offline;
 * this is the async convenience for callers who want a witnessed bundle without
 * hand-wiring requestTimestamp/submitRekorEntry after every seal. With no anchor
 * option it is exactly sealSession() plus an await, and adds no external_anchors.
 *
 * @param {object} session
 * @param {object} [options] - sealSession options PLUS:
 *   @param {string|{url?:string,tsaUrl?:string,hashAlgorithm?:string,timeoutMs?:number}} [options.tsa]
 *     - request an RFC 3161 timestamp (string = TSA URL, or an object)
 *   @param {{publicKeyPem:string,url?:string,rekorUrl?:string,timeoutMs?:number}} [options.rekor]
 *     - submit a Rekor entry (needs the signer's public key PEM)
 *   @param {(batchRootHex:string, bundle:object)=>Promise<object|object[]>} [options.requestAnchor]
 *     - custom anchor producer (also the offline-testable seam)
 *   @param {boolean} [options.bestEffortAnchors=false] - if true, an anchor
 *     request that fails is recorded in bundle.anchor_errors[] instead of
 *     throwing, and the bundle returns with whatever anchors succeeded. Default
 *     is fail-loud: an explicitly-requested anchor that fails throws, so a caller
 *     never mistakes an unanchored bundle for a witnessed one.
 * @returns {Promise<object>} the sealed bundle, with external_anchors[] when any
 *   anchor succeeded (and anchor_errors[] in best-effort mode).
 */
export async function sealAndAnchor(session, options = {}) {
  const { tsa, rekor, requestAnchor, bestEffortAnchors = false, ...sealOptions } = options;
  const bundle = sealSession(session, sealOptions);

  const anchors = [];
  const errors = [];
  const collect = async (label, fn) => {
    try {
      const a = await fn();
      if (Array.isArray(a)) anchors.push(...a.filter(Boolean));
      else if (a) anchors.push(a);
    } catch (e) {
      if (!bestEffortAnchors) throw new Error(`sealAndAnchor: ${label} anchor failed: ${e?.message ?? String(e)}`);
      errors.push({ anchor: label, reason: e?.message ?? String(e) });
    }
  };

  if (tsa) {
    const t = typeof tsa === "string" ? { tsaUrl: tsa } : tsa;
    await collect("rfc3161-tsa", () => requestTimestamp({
      batchRootHex: bundle.batch_root,
      tsaUrl: t.tsaUrl ?? t.url,
      hashAlgorithm: t.hashAlgorithm,
      timeoutMs: t.timeoutMs,
    }));
  }
  if (rekor) {
    await collect("rekor", () => submitRekorEntry({
      batchRootHex: bundle.batch_root,
      signatureBase64: bundle.signatures[0].signature,
      publicKeyPem: rekor.publicKeyPem,
      rekorUrl: rekor.rekorUrl ?? rekor.url,
      timeoutMs: rekor.timeoutMs,
    }));
  }
  if (requestAnchor) {
    await collect("custom", () => requestAnchor(bundle.batch_root, bundle));
  }

  if (anchors.length) bundle.external_anchors = anchors;
  if (errors.length) bundle.anchor_errors = errors;
  return bundle;
}

/**
 * Recover a session from a durable store after a crash. Reads all lines,
 * reconstructs the in-memory session state, and returns it. The returned
 * session is either:
 *   - resumable (session._sealed === false, seal line was never written):
 *     more appendEvent + sealSession calls will work as normal.
 *   - already sealed (seal line found): sealSession will throw, but the
 *     bundle already exists on disk and can be reassembled by the caller.
 *
 * Recovery does NOT require the caller to pass agent/models/environment
 * again — those are read from the header line. The caller MUST pass the
 * signing privateKey (matching the header.schema_versions.attest_core
 * and header.session_id) so future events can sign, and so
 * sealPartialBundle can produce a valid signature.
 *
 * @param {object} params
 * @param {object} params.store — same store shape as createSession
 * @param {string|object} params.privateKey — Ed25519 private key for future signs
 * @returns {object} recovered session state
 */
export function recoverSession(params) {
  const { store, privateKey } = params ?? {};
  if (!store) throw new Error("recoverSession: store required");
  if (!privateKey) throw new Error("recoverSession: privateKey required");

  const lines = store.readLines();
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("recoverSession: store is empty");
  }

  let header = null;
  const events = [];
  let sealLine = null;

  for (const line of lines) {
    if (!line || !line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (err) {
      throw new Error(`recoverSession: malformed line: ${err.message}`);
    }
    if (obj.kind === "header") {
      if (header) throw new Error("recoverSession: duplicate header line");
      header = obj.header;
    } else if (obj.kind === "event") {
      events.push(obj.event);
    } else if (obj.kind === "seal") {
      sealLine = obj;
    }
    // Unknown kinds are ignored so future additive extensions are safe.
  }

  if (!header) throw new Error("recoverSession: no header line found");

  // Reconstruct chain state by walking the persisted events.
  let lastHash = headerSeedHash(header);
  for (const ev of events) {
    lastHash = sha256Hex(canonicalBytes(signedShape(ev)));
  }

  const session = {
    _sealed: sealLine !== null,
    header,
    events,
    _headerHash: headerSeedHash(header),
    _lastEventHash: lastHash,
    _signing: {
      algorithm: "ed25519",
      keyId: sealLine?.signatures?.[0]?.key_id ??
        header.recovered_from_key_id ?? "recovered",
      privateKey: normalizePrivateKey(privateKey),
    },
    _store: store,
    _recoveredSeal: sealLine,
  };

  return session;
}

/**
 * Produce a signed evidence bundle from a session that never received a
 * session_end (e.g. the process crashed). Unlike sealSession, this does
 * NOT auto-append session_end — the caller acknowledges the record is
 * partial. The bundle verifies against the chain up to the crash, and
 * bundle.header.session_ended_at_utc is set to null so an auditor sees
 * the partial-record posture.
 *
 * @param {object} session — recovered session
 * @param {object} [options]
 * @param {string} [options.keyId] — override key_id in the signature block
 */
export function sealPartialBundle(session, options = {}) {
  if (!session || typeof session !== "object") throw new Error("sealPartialBundle: session required");
  if (session._sealed) throw new Error("sealPartialBundle: session already sealed");
  if (session.events.length === 0) throw new Error("sealPartialBundle: no events to seal");

  const eventHashes = session.events.map(e => sha256Hex(canonicalBytes(signedShape(e))));
  const batchRoot = sha256Hex(Buffer.concat(eventHashes.map(h => Buffer.from(h, "hex"))));
  const signature = signEd25519(session._signing.privateKey, Buffer.from(batchRoot, "hex"));

  const keyId = options.keyId ?? session._signing.keyId;
  session.header.session_ended_at_utc = null; // partial → no clean end time

  const bundle = {
    bundle_version: BUNDLE_VERSION,
    spec_version: SPEC_VERSION,
    header: session.header,
    events: session.events,
    batch_root: batchRoot,
    signatures: [
      {
        algorithm: session._signing.algorithm,
        key_id: keyId,
        signature,
        signed_at_utc: new Date().toISOString(),
      },
    ],
  };

  session._sealed = true;

  if (session._store) {
    session._store.appendLine(JSON.stringify({
      kind: "seal",
      batch_root: batchRoot,
      signatures: bundle.signatures,
      session_ended_at_utc: null,
      partial: true,
    }));
  }

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
 * @param {boolean|"structural"|"full"} [params.checkAnchors] — anchor verification mode:
 *   - false (default): don't verify anchors; trustLevel stays SELF_SIGNED
 *   - true or "structural": messageImprint match only for TSA anchors, body-hash
 *     match for Rekor anchors; elevates to TIME_ANCHORED_STRUCTURAL / LOG_ANCHORED_STRUCTURAL
 *   - "full": also verifies CMS SignedData signature (TSA) and inclusion proof
 *     + SET (Rekor); elevates to TIME_ANCHORED / LOG_ANCHORED on success, falls
 *     back to structural on partial failure with a diagnostic reason
 * @param {string|object} [params.rekorPubKey] — required for Rekor "full" mode.
 *   Fetch current key: `curl https://rekor.sigstore.dev/api/v1/log/publicKey`
 * @returns {{ok: boolean, error?: {seq:number|null, reason:string, impact:string}, reason?: string, failedSeq?: number, trustLevel?: string, anchors?: object[]}}
 *
 * Failure return shape (M5 verifier-error-format port, 2026-07-13):
 *   {
 *     ok: false,
 *     error: { seq: number|null, reason: <snake_case>, impact: <sentence> },
 *     // back-compat mirrors — will be removed in v3.1:
 *     reason: <same as error.reason>,
 *     failedSeq: <same as error.seq when it's a number>,
 *   }
 * Callers should read `result.error` going forward. The legacy top-level
 * `reason` + `failedSeq` fields are preserved so existing tests + tools
 * (bin/shadow-verify.mjs, verify.html) don't break during the transition.
 */
function fail(seq, reason, impact) {
  const s = typeof seq === "number" ? seq : null;
  return {
    ok: false,
    error: { seq: s, reason, impact },
    reason,
    ...(typeof seq === "number" ? { failedSeq: seq } : {}),
  };
}

export function verifyBundle(bundle, params) {
  const { publicKey, checkAnchors = false, rekorPubKey, caTrustStorePem } = params ?? {};
  if (!publicKey) return fail(null, "public_key_missing",
    "verifyBundle was called without an Ed25519 public key; cannot verify the signature.");
  if (!bundle || typeof bundle !== "object") return fail(null, "bundle_missing",
    "The supplied argument is not an object; expected a parsed Shadow evidence bundle.");
  if (bundle.bundle_version !== BUNDLE_VERSION) return fail(null, "bundle_unsupported_version",
    `bundle_version ${bundle.bundle_version} is not supported by this verifier (expected ${BUNDLE_VERSION}).`);
  if (!Array.isArray(bundle.events)) return fail(null, "events_not_array",
    "bundle.events is not an array; the event chain cannot be walked.");
  if (!Array.isArray(bundle.signatures) || bundle.signatures.length === 0) return fail(null, "signatures_missing",
    "bundle.signatures is empty; the batch root is unsigned and cannot be trusted.");

  const headerHash = headerSeedHash(bundle.header);
  let expectedPrev = headerHash;
  const eventHashes = [];

  for (let i = 0; i < bundle.events.length; i++) {
    const ev = bundle.events[i];
    if (ev.seq !== i) return fail(i, "seq_gap",
      `Event at index ${i} declares seq ${ev.seq}; the chain is missing or reordered starting here.`);
    if (ev.prev_hash !== expectedPrev) return fail(i, "prev_hash_mismatch",
      `prev_hash at seq ${i} does not match the previous event's own hash; chain broken at this point and every event after it is unverifiable against this signature.`);
    const own = sha256Hex(canonicalBytes(signedShape(ev)));
    eventHashes.push(own);
    expectedPrev = own;
  }

  const batchRoot = sha256Hex(Buffer.concat(eventHashes.map(h => Buffer.from(h, "hex"))));
  if (batchRoot !== bundle.batch_root) return fail(null, "batch_root_mismatch",
    "The Merkle root recomputed from the event hashes does not match bundle.batch_root; either an event was mutated or the batch_root field was rewritten.");

  const sig = bundle.signatures[0];
  if (sig.algorithm !== "ed25519") return fail(null, "signatures_unsupported_algorithm",
    `Signature algorithm "${sig.algorithm}" is not supported; this verifier only accepts ed25519.`);
  const keyObj = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  const sigOk = cryptoVerify(
    null,
    Buffer.from(batchRoot, "hex"),
    keyObj,
    Buffer.from(sig.signature, "base64url"),
  );
  if (!sigOk) return fail(null, "signature_verification_failed",
    "The Ed25519 signature does not match the batch root under the supplied public key; the bundle is not authentic for this key.");

  // v3 M3 sprint 1 + 2: report trust level. Default SELF_SIGNED. If the
  // caller opts into checkAnchors, walk external_anchors and elevate.
  //   - "structural" / true: messageImprint match only → TIME_ANCHORED_STRUCTURAL
  //   - "full": also CMS SignedData signature verify → TIME_ANCHORED on success
  let trustLevel = TRUST_LEVELS.SELF_SIGNED;
  const anchorResults = [];
  const wantFull = checkAnchors === "full";
  const anchorsEnabled = checkAnchors === true || checkAnchors === "structural" || wantFull;

  if (anchorsEnabled && Array.isArray(bundle.external_anchors) && bundle.external_anchors.length > 0) {
    for (const anchor of bundle.external_anchors) {
      let r;
      if (anchor.kind === "rfc3161-tsa") {
        r = verifyRfc3161Anchor({
          anchor,
          expectedBatchRootHex: batchRoot,
          verifyCms: wantFull,
          caTrustStorePem,
        });
      } else if (anchor.kind === "rekor") {
        r = verifyRekorAnchor({
          anchor,
          expectedBatchRootHex: batchRoot,
          verifyFull: wantFull,
          rekorPubKey,
        });
      } else {
        anchorResults.push({ kind: anchor.kind, ok: false, reason: "anchor kind not yet supported" });
        continue;
      }
      anchorResults.push({ kind: anchor.kind, ...r });
      if (r.ok && r.trustLevel && trustLevelRank(r.trustLevel) > trustLevelRank(trustLevel)) {
        trustLevel = r.trustLevel;
      }
    }
  }

  return { ok: true, trustLevel, anchors: anchorResults };
}
