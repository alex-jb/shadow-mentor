# ADR: Portable Audit Package Supersession Contract

- **Status:** ACCEPTED (bounded increment)
- **Date:** 2026-07-25
- **Baseline:** `ced8c2c` (`feat/shadow-portable-audit-package-cli`), architecture discovery `6edf298`
- **Branch:** `feat/shadow-portable-package-supersession`
- **Human approval:** Alex explicitly approved **this bounded Core supersession increment only**
  (portable-package supersession contract + deterministic fixture CLI + chain verification).
  No Human Review, Approval, or any business-mutation workflow is approved or implemented here.
- **Control plane:** `shadow-control-plane@b2fe0af` was consulted READ-ONLY and is not modified.

## Problem

`shadow-portable-audit-package/1.0` produces immutable, independently verifiable signed
packages. There is no way for a *new* immutable package to cryptographically reference and
supersede a *prior* immutable package without rewriting the prior package. That link is the
Core prerequisite for future Human Review / Approval workflows, which will need to ship a
successor package ("the reviewed/approved state") while the original package remains intact
as evidence.

## Options evaluated

### Option A — new additive package contract version `shadow-portable-audit-package/1.1`

A successor package is an ordinary portable package whose signed manifest carries a mandatory
`supersedes` block naming its predecessor by content identity. Standalone packages continue to
be emitted as unchanged `1.0`.

### Option B — separate signed supersession-chain contract

Prior and successor packages both stay `1.0`; a third, separately signed artifact (a
"chain record") asserts the predecessor→successor relationship.

## Evaluation

| Criterion | Option A (1.1 additive) | Option B (external chain record) |
|---|---|---|
| Signed-byte compatibility | 1.0 signed bytes untouched; 1.1 is a new version behind the existing hard `manifest_version` gate. Old verifiers reject 1.1 as `UNSUPPORTED` (fail-closed, never misread). | 1.0 bytes untouched, but the *link* lives outside every package — a package alone cannot prove it is a successor. |
| Backward compatibility | Every existing 1.0 package verifies byte-for-byte as before; `create` without `--supersedes` still emits 1.0. | Same for packages, but every consumer must learn a *second* artifact type. |
| Package verifier behavior | One verifier, version-gated: 95 % of checks shared; supersedes block validated only for 1.1. | Two verifiers with independent trust roots and a new binding problem (chain record ↔ package). |
| Web consumption | Web imports packages only; the timeline is derivable from the packages themselves. | Web must also import, store, and trust-manage chain records; a lost record silently orphans a successor. |
| Chain verification | Links are inside each successor's signed manifest → verifying the supplied set of packages is sufficient. | Requires the chain record to be present *and* verified *and* bound; three-way consistency surface. |
| Future Human Review / Approval packages | A review/approval package is just a future successor with a new relation value in the same signed slot. | Review/approval would need both a package and a chain record per action. |
| Fork / cycle detection | Graph is reconstructed from signed in-package claims; forks/cycles detectable from packages alone. | Detectable only when all chain records are supplied — records themselves can fork. |
| Missing predecessor | Honest `PREDECESSOR_NOT_SUPPLIED` from the successor's own signed claim. | A missing chain record is indistinguishable from "no supersession ever happened". |
| Rollback to `ced8c2c` | Delete the additive code paths; every 1.0 package and the 1.0 verifier are untouched. | Same. |
| Migration risk | None: no existing artifact changes meaning; 1.0 manifests carrying a `supersedes` field are **rejected** (`SUPERSESSION_MALFORMED`) so 1.0 can never be silently extended. | Low for packages, but introduces a new artifact class that must be versioned, stored, and revoked forever. |
| Size of contract | Smallest: one optional-at-the-ecosystem-level, mandatory-at-1.1 block + one provenance schema rev. | Larger: new artifact schema + new signing flow + new binding rules. |

## Decision

**Option A.** New additive contract version **`shadow-portable-audit-package/1.1`**:

1. `shadow-portable-audit-package/1.0` is **unchanged in place** — semantics, layout, signed
   bytes, and standalone verifier behavior are byte-for-byte what `ced8c2c` shipped. The 1.0
   contract cannot be silently extended: supersession is only *defined* for 1.1, so a
   `supersedes`-shaped field smuggled into a 1.0 manifest is never interpreted as a link —
   **chain verification** (a new surface, no 1.0 semantics implicated) reports it as
   `SUPERSESSION_MALFORMED`, while standalone 1.0 verification behaves exactly as at baseline.
2. A **1.1 package MUST carry exactly one signed `supersedes` block** (a 1.1 manifest without
   one is malformed). Standalone packages keep being produced as 1.0. This keeps the decision
   space closed: 1.0 ⇔ standalone, 1.1 ⇔ successor.
3. The `supersedes` block lives **inside the signed manifest bytes** and binds:
   - `relation` — `"shadow-package-supersession/1"` (closed vocabulary)
   - `predecessor_package_id` — the prior package's content-derived id (64-hex)
   - `predecessor_manifest_sha256` — SHA-256 over the prior package's `manifest.json` file
     bytes (its immutable signed identity, signature included)
   - `predecessor_manifest_version` — the prior package's contract version
   - `predecessor_case_id` — must equal the successor's own `case_id` (same-case rule,
     self-checkable standalone)
   - `predecessor_evidence_session_id` — the prior evidence session (`null` only if the
     predecessor legitimately lacks one; for 1.0/1.1 predecessors it is always available)
   - `marker` — `"FIXTURE_SUCCESSOR"` (closed vocabulary; a **neutral fixture-only successor
     marker**, explicitly NOT a Human Review, Approval, or Rejection semantic)
4. The **provenance member** of a 1.1 package uses schema
   `shadow-audit-package-provenance/1.1` = the 1.0 provenance shape **plus** a `supersession`
   object that repeats the manifest's `supersedes` block verbatim. The verifier cross-checks
   the two (`BINDING_MISMATCH` on divergence). This also guarantees a successor's member
   bytes differ from its predecessor's, so the content-derived `package_id` differs — a
   byte-identical "successor" is structurally impossible, and self-reference is additionally
   rejected outright.
5. `package_id` derivation is **unchanged** (sha256 over sorted member hashes) for both
   versions. Chain identity is anchored on `predecessor_manifest_sha256`, which covers the
   predecessor's full signed manifest.
6. New signed capability token `SUPERSESSION_IS_NOT_GLOBAL_LATEST` is **mandatory in 1.1**
   packages: the honesty claim "a valid chain proves local linkage only, never global
   freshness" rides inside the signed bytes.
7. **Chain verification** is a new companion concern (`lib/portable-audit-package-chain.mjs`
   + `verify-chain` CLI subcommand) over a *supplied set* of package directories. It verifies
   every package independently first, then resolves links by `predecessor_package_id` with
   `predecessor_manifest_sha256` as the tie-breaking identity check, and reports duplicates,
   self-references, cycles, forks, broken/disconnected chains, unsupported transitions, and
   the **locally observed** chain head. A valid chain head is never called globally latest.
8. Supported transitions: a 1.1 successor may supersede a 1.0 or a 1.1 predecessor. Anything
   else is `UNSUPPORTED_TRANSITION`.

## Consequences

- Every prior 1.0 package remains independently valid, immutable, and byte-identical.
- A successor is a **new immutable package**; creating it never touches the predecessor.
- Both packages verify standalone; the chain adds a second, separate verification layer.
- A valid chain proves linkage + tamper-evidence only — never business correctness and never
  global "latest" status (only the head of the supplied, locally observed chain).
- Future Human Review / Approval work extends the `relation`/`marker` vocabularies in a new
  bounded increment; nothing here encodes review/approval/rejection semantics.
- Rollback: `git checkout ced8c2c` (or revert the single commit). No data migration exists to
  undo because no existing artifact changed.

## Out of scope (hard boundaries honored)

Shadow Web, Shadow Lens, Flow, control-plane, production key management, revocation,
rotation, global freshness claims, backends/databases, network, live models, Human Review /
Approval / business First Failure synthesis.
