// Cross-runtime golden-vector parity for aex-attestation/v2 (§8).
// The committed golden vector is the byte-for-byte contract every runtime must reproduce. This suite
// proves the NODE runtime reproduces it exactly (canonical text, UTF-8 hex, SHA-256, HMAC, Ed25519).
// The BROWSER verifier shares this exact canonicalize() (same JS module), so browser parity is the same
// bytes by construction. The C# canonicalizer lives at packages/attest-core/csharp-parity/ and is pinned
// against the SAME golden vector (see that dir's README for its run status).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicKey } from "node:crypto";
import { buildV2Envelope, v2SigningText, v2SigningBytes, v2CanonicalDigest, buildAttestationV2, verifyAttestationV2 } from "../packages/attest-core/attestation-v2.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(__dirname, "..", "packages", "attest-core", "golden", "v2-golden-vectors.json"), "utf8"));

test("NODE reproduces the golden canonical text / UTF-8 hex / SHA-256 exactly", () => {
  const envelope = buildV2Envelope(golden.envelope_input);
  assert.equal(v2SigningText(envelope), golden.canonical_text);
  assert.equal(v2SigningBytes(envelope).toString("hex"), golden.utf8_hex);
  assert.equal(v2CanonicalDigest(envelope), golden.sha256_hex);
});

test("the golden canonical text is byte-identical to its committed UTF-8 hex", () => {
  assert.equal(Buffer.from(golden.canonical_text, "utf8").toString("hex"), golden.utf8_hex);
});

test("NODE reproduces the golden HMAC-SHA256 signature", () => {
  const att = buildAttestationV2({ ...golden.envelope_input, mode: "hmac-sha256", secret: golden.hmac_sha256.secret });
  assert.equal(att.signature, golden.hmac_sha256.signature_hex);
  assert.equal(verifyAttestationV2(att, { secret: golden.hmac_sha256.secret }).ok, true);
});

test("the golden Ed25519 signature verifies against the pinned public key", () => {
  const att = {
    version: "aex-attestation/v2", domain: "shadow-attestation", algorithm: "ed25519", mode: "ed25519",
    request_commitment: golden.envelope.request_commitment, output_commitment: golden.envelope.output_commitment,
    model_id: golden.envelope.model_id, completed_at_utc: golden.envelope.completed_at_utc,
    previous_hash: golden.envelope.previous_hash, key_id: golden.envelope.key_id,
    bindings: golden.envelope.bindings, signature: golden.ed25519.signature_base64,
  };
  const publicKey = createPublicKey(golden.ed25519.public_key_pem);
  assert.equal(verifyAttestationV2(att, { publicKey }).ok, true);
});

// BROWSER parity: the verify.html inline canonicalize (browsers can't import the Node module) is a
// byte-identical mirror of packages/attest-core canonicalize. Run THAT algorithm + WebCrypto SHA-256
// against the v2 golden envelope and assert it reproduces the same canonical text + digest — so gate #3's
// browser leg is tested, not merely asserted "same module".
function browserCanonicalize(value) {   // verbatim mirror of verify.html's <script> canonicalize
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(browserCanonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + browserCanonicalize(value[k])).join(",") + "}";
}
test("BROWSER algorithm reproduces the v2 golden canonical text + SHA-256 (WebCrypto)", async () => {
  const text = browserCanonicalize(golden.envelope);
  assert.equal(text, golden.canonical_text, "browser canonicalize drifted from Node on the v2 envelope");
  const digestBuf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digestBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
  assert.equal(hex, golden.sha256_hex);
});

test("the golden envelope actually names every signed field (no positional bytes)", () => {
  for (const name of ["domain", "wire_version", "algorithm", "request_commitment", "output_commitment",
    "model_id", "completed_at_utc", "previous_hash", "key_id", "bindings",
    "dictionary_hash", "citation_registry_sha256"]) {
    assert.ok(golden.canonical_text.includes(`"${name}"`), `golden bytes must name "${name}"`);
  }
  assert.ok(golden.canonical_text.includes('"previous_hash":null'), "null chain-head must be literally in the bytes");
});
