# Next implementation increment — real capture health and immutable segments

## Implemented foundation

The fixture package CLI and portable 1.0/1.1/1.2 contracts from the original plan are implemented.
The established `create --fixture banking` and `assemblePackage` remain fixture signing paths.

This increment adds the explicit Core `create-operator` CLI and `assembleOperatorPackage` API for
standalone 1.0 packages. They require an existing sealed bundle, supported narrative, independent
verification inputs, a matching supplied Ed25519 package pair and explicit source/build time.
Original evidence bytes and narrative labels remain unchanged. The producer does not capture
hooks, invoke a model or supply missing approval. See the [operator runbook](PACKAGE_OPERATOR_RUNBOOK.md).

Web already has separate operator 1.0 admission and `VERIFIED_OPERATOR_KEY` display. Production and
operator 1.1/1.2 remain unsupported there. No provider origin or capture completeness is established
by either the producer entry point or a successful package verification.

Read-only `shadow-record status` now observes pending queues, open stores, sealed bundles and
global unattributed error-log metadata. It independently verifies a matching sealed bundle with
the public key and distinguishes recorded, manual and partial termination. Capture completeness
and provider origin remain `UNVERIFIED`; sealed-session resume remains `UNSUPPORTED`.
See [capture health and acceptance boundaries](../CAPTURE_HEALTH_2026-10-02.md).

## Current next task

> Use the read-only health observations to accept an actual operator-run provider session through
> recorder, independent evidence verification, `create-operator`, Core package verification and
> Web import/reload/export. Define immutable segments before claiming sealed-session resume.

Keep capture, packaging, verification and presentation outcomes separate. Acceptance should cover:

1. Installed hook configuration and genuine observed inputs recorded separately from the recorder's
   signatures. Source/provider labels remain declarations; the observer must not change provider
   permissions or execute tools merely to populate an audit record.
2. Capture health for normal completion, interruption and corrupt deferred queues. Inspect adapter
   diagnostics, pending/store state and expected event coverage; hook exit `0` alone is not success.
3. The original sealed bundle independently verified with its public key, then included
   byte-for-byte in an operator package whose outer key pair and full fingerprints are explicit.
4. Independent Core package verification followed by Web import, reload, Report and byte-preserving
   export. A successful display cannot fill missing capture evidence, identity or approval.
5. A defined immutable-segment protocol for a resumed provider session after a prior segment is
   sealed. Current same-session sealed-hook skipping must be exposed as incomplete resumed coverage,
   not hidden behind a valid first bundle. Segment linkage is not package supersession or a business
   decision lifecycle transition.
6. Honest unknown/absent model identity, permission decisions, first failure, downstream impact,
   human review and business approval. A successful tool result is not a recorded permission grant.

## Boundaries carried forward

- Signatures establish integrity under a key, not capture completeness, provider authenticity,
  model quality, analytical correctness or organizational authority.
- Operator source, signing provenance and build time are explicit declarations. Key revocation and
  rotation are not checked; a valid signature alone does not prove freshness.
- The browser executes no Core process and receives no private signing key. Core packaging is
  offline and invokes no capture/provider/model action.
- Fixture inputs remain labeled as fixtures even when an operator signs the outer package.
- Existing `shadow-flow-export/1.0`, `shadow-evidence/v1` and `aex-attestation/v1` contracts remain
  unchanged; no physical/XR validation claim is introduced.
- This plan records implementation scope, not a completed real-provider experiment. Candidate
  acceptance measurements belong in a separate evidence-backed acceptance record.
