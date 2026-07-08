# Shadow for Bank Compliance Officers

**A 5-page overview in plain English. No cryptography vocabulary. No academic references. If you are a CTO or engineer, read `README.md` instead.**

---

## What Shadow does in one sentence

Shadow reads a loan application, runs it through a five-voice review council (credit, compliance, risk, applicant advocate, macro contrarian), and produces a written verdict + a §1002.9(b)(2)-compliant adverse-action notice that a regulator can trace back to specific CFR sections and Fed / OCC / CFPB citations.

## The three fine axes Shadow addresses

Shadow was built to reduce risk on the three biggest CFPB fine axes for loan origination:

### 1. §1002.9(b)(2) — Adverse-action notice must be specific

The CFR text: "Statements that the adverse action was based on the creditor's internal standards or policies or that the applicant... failed to achieve a qualifying score on the creditor's credit scoring system are insufficient."

Recent CFPB enforcement actions where §1002.9(b)(2) failures cost the bank real money:

- **CFPB v. Fifth Third (2020)** — $18M restitution + civil penalty. Adverse-action notices cited "internal underwriting standards" instead of specific reasons.
- **CFPB Bulletin 2022-07** — clarified that "algorithmic denials" still require specific reasons. Banks relying on ML models without traceable reasons flagged for enforcement.
- **CFPB Circular 2023-03** (withdrawn) → replaced by CFR §1002.9(b)(2) statutory language in Shadow v1.5.21+.

**What Shadow does**: every adverse-action notice Shadow drafts pulls the specific reason from a signed, versioned dictionary. Every sentence in the notice traces to a specific CFR citation. The notice is emitted in English and Spanish (§1002.4 bilingual disclosure rule). Template phrases the CFR names as insufficient ("internal standards", "did not achieve a qualifying score") are refused by the system, not just discouraged.

### 2. §1002.6(b) — Protected-class term leakage

The CFR text: "A creditor may not consider... any information that it is barred by § 1002.5 from obtaining or from using for any purpose other than to conduct a self-test."

Recent CFPB enforcement actions:

- **CFPB v. Ally Financial (2013)** — $98M settlement. Underwriting model used ZIP code as proxy for protected class.
- **HUD v. Facebook (2019)** — $5M settlement. Ad targeting used age and ZIP as protected-class proxies.

**What Shadow does**: Shadow ships an explicit protected-class proxy detector for both US-ECOA (race, color, religion, national origin, sex, marital status, age, public assistance) and EU-GDPR jurisdictions (adds nationality, sexual orientation, health status, union membership). When a proposed loan-underwriting feature correlates with a protected class above threshold, Shadow blocks the underwriting decision before it reaches production. If a protected-class term ever appears in a Shadow-drafted adverse-action reason sentence, the system refuses to emit the notice at all.

### 3. §1002.4 — Bilingual disclosure

The CFR text requires certain disclosures in the applicant's principal language when the bank markets in that language.

**What Shadow does**: every adverse-action notice ships in English AND Spanish, side by side, in a single response. The bank does not need to run the notice through a separate translation vendor.

## What it looks like day-to-day

The compliance officer's actual workflow with Shadow in the loop:

1. **Loan officer submits application** through the bank's origination system as usual.
2. **Shadow's five-voice council runs** (~10 seconds, or ~1 second if the bank is on the deterministic path). Each voice writes a rationale citing specific CFR sections.
3. **Verdict emitted**: approve / escalate / block.
4. **If block or escalate**, Shadow drafts the adverse-action notice text in English + Spanish, with every citation traced.
5. **Compliance officer reviews the notice** in the Shadow dashboard or the bank's own review UI. Approve or edit before it goes to the applicant.
6. **The whole exchange is logged** with a unique fingerprint the regulator can independently verify. If a CFPB examiner asks in 2028 "why was this loan denied", the compliance officer pulls the fingerprint and the answer is one click.

## What YOU actually do with it

You do not:

- Rewrite adverse-action notice templates
- Chase down which model version was in production when a denial happened
- Explain to legal counsel what the algorithm "thought"

You do:

- Review Shadow-drafted notices in-app, approve or edit
- Point regulators at the fingerprint when they audit
- Sign off on the citation dictionary quarterly (Shadow ships a signed, versioned dictionary; you approve changes)
- Run the monthly Judge Card review (Shadow publishes a 3-metric reliability report; you read it in 10 minutes)

## Five questions your CTO / CISO will ask

Show them the answers below. This shortens the vendor risk review from six weeks to two.

### 1. "Where does our data go?"

Shadow runs on-premise or in your own cloud tenant. Shadow does not host or store your loan data. If you use Shadow with a hosted LLM (Anthropic Claude, OpenAI GPT, or Zhipu GLM), the LLM sees only the specific fields the persona voice needs — Shadow filters per persona so the credit voice never sees the applicant narrative and the compliance voice never sees the credit score.

### 2. "How is our data cryptographically isolated from other Shadow customers?"

Each customer bank receives a per-tenant cryptographic key derived from a Shadow master secret. Bank A cannot verify Bank B's audit trail. Bank A cannot recover Shadow's master secret from its own key.

### 3. "What happens if the AI model is silently swapped?"

Every verdict Shadow emits carries a fingerprint of the exact model version + the sampling parameters. If an AI provider silently switches models mid-quarter, Shadow's verification catches it independently of the provider.

### 4. "Can we audit past decisions?"

Every decision Shadow makes is chained to the previous decision. Reordering, inserting, or editing any past decision breaks the chain and is detectable. Your bank's audit team can independently verify the chain without Shadow's help.

### 5. "Is this a Snowflake-Truera situation where we get locked in?"

Shadow is MIT-licensed open source, hosted at github.com/alex-jb/shadow-mentor. If Shadow the company disappears tomorrow, your bank can continue running Shadow the software on its own infrastructure. The audit trail your bank produced under Shadow stays verifiable independently.

## What Shadow is NOT

Shadow is not a replacement for your bank's credit underwriting model. Shadow is a review and audit layer that runs after underwriting. Your existing credit model stays in place; Shadow reviews the model's decision and produces the notice.

Shadow is not a substitute for legal counsel. The adverse-action notices Shadow drafts follow §1002.9(b)(2) grounded in the CFR text, but a compliance officer or legal counsel still approves each notice before it goes to the applicant.

Shadow is not FDIC-insured, FINRA-registered, or under any specific regulatory examination regime. Shadow is a software tool your bank operates. Regulatory obligations remain with the bank.

Shadow does not handle KYC/CIP identity verification. It integrates with your existing KYC vendor (Alloy, Persona, Trulioo, etc.). Shadow's role is at the credit-decision + adverse-action layer, not identity onboarding.

## Trial path — how to run 100 test loans through Shadow in a week

Week 1 pilot, no production integration:

- **Day 1**: bank compliance officer sends Shadow 20 past denied loan applications with all PII redacted. Shadow returns the verdict + adverse-action notice for each.
- **Day 2**: compliance officer reads through the 20 notices. Compares Shadow's drafted notice to the bank's actual sent notice. Flag anywhere Shadow's version is either (a) more specific per §1002.9(b)(2) or (b) missing a required element.
- **Day 3-4**: bank feeds Shadow 80 more redacted historical denials. Compliance officer scores each on a 3-column sheet: Shadow's verdict correct / Shadow's citation grounded / Shadow's language usable in production.
- **Day 5**: readout. What percentage of Shadow's verdicts matched the bank's original decision? What percentage of Shadow's notices were more specific than the bank's original? What percentage would have avoided a specific CFPB enforcement risk pattern?

The pilot generates a real answer to "would this reduce our §1002.9(b)(2) fine tail?" in one week, on real (historical, redacted) bank data, without changing production systems.

## What we ask for after the pilot

If the pilot shows Shadow's notices are demonstrably more specific + demonstrably better-grounded than the bank's current notice-drafting workflow:

- **Month 2**: Shadow runs in shadow mode on live originations (Shadow sees the decision, does not modify it, drafts the notice in parallel with the bank's current process). Compliance officer compares side-by-side.
- **Month 3**: Shadow-drafted notice replaces the bank's current draft as the starting point for compliance officer review. Bank still approves each notice before it goes to the applicant.
- **Quarter 2**: Shadow signs its verdicts with a bank-specific key. All Shadow-emitted records become part of the bank's regulatory audit trail.

## What is different about Shadow vs. Comply.ai / Holistic AI / ModelOp

The other governance vendors focus on "responsible AI governance" — model registry, ethical assessment, monitoring dashboards. Useful, but they do not draft adverse-action notices, and their audit trails are not cryptographically verifiable independently of the vendor.

Shadow's specific differentiators, in language a compliance officer cares about:

- **Emitted notice text**: Shadow produces the specific bilingual adverse-action language that goes to the applicant, grounded in the CFR. Comply.ai and Holistic AI produce assessments, not notices.
- **Independent verifiability**: if Shadow disappears tomorrow, your audit trail stays verifiable using open-source tools. The other vendors' audit trails require the vendor's platform to verify.
- **§1002.6(b) refusal invariants**: Shadow refuses to emit a notice containing protected-class terms in the reason sentence. This is a hard code-level guarantee, not a monitoring alert.
- **§1002.4 bilingual by default**: Shadow ships EN + ES in one response. No separate translation vendor.

## Where to go from here

Compliance officer path:

1. Send this document to your CTO or CISO
2. Ask for a 30-minute demo — the bank feeds Shadow one redacted historical denial in real time, sees the notice come back
3. If the demo lands, propose the Week-1 pilot above to the bank's chief credit officer

Contact: alex@shadow-mentor.dev (or the equivalent contact on your Shadow procurement package).

## Related documents

- `README.md` — technical overview for engineers
- `docs/CITATION_MAP.md` — every regulatory citation Shadow uses, with primary-source URLs
- `docs/GAICF-COMPATIBILITY.md` — three-layer control framework mapping (for CTOs / CISOs)
- `docs/PER-TENANT-KEY-ISOLATION.md` — data isolation answer for vendor risk assessment
