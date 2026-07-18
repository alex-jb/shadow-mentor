# Shadow · positioning · provenance

**v0 · 2026-07-15.** Anchor doc for the "what does Shadow actually deliver" question. Replaces the flight-recorder-only framing everywhere it appears in outward-facing surfaces.

**Practitioner input date:** 2026-07-15. Two working banking-audit professionals (one Chief Audit Executive / IT Audit consultant, one M&T Bank audit consultant) reviewed the Shadow v2.0.3 evidence bundle and returned a written positioning verdict. This document restates that verdict in our own words, notes what our current code literally delivers vs. what the verdict asks for, and drafts (not publishes) new hero copy for README / Show HN / ICAIF.

---

## The one sentence

**"Prove what the AI originally produced, before a human changed it."**

This is a value description, not a technology description. It names the audit gap the code fills. It replaces:

- ~~"A flight recorder for AI agents."~~ (technology description; retired)
- ~~"Every session becomes a signed evidence bundle."~~ (feature list; retired as lead)

The value description is the lead. The technology and feature list are the substantiation, not the promise.

---

## What our current code literally delivers (v2.0.3, verified 2026-07-15)

The Claude Code adapter emits a `tool_call` event for every AI-driven file write / shell / tool invocation. That event carries:

- `payload_hash` — SHA-256 of the canonical AI-produced tool input at emission time
- `payload_ref` — self-referential pointer to the hash
- `prev_hash` — chain link to the previous event
- All of the above are Ed25519-signed at seal time via the batch_root

**What this proves to an independent verifier:**

1. "At time T, this operator's key signed a chain that includes an event with payload_hash X."
2. "Anyone holding a candidate file can compute its SHA-256 and confirm whether it IS or IS NOT what the AI produced at time T."
3. "If the chain has been altered after signing, the offline verifier will surface a `prev_hash_mismatch` at the tampered seq."

**What this does NOT deliver today (honest gap):**

1. The raw AI-produced content is **not** persisted in the bundle. Only its hash is. To reconstruct "what the AI wrote," an auditor needs the candidate file from an outside source (git, disk, backup) and a hash comparison. The bundle by itself cannot render the AI's original output as bytes.
2. Modifications made outside a Claude Code session (developer editing the file directly with a text editor) are **not** captured by the adapter, since no Claude Code hook fires for them. Detecting such modifications requires a downstream diff between the bundle's payload_hash and the candidate file's SHA-256.

**Consequence for hero copy:** we may claim "cryptographic proof of what the AI originally produced" (true today). We may **not** claim "preserves the AI's original artifact" verbatim (misleading given the current schema). Closing that gap is the first inline-payload work item; see [`research/inline-payload-implementation-plan-2026-07-15.md`](./research/inline-payload-implementation-plan-2026-07-15.md).

---

## Draft hero copy (NOT SHIPPED · pending eng gap closure decision)

### Candidate A · README first paragraph (fingerprint framing, honest today)

> Prove what the AI originally produced, before a human changed it. Every AI-driven action in a Claude Code session is cryptographically fingerprinted at production time, hash-chained into an offline-verifiable evidence bundle, and signed with an Ed25519 key that lives outside the agent's boundary. An auditor with a public key can independently confirm whether any file, three years later, IS or IS NOT the byte-for-byte output the AI wrote — no network call, no server trust, one HTML file.

### Candidate B · Show HN title (fingerprint framing)

> Show HN: Shadow — cryptographic fingerprint of what AI code assistants originally produced, before your developer changed it

### Candidate C · Show HN title (after inline-payload ships)

> Show HN: Shadow — the AI's original output, preserved and independently verifiable

---

## What Lora and Janna asked for that we DO cover today

The audit-industry positioning verdict included this line, verbatim: *"Can I verify the signatures without using your platform? This is extremely important. If verification depends on the vendor's own application: confidence decreases. If verification can be performed independently: confidence increases substantially."*

This is item #5 in the seven-gap ledger and it is the one Shadow has already won:

- `verify.html` runs in any browser, offline, from a USB stick
- `npx shadow-verify` CLI runs in any Node runtime, no Shadow server required
- GitHub Action `alex-jb/shadow-verify` runs in any CI, no Shadow server required
- All three surfaces compute the same math on the same bundle and agree byte-for-byte

**Talking point next time an auditor asks about verification independence:** "That's the one thing we've been designing for since day one. No Shadow server ever needs to be online for you to verify a bundle. If Shadow the company disappears tomorrow, your audit trail from today still verifies."

---

## Scope boundary (from the seven-gap ledger)

Two more gaps admit a partial answer with the current codebase:

- **Supply chain (gap #6)** — model provider + api_version + runtime config are today OPTIONAL extensions on the header. M2.2 Phase 2 already pins `discovered_model_id` and `discovered_agent_version`; adding provider + api_version is small work.
- **Human judgment (gap #3)** — `human_approval` is a supported event type but has no structured schema. Adding approver_id / role / timestamp / comments as first-class fields is the Task C minimum.

The remaining four gaps (completeness enforcement, identity binding to SSO/MFA, governance policy ownership, enterprise integration into Jira/GitHub/ServiceNow/GRC) are explicitly OUT OF SCOPE for Shadow. See the seven-gap ledger for the full posture.

---

## ICAIF conclusion candidate

Working draft for the Milan paper (Section 7). Refined from the practitioner input, not verbatim from it:

> Shadow's principal contribution is not the replacement of existing audit controls, but the strengthening of AI-provenance coverage by capturing a cryptographic fingerprint of the AI's original artifact at production time and preserving that fingerprint in an independently verifiable evidence chain. When paired with an operator's identity, change-management, and governance systems, the resulting evidence package narrows the historical audit gap between what an AI produced and what a developer subsequently modified before deployment.

**Attribution note:** the framing is grounded in practitioner input from 2026-07-15 audit-professional review. It does not claim to reproduce any specific regulator's or institution's internal checklist.

**Lora Levitchi co-authorship status:** still pending confirmation. Do NOT list her as an author of this paper without an explicit written yes.

---

## What NOT to do

- Do not ship any of the draft copy above into README, Show HN, or the paper without an eng decision on the inline_payload gap. If the gap stays open through 8/2, use "fingerprint" phrasing (Candidate A + B). If we close the gap before 8/2, we may use the stronger "preserves" phrasing (Candidate C).
- Do not commit any of these seven gaps as roadmap items unless they are in the SUBSCRIBED bucket (independent validation = shipped, supply chain + human judgment = 18-day work). The four OUT OF SCOPE gaps must be listed in the README's "what Shadow is not" section, not the roadmap.
- Do not describe Shadow as a "governance platform" or "GRC solution" anywhere. It is one control within a larger governance framework. That is the practitioner-verified positioning and it is more defensible than the platform framing we have used in prior drafts.
