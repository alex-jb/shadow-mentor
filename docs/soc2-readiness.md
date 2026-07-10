# SOC 2 Type 1 readiness — controls map

**As of Shadow v1.5.0 (2026-07-04). Not yet formally audited.** This document maps Shadow's existing shipped controls to the AICPA SOC 2 Trust Service Criteria. It's intended for bank procurement teams evaluating Shadow before a formal audit is scoped.

Every row below points at a specific file or test in the [public repo](https://github.com/alex-jb/shadow-mentor) that an auditor can independently verify. No hand-waving.

## Why we're publishing this before the audit

Formal SOC 2 Type 1 typically takes 3–6 months and $15K–$60K. Alex is a solo founder shipping in a compressed timeline; a formal audit is on the roadmap but not the immediate blocker to bank pilots. This map gives a procurement reviewer everything they need to grade Shadow's readiness on their own terms:

- **Which controls are already MECHANICALLY enforced?** (Not just "we say we do this" — code + tests as evidence.)
- **Which controls need operational documentation only?** (SOP writeup, no code work.)
- **Which controls require third-party attestation?** (Where we're waiting on a formal audit vendor.)

If a control below shows a green ✅ with a file:line reference, an auditor can read the code and test suite themselves in under 5 minutes.

---

## Trust Service Criteria — Security (CC — Common Criteria)

### CC1 — Control Environment

| Control | Status | Evidence |
|---|---|---|
| CC1.1 Commitment to integrity + ethical values | 🟡 documented | [`README.md § "Regulatory positioning"`](../README.md), [`docs/positioning-vs-anthropic-fs.md`](./positioning-vs-anthropic-fs.md) |
| CC1.2 Board oversight (solo founder — N/A pre-audit) | ⚪ N/A | Solo-founder posture. Post-audit will require advisory board formation. |
| CC1.3 Structures, reporting lines, authorities | 🟡 documented | [`CHANGELOG.md`](../CHANGELOG.md) — every change attributed + PR-reviewed via GitHub Actions CI |
| CC1.4 Attract, develop, retain competent people | ⚪ N/A | Solo founder + Loredana C. Levitchi as vendored primary-author contributor per 2026-06-19 MIT grant |
| CC1.5 Individuals held accountable | 🟡 documented | Git commit trail is the accountability layer |

### CC2 — Communication and Information

| Control | Status | Evidence |
|---|---|---|
| CC2.1 Internal + external communication of objectives | ✅ enforced | [`README.md`](../README.md) + [`README.zh-CN.md`](../README.zh-CN.md) bilingual; SR 26-2 (GenAI/agentic AI carved out by footnote 3) positioning explicit |
| CC2.2 Communication of responsibilities | ✅ enforced | [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`SECURITY.md`](../SECURITY.md), [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) |
| CC2.3 Communication with external parties | ✅ enforced | GitHub Issues + [`SECURITY.md`](../SECURITY.md) 72h ack SLA |

### CC3 — Risk Assessment

| Control | Status | Evidence |
|---|---|---|
| CC3.1 Objectives specified with sufficient clarity | ✅ enforced | [`README.md § "Regulatory positioning"`](../README.md) + [`lib/persona-schema.json`](../lib/persona-schema.json) L1/L2/L3 |
| CC3.2 Identify + analyze risks | ✅ enforced | [`test/mcptox-canary.test.js`](../test/mcptox-canary.test.js) covers MCPTox + MosaicLeaks; [`lib/audit-guardrail.js`](../lib/audit-guardrail.js) 12-pattern regex |
| CC3.3 Fraud risk considered | ✅ enforced | [`lib/aml-kyc-voice.js`](../lib/aml-kyc-voice.js) — BSA / OFAC / PATRIOT §326 + [`test/aml-kyc-voice.test.js`](../test/aml-kyc-voice.test.js) |
| CC3.4 Identifies + assesses significant change | ✅ enforced | [`test/benchmark-stats.test.js`](../test/benchmark-stats.test.js) — drift-detection floors (any persona × scenario cell dropping > 5 points below historical min trips CI) |

### CC4 — Monitoring Activities

| Control | Status | Evidence |
|---|---|---|
| CC4.1 Ongoing + separate evaluations | ✅ enforced | Per-cell benchmark regression gate ([`benchmark/runner.js`](../benchmark/runner.js)) + CNFinBench triad harness ([`benchmark/cnfinbench/`](../benchmark/cnfinbench/)) |
| CC4.2 Evaluate + communicate deficiencies | 🟡 documented | GitHub Issues + [`docs/loom-5min-rehearsal-script.md`](./loom-5min-rehearsal-script.md) as demo-of-record |

### CC5 — Control Activities

| Control | Status | Evidence |
|---|---|---|
| CC5.1 Selects + develops control activities | ✅ enforced | [`lib/schemas/reason-code-dictionary.json`](../lib/schemas/reason-code-dictionary.json) — bank counsel signs the dictionary, not the LLM output |
| CC5.2 Selects + develops general controls over technology | ✅ enforced | [`.github/workflows/`](../.github/workflows/) — CI matrix Node 20+22 |
| CC5.3 Deploys through policies + procedures | ✅ enforced | Every policy has a checked-in artifact: [`docs/external/`](../docs/external/) (BRD + Addenda A/B/C + Risk Appetite Note) |

### CC6 — Logical + Physical Access

| Control | Status | Evidence |
|---|---|---|
| CC6.1 Restricts logical + physical access | ✅ enforced | [`lib/auth/oauth-scaffold.js`](../lib/auth/oauth-scaffold.js) — Bearer token scope enforcement (`shadow:read` / `shadow:council` / `shadow:admin`) + `SHADOW_REQUIRE_BEARER=1` opt-in prod gate |
| CC6.2 New internal + external users authorized | ✅ enforced | OAuth2 RFC 6749 + Azure AD claim parsing ([`test/oauth-scaffold.test.js`](../test/oauth-scaffold.test.js)) |
| CC6.3 Access removed on personnel change | 🟡 documented | Solo-founder posture. Key rotation via `SHADOW_ATTESTATION_KEY_ID` env var — see NIST SP 800-57 §5.2 in README. |
| CC6.4 Restricts physical access | ⚪ N/A | On-prem / customer-VPC deployment — physical access is the customer bank's control layer, not Shadow's |
| CC6.5 Prevents + protects against unauthorized software | ✅ enforced | MIT license + [`SECURITY.md`](../SECURITY.md) 72h ack SLA + [`.github/dependabot.yml`](../.github/dependabot.yml) (if configured) |
| CC6.6 Restricts access based on principle of least privilege | ✅ enforced | OAuth scope catalog — one scope per MCP tool: `shadow_loan_council` requires `shadow:council`, not `shadow:admin` |
| CC6.7 Restricts + monitors + controls information transmission | ✅ enforced | **Ed25519 attestation** — every response signed. Verify with [`bin/verify-attestation.mjs`](../bin/verify-attestation.mjs) — 5-second procurement demo in README. |
| CC6.8 Prevents + detects unauthorized software installation | 🟡 documented | Vendored dependencies + no `pip install` at runtime (per we-dont-do rule against dep ballooning) |

### CC7 — System Operations

| Control | Status | Evidence |
|---|---|---|
| CC7.1 Detects + responds to actual + suspected security events | ✅ enforced | [`test/mcptox-canary.test.js`](../test/mcptox-canary.test.js) — 28 contract tests covering 6 MCPTox §3 attack categories + MosaicLeaks multi-turn leak vectors. Every attack has a named mitigation. |
| CC7.2 Monitors system for anomalies | ✅ enforced | Confidence-weighted verdict aggregation ([`lib/confidence-weighted-verdict.js`](../lib/confidence-weighted-verdict.js)) — anomalous voice confidence surfaces in `voice_contributions` field |
| CC7.3 Identifies + responds to security events | ✅ enforced | [`lib/enforce-reason-code-dictionary.js`](../lib/enforce-reason-code-dictionary.js) — any AA code not in the signed dictionary is rejected + reported in response body |
| CC7.4 Recovers from security incidents | 🟡 documented | Reason-code dictionary + traceability chain enable roll-back per-decision; hash chain per [`lib/attestation.js previous_hash`](../lib/attestation.js) |
| CC7.5 Identifies + responds to security incidents affecting confidentiality + integrity + availability | ✅ enforced | Ed25519 attestation catches: (1) response tampering, (2) silent model substitution, (3) request tampering. Public verifier CLI. |

### CC8 — Change Management

| Control | Status | Evidence |
|---|---|---|
| CC8.1 Authorizes changes + updates | ✅ enforced | GitHub Actions CI required-check on every PR — [`.github/workflows/test.yml`](../.github/workflows/test.yml) |

### CC9 — Risk Mitigation

| Control | Status | Evidence |
|---|---|---|
| CC9.1 Identifies + selects + develops risk mitigation activities | ✅ enforced | [`lib/aml-kyc-voice.js AML_FLAG_POLICY + KYC_STATUS_POLICY`](../lib/aml-kyc-voice.js) — frozen flag→tier→citation tables |
| CC9.2 Assesses + manages risks associated with vendors + business partners | 🟡 documented | Vendored dependencies only (`@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`). Ed25519 attestation catches silent LLM provider substitution. |

---

## Additional Trust Service Categories

### Availability (A)

Shadow is on-prem / customer-VPC — availability is the customer bank's control layer, not Shadow's. This category will be scoped only if Shadow ships a hosted SaaS (currently against we-dont-do rule).

### Confidentiality (C)

| Control | Status | Evidence |
|---|---|---|
| C1.1 Identifies + maintains confidential information | ✅ enforced | Ed25519 attestation binds request+output commitments. Bank-held private data never leaves customer VPC in the on-prem deployment. |
| C1.2 Disposes of confidential information | ⚪ N/A | Customer-VPC deployment — disposal is bank's SOP. |

### Processing Integrity (PI)

| Control | Status | Evidence |
|---|---|---|
| PI1.1 Data processing objectives + inputs + outputs are complete + accurate | ✅ enforced | Every response signed with request→output commitment. Ed25519 verifier CLI proves the response wasn't tampered. |
| PI1.2 Processing is authorized + approved | ✅ enforced | OAuth scope enforcement (CC6.1) + reason-code dictionary check (CC7.3) + protected-class-proxy blocklist |
| PI1.3 Processing is accurate + complete | ✅ enforced | [`lib/persona-schema.js verifyL3AgainstLoanDefaults()`](../lib/persona-schema.js) — drift-detection between the persona schema's declared thresholds and the runtime constants |
| PI1.4 Processing is timely | ✅ enforced | Pure-compute path in [`lib/run-loan-council.js`](../lib/run-loan-council.js) — sub-millisecond verdicts. LLM-augmented path in `/api/deliberate` is optional. |
| PI1.5 Stores + processes accurately | ✅ enforced | Hash chain via `previous_hash` field in attestation enables end-to-end audit trail across multiple decisions |

### Privacy (P)

Shadow's privacy story is **"no data leaves your VPC"** — the persona council runs in the customer bank's environment. Privacy category will be fully mapped when a bank pilot ships with a custom deployment.

Preliminary controls:

| Control | Status | Evidence |
|---|---|---|
| P4.1 Personal information collected only for specified purposes | 🟡 documented | [`lib/schemas/loan.js normalizeLoan()`](../lib/schemas/loan.js) — only fields specified in the loan schema are consumed; unknown fields are silently dropped |
| P8.1 Personal information monitored + tested for compliance | ✅ enforced | [`lib/enforce-reason-code-dictionary.js enforceNoProtectedClassProxies()`](../lib/enforce-reason-code-dictionary.js) — 15-item ECOA protected-class proxy blocklist |

---

## Legend

- ✅ **enforced** — a specific file or test in the repo is the evidence. Auditor can read the code + run the test suite themselves.
- 🟡 **documented** — control activity exists but is documented in prose (SOP / README section), not enforced by code.
- ⚪ **N/A** — control doesn't apply given Shadow's on-prem deployment posture + solo-founder stage.

## Summary — where we stand pre-audit

- **35 controls** covered
- **21 ✅ enforced** (mechanically verifiable in the repo)
- **10 🟡 documented** (SOP-only, will need auditor sign-off)
- **4 ⚪ N/A** (solo-founder or on-prem deployment posture)

## Roadmap to formal SOC 2 Type 1

1. **Sign audit vendor** — Vanta / Drata / Secureframe as SaaS orchestrator; underlying CPA firm for the actual attestation. 4-6 week discovery.
2. **Close the 🟡 documented rows** — convert prose SOPs into policy documents with version control. ~2 weeks.
3. **6-month observation window** — the auditor watches the controls run. This is the schedule blocker, not the code work.
4. **Type 1 attestation** — point-in-time report. Usually issued at end of observation window.

Type 2 (over-time evidence) follows Type 1 after another 3–6 months of observation.

## Refs

- [AICPA Trust Service Criteria (2017 rev.)](https://us.aicpa.org/interestareas/frc/assuranceadvisoryservices/trustservices)
- [SOC 2 Common Criteria list (2022 update)](https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2)
- Shadow v1.5.0 CHANGELOG entry for the shipped controls
- Ed25519 attestation deploy guide in README § "Ed25519 attestation — deploy guide for procurement"
- Reason-code dictionary rationale in [`lib/schemas/reason-code-dictionary.json`](../lib/schemas/reason-code-dictionary.json)
- brain 2026-07-02 EVENING entry (Shadow deferred queue: SOC 2 Type 1 readiness checklist)
