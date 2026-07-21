// Deterministic acceptance-artifact generator for the verifier self-trust slice. Produces a
// valid + a tampered evidence bundle, a FIXTURE-signed release manifest over the real page +
// locale files, and bilingual verification reports. Everything is signed with the clearly
// labeled FIXTURE RELEASE KEY — NOT production-signed. Run: node verify/build-acceptance.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBundle, verifyBundle } from "./verify-bundle.mjs";
import { buildManifest, signManifest, sha256Hex, keyFingerprint, verifyManifestSignature, checkAssets } from "./verify-manifest.mjs";
import { FIXTURE_RELEASE_PUBLIC_PEM, FIXTURE_RELEASE_PRIVATE_PEM, FIXTURE_RELEASE_LABEL } from "./fixture-release-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "verify-acceptance");
const BUILT_AT = "2026-07-21T00:00:00Z";           // deterministic (not Date.now)
const COMMIT = "fixture-acceptance";
const VERIFIER_VERSION = "2.2.0";
const write = (name, obj) => writeFileSync(join(OUT, name), typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) + "\n");

export function buildAll() {
  mkdirSync(OUT, { recursive: true });

  // ── valid + tampered evidence bundles ──
  const header = { session_id: "sess-acceptance-0001", agent: { name: "shadow-lens", version: "2.2.0" }, session_ended_at_utc: BUILT_AT, profile: "banking-v1" };
  const valid = buildBundle({
    header,
    events: [
      { type: "case.opened", note: "MID-MARKET LOAN CASE #SL-2026-014", payload_ref: "unsigned-meta-0" },
      { type: "council.decided", recommendation: "REVIEW", dissent: 3, payload_ref: "unsigned-meta-1" },
      { type: "record.sealed", audit_reference: "hash-chain:demo", payload_ref: "unsigned-meta-2" },
    ],
    privateKeyPem: FIXTURE_RELEASE_PRIVATE_PEM, keyId: "fixture-release-2026",
  });
  write("valid-bundle.json", valid);

  const tampered = JSON.parse(JSON.stringify(valid));
  tampered.events[1].recommendation = "APPROVE";   // mutate a signed field → chain/root break
  write("tampered-bundle.json", tampered);

  // sanity: valid verifies, tampered fails at the mutated seq
  const vOk = verifyBundle(valid, FIXTURE_RELEASE_PUBLIC_PEM);
  const vBad = verifyBundle(tampered, FIXTURE_RELEASE_PUBLIC_PEM);
  if (!vOk.ok) throw new Error("acceptance valid bundle did not verify: " + vOk.reason);
  if (vBad.ok) throw new Error("acceptance tampered bundle verified — generator bug");

  // ── signed release manifest over the real page + locales ──
  const assetFiles = ["verify.html", "verify/locales/en.json", "verify/locales/zh-CN.json"];
  const assets = assetFiles.map((p) => ({ path: p, sha256: sha256Hex(readFileSync(join(ROOT, p))) }));
  const manifest = signManifest(buildManifest({
    verifier_version: VERIFIER_VERSION, commit_sha: COMMIT, built_at: BUILT_AT,
    supported_profiles: ["banking-v1", "data-science-v1", "coding-agent-v1"],
    assets, release_public_key_fingerprint: keyFingerprint(FIXTURE_RELEASE_PUBLIC_PEM),
  }), FIXTURE_RELEASE_PRIVATE_PEM);
  write("verify-manifest.v1.json", manifest);

  // ── bilingual verification reports (deterministic; original evidence values preserved) ──
  const baseReport = {
    verifier_version: VERIFIER_VERSION, verifier_build_commit: COMMIT, verification_timestamp: BUILT_AT,
    bundle_id: header.session_id, bundle_hash: vOk.batchRoot, signing_algorithm: "ed25519",
    public_key_fingerprint: keyFingerprint(FIXTURE_RELEASE_PUBLIC_PEM),
    matrix: { record_integrity: "VERIFIED", signature: "VERIFIED", hash_chain: "VERIFIED", profile: "VERIFIED", source_resolution: "NOT_PRESENT", external_anchor: "NOT_PRESENT" },
    analytical_correctness: "NOT_JUDGED_BY_VERIFIER", signing: FIXTURE_RELEASE_LABEL,
  };
  write("verification-report.en.json", { ...baseReport, ui_language: "en" });
  write("verification-report.zh-CN.json", { ...baseReport, ui_language: "zh-CN" });

  // ── verifier-integrity (self-trust) report ──
  const check = checkAssets(manifest, Object.fromEntries(assetFiles.map((p) => [p, readFileSync(join(ROOT, p))])));
  write("verifier-integrity-report.json", {
    manifest_id: manifest.manifest_version, manifest_signature: verifyManifestSignature(manifest, FIXTURE_RELEASE_PUBLIC_PEM).ok ? "VERIFIED" : "FAILED",
    release_key_fingerprint: manifest.release_public_key_fingerprint, signing: FIXTURE_RELEASE_LABEL,
    asset_check: check.verdict, assets: check.results,
    independent_comparison: "INDEPENDENT_COMPARISON_NOT_PERFORMED",
    note: "Assets match the signed manifest. Cross-check the release_key_fingerprint against the GitHub Release / npm to close the trust loop.",
  });

  write("README.md",
`# verify-acceptance — deterministic acceptance artifacts

All artifacts here are signed with the **${FIXTURE_RELEASE_LABEL} / 测试发布密钥** — NOT production-signed.

- \`valid-bundle.json\` — verifies clean.
- \`tampered-bundle.json\` — one signed event mutated; fails at seq 1 (prev_hash/batch_root break).
- \`verify-manifest.v1.json\` — release manifest over verify.html + locales, fixture-signed.
- \`verification-report.{en,zh-CN}.json\` — same evidence values, localized UI language only.
- \`verifier-integrity-report.json\` — assets-match-signed-manifest + INDEPENDENT_COMPARISON_NOT_PERFORMED.

Regenerate: \`node verify/build-acceptance.mjs\`. Fixture public key:
\`\`\`
${FIXTURE_RELEASE_PUBLIC_PEM}
\`\`\`
Browser-rendered acceptance screenshots are pending (not captured on the Node host).
`);

  return { valid: vOk.ok, tamperedRejected: !vBad.ok, manifestOk: verifyManifestSignature(manifest, FIXTURE_RELEASE_PUBLIC_PEM).ok, assetVerdict: check.verdict };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildAll();
  console.log("acceptance built:", JSON.stringify(r));
}
