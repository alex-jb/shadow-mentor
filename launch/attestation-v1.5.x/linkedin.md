# LinkedIn draft — for bank compliance / risk officers

## Post

Compliance officers ask a specific question about AI-driven verdicts that most vendors dodge:

"How do I prove — six months from now, under regulator inspection — that the response I filed is the one the model actually generated?"

Not "prove the model was correct." Prove **integrity**. Prove the record I hold in my audit log wasn't silently edited by a downstream service, wasn't produced by a swapped-out cheaper model, wasn't re-signed after the fact by someone with signing access.

Standard cryptographic answers exist. Actually operationalizing them for a bank ops team without a dedicated crypto engineer on staff — that's the gap.

Over the last 48 hours I shipped six releases on my Shadow project (open source, MIT) closing this end-to-end:

• **Ed25519 signing** (RFC 8032) — Shadow holds the private key, bank auditor holds only the public key. Auditor can verify every historical decision. Cannot forge one. Separation is the point.

• **Three verifier surfaces on the same primitive**:
  – CLI for auditors on a laptop
  – MCP tool for auditors inside Claude Desktop / Cursor
  – HTTP endpoint for SIEM pipelines
  All wrap the same `verifyAttestation()` primitive. Response shape identical between chat and HTTP so audit-trail comparability holds regardless of which surface a team uses.

• **Drop-in bank CI recipe** — 2 GitHub secrets, drop 2 files, every push to audit-log JSON re-verifies before merge. Merge blocked on any tamper.

• **Deploy CLI** with correct file permissions by default (0600 private key, 0644 public key). No shell hacks. Rotation via `--force` flag, not accidental double-run.

• **One-command acceptance demo** — `npm run demo:attestation` runs the whole chain from a fresh clone in ~250ms. Six green checkmarks or a red X with the exact failure mode named.

**Positioning is honest**: SR 26-2 footnote 3 delegation (SR 11-7 was rescinded April 2026), GDPR Art. 22 + Schufa for EU (not EU AI Act — credit-scoring deferred to Dec 2027), CFPB Circular 2026-03 model-traceability. Full 543 test pass with a subprocess smoke test wired to the acceptance demo so any regression breaks CI.

If your compliance function is evaluating AI-driven decisioning tooling and the "how do we independently verify" question is stuck — I'd be interested in a 20-minute conversation about where the surface friction actually lives.

Repo (public, MIT): github.com/alex-jb/shadow-mentor

#Compliance #BankRisk #AIGovernance #ModelRisk

## Do not

- Do not use "leverage" / "unlock" / "empower" verbs
- Do not add hashtags beyond the four above
- Do not link to a competitor's post in the same thread
