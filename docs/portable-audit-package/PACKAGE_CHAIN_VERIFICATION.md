# Package Chain Verification

Module: `lib/portable-audit-package-chain.mjs` (`verifyPackageChain`).
CLI: `shadow-audit-package verify-chain --package <dir> [--package <dir> ...] [--json]`.

## Order of verification

1. **Each package independently** via `verifyPackageDir` — signature, two-way
   completeness, member hashes, bindings, internal evidence re-derivation. A chain is
   never "valid" merely because each signature verifies; equally, a broken link is never
   masked by valid per-package signatures.
2. **Immutable identity capture** — sha256 over each supplied `manifest.json` file bytes.
3. **Duplicates** — the same `package_id` supplied twice is `DUPLICATE_PACKAGE`.
4. **Link resolution** per 1.1 successor claim:
   - match by `predecessor_package_id`;
     - found → confirm `predecessor_manifest_sha256` over the actual manifest bytes
       (`PREDECESSOR_MANIFEST_MISMATCH` if changed/substituted), predecessor's own
       verification (`PREDECESSOR_INVALID`), actual contract version vs claim
       (`UNSUPPORTED_TRANSITION`), actual case vs claim (`CASE_MISMATCH`), actual evidence
       session vs claim when asserted (`SESSION_RELATION_MISMATCH`);
   - no id match but manifest-hash match → `PREDECESSOR_ID_MISMATCH`;
   - neither → `PREDECESSOR_NOT_SUPPLIED` (honest report — never guessed around).
   - claim of itself → `SELF_REFERENCE`.
5. **Graph shape over CLAIMED links** (independent of hash checks passing — forged claim
   graphs are still reported): cycles (`CHAIN_CYCLE`), forks — two or more supplied
   successors claiming one predecessor (`CHAIN_FORK`, reported never silently resolved).
6. **Local head + linearity** — head = supplied package no other supplied package claims
   as predecessor. Exactly one head + one connected linear sequence covering all supplied
   packages, else `CHAIN_BROKEN` with every observed head named.

## Verdicts and outcomes

`verdict` ∈ `SUPERSESSION_VALID` | `SUPERSESSION_FAILED`. The spec's distinguished
outcomes map to result fields:

| Outcome | Where it shows |
|---|---|
| valid standalone package | chain of one: `ok: true`, `order: [id]` |
| valid chain head, all predecessors supplied | `ok: true`, `local_head`, `order` root→head |
| valid package, predecessor not supplied | `ok: false` + `PREDECESSOR_NOT_SUPPLIED`, but that package's `package_ok: true` |
| invalid predecessor identity | `PREDECESSOR_ID_MISMATCH` / `PREDECESSOR_MANIFEST_MISMATCH` |
| case mismatch | `CASE_MISMATCH` |
| broken chain | `CHAIN_BROKEN` (+ `local_heads[]`) |
| cycle | `CHAIN_CYCLE` |
| fork observed | `CHAIN_FORK` (+ `local_heads[]`) |
| valid but not the selected local head | `packages[].is_local_head: false`, `package_ok: true` |
| unsupported contract/version | `PACKAGE_UNSUPPORTED` / `UNSUPPORTED_TRANSITION` |

## Local-head semantics — read carefully

`local_head` is **only** the head of the supplied, locally observed chain. Any number of
newer packages may exist elsewhere. The result never says "latest", "current", or
"freshest"; the boundary statement rides in every result and the honesty token
`SUPERSESSION_IS_NOT_GLOBAL_LATEST` rides in every 1.1 package's signed bytes.

## Determinism

Results are order-insensitive over the supplied set (packages sorted by `package_id`,
links by successor id, order derived from signed claims) and contain no wall-clock data.
Identical inputs produce identical results.

## `requireCompleteChain: false` (module option, not exposed on the CLI)

Used by `create --supersedes` self-checks, where only the immediate predecessor is
supplied: an absent *ancestor* is reported in `unresolved_references` instead of failing
the run, while the link being created is still fully checked. The CLI's `verify-chain`
always runs complete-chain semantics.

## Error classes

Malformed manifest JSON inside a supplied directory is an I/O-class error (CLI exit 3),
matching the `verify` command. Chain verification failures are exit 1. Usage errors are
exit 2.
