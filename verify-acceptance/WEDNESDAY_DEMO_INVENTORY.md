# Wednesday demo — immutable inventory (FROZEN)

Frozen 2026-07-21. Do not modify the artifacts below without re-freezing this file.

## Commit SHAs
| demo | commit |
|---|---|
| Android stable demo (source the frozen APK was built from) | `5168b07` |
| verify.html browser acceptance | `9e0385c` |

## Fixture vs production — READ FIRST
The release-manifest fingerprint **`727d29d3204231f7` is the FIXTURE RELEASE KEY fingerprint**,
NOT a production release-key fingerprint. A future production release must use a separately
approved production release key and publish **that** key's fingerprint through independent
channels. Nothing here is production-signed.

## Frozen Android APK
| path | sha256 | status |
|---|---|---|
| apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk | `93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8` | FROZEN · commit 5168b07 · 24,442,084 bytes · DESKTOP-MOCK / DEVICE-VALIDATION-PENDING |

## Wednesday verifier package (`verify-acceptance/wednesday-package/`)
| path | sha256 |
|---|---|
| verify.html | `c478b46f42d0a9aea407a68a14178ffd638ba608b8972c806bd612c9f7d0d6bc` |
| verify/locales/en.json | `44a42af0331ede1cbe782e1486325421513fcaed3c997850de2eefa7e014e1ab` |
| verify/locales/zh-CN.json | `305a02065247864daaa177c3da0d86840ca805e4c8c0c317498315a317b949ad` |
| valid-bundle.json | `fe7e561ea41f86f907a03446aa1f232bc8468eb947f0182547d5e4b580c68cf2` |
| tampered-bundle.json | `f81baedfd1872a7e7fd5de9bb5cf36f4c4d3de80b11ee9d837bd02a3c6f6a2af` |
| verify-manifest.v1.json | `e632ec5dd70c5cb963ad437193f7f501ef83d6bae1a841b70e4b92fdc8d04c0c` |
| verify-manifest.mismatch.json | `beb7cf00ab4b1312b69d43949e8032eefa778531a29623593cce7ce4c5e65270` |
| fixture-release-public.pem | `5737326fa98041ea2e8ed97af51897a95334ccdc026c41dc6dcd16ed4d9ffb0c` |
| verification-report.en.json | `244cfd3f275581b26ec62bb84da6a6453e391b751b83963d97aac94288b393af` |
| verification-report.zh-CN.json | `eb13a494186f7a08be79c726acca8f507b340c934ebde7d1068c34482ed30d36` |
| verifier-integrity-report.json | `de1b142afe4cbcae47d93c496c7b238ddb4fc4f9b9b7e86b76c073d943bbff5d` |
| README.md | `59f78e6dfe8cda996fc73b4f38028c817f6849a160032a48dd0623e842a5f774` |

Fixture release-key fingerprint (in the manifest): `727d29d3204231f7` (FIXTURE).

## Acceptance screenshots (`verify-acceptance/screenshots/`, Chromium 149, real renders)
| file | sha256 |
|---|---|
| en-valid-evidence.png | `001afc32c95644e7d9a64498b5b3d9e86a002ab614b708082e65dd684a5c2285` |
| en-tampered-evidence.png | `824addef99e62a3ef8057b6b3785cdfee62dcbef6fc3801ef0f1ddf71a6b58d8` |
| en-verifier-valid.png | `32dd73e29a5d79487dbc0b52811a7eaf1b32b6e1d8781cdc775cc1e4e3f7736d` |
| en-verifier-mismatch.png | `20805ace824d424af28388fbe0938273cdd0de248ceef389993a0e2e79235934` |
| zh-CN-valid-evidence.png | `46666cd9a449c3e57519f4992c6307c480a7757f2399fd7f66074eb86dda5b79` |
| zh-CN-tampered-evidence.png | `1cf22c7f112c3f6983b7a117697fc0e335f8c4c9ff72b7181620624687c56084` |
| zh-CN-verifier-valid.png | `00f8dab54c4b96bf31937244236df28cc3aadb127245a5a2324a50d1bfec3311` |
| zh-CN-verifier-mismatch.png | `0edcdf7da81d85f7cf9ecc7e0e902f44fdc1921b05d86d3599307d5aa22ffdd7` |
| en-responsive-1280x720.png | `6844e7c7f69a528265b59d44eaa5b42cf6515afac25b820df6a3e26859072a4b` |

Reconfirm any time with `shasum -a 256 verify-acceptance/screenshots/*.png`.

## Local serve command (exact)
```bash
cd verify-acceptance/wednesday-package
python3 -m http.server 8899 --bind 127.0.0.1
# open http://127.0.0.1:8899/verify.html   (confirmed 200: verify.html, locales, manifest)
```

## Status ladder (this freeze)
HOST-TESTED ✅ (1824 Node pass / 3 skip) · BROWSER-RENDERED ✅ (Chromium 149, EN+zh-CN) ·
FIXTURE-SIGNED ✅ · PRODUCTION-SIGNED ❌ · OFFLINE-VALIDATED ⚠️ (evidence verify offline; full page =
offline-after-initial-asset-load) · DEVICE-VALIDATED ❌ (n/a).

## Known limitations
- Manifest asset-hash comparison needs a same-origin fetch (static host / after load); offline it
  honestly reports INDEPENDENT COMPARISON NOT PERFORMED.
- The fingerprint cross-check is a human step the page cannot perform.
- Signing is FIXTURE only; the Android APK is a desktop mock, device-validation pending.
