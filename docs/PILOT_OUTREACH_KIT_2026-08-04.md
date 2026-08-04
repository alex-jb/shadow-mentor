# Shadow — pilot outreach kit
*The review's #1 next move: get one real compliance officer to run one real denied application. This is the kit to make that happen. 2026-08-04.*

> Discipline (from the JTBD research): this buyer is defensive, personally exposed, and regulation-fluent. They trust **specific citations, admissions of the lender's own liability, and examiner vocabulary**; they distrust **superlatives, "AI magic," and anything implying the tool absorbs their accountability.** Every word below leads with the reg section, not the technology. No fabricated metrics. Cite **GDPR Art. 22 + Schufa C-634/21** (live) and **CFPB Circular 2022-03 / Reg B §1002.9(b)(2)** — never "EU AI Act" (deferred 2027).

---

## 1 · Who to target (in priority order)
1. **Fair-lending compliance officer** or **Model Risk Management (2nd-line) analyst** at an **EU-exposed fintech lender** (GDPR Art. 22 + Schufa make automated-decision explanation legally live today). Title cues: "Head of Fair Lending", "Model Validation Lead", "Adverse Action Specialist", "Chief Compliance Officer (lending)".
2. Same role at a **US fintech lender** using AI/ML underwriting (Reg B + CFPB Circular 2022-03 make the "explain your model's specific reasons" obligation live).
3. NOT the data-science team (they built the model — they're the problem being managed, not the buyer).

**Best channel: warm intro through Lora.** She has mid-tier banking contacts (`Correspondence/ECC-2026/lora-mid-tier-contacts-2026-07-07.md`) and the fair-lending domain standing. A one-line intro from her outperforms any cold email — use §3 first, §4 only as fallback.

## 2 · The one-pager (hand this over / paste into a deck)

> ### When the examiner asks why your model denied that applicant, can you answer in an afternoon?
>
> Under **Reg B / ECOA §1002.9(b)(2)** you owe each denied applicant the **specific** principal reasons — not FCRA "key factors," not "did not meet our proprietary model." **CFPB Circular 2022-03** is explicit: *a creditor's lack of understanding of its own methods is not a defense.* In the EU, **GDPR Art. 22 + Schufa (C-634/21)** make the same per-decision explanation legally live today.
>
> **Shadow** is the independent, open-source verifier for AI credit decisions. We didn't build your model — which is exactly why your regulator trusts us to check it. For each denied decision, Shadow:
> - maps the model's output to the **specific §1002.9(b)(2) principal reasons** (and refuses to guess when it can't ground one);
> - drafts the compliant notice for your officer to review, edit, and **sign off**;
> - seals the whole decision — reasons, notice, model manifest — into a **signed, hash-chained record your examiner re-verifies offline, with no account and no trust in us**. If anyone alters it after the fact, verification fails and names the exact step.
>
> It runs on your data, in your environment (no applicant PII leaves it). It's analysis-only — it never makes or changes the lending decision. MIT-licensed; you can read every line and run it yourself.
>
> **The ask:** bring us **one real denied application**. In 20 minutes we'll show you the exam-ready trace + the record your examiner can verify. If it's not obviously useful, we part as friends.

## 3 · Warm-intro request to Lora (send this to Lora, not the prospect)

> Hi Lora — quick ask. The Shadow adverse-action piece is at the point where one real denied-loan file from a fair-lending or model-risk person would tell us everything: does the exam-ready trace + the offline-verifiable record actually save them time on a real exam. Is there anyone in your mid-tier contacts who owns fair-lending or model validation at a lender using AI/ML underwriting (EU-exposed ideal, US fine) who'd give me 20 minutes? I'd keep it concrete — they bring one denied application, I show the trace and the verify step, no pitch deck. Happy to send you the one-pager to forward. Thanks!

## 4 · Cold email (fallback only — short, reg-led, no hype)

> **Subject:** verifying your AI model's adverse-action reasons — 20 min?
>
> Hi [Name],
>
> You owe each denied applicant the specific principal reasons under Reg B §1002.9(b)(2) [EU: GDPR Art. 22 + Schufa], and Circular 2022-03 says not understanding your own model isn't a defense. If your underwriting uses an AI/ML model, producing those specific reasons — and evidence that survives an exam — is harder than it should be.
>
> I've built an independent, open-source verifier for exactly this: it maps a denied decision to its §1002.9(b)(2) principal reasons and seals a record your examiner re-verifies offline, no account. It's analysis-only and runs on your data.
>
> Would you bring one real denied application to a 20-minute call? I'll show the exam-ready trace and the verify step — no deck. If it's not useful, no follow-up.
>
> [Name] · github.com/alex-jb/shadow-mentor (MIT)

## 5 · The 20-minute pilot script (when they say yes)
1. They bring **one denied application** (or a synthetic one shaped like theirs — FICO/DTI/LTV + model output).
2. Run it through Shadow → the **§1002.9(b)(2) principal reasons + drafted notice** (`shadow-review-sign-mockup.vercel.app` shows the officer's screen; the real CLI/API runs on their data).
3. They **edit + sign** → a signed evidence bundle. Show that editing the sealed verdict makes verification **fail and name the step** (`shadow-verify-mockup.vercel.app` / `npx shadow-verify`).
4. Hand them the **examiner pack** — notice + reason-code report + the bundle that re-verifies offline (`shadow-export-mockup.vercel.app`).
5. Close: *"What would you need to see to run this against 10 of your real denials next month?"* — that answer defines the paid pilot and which screens to build for real.

## 6 · What NOT to do
- Don't lead with the crypto, the hash-chain, or "AI" — lead with their exam and their liability.
- Don't promise it decides or fixes anything — it's analysis-only; that's a feature to this buyer.
- Don't cite EU AI Act, "SR 26-2 Tier 3," or any fabricated adoption metric.
- Don't send the public mockup links until Deployment Protection is off (they currently 302). Until then, screen-share the local build or the worked example (`shadow-aa-demo.vercel.app`, which is public).

## Alex's next actions
1. Turn off Vercel Deployment Protection on the 4 mockup projects (so §5's links work for a prospect).
2. Send §3 to Lora (warm path). Attach the §2 one-pager.
3. When a call lands, run §5. Bring the worked example as the live proof.
