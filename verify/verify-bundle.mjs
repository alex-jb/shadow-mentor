// Node mirror of verify.html's evidence-bundle verifier (same canonicalization + hash-chain +
// batch-root + Ed25519 logic), so the acceptance bundles are checked on the host and the browser
// page can't silently drift from the tested logic. Also exports buildBundle() for the acceptance
// generator. Deterministic: callers pass timestamps.
import { createHash, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}
const canonBytes = (v) => Buffer.from(canonicalize(v), "utf8");
export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const headerSeedHash = (header) => sha256Hex(canonBytes({ ...header, session_ended_at_utc: null }));
const signedShape = (ev) => { const { payload_ref, ...rest } = ev; return rest; };
const hexToBytes = (hex) => Buffer.from(hex, "hex");

function fail(seq, reason, impact) {
  const out = { ok: false, error: { seq: typeof seq === "number" ? seq : null, reason, impact }, reason };
  if (typeof seq === "number") out.failedSeq = seq;
  return out;
}

export function verifyBundle(bundle, publicKeyPem) {
  if (!bundle || typeof bundle !== "object") return fail(null, "bundle_missing", "not a JSON object");
  if (bundle.bundle_version !== 1) return fail(null, "bundle_unsupported_version", `bundle_version ${bundle.bundle_version} unsupported (expected 1)`);
  if (!Array.isArray(bundle.events)) return fail(null, "events_not_array", "bundle.events is not an array");
  if (!Array.isArray(bundle.signatures) || bundle.signatures.length === 0) return fail(null, "signatures_missing", "batch root unsigned");

  let expectedPrev = headerSeedHash(bundle.header);
  const eventHashes = [];
  for (let i = 0; i < bundle.events.length; i++) {
    const ev = bundle.events[i];
    if (ev.seq !== i) return fail(i, "seq_gap", `event index ${i} declares seq ${ev.seq}; chain reordered/missing here`);
    if (ev.prev_hash !== expectedPrev) return fail(i, "prev_hash_mismatch", `prev_hash at seq ${i} broken; every event after it is unverifiable`);
    const own = sha256Hex(canonBytes(signedShape(ev)));
    eventHashes.push(own);
    expectedPrev = own;
  }
  const concat = Buffer.concat(eventHashes.map(hexToBytes));
  const batchRoot = sha256Hex(concat);
  if (batchRoot !== bundle.batch_root) return fail(null, "batch_root_mismatch", "recomputed root != bundle.batch_root");

  const sig = bundle.signatures[0];
  if (sig.algorithm !== "ed25519") return fail(null, "signatures_unsupported_algorithm", `algorithm ${sig.algorithm} unsupported`);
  if (!publicKeyPem) return fail(null, "public_key_missing", "Ed25519 public key required");
  let ok;
  try {
    ok = edVerify(null, hexToBytes(batchRoot), createPublicKey(publicKeyPem), Buffer.from(sig.signature, "base64url"));
  } catch (e) {
    return fail(null, "public_key_import_failed", e.message);
  }
  if (!ok) return fail(null, "signature_verification_failed", "signature does not match batch root for this key");

  return {
    ok: true,
    trustLevel: Array.isArray(bundle.external_anchors) && bundle.external_anchors.length
      ? "TIME_ANCHORED (external anchor present, not verified offline)" : "SELF_SIGNED (no external anchor)",
    eventCount: bundle.events.length, sessionId: bundle.header.session_id,
    agent: `${bundle.header.agent.name}@${bundle.header.agent.version}`, batchRoot, keyId: sig.key_id,
  };
}

// Build a valid, signed bundle for fixtures/acceptance. Deterministic given its inputs.
export function buildBundle({ header, events, privateKeyPem, keyId, externalAnchors }) {
  let prev = headerSeedHash(header);
  const outEvents = [];
  const hashes = [];
  events.forEach((e, i) => {
    const ev = { seq: i, prev_hash: prev, ...e };
    const own = sha256Hex(canonBytes(signedShape(ev)));
    hashes.push(own); prev = own; outEvents.push(ev);
  });
  const batchRoot = sha256Hex(Buffer.concat(hashes.map(hexToBytes)));
  const signature = edSign(null, hexToBytes(batchRoot), createPrivateKey(privateKeyPem)).toString("base64url");
  return {
    bundle_version: 1, header, events: outEvents, batch_root: batchRoot,
    signatures: [{ algorithm: "ed25519", key_id: keyId, signature }],
    ...(externalAnchors ? { external_anchors: externalAnchors } : {}),
  };
}
