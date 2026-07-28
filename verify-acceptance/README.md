# verify-acceptance — deterministic acceptance artifacts

All artifacts here are signed with the **FIXTURE RELEASE KEY / 测试发布密钥** — NOT production-signed.

- `valid-bundle.json` — verifies clean.
- `tampered-bundle.json` — one signed event mutated; fails at seq 1 (prev_hash/batch_root break).
- `verify-manifest.v1.json` — release manifest over verify.html + locales, fixture-signed.
- `verification-report.{en,zh-CN}.json` — same evidence values, localized UI language only.
- `verifier-integrity-report.json` — assets-match-signed-manifest + INDEPENDENT_COMPARISON_NOT_PERFORMED.

Regenerate: `node verify/build-acceptance.mjs`. Fixture public key:
```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAqEUmIuPWQhhRKpOB34ICb++uwx9r8aLVEdXNzWNcHgs=
-----END PUBLIC KEY-----
```
Browser-rendered acceptance screenshots are pending (not captured on the Node host).
