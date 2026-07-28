# Package Supersession — Test Strategy

Two new suites, extending (never modifying) the existing package suites:

- `test/shadow-audit-package-supersession-cli.test.js` — CLI surface (20 tests):
  successor creation, chain fixtures, immutability, determinism, exit codes, atomicity,
  privacy, bare-env offline operation, 1.0 regression pins.
- `test/shadow-audit-package-chain.test.js` — adversarial link/graph matrix (33 tests):
  identity binding, chain integrity, tampering, 1.0-boundary behavior.

## The `reforge` helper — attacker model

Chain tests use a `reforge(srcDir, mutate)` helper that clones a package, mutates
manifest and/or members, recomputes member hashes + `package_id`, and **re-signs with
the committed fixture key**. This models the strongest in-scope attacker: one holding
the (public, fixture-only) signing key who can produce validly signed but dishonest
packages. Every broken *binding* must still be caught; a fully coherent re-forge by a
key holder is the documented key-compromise limitation, inherent to signatures.

`editClaim` keeps manifest.supersedes and the provenance member's `supersession` in
sync, so each test isolates exactly the chain-level check under test instead of
tripping the package-level `BINDING_MISMATCH` first.

## Matrix coverage (spec §9 → test)

Successful paths: create A/B/C · verify each independently · verify A→B · verify
A→B→C · byte-determinism of repeated chain generation · predecessor byte-unchanged
after successor creation · existing 1.0 CLI behavior unchanged (the pre-existing 55
package tests still pass untouched).

Identity/binding: wrong predecessor id (manifest hash matches) → `PREDECESSOR_ID_MISMATCH`
· wrong manifest hash → `PREDECESSOR_MANIFEST_MISMATCH` · other-case predecessor →
`CASE_MISMATCH` · self-inconsistent claim case → `SUPERSESSION_MALFORMED` · changed
current session → `BINDING_MISMATCH` (1.0-era check) · changed claimed predecessor
session → `SESSION_RELATION_MISMATCH` · null session claim = not asserted (valid) ·
substituted valid package → `PREDECESSOR_NOT_SUPPLIED` + `CHAIN_BROKEN` · replay under
another case → `CASE_MISMATCH` · self-reference → `SELF_REFERENCE` (standalone + chain).

Chain integrity: missing predecessor · broken middle link · reordered supply (must be
result-identical, order-insensitivity is the honest semantics of signed links) ·
duplicate package · 2-cycle · 3-cycle · fork A→{B,B2} · multiple possible heads · valid
local head · valid-but-not-head packages · unsupported claimed version · claimed version
disagreeing with the actual predecessor.

Tampering: predecessor member tamper → `PACKAGE_TAMPERED` + `PREDECESSOR_INVALID` ·
signature-preserving whitespace change to the predecessor manifest →
`PREDECESSOR_MANIFEST_MISMATCH` (the package still verifies standalone — the strictest
immutability pin in the suite) · unsigned supersedes edit → `MANIFEST_SIGNATURE_FAILED`
· removed supersedes on 1.1 → `SUPERSESSION_MALFORMED` · malformed relation / identity /
marker (including `"APPROVED"` — review semantics must NOT parse) · provenance/manifest
divergence → `BINDING_MISMATCH` · missing honesty token → `SUPERSESSION_MALFORMED` ·
undeclared extra file · symlink traversal regression.

CLI: help · missing/invalid/unknown args · `--json` · exit codes 0/1/2/3/4 · `--force`
refusal on the predecessor dir · atomic failure cleanup · stdout/stderr separation ·
bare PATH-only env (no credentials) · static no-network scan of the chain module ·
no private key material anywhere.

## Regression scope

The full repo suite (`npm test`, `scripts/run-tests.mjs`) runs every existing package,
Flow-export, evidence, attestation and verifier test unchanged. No test was skipped,
weakened, or deleted in this increment.
