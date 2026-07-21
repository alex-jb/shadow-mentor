// Verifier self-trust: signed release manifest. A valid signed manifest whose asset hashes match
// the loaded assets yields ASSETS_MATCH_SIGNED_MANIFEST; a modified asset, a broken signature, a
// malformed manifest, or a missing/unknown asset each fail closed and distinctly.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VERIFY_MANIFEST_VERSION, buildManifest, signManifest, verifyManifestSignature,
  checkAssets, sha256Hex, keyFingerprint,
} from "../verify/verify-manifest.mjs";
import { FIXTURE_RELEASE_PUBLIC_PEM, FIXTURE_RELEASE_PRIVATE_PEM } from "../verify/fixture-release-key.mjs";

const JS = "console.log('verifier');";
const CSS = "body{color:#fff}";

function makeSigned() {
  const m = buildManifest({
    verifier_version: "2.2.0", commit_sha: "deadbeef", built_at: "2026-07-21T00:00:00Z",
    supported_profiles: ["banking-v1"],
    assets: [{ path: "verify.js", sha256: sha256Hex(JS) }, { path: "verify.css", sha256: sha256Hex(CSS) }],
    release_public_key_fingerprint: keyFingerprint(FIXTURE_RELEASE_PUBLIC_PEM),
  });
  return signManifest(m, FIXTURE_RELEASE_PRIVATE_PEM);
}

test("a valid signed manifest verifies + assets match", () => {
  const m = makeSigned();
  assert.equal(m.manifest_version, VERIFY_MANIFEST_VERSION);
  assert.equal(verifyManifestSignature(m, FIXTURE_RELEASE_PUBLIC_PEM).ok, true);
  const { verdict } = checkAssets(m, { "verify.js": JS, "verify.css": CSS });
  assert.equal(verdict, "ASSETS_MATCH_SIGNED_MANIFEST");
});

test("a modified JS asset → ASSET_MISMATCH", () => {
  const m = makeSigned();
  const { results, verdict } = checkAssets(m, { "verify.js": JS + "// tampered", "verify.css": CSS });
  assert.equal(verdict, "ASSET_MISMATCH");
  assert.ok(results.find((r) => r.path === "verify.js").status === "MISMATCH");
});

test("a modified CSS asset → ASSET_MISMATCH", () => {
  const m = makeSigned();
  const { verdict } = checkAssets(m, { "verify.js": JS, "verify.css": CSS + "x" });
  assert.equal(verdict, "ASSET_MISMATCH");
});

test("a missing asset fails closed (not silently skipped)", () => {
  const m = makeSigned();
  const { results, verdict } = checkAssets(m, { "verify.js": JS });
  assert.equal(verdict, "ASSET_MISMATCH");
  assert.ok(results.find((r) => r.path === "verify.css").status === "MISSING");
});

test("an unknown asset is surfaced", () => {
  const m = makeSigned();
  const { results } = checkAssets(m, { "verify.js": JS, "verify.css": CSS, "evil.js": "x" });
  assert.equal(results.find((r) => r.path === "evil.js").status, "UNKNOWN");
});

test("an invalid manifest signature is rejected", () => {
  const m = makeSigned();
  m.signature = Buffer.from("not the real signature padded padded pad").toString("base64");
  const r = verifyManifestSignature(m, FIXTURE_RELEASE_PUBLIC_PEM);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "MANIFEST_SIGNATURE_FAILED");
});

test("tampering any signed field breaks the signature", () => {
  const m = makeSigned();
  m.verifier_version = "9.9.9";   // outside the signed bytes recompute
  assert.equal(verifyManifestSignature(m, FIXTURE_RELEASE_PUBLIC_PEM).ok, false);
});

test("a malformed manifest is rejected, not crashed", () => {
  assert.equal(verifyManifestSignature(null, FIXTURE_RELEASE_PUBLIC_PEM).reason, "MANIFEST_MALFORMED");
  assert.equal(verifyManifestSignature({ manifest_version: "wrong" }, FIXTURE_RELEASE_PUBLIC_PEM).reason, "MANIFEST_MALFORMED");
});
