# Auditor sufficiency gaps · Shadow posture · 2026-07-15

**Practitioner input date:** 2026-07-15. A Chief Audit Executive / IT Audit consultant, reviewing the Shadow v2.0.3 evidence bundle, returned a seven-item list of reasons that cryptographic signing alone is insufficient for procurement-grade audit sign-off. This document is Shadow's honest posture against each item. Not a roadmap. A scope statement.

**Rule of discipline:** the four items marked OUT OF SCOPE must NOT be silently promoted to roadmap items later. If we ever build them, that is a strategic pivot that requires its own explicit decision.

---

## The seven items

| # | Gap | Shadow's posture | Notes |
|---|---|---|---|
| 1 | **Completeness** — how do we know every AI-assisted change generated an evidence package? Developers can bypass. | ❌ **OUT OF SCOPE** | Requires SSO / policy engine / developer-side enforcement. Belongs in the operator's CI + IDE + DevOps governance stack. Shadow provides a receipt; it does not enforce that every AI-assisted action produces one. |
| 2 | **Identity** — who actually generated the prompt? Needs MFA / SSO / service-account binding. | ❌ **OUT OF SCOPE** | Requires enterprise IAM integration (Okta / Entra / Ping). Shadow records `header.agent.identity_ref` today but does not bind to enterprise identity providers. Belongs in the operator's IAM. |
| 3 | **Human judgment** — evidence shows someone approved, does not show meaningful review occurred. | 🟡 **PARTIAL · 18-day work (Task C)** | `human_approval` event type exists today but no structured fields. Adding approver_id / role / approval_timestamp / approval_comments as first-class extension is small work. Cannot itself prove the reviewer read carefully — the evidence surfaces what the reviewer said, not what they thought. |
| 4 | **Governance** — which policy requires it? Who owns? Retention? Exceptions? | ❌ **OUT OF SCOPE** | Requires policy management system, records management, exception workflow. Belongs in the operator's GRC platform. Shadow can carry a `header.custom.policy_refs[]` reference by hash but does not host or evaluate policy text. |
| 5 | **Independent validation** — can I verify without using your platform? | ✅ **ALREADY WON** | Shipped since v2.0.0. `verify.html` (offline browser · WebCrypto), `npx shadow-verify` (any Node), GitHub Action (any CI). All three produce byte-identical verification reports from the same bundle. Zero Shadow-side infrastructure required. This is the single most important item in the list; it also happens to be the one we already deliver. |
| 6 | **Supply chain** — how do we know the AI model itself was not changed? Needs model version, provider, API version, configuration, runtime metadata. | 🟡 **PARTIAL · 18-day work** | M2.2 Phase 2 already pins `discovered_agent_version` and `discovered_model_id` on the header. Adding `provider` (anthropic / openai / azure), `api_version`, and `runtime_config` fingerprint is a schema extension the adapter can populate from the same transcript source. |
| 7 | **Enterprise integration** — how does this connect to Jira / GitHub / ServiceNow / Azure DevOps / Jenkins / existing GRC? | ❌ **OUT OF SCOPE** | Requires connector adapters for each destination system. Belongs in the operator's integration layer or a downstream vendor. Shadow ships a bundle; how the operator ingests it into their GRC is their choice. |

---

## The distribution

- ✅ 1 item ALREADY WON (independent validation)
- 🟡 2 items PARTIAL, 18-day work (human judgment · supply chain)
- ❌ 4 items OUT OF SCOPE (completeness · identity · governance · enterprise integration)

The four OUT OF SCOPE items are a governance platform. Shadow is a control within a governance framework, not a platform. This is a deliberate scope choice; see [`../POSITIONING_PROVENANCE.md`](../POSITIONING_PROVENANCE.md).

---

## Copy for the "what Shadow is not" section of README

Draft, not yet shipped:

> Shadow is a cryptographic-evidence control. It is not a governance platform. It does not enforce that every AI-assisted change generates an evidence package (that is your CI + IDE + policy layer). It does not bind prompts to enterprise identity (that is your SSO / IAM). It does not host policy text or evaluate governance rules (that is your GRC platform). It does not integrate into Jira, ServiceNow, or Azure DevOps out of the box (bundles are JSON; wire them into your existing ingestion). Within that boundary, Shadow does one thing very well: it produces a cryptographic fingerprint of what the AI originally produced and preserves it in an independently verifiable evidence chain that survives your platform, your team, and the passage of time.

---

## Attribution

Practitioner input, 2026-07-15. Two working banking-audit professionals reviewed Shadow v2.0.3 in writing. No claim is made that either practitioner has formally endorsed Shadow, or that their organizations have adopted it. The item list and framing above is paraphrased from private practitioner correspondence and does not reproduce their document verbatim.
