// demos/replay/verify-browser.js
// Browser-side Shadow bundle verifier. Mirrors the Node
// `verifyBundle` in packages/attest-core/session.js — same event chain
// walk, same batch_root recomputation, same Ed25519 signature check —
// but implemented with WebCrypto so it runs from `file://`.
//
// Rule (design §9): behavior must be observationally identical to the
// Node reference. If a bundle fails one, it must fail the other with
// the same `reason`. The paired parity test lives at
// `test/replay-verify-browser-parity.test.js`.

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

function canonicalBytes(value) {
  return new TextEncoder().encode(canonicalize(value));
}

async function sha256Hex(bytes) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function headerSeedHash(header) {
  const normalized = { ...header, session_ended_at_utc: null };
  return sha256Hex(canonicalBytes(normalized));
}

function signedShape(event) {
  const { payload_ref, ...rest } = event; // payload_ref is unsigned per spec §Redaction
  return rest;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function b64urlToBytes(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToSpki(pem) {
  const cleaned = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, "");
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/**
 * Verify a Shadow evidence bundle. Return shape mirrors Node's:
 *   { ok: true, batchRoot, eventCount, sessionId, agent, keyId }
 *   { ok: false, error: {seq, reason, impact}, reason (back-compat), failedSeq (back-compat) }
 *
 * @param {object} bundle
 * @param {string} publicKeyPem — Ed25519 SPKI PEM
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

export async function verifyBundleInBrowser(bundle, publicKeyPem) {
  if (!bundle || typeof bundle !== "object") return fail(null, "bundle_missing",
    "The supplied argument is not an object; expected a parsed Shadow evidence bundle.");
  if (bundle.bundle_version !== 1) return fail(null, "bundle_unsupported_version",
    `bundle_version ${bundle.bundle_version} is not supported by this verifier (expected 1).`);
  if (!Array.isArray(bundle.events)) return fail(null, "events_not_array",
    "bundle.events is not an array; the event chain cannot be walked.");
  if (!Array.isArray(bundle.signatures) || bundle.signatures.length === 0) return fail(null, "signatures_missing",
    "bundle.signatures is empty; the batch root is unsigned and cannot be trusted.");

  const seed = await headerSeedHash(bundle.header);
  let expectedPrev = seed;
  const eventHashes = [];

  for (let i = 0; i < bundle.events.length; i++) {
    const ev = bundle.events[i];
    if (ev.seq !== i) return fail(i, "seq_gap",
      `Event at index ${i} declares seq ${ev.seq}; the chain is missing or reordered starting here.`);
    if (ev.prev_hash !== expectedPrev) return fail(i, "prev_hash_mismatch",
      `prev_hash at seq ${i} does not match the previous event's own hash; chain broken at this point and every event after it is unverifiable against this signature.`);
    const own = await sha256Hex(canonicalBytes(signedShape(ev)));
    eventHashes.push(own);
    expectedPrev = own;
  }

  const concat = new Uint8Array(eventHashes.length * 32);
  eventHashes.forEach((h, i) => concat.set(hexToBytes(h), i * 32));
  const batchRoot = await sha256Hex(concat);
  if (batchRoot !== bundle.batch_root) return fail(null, "batch_root_mismatch",
    "The Merkle root recomputed from the event hashes does not match bundle.batch_root; either an event was mutated or the batch_root field was rewritten.");

  const sig = bundle.signatures[0];
  if (sig.algorithm !== "ed25519") return fail(null, "signatures_unsupported_algorithm",
    `Signature algorithm "${sig.algorithm}" is not supported; this verifier only accepts ed25519.`);
  if (!publicKeyPem) return fail(null, "public_key_missing",
    "verifyBundleInBrowser was called without a public key PEM.");

  let key;
  try {
    key = await crypto.subtle.importKey(
      "spki",
      pemToSpki(publicKeyPem),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch (err) {
    return fail(null, "public_key_import_failed",
      `Public key PEM could not be parsed by WebCrypto: ${err.message}`);
  }

  const sigBytes = b64urlToBytes(sig.signature);
  const batchRootBytes = hexToBytes(batchRoot);
  const sigOk = await crypto.subtle.verify({ name: "Ed25519" }, key, sigBytes, batchRootBytes);
  if (!sigOk) return fail(null, "signature_verification_failed",
    "The Ed25519 signature does not match the batch root under the supplied public key; the bundle is not authentic for this key.");

  return {
    ok: true,
    trustLevel: Array.isArray(bundle.external_anchors) && bundle.external_anchors.length > 0
      ? "TIME_ANCHORED_STRUCTURAL (external anchor present — not verified by this offline tool)"
      : "SELF_SIGNED",
    batchRoot,
    eventCount: bundle.events.length,
    sessionId: bundle.header.session_id,
    agent: `${bundle.header.agent.name}@${bundle.header.agent.version}`,
    keyId: sig.key_id,
  };
}

// Exported for reuse by tamper.js (needs to hash + re-derive the
// tampered event's own_hash for downstream visualization).
export const _internal = { canonicalize, canonicalBytes, sha256Hex, signedShape };
