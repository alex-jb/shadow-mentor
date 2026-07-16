// demos/replay/3d/verify.js
// ─────────────────────────────────────────────────────────────────
// The real verification path, reused — never simulated (Phase 3.1).
//
// The Audit Room does NOT reimplement verification. It imports the exact
// browser verifier the 2D replay + verify.html use (`../verify-browser.js`,
// parity-tested against the Node reference in packages/attest-core) and the
// exact tamper state machine (`../tamper.js`). Because the tamper mutation,
// the chain walk, and the {seq, reason, impact} error object all come from
// those shared modules, the Phase 3 acceptance test holds by construction:
// exporting the tampered working bundle and dropping it into verify.html
// reproduces the identical failure the scene just showed.
//
// This module adds only what's specific to the 3D demo:
//   • verifyWorking() — picks the right public key (original agent vs the
//     reviewer counter-signature) so one call verifies any working state.
//   • annotate()      — Phase 4.2: append a SIGNED review_annotation event
//     and re-seal so the annotated bundle re-verifies clean.
// ─────────────────────────────────────────────────────────────────
import { verifyBundleInBrowser, _internal } from "../verify-browser.js";
import { runTamperCycle, clonePristine } from "../tamper.js";
import { DEMO_PUBLIC_KEY_PEM } from "./demo-data.js";

export { verifyBundleInBrowser, clonePristine, runTamperCycle };

const { canonicalBytes, sha256Hex, signedShape } = _internal;
const REVIEWER_KEY_ID = "reviewer-local-demo";

// ── low-level chain helpers (same algorithm as verify-browser.js) ──
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToB64url(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function abToPem(ab, label) {
  const b = new Uint8Array(ab);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  const b64 = btoa(s).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----`;
}
async function headerSeedHash(header) {
  return sha256Hex(canonicalBytes({ ...header, session_ended_at_utc: null }));
}
async function ownHash(event) {
  return sha256Hex(canonicalBytes(signedShape(event)));
}
async function recomputeBatchRoot(bundle) {
  const hashes = [];
  for (const ev of bundle.events) hashes.push(await ownHash(ev));
  const concat = new Uint8Array(hashes.length * 32);
  hashes.forEach((h, i) => concat.set(hexToBytes(h), i * 32));
  return sha256Hex(concat);
}

// ── reviewer keypair (Phase 4.2): the reviewer counter-signs their notes.
// Generated fresh each load with WebCrypto; the private key never leaves
// memory. Verification of an annotated bundle uses this public key.
let _reviewer = null;
async function reviewerKeys() {
  if (_reviewer) return _reviewer;
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
  _reviewer = { priv: kp.privateKey, publicKeyPem: abToPem(spki, "PUBLIC KEY") };
  return _reviewer;
}

// Verify whatever state the working bundle is in, choosing the key by the
// signature's key_id: reviewer-signed after annotation, else the original
// committed agent key. One entry point for pristine, tampered, annotated.
export async function verifyWorking(bundle) {
  const keyId = bundle?.signatures?.[0]?.key_id;
  if (keyId === REVIEWER_KEY_ID) {
    const { publicKeyPem } = await reviewerKeys();
    return verifyBundleInBrowser(bundle, publicKeyPem);
  }
  return verifyBundleInBrowser(bundle, DEMO_PUBLIC_KEY_PEM);
}

// Phase 4.2.3 — attach a signed review_annotation event to the working
// bundle and re-seal so it re-verifies clean. The reviewer's key signs the
// extended chain (the original agent seal cannot cover events appended
// after it — the reviewer takes responsibility for the annotation, which
// is exactly the audit-trail-of-the-audit-trail the spec asks for).
export async function annotate(bundle, targetSeq, note) {
  const keys = await reviewerKeys();
  const prev = bundle.events[bundle.events.length - 1];
  const prevOwn = await ownHash(prev);
  const payload = { kind: "review_annotation", target_seq: targetSeq, note, by: "reviewer" };
  const payloadHash = await sha256Hex(canonicalBytes(payload));

  const ev = {
    seq: bundle.events.length,
    ts_utc: prev.ts_utc, // deterministic: reuse last ts (no Date in demo path)
    event_type: "review_annotation",
    actor: "reviewer",
    payload_hash: payloadHash,
    payload_ref: `sha256:${payloadHash}`,
    prev_hash: prevOwn,
    extensions: { review: payload },
  };
  bundle.events.push(ev);

  const batchRoot = await recomputeBatchRoot(bundle);
  const sigBytes = await crypto.subtle.sign({ name: "Ed25519" }, keys.priv, hexToBytes(batchRoot));
  bundle.batch_root = batchRoot;
  bundle.signatures = [{
    algorithm: "ed25519",
    key_id: REVIEWER_KEY_ID,
    signature: bytesToB64url(new Uint8Array(sigBytes)),
    signed_at_utc: prev.ts_utc,
  }];
  return ev;
}

export { REVIEWER_KEY_ID };
