# Package Supersession CLI

Extends `bin/shadow-audit-package.mjs`. Existing `create` and `verify` behavior is
preserved bit-for-bit; two additions only.

## Create a successor

```
node bin/shadow-audit-package.mjs create \
  --fixture banking \
  --supersedes <prior-package-directory> \
  --output-dir <new-package-directory>
```

Behavior:

1. The predecessor is **verified first**; a predecessor that does not verify is refused
   (`PREDECESSOR_INVALID`, exit 3, nothing written).
2. The predecessor's `package_id`, `manifest.json` sha256, contract version, case id and
   evidence session are read — the predecessor is **never modified** (the CLI refuses
   `--output-dir` equal to the predecessor even with `--force`).
3. A new immutable `shadow-portable-audit-package/1.1` is assembled with the signed
   `supersedes` block, self-verified standalone **and** chain-self-verified against the
   supplied predecessor inside the atomic temp directory, then renamed into place. Any
   failure leaves no partial package.
4. Determinism: `--built-at` defaults to the fixture timestamp — never wall clock.
   Identical inputs → byte-identical successor.

Chain fixtures (deterministic A → B → C):

```
node bin/shadow-audit-package.mjs create --fixture banking --output-dir A
node bin/shadow-audit-package.mjs create --fixture banking --output-dir B --supersedes A
node bin/shadow-audit-package.mjs create --fixture banking --output-dir C --supersedes B
```

## Verify a chain

```
node bin/shadow-audit-package.mjs verify-chain \
  --package A --package B --package C [--public-key <key.pem>] [--json]
```

- `--package` is repeatable; order does not matter (links come from signed claims).
- `--public-key` optionally overrides the embedded package key, as in `verify`.
- `--json` emits the full deterministic result object on stdout (one line).

## Exit codes

| Command | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| `create` (incl. `--supersedes`) | written | — | usage | input / I-O / bad predecessor | assembled package failed self- or chain-self-verification (nothing written) |
| `verify` | verified | verification failed | usage | I/O | — |
| `verify-chain` | chain valid | chain verification failed | usage | I/O | — |

## Guarantees

- argv arrays only; no shell interpolation; no arbitrary module loading (fixed imports).
- Explicit `--output-dir`, refuse-overwrite without `--force`, atomic temp+rename.
- Offline: no network APIs, no credentials (test-pinned with a PATH-only environment).
- No private key is ever written, printed, or packaged; fixture signing only
  (`key_provenance=fixture`) — never a production signing profile.
- stdout carries results; stderr carries errors; failure vocabulary is closed
  (see PACKAGE_CHAIN_VERIFICATION.md).
