# Package Supersession — Security Boundary

Extends [PACKAGE_SECURITY_BOUNDARY.md](./PACKAGE_SECURITY_BOUNDARY.md); everything there
still holds. This file states only what supersession adds — and, more importantly, what
it does NOT add.

## What a valid supersession chain proves

- Each supplied package is internally tamper-evident (per the 1.0/1.1 package boundary).
- Each verified link was signed naming exactly that predecessor: package content id
  **and** full signed-manifest bytes (sha256), same case, and the asserted evidence
  session relation.
- The supplied set forms one linear, cycle-free, fork-free sequence with one locally
  observed head.

## What it NEVER proves

- **Not global latest.** The head of the supplied chain is not the newest package that
  exists — any number of successors may live outside the supplied set. There is no
  registry, no freshness oracle, no revocation feed. The signed token
  `SUPERSESSION_IS_NOT_GLOBAL_LATEST` and the chain boundary statement make this
  non-claim explicit.
- **Not business correctness.** A perfectly valid chain can chain together analytically
  wrong content. Signature ≠ correctness, chain ≠ correctness.
- **Not review or approval.** The only relation is a neutral fixture successor marker.
  No Human Review, Approval, Rejection, or business First Failure is encoded, implied,
  or synthesized.
- **Not predecessor invalidation.** Being superseded changes nothing about the
  predecessor: it stays valid, verifiable, and evidentially intact. Consumers MUST NOT
  delete or rewrite superseded packages.

## Threats addressed

| Threat | Control |
|---|---|
| Rewriting history by editing a prior package | `predecessor_manifest_sha256` over the full manifest file bytes — even a signature-preserving whitespace change breaks the link |
| Substituting a different (even valid) predecessor | id + manifest-hash double binding; `PREDECESSOR_MANIFEST_MISMATCH` / `PREDECESSOR_NOT_SUPPLIED` |
| Cross-case replay of a successor | same-case rule, checked standalone (self-consistency) and at chain level against the actual predecessor |
| Silent fork resolution | forks are reported (`CHAIN_FORK`), never auto-picked |
| Cycle claims | reported (`CHAIN_CYCLE`) from the claimed graph, independent of hash checks |
| Smuggling supersession into 1.0 | never interpreted; chain reports `SUPERSESSION_MALFORMED`; standalone 1.0 verification untouched |
| Successor that overwrites its predecessor on disk | CLI refuses `--output-dir == --supersedes` even with `--force` |

## Explicitly out of scope (unchanged production gaps)

- **Key compromise:** whoever holds the signing key can forge coherent packages AND
  coherent chains. Fixture keys are public by design; nothing here is production
  signing. Key rotation and revocation remain NOT implemented (signed capability tokens
  say so).
- **Completeness oracle:** the verifier can only reason about the packages it is given.
  "Predecessor not supplied" is an honest report, not a proof that the predecessor does
  not exist.
- **No network, no registry, no backend** — by hard boundary of this increment.
