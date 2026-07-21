# verify.html — self-trust + bilingual

`verify.html` answers two questions and keeps them separate:

- **VERIFY EVIDENCE / 验证证据** — is this Shadow evidence bundle valid?
- **VERIFY THE VERIFIER / 验证验证器** — why should I trust this page?

## Threat model (and the honest limit)

A page **cannot** prove itself trustworthy by hashing itself: a malicious host swaps the page **and**
its expected hash together. So the self-trust model is:

1. the page hashes its loaded assets **and** checks them against a **signed release manifest**;
2. the manifest is signed by an **independent release key**;
3. the user cross-checks the manifest fingerprint from an **independent channel** (GitHub Release,
   npm package, or an approved offline copy);
4. the page **states this boundary plainly** and shows `INDEPENDENT COMPARISON NOT PERFORMED`
   (`独立渠道核对尚未执行`) until step 3 is done by a human.

The page never claims `SELF-VERIFIED = TRUSTED`. It claims, at most, `ASSETS MATCH SIGNED MANIFEST`
(`资源与已签名清单一致`).

## Evidence verification

Real WebCrypto Ed25519 + canonicalization + hash-chain + batch-root (mirror of
`verify/verify-bundle.mjs`, host-tested). Results render as an **independent status matrix** — record
integrity / signature / hash chain / profile / source resolution / external anchor — each
`VERIFIED / FAILED / NOT PRESENT / NOT CHECKED / UNSUPPORTED / MALFORMED`, never one green badge. A
failure shows the exact failed sequence + reason + downstream affected sequences. "Analytical
correctness" is explicitly **Not judged by this verifier**.

## Verifier integrity

Load `verify-manifest.v1.json` → the page verifies its Ed25519 signature against the embedded
**release public key**, shows the fingerprint, and compares asset hashes where the browser can fetch
same-origin assets. Fails closed on a malformed manifest, a bad signature, or a missing/unknown
asset. Signed with the **FIXTURE RELEASE KEY / 测试发布密钥** in this repo — **not production-signed**.

## Independent-channel requirement

To close the trust loop, compare the `release_public_key_fingerprint` shown on the page against the
fingerprint published in the GitHub Release / npm package. If they differ, do **not** trust the page.

## Offline + privacy

Works fully offline after load (CSP `default-src 'none'`, `connect-src 'self'`). No live model, no
backend API, no analytics, no telemetry, no CDN fonts. Dropped bundles are processed locally and
**nothing is uploaded**; the page retains nothing. Localization changes only UI language — it never
alters the bundle hash, source quotes, signatures, sequence numbers, evidence IDs, or the verdict.

## Reproduce the build / compare hashes independently

```bash
# 1. regenerate the acceptance artifacts (deterministic, fixture-signed)
node verify/build-acceptance.mjs
# 2. hash the page + locales yourself and compare to verify-acceptance/verify-manifest.v1.json
shasum -a 256 verify.html verify/locales/en.json verify/locales/zh-CN.json
# 3. compare the release_public_key_fingerprint in the manifest against the GitHub Release
```

## Status

`HOST-TESTED`: evidence verifier mirror, manifest sign/verify, safe-parse hardening, locale parity,
acceptance artifacts. `FIXTURE-SIGNED`: the manifest + acceptance bundles. `BROWSER-RENDERED`:
pending (the page is authored + structurally contract-tested, not rendered on the build host).
`PRODUCTION-SIGNED` / `OFFLINE-VALIDATED` / `DEVICE-VALIDATED`: **not** claimed.
