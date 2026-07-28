# Package Supersession — Web Handoff (next Web increment)

This documents how Shadow Web SHOULD consume supersession chains. **No Web code was
changed in this increment** (hard boundary). This is the contract the next Web
increment implements against.

## Import model

- Web imports **individual immutable packages** (1.0 and 1.1), exactly as today for
  standalone import. A related set (a case's packages) is simply several imports.
- On every import, Web verifies the package **independently first** (same checks as
  `verifyPackageDir`, already ported for 1.0 — extend with the 1.1 supersedes
  structural + binding checks).
- Then Web runs chain resolution over **all packages it holds for that case** (same
  algorithm as `verifyPackageChain`): link resolution by `predecessor_package_id` +
  `predecessor_manifest_sha256`, duplicates, self-reference, cycles, forks, heads.

## Display requirements

- **Version timeline** per case: root → … → locally observed head, each node showing
  package id (short), built_at, contract version, and the neutral successor marker.
- **Locally observed chain head** — label it exactly that. Never "latest", "current",
  or "newest". The honest phrasing ships in every result (`boundary`) and in signed
  bytes (`SUPERSESSION_IS_NOT_GLOBAL_LATEST`).
- **Missing predecessor** — show the unresolved signed claim (id prefix) with an honest
  "predecessor not imported" state. Never hide the claim, never fabricate a node.
- **Fork** — show both branches; never auto-select a winner.
- **Broken chain / cycle** — show the failure state verbatim from the closed vocabulary.
- **Package integrity ≠ decision state.** A package can be VERIFIED while the chain is
  unconfirmed, forked, or broken — display these as separate statuses. Nothing in a
  chain is a business decision; there is no approval semantics to render.

## Retention rules (non-negotiable)

- **Every imported package is retained.** Importing Package B never rewrites, hides, or
  deletes Package A. Superseded ≠ invalid; superseded packages remain first-class,
  openable, verifiable evidence.
- Re-import of the same `package_id` with different bytes is a conflict to surface —
  never a silent replace.
- Standalone package import (no chain context) keeps working unchanged.

## Safe to persist in IndexedDB

Per package: the member files' bytes (or content-addressed blobs), the manifest,
`package_id`, `manifest_sha256` (computed at import over the manifest file bytes),
`manifest_version`, `case_id`, `evidence_session_id`, the `supersedes` block verbatim,
the LOCAL verification result **marked as derived-at-import** (must be re-derivable on
demand — never treated as evidence), and import metadata (imported_at, source filename).

NOT safe to persist: any claim of global freshness; any merged/rewritten package bytes;
any cross-case linkage (links are same-case only); anything presented as a business
decision state.

## Chain recomputation

Chain status is **derived state**: recompute from the stored packages on every import
(and on demand). Never persist a chain verdict as authoritative — the arrival of one
package can legitimately change the chain picture (e.g. filling a missing predecessor,
or revealing a fork).

## Exact next Web action

Add a package-set import screen: multi-select `.zip`/directory of packages → per-package
independent verification (extend the existing 1.0 web verifier with the 1.1 checks) →
chain resolution → timeline render with the statuses above → IndexedDB persistence per
the safe-list. No approval UI, no mutation of anything imported.
