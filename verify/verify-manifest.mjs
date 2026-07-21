// Signed release-manifest contract for verify.html self-trust. The page can hash its own loaded
// assets, but that alone proves nothing (a malicious host swaps page AND hashes). The manifest is
// signed by an independent release key; the page verifies the SIGNATURE, compares asset hashes,
// and states plainly that the fingerprint must still be cross-checked from an independent channel
// (GitHub Release / npm / offline copy). This module is the deterministic, testable core.
import { createHash, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";

export const VERIFY_MANIFEST_VERSION = "shadow-verify-manifest-v1";

// canonical JSON (sorted keys) — mirrors verify.html + attest-core canonicalize
export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

export function sha256Hex(bytesOrString) {
  return createHash("sha256").update(bytesOrString).digest("hex");
}

// key fingerprint = sha256 of the SPKI DER, first 16 hex (stable, human-comparable)
export function keyFingerprint(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256Hex(der).slice(0, 16);
}

// the bytes that get signed = canonical manifest WITHOUT the signature field
function signedBytes(manifest) {
  const { signature, ...rest } = manifest;
  return Buffer.from(canonicalize(rest), "utf8");
}

export function buildManifest({ verifier_version, commit_sha, built_at, canonicalization_version, supported_profiles, assets, release_public_key_fingerprint }) {
  return {
    manifest_version: VERIFY_MANIFEST_VERSION,
    verifier_version,
    commit_sha,
    built_at,                                   // caller supplies (deterministic)
    canonicalization_version: canonicalization_version || "shadow-canon/1",
    supported_profiles: supported_profiles || [],
    assets: [...assets].sort((a, b) => a.path.localeCompare(b.path)),
    release_public_key_fingerprint,
  };
}

export function signManifest(manifest, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  const sig = edSign(null, signedBytes(manifest), key);   // Ed25519: algorithm = null
  return { ...manifest, signature: sig.toString("base64") };
}

// verify the manifest signature. Returns { ok, reason }.
export function verifyManifestSignature(manifest, publicKeyPem) {
  if (!manifest || typeof manifest !== "object") return { ok: false, reason: "MANIFEST_MALFORMED" };
  if (manifest.manifest_version !== VERIFY_MANIFEST_VERSION) return { ok: false, reason: "MANIFEST_MALFORMED" };
  if (typeof manifest.signature !== "string" || !manifest.signature) return { ok: false, reason: "MANIFEST_SIGNATURE_MISSING" };
  let ok;
  try {
    ok = edVerify(null, signedBytes(manifest), createPublicKey(publicKeyPem), Buffer.from(manifest.signature, "base64"));
  } catch (e) {
    return { ok: false, reason: "MANIFEST_SIGNATURE_FAILED" };
  }
  return ok ? { ok: true, reason: "OK" } : { ok: false, reason: "MANIFEST_SIGNATURE_FAILED" };
}

// compare the assets the page actually loaded (path → bytes) against the manifest entries.
// Fails closed: a malformed manifest, an unknown asset, or a missing asset is surfaced, never
// silently skipped. Returns per-asset results + an overall self-trust verdict.
export function checkAssets(manifest, loadedAssets) {
  const results = [];
  const manifestByPath = new Map((manifest.assets || []).map((a) => [a.path, a.sha256]));
  for (const [path, bytes] of Object.entries(loadedAssets)) {
    if (!manifestByPath.has(path)) { results.push({ path, status: "UNKNOWN" }); continue; }
    const actual = sha256Hex(bytes);
    results.push({ path, status: actual === manifestByPath.get(path) ? "MATCH" : "MISMATCH", actual });
  }
  for (const [path] of manifestByPath) if (!(path in loadedAssets)) results.push({ path, status: "MISSING" });

  let verdict;
  if (results.some((r) => r.status === "MISMATCH")) verdict = "ASSET_MISMATCH";
  else if (results.some((r) => r.status === "MISSING")) verdict = "ASSET_MISMATCH";
  else verdict = "ASSETS_MATCH_SIGNED_MANIFEST";
  return { results, verdict };
}
