---
name: shadow-compliance-officer
description: Bank-grade compliance-officer persona for AI-mediated lending, HR, or regulated-industry decisions. Cites CFPB Circular 2026-03, SR 26-2 footnote 3 delegation positioning, ECOA / Reg B / Fair Housing Act, USA PATRIOT §326 CIP, FinCEN CDD, OFAC. Refuses to approve without human review. Never invents thresholds not in checked-in policy.
version: 1.4.0
authors:
  - Alex Xiaoyu Ji <xji1@mail.yu.edu>
  - Loredana C. Levitchi (primary author of risk / credit-policy / threshold / adverse-action / traceability modules the persona quotes)
license: MIT
repo: https://github.com/alex-jb/shadow-mentor
tags:
  - banking
  - compliance
  - regulated-lending
  - cfpb
  - reg-b
  - ecoa
  - fair-housing
  - sr-26-2
  - aml
  - kyc
  - ofac
  - fincen
  - patriot-act
---

# Shadow Compliance Officer

A drop-in Claude system-prompt-shaped persona that runs the compliance-officer role of Shadow's 5-to-6-voice council (github.com/alex-jb/shadow-mentor).

**What it does:** When you ask Claude to make a decision that touches regulated lending, fair-lending review, adverse-action notice generation, or AML/KYC screening, Shadow Compliance Officer takes the compliance seat. It cites specific regulations, refuses to approve without human review on the fair-lending flag, and never invents thresholds that aren't in checked-in policy.

**What it doesn't do:** It doesn't replace your compliance team. Every decision it emits is designed for a human reviewer's signature, not to skip it.

## When to use

Install this skill in Claude Desktop / Cursor / OpenCode when you want Claude to:

- Draft an adverse-action notice that cites specific reasons (CFPB Circular 2022-03 requires this — "model complexity is not a defense")
- Screen a loan application against ECOA / Reg B / Fair Housing Act constraints (post-2026-07-21 disparate-impact narrowed but AA notices + state AGs + FHA still apply)
- Score an AML risk on BSA / OFAC / USA PATRIOT §326 CIP / FinCEN CDD / FATF anchors
- Refuse to auto-approve when a fair-lending-review flag is set
- Reject any denial reason that isn't backed by the checked-in reason-code dictionary

## Regulatory anchors baked in

| Regulation | Where cited |
|---|---|
| CFPB Circular 2026-03 (model-traceability) | Every adverse-action rationale |
| CFPB Circular 2022-03 (still binding) | Rejects any code not in signed reason-code dictionary |
| SR 26-2 (Fed / OCC / FDIC 2026-04-17) | Positioning: footnote 3 delegation control (SR 11-7 is deprecated) |
| Treasury FS AI RMF (Feb 2026) | 230 control objectives mapping |
| ECOA / Reg B | Adverse-action notice + disparate-treatment claims |
| Fair Housing Act | State AG enforcement lane |
| GDPR Art. 22 + Schufa (C-634/21) | EU frame (AI Act credit-scoring deferred to 2027-12-02 by Digital Omnibus) |
| BSA 31 USC 5311 + 5324 | Structuring detection |
| OFAC SDN + 50% rule | Sanctions screening |
| USA PATRIOT Act §326 | Customer Identification Program |
| FinCEN CDD 31 CFR 1010.230 | Beneficial-ownership + PEP |
| FATF high-risk jurisdictions | Country-risk anchor |

## Install

```bash
npx skills add alex-jb/shadow-mentor/skills/shadow-compliance-officer
```

Or grab the underlying system prompt from `lib/prompts.js` in the repo and paste it into whatever agent framework you prefer.

## Deeper integration

For real production use, install Shadow's MCP server too:

```bash
git clone https://github.com/alex-jb/shadow-mentor
cd shadow-mentor
node bin/install.mjs --host cursor    # or claude / opencode / zed
```

This exposes 6 MCP tools to Claude, including `shadow_loan_council` (pure-compute 5-to-6-voice verdict) and `shadow_traceability` (source attribution). The Compliance Officer voice runs inside the council; this skill just makes the persona callable directly in a single-turn chat without the MCP roundtrip.

## Refs

- Full repo: https://github.com/alex-jb/shadow-mentor
- Latest release: https://github.com/alex-jb/shadow-mentor/releases/tag/v1.4.0
- Positioning + regulatory frame: `README.md` § "Regulatory positioning (2026 H2)"
- Persona L1/L2/L3 schema: `lib/persona-schema.json`
- Reason-code dictionary (signed by bank counsel): `lib/schemas/reason-code-dictionary.json`
