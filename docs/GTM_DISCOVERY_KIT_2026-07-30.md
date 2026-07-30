# Shadow — Discovery & GTM Starter Kit
*2026-07-30 · the "stop building, start selling" kit · the #1 output of the full scan*

The whole scan converged on one thing: **you have never validated that a single institution will pay.** This kit exists to fix that in the next 30 days. The goal is not a signed deal — it's **one real conversation with a fair-lending / model-risk owner who is bleeding.** Everything below serves that.

---

## 0 · The one thing to internalize
- **Lead with independence, not crypto.** "Others log their own agents; Shadow verifies anyone's — independently." Crypto is free from Microsoft now; it's plumbing, never the pitch.
- **The moat is Lora's fair-lending domain logic + Reg-B/GDPR-Art-22 reason-code depth.** Use it.
- **EU-first.** GDPR Art. 22 + *Schufa* C-634/21 + *Dun & Bradstreet* C-203/22 are enforceable **today** — that's the live pain. US (CFPB defunded) is softer.
- **Sell the concierge version by hand first** (§4). Ship code only after someone pays for the manual artifact.

---

## 1 · The pitch (memorize the 30-second version)
> "When your AI/ML model denies a loan applicant and an examiner or a rejected customer asks *why*, you have to produce a specific, defensible reason — and prove the record wasn't rewritten. Today that's two weeks of manual reconstruction + outside counsel. Shadow is the **independent verifier** that turns any AI credit decision into an examiner-ready adverse-action report — Reg B / GDPR Art. 22 reason codes, tamper-evident, re-verifiable in your own CI. We're not the model vendor grading our own homework; we're the non-conflicted third party the examiner actually needs."

**The single scoped offer:** *adverse-action verification for AI credit decisions.* One workflow. Not 6 personas, not AML, not glasses.

---

## 2 · Target list — who feels this pain first

### A. EU-exposed fintech lenders (PRIMARY — fastest to a paid pilot)
Criteria: automated/ML consumer or SME credit decisions + EU data subjects (GDPR Art. 22 live) + a compliance owner who can pilot on de-identified data without a 12-month bank TPRM cycle.

| Company | Country | Why them (trigger) |
|---|---|---|
| **Younited Credit** | FR | Fully-automated consumer credit at scale; French CNIL + Art. 22 explainability is a live obligation |
| **auxmoney** | DE | ML-driven consumer lending; Schufa-country, right-to-explanation directly applies |
| **Zopa** | UK | Bank-licensed digital lender, heavy ML underwriting; UK GDPR + FCA Consumer Duty explainability |
| **Lendable / Oakbrook / Abound** | UK | ML consumer credit, actively tuning models; small compliance teams that feel the manual pain |
| **iwoca / Funding Circle / October** | UK/FR | SME lending with automated scoring; explainability + audit trail asks from partner banks |
| **Klarna / Zilch / Scalapay** | SE/UK/IT | BNPL = automated credit decisions on huge volume; regulatory heat rising on BNPL affordability |
| **Kreditz / Taktile / Rich Data Co** | EU | *Decision-engine vendors to lenders* — a channel: they need an independent audit layer their bank clients trust (or a partner, not a competitor) |
| **Solaris / Swan / Griffin** | DE/FR/UK | Banking-as-a-service — their lending clients inherit the audit obligation; one BaaS deal = many downstream |

*Pick 10–12 of these, find the fair-lending / model-risk / compliance owner on LinkedIn, and open a conversation. Skeptics > believers.*

### B. Channel — consultancies & agent-platform vendors (PARALLEL bet)
The governance spend attached to Anthropic's *Claude for Financial Services* deals is currently captured by services firms, not product. An **independent OSS verifier they embed** reaches banks without you selling to procurement.

- **Big 4 AI-governance / model-risk practices** (Deloitte, KPMG, PwC, EY) — the person running "AI model validation for banking clients."
- **Boutique model-risk / fair-lending advisories** (e.g. Charles River Associates, Prometeia, fintech-focused RegTech consultancies).
- **AI-agent platform vendors** shipping into FS who need a governance add-on to close deals.

### C. Do NOT chase yet
Mid-market banks direct (2027-paced procurement), auditors/examiners (glacial), pure developers (champion-generation, not buyers).

---

## 3 · Outreach templates

### Cold email — fintech lender compliance/model-risk owner
> **Subject: independent adverse-action verification for your AI credit decisions**
>
> Hi {First},
>
> Quick one — when your underwriting model denies an applicant and someone (an examiner, or the applicant under GDPR Art. 22) asks *why*, how long does it take your team to produce the specific, defensible reason and prove the decision record wasn't altered?
>
> I built Shadow with a banking model-risk collaborator: an **independent, open-source verifier** that turns each AI credit decision into an examiner-ready adverse-action report — Reg B / Art. 22 reason codes, tamper-evident, re-verifiable in your own CI. We're not the model vendor; we're the non-conflicted third party.
>
> Not selling anything today — I'm trying to pressure-test it against 3–4 teams who actually live this. Worth 20 minutes to show you how it'd map to one of your denied cases?
>
> {Alex} · {link to the 1-page brief}

### LinkedIn connect note (300 chars)
> Building an independent, open-source verifier for AI credit decisions — Reg B / GDPR Art. 22 adverse-action reason codes, tamper-evident, re-verifiable. Pressure-testing with a few EU lending compliance teams. Would value 20 min of your reality-check — open to it?

### Consultancy / channel note
> You're likely fielding "how do we govern the AI agent" questions from banking clients post-Anthropic-FS. Shadow is an OSS, independent decision-verifier you could embed in those engagements — banking reason-code depth (Reg B / Art. 22) + tamper-evident audit, MIT core. Worth a look as a delivery accelerator?

---

## 4 · The concierge pilot (sell this by hand, first)
Before automating anything, sell the *outcome* manually to prove someone pays:

**Offer:** "Send me 5–10 of your AI-denied applications (de-identified). Within 48h I return, for each: the specific Reg-B/Art-22 adverse-action reason codes, a plain-language explanation an examiner accepts, and a signed, re-verifiable record. **$2K for the batch.**"

- You run it by hand (council + reason-code dictionary + attestation — the code already does this).
- The deliverable is the examiner-ready report + the offline verifier they can re-run.
- **The written trigger:** "if this saves your team time, the automated version (runs in your CI) is $X/mo — decision by {date}."
- One paid batch = your first validated dollar + the case study + the reference.

---

## 5 · Champion one-pager (turn the paper into ammunition)
The IEEE paper is **not** procurement currency — a vendor-risk office doesn't score peer review. Convert it into a one-page artifact your champion forwards internally:

**"Why Shadow's audit is rigorous" (1 page):**
1. **Independence** — verifies third-party agent output, not its own (the examiner's requirement).
2. **Reg-B/Art-22 reason-code mapping** — each decision tied to a regulation and a test (the CITATION_MAP).
3. **Tamper-evidence** — Ed25519 + hash-chain, re-verifiable offline in the bank's own CI, no trust in the vendor.
4. **Deterministic verdict** — rules decide; the LLM only writes rationale, so the decision is reproducible.
5. **Peer-reviewed method** — {IEEE paper ref} for the reviewer who wants the rigor.
6. **Honest scope** — states exactly what it does and does not prove.

Plus a **downloadable 1-page security/architecture brief** (Ed25519 + hash-chain + local-first + zero-telemetry) a risk officer can attach to an internal ticket.

---

## 6 · The 30-day discovery sprint (do this, not more code)
1. **Week 1** — build the named list (10–12 lenders + 3 consultancies), find the right person on LinkedIn, ask Lora for 1–2 warm intros.
2. **Week 2** — send 20 personalized outreaches (email + LinkedIn). Target: 3–5 conversations booked.
3. **Week 3** — on each call, map Shadow to ONE of their real denied cases (the concierge demo). Listen for the budget line + the pain, not for praise.
4. **Week 4** — land 1 concierge pilot ($2K, by hand) with a written date to convert to the automated version.

**The metric that matters:** not GitHub stars, not releases — **one compliance owner with a budget and a live pain who takes the call.** If you can't find that person in 30 days, the market is still 2027 — throttle to nights-and-weekends OSS and revisit Q1 2027.

---

*Pairs with `docs/SHADOW_FULL_SCAN_2026-07-30.html` (the strategy) and `docs/CITATION_MAP.md` (the reason-code depth that is the moat). The kill-switch: this only works if you actually send the outreach. Building is the comfortable substitute for the uncomfortable call — resist it.*
