# Operator runbook — portable audit package (fixture mode)

## Produce the canonical fixture package

```bash
node bin/shadow-audit-package.mjs create --fixture banking --output-dir ./audit-package
# or: npm run audit:package -- create --fixture banking --output-dir ./audit-package
```

Expected: `wrote ./audit-package (shadow-portable-audit-package/1.0, 6 members, case case-2026-Q3-0042, session reference-banking-decision-2026-001)` plus the fixture-key and boundary lines. Exit 0.

## Verify a package

```bash
node bin/shadow-audit-package.mjs verify --package ./audit-package
node bin/shadow-audit-package.mjs verify --package ./audit-package --json   # machine-readable
```

Expected: `✓ package verified … verdict: VERIFIED_FIXTURE_KEY`. Exit 0.
Any tamper/substitution: `✗ package verification FAILED` with named failure
classes. Exit 1.

For key-identity trust (not just tamper-evidence), obtain the package public
key from an independent channel and pass it explicitly:

```bash
node bin/shadow-audit-package.mjs verify --package ./audit-package --public-key /path/to/independent-copy.pem
```

Then compare `signing.package_public_key_fingerprint_sha256` in
`manifest.json` against the fingerprint published on the independent channel.

## Package a different (already sealed) evidence bundle

```bash
node bin/shadow-audit-package.mjs create --fixture banking --output-dir ./pkg \
  --evidence path/to/bundle.json --evidence-public-key path/to/public.pem
```

The bundle must verify; HMAC bundles and bundles carrying
`header.agent.identity_ref` are refused (the latter can be overridden with
`--allow-identity-ref` — do that only when the identity disclosure is
intended, it enters the signed, portable artifact permanently).

## Common failures

| Symptom | Meaning | Action |
|---|---|---|
| exit 3 `already exists. Refusing to overwrite` | output dir present | choose a new dir or pass `--force` |
| exit 3 `refusing to package evidence that does not verify` | input bundle broken/tampered | re-export the bundle from its authoritative producer |
| exit 3 `NOT_PORTABLE` | HMAC-signed input | re-sign the evidence path with Ed25519; HMAC never ships |
| exit 1 `TAMPERED` on verify | member bytes differ from the signed manifest | treat the package as compromised; re-obtain from the producer |
| exit 1 `VERIFIER_DISAGREEMENT` | shipped verification-result ≠ local re-derivation | trust the local derivation; the shipped copy is a convenience view only |
| exit 1 `UNEXPECTED_MEMBER` | undeclared file inside the package dir | do not "clean it up and accept" — the package is not what was signed |

## Operational rules

- Never place extra files inside a package directory (two-way completeness
  makes the package fail verification).
- Never edit any member in place; any change requires producing a new package
  (new `package_id`).
- Fixture packages are demos. Do not present a `VERIFIED_FIXTURE_KEY` verdict
  as production-signed to any external party.
- The CLI is offline: it needs no network and no credentials. If a wrapper
  around it ever asks for either, that wrapper is out of contract.
