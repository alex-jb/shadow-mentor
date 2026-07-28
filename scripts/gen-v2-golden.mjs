// Regenerates packages/attest-core/golden/v2-golden-vectors.json.
// Run ONLY on an intentional v2 canonical-format change (which is a wire-version bump, not a silent edit):
//   node scripts/gen-v2-golden.mjs
// The committed golden vector is the cross-runtime contract: Node, the browser verifier, and the C#
// canonicalizer (packages/attest-core/csharp-parity/) must all reproduce canonical_text / utf8_hex /
// sha256_hex byte-for-byte. The Ed25519 keypair is pinned into the file so signatures stay reproducible.
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildV2Envelope, v2SigningText, v2SigningBytes, v2CanonicalDigest, buildAttestationV2 } from "../packages/attest-core/attestation-v2.js";

const H = (c) => c.repeat(64);
const envInput = {
  algorithm: "hmac-sha256",
  requestCommitment: H("1"), outputCommitment: H("2"),
  modelId: "claude-opus-4-8", completedAtUtc: "2026-01-02T03:04:05Z",
  previousHash: null, keyId: "shadow-prod-2026-q1",
  bindings: { dictionary_hash: H("a"), citation_registry_sha256: H("b") },
};
const envelope = buildV2Envelope(envInput);
const SECRET = "golden-vector-secret-not-a-real-key";
const hmac = buildAttestationV2({ ...envInput, mode: "hmac-sha256", secret: SECRET }).signature;
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const edAtt = buildAttestationV2({ ...envInput, mode: "ed25519", privateKey });

const golden = {
  _comment: "aex-attestation/v2 GOLDEN VECTORS. Any runtime (Node/browser/C#) MUST reproduce canonical_text byte-for-byte, its utf8_hex, and sha256_hex. Regenerate ONLY via scripts/gen-v2-golden.mjs with an intentional format change + version bump.",
  wire_version: "aex-attestation/v2",
  envelope_input: envInput,
  envelope,
  canonical_text: v2SigningText(envelope),
  utf8_hex: v2SigningBytes(envelope).toString("hex"),
  sha256_hex: v2CanonicalDigest(envelope),
  hmac_sha256: { secret: SECRET, signature_hex: hmac },
  ed25519: {
    private_key_pem: privateKey.export({ type: "pkcs8", format: "pem" }),
    public_key_pem: publicKey.export({ type: "spki", format: "pem" }),
    signature_base64: edAtt.signature,
  },
};
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "attest-core", "golden", "v2-golden-vectors.json");
writeFileSync(out, JSON.stringify(golden, null, 2) + "\n");
console.log("wrote", out, "sha256=", golden.sha256_hex);
