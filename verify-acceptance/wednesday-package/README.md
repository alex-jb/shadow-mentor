# Shadow Verify — Wednesday offline package

Self-contained. **FIXTURE RELEASE KEY / 测试发布密钥 — not production-signed.**

## Run locally (one command, then open the printed URL)

```bash
cd verify-acceptance/wednesday-package
python3 -m http.server 8899 --bind 127.0.0.1
# open http://127.0.0.1:8899/verify.html
```

## Demo script

1. **VERIFY EVIDENCE** — paste `valid-bundle.json`, paste `fixture-release-public.pem` → all rows VERIFIED,
   External Anchor NOT PRESENT, "Analytical correctness: not judged".
2. Paste `tampered-bundle.json` → FAILED at seq 2 (`prev_hash_mismatch`), downstream shown, no false green.
3. **VERIFY THE VERIFIER** — Load release manifest → `verify-manifest.v1.json` → manifest signature VERIFIED,
   **ASSETS MATCH SIGNED MANIFEST**, **INDEPENDENT COMPARISON NOT PERFORMED**.
4. Load `verify-manifest.mismatch.json` → **ASSET MISMATCH** with expected/actual hashes, no TRUSTED badge.
5. Toggle **EN / 中文** — identical evidence values, localized UI only.

## Trust boundary

The page proves your assets match a signed manifest. It does **not** prove the manifest/key came from an
independent channel — compare the fingerprint (`727d29d3204231f7`) against the GitHub Release / npm yourself.

## Offline

Evidence verification works offline after the page loads. The verifier's asset-hash comparison needs a
same-origin fetch (a static host); offline it honestly reports INDEPENDENT COMPARISON NOT PERFORMED.

Acceptance evidence: `../BROWSER_ACCEPTANCE_REPORT.md` + `../screenshots/`.
