# Shadow GTM synthesis — ICP, distribution, pricing, and the wedge check (2026-07-16)

A 4-axis deep-research pass on how to actually take the repositioned Shadow
(OSS-first, third-party AI-agent audit, sold to fintechs-selling-to-banks — see
`shadow-reposition-2026-07-16.md`) to market. One finding materially changes the
positioning; the rest is an actionable playbook.

## The finding that changes positioning: the wedge is NOT empty

The generic "OSS verifier for tamper-evident AI-agent decision logs" niche is
**contested, trending toward occupied.** Real occupants with near-identical
primitives *and* the same independence pitch:

- **MakerChecker** (github.com/makerchecker/MakerChecker) — Ed25519 + SHA-256
  hash-chain over RFC 8785 canonical JSON, offline-verifiable bundle "with no
  trust in the process that produced it." AI-agent specific. Word-for-word
  Shadow's pitch.
- **Halo Record**, **OpenFang** (Rust agent-OS Merkle audit trail), **Zylos**
  (agent-identity + signed provenance startup).
- **IETF is standardizing it:** SCITT capsule-provenance-binding ("Agent Action
  Capsules"), Agent Name Service v2, VAP — COSE-signed statements + transparency
  receipts, pointed directly at agents.

**Implication:** stop positioning on the primitive or on "we're first" (a single
GitHub search falsifies it). The primitive is commoditizing. **Shadow's only
durable moat is the banking-regulatory binding** — the reason-code dictionary,
Reg B / ECOA adverse-action (AA01–AA06), `dictionary_hash`, SR 26-2 framing,
CITATION_MAP — the regulator-legible layer none of the generic agent-audit repos
have. And **emit SCITT/COSE-compatible receipts** so Shadow rides the emerging
interop standard instead of being one more proprietary hash-chain.

## ICP + target list (who buys first)

Seed–Series B AI-native vendors (~10–150 people) that sell a *decisioning* or
*investigative* AI agent into banks/lenders, past first bank logo but not Big-4-
locked. Champion = Head of Compliance/Risk or founder-CTO; the trigger is
*external* — their bank customer's third-party-risk + model-governance diligence
demands evidence, and SOC 2 provably doesn't answer the model-governance
question.

**Start with AML/KYC / financial-crime agents** — their whole value prop is
already "audit-ready," they're the best-funded, and their bank buyers demand
investigation-trail evidence today:

- **Bretton AI** (formerly Greenlite) — $75M Series B Feb 2026; Robinhood,
  Mercury, Lead Bank. **Sardine** — $145M+, 300+ customers. **Unit21** —
  200+ institutions (Chime, Sallie Mae). **Hawk (Hawk:AI)** — explainable AML +
  SAR drafting.

Then **agentic underwriting/credit-decisioning** (most acute governance pain —
the decision *is* the regulated object): Taktile, Aloan (dev-heavy, newer);
Zest AI, Scienaptic (mature/entrenched — harder). Collections (Prodigal, TrueAccord)
and contact-center (Gradient Labs, interface.ai) are later/warm-up segments.
Governance platforms (Credo AI, Holistic AI, ModelOp) are competitors, not ICP.
*(Norm Ai unverified — confirm before outreach.)*

Reach them: ACAMS (the AML segment lives here), Money20/20, Fintech Meetup, YC
batches, MLOps/agent-eval Slack+Discord, and PRs into awesome-mcp-servers / AI-
governance lists.

## Distribution (OSS dev-tool playbook)

Every tiny-team win (Trivy, Snyk, Semgrep, Gitleaks, Comp AI) followed the same
path: **a single-binary/`npx` zero-config CLI that produces a real result in
<10 minutes, shipped day-one with a GitHub Action + pre-commit hook**, seeded via
Show HN + awesome-lists + GitHub topics.

- **Package the verifier AS the wedge** (done — `docs/wedge/verify-in-10-minutes.md`);
  the one remaining step is exposing an `npx`-runnable `bin` so it's `npx @shadow/verify …`.
- Ship a **GitHub Action + pre-commit hook** on day one; list on the Marketplace.
- **Become a default inside a bigger tool** (Trivy-in-Harbor pattern) beats
  announcements.

Failure modes to avoid: stars-without-integration graveyard repos; a self-serve
*individual* paywall (Snyk's documented failure — sell the org, not the dev);
over-gating the core CLI; pitching CISOs before bottoms-up usage exists.

## Pricing (open-core, fintech-first)

Give away the CLI, the format, single-record verification, and self-host —
**MIT/Apache, adoption is the moat.** Charge for the **hosted layer the team/
bank-facing buyer needs:** continuous verification, the **evidence/attestation
report a fintech hands its bank**, dashboards, key management, RBAC, retention,
SSO, SLA.

- **Self-serve entry $149–$499/mo** ($1.8K–$6K/yr) — Comp AI's $199/mo cloud is
  the tightest comp; publish these tiers (ACV < $25K → publish).
- **Growth $500–$1.5K/mo.** **Enterprise/SSO $25K+/yr "contact sales."**
- **MVP paid product** = the bank-facing governance evidence artifact (a hosted,
  continuously-refreshed verification report + one "trust page"), priced flat +
  usage allowance (not pure per-verification — compliance buyers hate
  unpredictable spend), scaling per-bank-relationship.
- Pitfalls: gating the CLI (kills adoption); pricing < ~$149/mo (reads as a toy
  in compliance); forcing a sales call for a $300/mo need.

## The go/reposition in one paragraph

Shadow is a real, small, defensible business **if** narrowed to third-party
agent-audit, sold OSS-first to AML/KYC + underwriting fintechs, on the
examiner-defensibility + auditor-independence argument, monetized via a hosted
bank-facing evidence report at published self-serve pricing. The primitive is
commoditizing, so the moat is the **banking-regulatory binding + SCITT interop**,
never "we invented the hash-chain." Whether to commit is Alex's call; this is the
evidence-backed path a solo founder can walk.

Full agent memos with all citations/URLs are in the 2026-07-16 research
transcripts.
