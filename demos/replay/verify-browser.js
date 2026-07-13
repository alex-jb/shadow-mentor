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
 *   { ok: false, reason, failedSeq? }
 *
 * @param {object} bundle
 * @param {string} publicKeyPem — Ed25519 SPKI PEM
 */
export async function verifyBundleInBrowser(bundle, publicKeyPem) {
  if (!bundle || typeof bundle !== "object") return { ok: false, reason: "not a JSON object" };
  if (bundle.bundle_version !== 1) {
    return { ok: false, reason: `unsupported bundle_version ${bundle.bundle_version}` };
  }
  if (!Array.isArray(bundle.events)) return { ok: false, reason: "events must be an array" };
  if (!Array.isArray(bundle.signatures) || bundle.signatures.length === 0) {
    return { ok: false, reason: "signatures missing" };
  }

  const seed = await headerSeedHash(bundle.header);
  let expectedPrev = seed;
  const eventHashes = [];

  for (let i = 0; i < bundle.events.length; i++) {
    const ev = bundle.events[i];
    if (ev.seq !== i) return { ok: false, reason: `sequence gap at index ${i}`, failedSeq: i };
    if (ev.prev_hash !== expectedPrev) {
      return { ok: false, reason: "prev_hash mismatch", failedSeq: i };
    }
    const own = await sha256Hex(canonicalBytes(signedShape(ev)));
    eventHashes.push(own);
    expectedPrev = own;
  }

  // batch_root = sha256(concat(eventHashes as raw 32-byte blocks))
  const concat = new Uint8Array(eventHashes.length * 32);
  eventHashes.forEach((h, i) => concat.set(hexToBytes(h), i * 32));
  const batchRoot = await sha256Hex(concat);
  if (batchRoot !== bundle.batch_root) return { ok: false, reason: "batch_root mismatch" };

  const sig = bundle.signatures[0];
  if (sig.algorithm !== "ed25519") {
    return { ok: false, reason: `unsupported signature algorithm "${sig.algorithm}"` };
  }
  if (!publicKeyPem) return { ok: false, reason: "public key required" };

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
    return { ok: false, reason: `public key import failed: ${err.message}` };
  }

  const sigBytes = b64urlToBytes(sig.signature);
  const batchRootBytes = hexToBytes(batchRoot);
  const sigOk = await crypto.subtle.verify({ name: "Ed25519" }, key, sigBytes, batchRootBytes);
  if (!sigOk) return { ok: false, reason: "signature verification failed" };

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
