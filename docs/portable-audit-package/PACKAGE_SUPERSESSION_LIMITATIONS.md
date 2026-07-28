# Package Supersession — Limitations

Honest list. Everything in [PACKAGE_LIMITATIONS.md](./PACKAGE_LIMITATIONS.md) still
applies; supersession adds these.

## By design (not bugs)

- **Supersession does not invalidate the predecessor.** The prior package stays a
  valid, verifiable, immutable evidence artifact forever. Consumers must not treat
  "superseded" as "void".
- **Supersession does not erase earlier evidence.** Nothing is rewritten; history only
  grows.
- **Supersession does not prove business correctness.** A valid chain of
  cryptographically perfect packages can still carry analytically wrong content.
- **The locally observed chain head is not globally latest.** There is no registry and
  no freshness oracle; the verifier only reasons over the packages supplied to it. The
  non-claim is signed into every 1.1 package (`SUPERSESSION_IS_NOT_GLOBAL_LATEST`).
- **"Predecessor not supplied" is not "predecessor does not exist".** It is an honest
  incompleteness report.
- **Forks are reported, not adjudicated.** Choosing a branch is a human/business
  concern outside this contract.
- **The marker is neutral.** `FIXTURE_SUCCESSOR` encodes no review, approval,
  rejection, or business First Failure. Those semantics do not exist yet anywhere in
  this contract.

## Fixture-mode gaps (production work, deliberately absent)

- **Fixture keys only.** The signing key is committed and public; anything it signs is
  demo-labeled. A key holder can forge coherent packages AND coherent chains — the
  chain detects broken bindings, not dishonest signers.
- **No key rotation, no revocation** (signed capability tokens say so). A production
  deployment additionally needs: externally held keys, rotation/rollover procedure,
  revocation distribution, and out-of-band fingerprint channels.
- **No registry / anchoring.** Global ordering or existence proofs (transparency log,
  timestamping authority, control-plane anchoring) are future work; today's chain is
  purely peer-to-peer file evidence.
- **Single-fixture producer.** `create` builds from the committed banking fixture only;
  the successor differs from its predecessor by provenance (and the signed link), not by
  new business content — real amended-decision content arrives with future Human Review
  / Approval increments.
- **Session relation is equality-checked only when asserted.** Richer relations
  (re-run evidence, partial evidence carry-over) are future contract vocabulary.

## Rollback

`ced8c2c` remains the rollback point: revert the single supersession commit (or check
out `ced8c2c`). No migration to undo — no existing artifact changed meaning, and every
1.0 package remains byte-identical and valid on both sides of the rollback.
