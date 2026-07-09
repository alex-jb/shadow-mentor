# Shadow — Capstone Presentation Prep (Dr. NGO, 2026-07-16)

**Meeting**: Wednesday 2026-07-16
**Preparing**: 2026-07-08 (T-8 days)
**Audience**: Dr. NGO (capstone advisor, Katz), Prof. Yang (co-PI on Katz Faculty Research Initiative)
**Team**: Alex Xiaoyu Ji + Loredana C. Levitchi
**Purpose**: capstone progress update — where we are, what shipped, what's next, what we need from advisor
**Format**: 15-min slot expected (5 status + 3 live demo + 5 roadmap + 2 ask)

---

## TL;DR — where Shadow is today

Shadow is a public OSS banking-compliance AI council targeting mid-tier US banks for ECOA / Reg B / adverse-action-notice compliance and secondary EU GDPR Art. 22 / Schufa. As of 2026-07-08:

- **v1.5.38 latest release · 1183/1184 tests passing · 19 GitHub Releases live · public repo (github.com/alex-jb/shadow-mentor)**
- **10 append-only cryptographic-attestation fields** covering the load-bearing invariants (dictionary hash, citation registry, protected-class proxy schema, policy-invariance score, adverse-action notice, sampling-seed commitment, evidence-partition scheme, heterogeneity commitment, typed-claim envelope, hash-chain provenance)
- **9 arXiv anchors** (2605.06161 · 2605.20312 · 2606.08285 · 2606.16121 · 2606.19826 · 2606.29142 · 2607.01661 · 2607.04103 · plus RFC 8032 Ed25519)
- **6 regulatory anchors** (SR 26-2 Tier 3 · CFPB Circular 2022-03 · CFPB Bulletin 2024-09 · Reg B final rule 2026-07-21 · GDPR Art. 22 + Schufa C-634/21 · Colorado SB 26-189)
- **8 releases shipped today alone** (v1.5.31 → v1.5.38) driven by two forcing functions: (1) Reg B final rule takes effect 2026-07-21 = 13 days out, (2) Norm AI raised $120M Series C @ $1.2B unicorn 2026-07-07 — visible competitive pressure
- **0 bank pilots yet.** First LinkedIn distribution post published 2026-07-08. Rafic Fahs (Fifth Third → Comerica compliance) LinkedIn DM drafted, pending Lora reply

## What Dr. NGO cares about (audience calibration)

Dr. NGO is capstone advisor at Katz. Priorities:
1. **Research contribution** — is this a defensible academic artifact
2. **Publication pipeline** — where are the papers, what's the timeline, will they land
3. **Business viability signal** — can this land a real bank pilot, or is it a research toy
4. **What the team needs from him** — signatures, introductions, feedback rounds, PI role for Katz RFP

Do NOT lead with cryptography vocabulary. Lead with the business framing (Norm AI just raised $120M; Reg B changes in 13 days; Shadow is the OSS reference implementation for the gap Norm won't fill) then walk to the technical proof.

---

## Section 1 — Status snapshot (5 min slide-equivalent)

### 1.1 What shipped since last check-in

- **Repo public** since 2026-07-06. github.com/alex-jb/shadow-mentor. MIT. 19 GitHub Releases with rich notes + benchmark artifacts.
- **Test surface**: 335 (2026-07-02) → 1183 (2026-07-08). +848 tests in 6 days. Every merge blocked by CI.
- **Shadow Agentic Score**: 39 → 87 ± 3 (n=6) across 4 prompt-sweep iterations. Persisted `benchmark/history/` for reproducibility.
- **Verdict-invariance harness**: 10 structural perturbation classes (key ordering, float precision, extra fields, null vs omitted, collateral ordering, exposure-weight ordering) pinned. Direct response to arXiv:2607.00937.
- **Cross-language verifier**: same signed attestation verifies byte-for-byte in Node (`bin/verify-attestation.mjs`) + Python (`from shadow_verify import verify_attestation`) + HTTP (`POST /api/verify-attestation`) + MCP tool (`shadow_verify_attestation`). CI runs Python verify against Node signatures on Python 3.9-3.13.

### 1.2 Academic pipeline (deliverables in flight)

| Paper | Deadline | Status | Co-authors |
|---|---|---|---|
| **IEEE VR 2027 abstract v3** | 2026-08-24 | Draft ready (`ieee-vr-2027-abstract-v3-2026-07-06.pdf`) awaiting Lora sign-off | Lora + Alex co-first; Hieu Ngo confirmed co-author 2026-06-25 |
| **ICAIF 2026 Milan paper skeleton** | 2026-08-02 | Skeleton committed (`docs/icaif-2026/paper-skeleton.md`) — needs empirical anchor + prose | Yang + Alex + Lora |
| **Katz Faculty Research Initiative RFP** | 2026-08-15 | Full submission package drafted (`docs/katz-rfp-2026/`); $3K request | Dr. NGO PI (needs sign-off), Yang co-PI, Lora external |
| **CITATION_MAP.md** (Lora ask 2026-07-06) | Delivered 2026-07-06 | Live in repo (`docs/CITATION_MAP.md` + `.csv` + `.pdf`) — persona × regulation × test-file triple map | Alex authored, Lora reviewed |

### 1.3 Business viability signal

- **Sales list**: 30 mid-tier US banks in scope (`docs/sales-30-target-banks.md`). Raymond James / Stifel / LPL Financial / Houlihan / Lazard MM top-tier. Norm AI is going tier-1 with their $120M raise — Shadow's tier-2/3 is a real segmentation, not a fallback.
- **Distribution asset**: LinkedIn post published 2026-07-08 on the §1002.9(b)(2) specificity vs model registry gap. Anchor thesis: "model registry answers 'on average'; audit trail answers 'this specific applicant on this specific day'." Corrected pre-publish from initial draft that miscited Fifth Third / Ally (auto-lending disparate-impact, not §1002.9 notice specificity).
- **Non-tech buyer doc**: `docs/FOR-BANK-COMPLIANCE-OFFICERS.md` — 5-page plain-English structured around 3 CFPB fine axes with named enforcement cases + 5 CTO/CISO Q&A + week-1 pilot path (20 loans day 1 → 100 day 5).
- **Cold-outreach draft**: Rafic Fahs LinkedIn DM (`~/Desktop/Interview-Prep/Projects/alex-brain/research/2026-07-08-rafic-fahs-linkedin-dm.md`) — 2 variants + timing rules + follow-up cadence + kill criterion. Paused pending Lora reply on IEEE v3 abstract.

## Section 2 — Live demo (3 min)

### 2.1 Recommended demo path

Show the `/api/deliberate` endpoint end-to-end. Demonstrates the whole stack in ~60 seconds.

**Setup** (before meeting): make sure `~/Desktop/AI-Projects/shadow-mentor/` is checked out at latest master, `.env.local` has `ANTHROPIC_API_KEY` set, `vercel dev` running OR laptop connected to WiFi and Vercel prod deploy is verified (see fallback plans § 2.3).

**Demo script** (Alex speaks):

> "Here's the Shadow endpoint we shipped this week. I paste a synthetic loan — FICO 720, DTI 0.30, LTV 0.70, with an OFAC SDN match flag — into the request body. Watch the response."

Run:
```bash
curl -X POST http://localhost:3000/api/deliberate \
  -H 'Content-Type: application/json' \
  -d '{
    "persona": "compliance",
    "scenario": "lbo",
    "loan": {
      "fico": 720,
      "dti": 0.30,
      "ltv": 0.70,
      "aml_flags": ["OFAC_SDN_MATCH"]
    }
  }' | jq
```

Point to specific fields as they scroll:
1. `verdict: "refuse_to_serve"` — "This is the v1.5.36 pivot. Prior to today, this response was 'escalate' — which would have implied human review can proceed. That's factually wrong for an OFAC hit under §5318 tipping-off. Shadow now says 'no discretion, statute bars service, borrower gets the generic notice.'"
2. `refuse_to_serve.borrower_facing_notice` — "This text is intentionally minimal. Rich rationale here would either imply discretion or violate BSA §5318(g)(2)."
3. `refuse_to_serve.citations[]` — "31 CFR 501.603 + OFAC 50% rule + applicable EO. Bank counsel signs off on this citation chain, not the LLM output."
4. `heterogeneity_enforcement.commitment_sha256` — "Every decision now binds proof that at least N distinct LLM providers were in the debate. Prevents silent single-provider deployments."
5. `claim_type_envelope.audit_expectation_class` — "Ships in v1.5.37 today. Declares this is a TESTIMONY-class claim (grounded in OFAC list). Auditor knows to verify source freshness, not seed commitment."
6. `attestation.signature` — "This is the Ed25519 signature over 10 append-only cryptographic-hash fields. Bank counsel pins these values in the procurement contract. Any silent post-hoc edit breaks verification."
7. `reproducibility_manifest.manifest_hash_sha256` — "One hash replaces 9 in the exam workpaper."

**Total demo time**: ~90 seconds if we don't get stuck on any single field.

### 2.2 Backup: static screenshot walkthrough

If live demo fails, open `docs/case-studies/` (already committed to repo) and walk through one of the 4 pre-recorded verdicts (GO / WAIT / SPLIT / KILL). Same story, no live-key dependency.

### 2.3 Fallback plans (rank-ordered)

1. **Vercel prod down** → run `vercel dev` locally on Alex's laptop (needs WiFi + Anthropic key + ~2 min warm-up)
2. **Anthropic key dry** → run `MOCK_ANTHROPIC=1 node examples/mock-deliberate.mjs` (would need to create this — 30 min work before meeting)
3. **No internet** → open `docs/case-studies/2026-07-08-refuse-to-serve.pdf` (need to render this next week — 20 min pandoc)
4. **Laptop dies** → hand phone screenshot walkthrough. Have `docs/FOR-BANK-COMPLIANCE-OFFICERS.pdf` on phone as backup narrative anchor.

### 2.4 Alex-manual pre-meeting checklist (do Tuesday 2026-07-15 night)

- [ ] `git pull` on shadow-mentor + verify latest tag
- [ ] `npm test` passes green
- [ ] `vercel dev` boots + `curl /api/health` returns 200 locally
- [ ] `curl /api/deliberate` with the demo payload above returns full JSON with all 4 new fields (verdict / refuse_to_serve / heterogeneity_enforcement / claim_type_envelope / reproducibility_manifest)
- [ ] Render `docs/FOR-BANK-COMPLIANCE-OFFICERS.md` to PDF, save to Downloads for phone-fallback
- [ ] Print `docs/CITATION_MAP.pdf` — Dr. NGO likes to hold paper
- [ ] Print `docs/THREAT_MODEL.md` — 6-category table is a killer visual anchor
- [ ] Print this presentation prep doc
- [ ] Confirm Lora is coming — she opens the meeting

## Section 3 — Roadmap (5 min)

### 3.1 Next 4 weeks — actual dated commitments

| Week | Deliverable | Owner |
|---|---|---|
| 2026-07-08 → 07-14 | Reg B 7/21 pivot verified live in production; Rafic Fahs DM fired (post-Lora sign) | Alex |
| 2026-07-15 → 07-21 | This presentation; **Reg B final rule EFFECTIVE 2026-07-21**; IEEE VR v3 to Lora sign-off | Alex + Lora |
| 2026-07-22 → 07-28 | 5 more mid-tier bank compliance officer LinkedIn DMs (weekly cadence); Katz RFP final draft to Dr. NGO | Alex |
| 2026-07-29 → 08-04 | ICAIF 2026 Milan paper full prose (deadline 2026-08-02); first LinkedIn DM reply rate signal | Alex + Yang |

### 3.2 What Shadow does NOT yet have (honest gaps — do not hide from Dr. NGO)

1. **0 bank pilots** — real customer acquisition is the load-bearing gap. Code quality is not the bottleneck.
2. **No LLM benchmark against Norm AI** — Norm is closed, we can't benchmark against them, but we can pin a public benchmark (CNFinBench or a synthetic tri-persona head-to-head) that Norm cannot answer without disclosing internals.
3. **No formal SOC 2 Type 1** — deferred to vendor decision (Vanta / Drata / Secureframe). Not blocking any near-term pilot.
4. **macOS native app POC** — Q3 track, 4 weeks. Not yet started. Would unlock "on-device, zero data egress" claim as a Norm AI counter.
5. **CNFinBench actual score** — dataset licence blocks redistribution. Alex needs Anthropic credit topup + weekend to run against real LLMs.

### 3.3 Two forcing functions driving urgency

1. **2026-07-21 Reg B final rule effective date** (13 days). Shadow shipped the pivot doc + repositioning of `enforce-reason-code-dictionary.js` today (v1.5.31). Bank counsel opening the repo after 7/21 sees correct post-effective-date framing.
2. **Norm AI $120M Series C at $1.2B unicorn 2026-07-07** (yesterday). Not existential — Norm is closed / SaaS / tier-1 / generic-law-to-agent. Shadow is OSS / cryptographic attestation / banking-vertical / mid-tier. Different segments. But it validates the category enormously — Dr. NGO should see it as a positive market signal, not a threat.

## Section 4 — The ask (2 min)

Frame at end of meeting. Three concrete asks:

1. **Katz Faculty Research Initiative PI sign-off** (deadline 2026-08-15) — Dr. NGO would be PI + Yang co-PI + Lora external + Alex grad RA. Full submission drafted, needs his review + signature. `docs/katz-rfp-2026/` in the repo.
2. **IEEE VR 2027 abstract review** — read `ieee-vr-2027-abstract-v3-2026-07-06.pdf` (30 min read) and flag anything a reviewer would push back on. Deadline 2026-08-24.
3. **Introduction to any mid-tier bank compliance officer he knows** — Raymond James / Stifel / LPL / Comerica / Fifth Third / Regions / KeyBank / Truist. Even one warm intro compresses months of cold outreach.

Do NOT ask him to code, ship, or debug. His value is signature + introduction + academic taste.

---

## Section 5 — Anticipated Q&A

**Q: How is this different from Norm AI?**
A: Norm AI is closed / SaaS / horizontal-legal / tier-1 (bank counsel at JPM). Shadow is OSS / cryptographic-attestation / banking-vertical / mid-tier. Norm's $120M raise validates the category. Bank counsel who wants signed on-premise audit trail cannot buy this from Norm — that's Shadow's differentiator. Also: `docs/positioning-vs-anthropic-fs.md` maps head-to-head against Anthropic's LPL / Raymond James / FIS Financial Crimes agents. Anthropic ships agents; Shadow governs them.

**Q: What's the academic contribution?**
A: Two threads. (1) The BRD-vs-Addenda source-separation principle — Lora's named contribution — which distinguishes institutional-policy layer (BRD) from calibration layer (Addenda A/B/C) so a bank can rotate a threshold without invalidating institutional policy. This is the load-bearing IEEE VR 2027 paper anchor. (2) Nine arXiv anchors from 2026-Q2/Q3 that Shadow makes procurement-visible: heterogeneous debate (2606.19826) + reproducibility (2606.08285) + threat systematization (2606.29142) + typed claims (2605.20312) + evidence partition (2607.01661) + sampling attestation (2606.16121) + Judge Card (2605.06161) + GAICF (2607.04103) — each is a working test file in the repo, not just a citation.

**Q: When does Shadow land a bank pilot?**
A: Honest answer — not committed. The load-bearing gap is distribution, not code. 0 bank pilots today. Rafic Fahs (Fifth Third / Comerica) DM is drafted. First LinkedIn distribution post published today. Cold-outreach cadence starts 2026-07-22 (one DM per day, Tue-Thu 9-11am ET, 5 target names lined up). Kill criterion: 5 sent → 0 replies in 15 business days → re-diagnose. If any of the 5 replies → 15-min screening call → structured pilot proposal. Realistic first-pilot signal: 30-60 days if the DM template is right; longer if not.

**Q: Regulatory landscape shifts — how are you keeping up?**
A: Two structural mechanisms. (1) Every regulatory citation lives in `docs/CITATION_MAP.md` — persona × citation × test-file triple. When a regulation changes, we change the test, which forces a documented ship. Example: v1.5.31 today shipped the Reg B 7/21 pivot 13 days before effective date. (2) Every threat category lives in `docs/THREAT_MODEL.md` with an explicit non-coverage list. This is what makes Shadow procurement-defensible — bank counsel can see honestly what we do NOT close.

**Q: Why should a bank buy this instead of continuing manual review?**
A: We don't say "buy" — we're OSS. The value we ship is: (1) audit trail that answers §1002.9(b)(2) specificity at CFPB exam time, (2) cryptographic proof that the reason-code dictionary + protected-class blocklist + adverse-action notice text were not silently edited post-hoc, (3) heterogeneity enforcement gate that refuses single-provider deployments where an adversarial peer could compromise the whole debate, (4) refuse_to_serve response class that prevents §5318(g)(2) tipping-off violations. Each of these is a fine risk. See `docs/FOR-BANK-COMPLIANCE-OFFICERS.md` for the plain-English version with named CFPB enforcement cases.

**Q: What about the "Shadow name" — trademark risk?**
A: Product name is `shadow-mentor` in the npm/github ecosystem; brand is "Shadow." Not aware of trademark conflict in the banking-compliance category. Would defer to counsel before formal ticker / logo trademark filing.

**Q: What is Lora's specific contribution?**
A: Named in `package.json` contributors. Primary author of `docs/BRD_ALIGNMENT.md` + `docs/external/ADDENDUM_A.md` (Credit) + `docs/external/ADDENDUM_B.md` (DTI) + `docs/external/ADDENDUM_C.md` (LTV) + `docs/external/RISK_APPETITE_NOTE.md`. These are the load-bearing banking-domain-grounding documents that make Shadow procurement-credible — they translate her ECB / bank-industry experience into signed policy artifacts. Also: 2026-06-19 four binding decisions (MIT license grant, FICO<700 hard block, IEEE co-first-author, Jason deck reframe) documented in brain memory.

**Q: What if Dr. NGO asks about ownership / commercialization?**
A: Honest posture — MIT licensed, Alex + Lora on GitHub as contributors, no commercial entity formed, no VC conversations. If Dr. NGO wants to explore Katz Business School incubator / Fordham Foundry / NYU Endless Frontier — receptive. Would need Lora's sign-off before any equity conversation. Katz RFP is $3K faculty research initiative, not a commercial vehicle.

---

## Section 6 — Metrics inventory (numbers to have ready)

| Metric | Value | Source |
|---|---|---|
| Latest tag | v1.5.38 | `git tag --sort=-v:refname \| head -1` |
| Tests passing | 1183/1184 (1 skip existing) | `npm test` |
| GitHub Releases live | 19 | `gh release list` |
| Test files | 76 | `find test -name "*.test.js" \| wc -l` |
| lib/ modules | 36 | `ls lib/*.js \| wc -l` |
| api/ endpoints | 14 | `ls api/*.js \| wc -l` |
| docs/ documents | 40+ | `ls docs/*.md \| wc -l` |
| aex-attestation/v1 append-only fields | 10 | `docs/TYPED-CLAIMS.md` table |
| arXiv anchors cited in repo | 9 | `docs/arxiv-citation-map.md` |
| Regulatory citations pinned in tests | 6 US + 4 EU + 5 state | `docs/CITATION_MAP.md` |
| Shadow Agentic Score | 87 ± 3 (n=6) | `benchmark/history/SUMMARY.md` |
| Verdict-invariance perturbation classes | 10/10 | `test/verdict-invariance.test.js` |
| Sales list — mid-tier US banks | 30 | `docs/sales-30-target-banks.md` |
| Bank pilots active | 0 | (honest) |
| LinkedIn distribution posts | 1 (published 2026-07-08) | (honest) |
| Cold-outreach DMs drafted | 1 (Rafic Fahs, unsent) | (honest) |
| Days until Reg B final rule effective | 13 | 2026-07-21 minus today |
| Days until IEEE VR 2027 deadline | 47 | 2026-08-24 minus today |
| Days until Katz RFP deadline | 38 | 2026-08-15 minus today |
| Days until ICAIF 2026 deadline | 25 | 2026-08-02 minus today |
| Days since Norm AI $120M raise | 1 | 2026-07-07 |

## Section 7 — What to walk in with

### On laptop
- `~/Desktop/AI-Projects/shadow-mentor/` at latest master
- `.env.local` populated
- `vercel dev` running warm OR Vercel prod verified live
- 2 browser tabs open: (a) github.com/alex-jb/shadow-mentor releases page; (b) this presentation doc

### On phone
- `docs/FOR-BANK-COMPLIANCE-OFFICERS.pdf` in Downloads
- `docs/CITATION_MAP.pdf` in Downloads
- Screenshots of the demo response (in case laptop dies)

### On paper (printed)
- `docs/CITATION_MAP.pdf` (Dr. NGO likes paper)
- `docs/THREAT_MODEL.md` § 1 table (6-category systematization)
- This presentation prep doc (Sections 1 + 3 + 5)

### In your head
- The `refuse_to_serve` narrative (OFAC → no discretion → §5318 tipping-off — this is the one story that lands the whole positioning in 45 seconds)
- Norm AI $120M number + the OSS + cryptographic-attestation + banking-vertical differentiation (three-clause counter)
- Reg B 2026-07-21 effective date + Shadow shipped 13 days early
- 1183 tests + 10 append-only cryptographic fields + 9 arXiv anchors (single-breath quantification of technical depth)

### What NOT to bring up unless asked
- npm token / Vercel deploy protection / infra chores (Dr. NGO doesn't care)
- LLM pricing / API cost (not his taste)
- Solo Founder OS / VibeXForge / Orallexa (different projects; would dilute the Shadow story)

---

## Section 8 — After the meeting (2026-07-16 EOD)

Same-day write-up:
- What Dr. NGO said. Verbatim quotes on any positioning suggestion, any bank contact he mentioned, any paper feedback.
- His yes/no on Katz PI role. If yes → send drafted signature packet within 24h. If no → understand why + adjust downstream Katz RFP submission.
- Any commitments HE made (e.g. "I'll intro you to X" — follow up in 5 days if silent).
- Add to `~/Desktop/Interview-Prep/Projects/alex-brain/` under a dated entry so future sessions carry the outcome.

Lora post-meeting sync (Wed evening or Thu):
- What she wants to change about the demo / positioning before next presentation
- IEEE VR v3 sign-off if she hasn't already sent it
- Whether to fire Rafic Fahs DM this week or wait

---

## Appendix — one-line Shadow pitch for cold pings (memorize)

> "Shadow is an open-source banking-compliance AI council with cryptographic audit trail. Ships the reason-code dictionary + protected-class blocklist + adverse-action notice as signed artifacts so bank counsel can pin them in procurement contracts. Different from Norm AI: OSS, on-premise, banking-vertical, mid-tier. Different from Anthropic finserv agents: we govern their output. github.com/alex-jb/shadow-mentor."

45 seconds spoken. Dr. NGO / Lora / Yang / Rafic Fahs / any bank compliance officer — same pitch, same 45 seconds.
