# shadow-audit-package CLI

Fixture-mode Core CLI that assembles and verifies
`shadow-portable-audit-package/1.0` directories. One thin CLI per job, per
repo convention; assembly and verification are separate subcommands sharing
one internal module (`lib/portable-audit-package.mjs`).

npm alias: `npm run audit:package -- <subcommand> …`

## create

```
node bin/shadow-audit-package.mjs create \
  --fixture banking \
  --output-dir <package-directory> \
  [--evidence <bundle.json> --evidence-public-key <key.pem>] \
  [--attestation <attestation.json>] \
  [--built-at <iso8601>] [--build-commit <sha>] \
  [--allow-identity-ref] [--force] [--json]
```

- `--fixture` — closed allowlist; only `banking` (the committed canonical
  narrative + the committed reference evidence bundle
  `docs/reference/banking-decision.bundle.json` + its public key).
- `--evidence` / `--evidence-public-key` — supply a different **existing,
  sealed** `shadow-evidence/v1` bundle (must be given together). The CLI never
  runs a council and never re-seals; evidence bytes are preserved exactly.
  Evidence that does not verify is refused. HMAC-signed bundles are refused
  (`NOT_PORTABLE`). `header.agent.identity_ref` must be null unless
  `--allow-identity-ref` is passed explicitly (privacy gate, default off).
- `--attestation` — optional existing `aex-attestation/v1` artifact
  (ed25519 mode only), included as the optional attestation member.
- `--built-at` — deterministic build timestamp; defaults to the fixture's
  `fixture_timestamp`, **never wall clock**.
- `--build-commit` — provenance commit; defaults to `git rev-parse HEAD`
  (acceptance-package precedent), falls back to `unknown`.
- `--force` — required to replace an existing output directory.
- `--json` — one-line machine-readable summary on stdout.

Behavior: validate everything → write into `<output-dir>.tmp-<pid>` →
self-verify the assembled package → rename atomically. A failed run leaves no
partial package and no temp directory. Signing uses the repo's FIXTURE RELEASE
KEY (`key_provenance=fixture`); the private key is never written, printed, or
packaged.

## verify

```
node bin/shadow-audit-package.mjs verify --package <package-directory> \
  [--public-key <key.pem>] [--json]
```

- Without `--public-key`, the embedded `keys/package-public-key.pem` member is
  used — this proves **tamper-evidence only**, not key identity. Pass an
  out-of-band key (and compare fingerprints out-of-band) for key-identity trust.
- `--json` emits the full deterministic result object
  (`ok`, `verdict`, `failures[]`, `checks[]`, bindings, `key_provenance`,
  `boundary`).
- Verdicts: `VERIFIED` · `VERIFIED_FIXTURE_KEY` (valid, but demo-labeled
  fixture key) · `FAILED`.

See `PACKAGE_VERIFICATION.md` for the full check sequence and failure classes.

## Exit codes

| Code | create | verify |
|---|---|---|
| 0 | package written and self-verified | package verified (incl. `VERIFIED_FIXTURE_KEY`) |
| 1 | — | package verification failed (closed failure vocabulary) |
| 2 | usage error (unknown/missing/mutually-inconsistent arguments, unknown fixture) | usage error |
| 3 | input read/parse error, unverifiable/non-portable input evidence, output exists without `--force`, write failure | package dir missing / manifest unreadable or not JSON |
| 4 | assembled package failed self-verification — nothing written | — |

Composed `bin/shadow-verify.mjs` semantics are preserved: the internal
evidence verification reuses `verifyBundle` (the same engine behind
shadow-verify's 0/1 verdicts); its closed failure reasons surface inside the
`EVIDENCE_VERIFICATION_FAILED` detail rather than being re-encoded.

## Guarantees

- Offline: no network access, no credentials required (tested under a bare
  `PATH`-only environment; static no-network-import scan is test-pinned).
- Deterministic: identical inputs produce byte-identical packages.
- No shell, no eval, no arbitrary executable or module selection.
- stdout carries results; stderr carries errors only.
