# Yeshiva Course Demo — Hieu Ngo Office Hours 6/25

> 5-minute live demo of the "Intern PDF scan → 5-voice council verdict" path
> shipped 2026-06-23. Designed for Hieu's "AI for Extended Reality" course
> final-project show-and-tell.

## Three-layer stack live

```
Intern (or instructor) → Loan PDF
       ↓
   /api/loan-council-from-pdf  (Shadow v1.1.1)
       ↓
   OCR layer (Mistral → Claude Vision → stub)
       ↓
   regex extraction → typed loan dict
       ↓
   validateLoan() → runLoanCouncil()
       ↓
   5-voice JSON verdict + BR threshold traceability + AA01-05 codes
       ↓
   Flow Workspace (XReal Air 2 Ultra rendering)
       ↓
   Spatial AR 5-persona debate overlay
```

## Live demo script (5 min)

### Setup (30 sec — pre-class)

```bash
cd ~/Desktop/shadow-mentor
npm install
npm run dev    # localhost:3000
```

### Demo step 1 — empty body (stub mode) (1 min)

```bash
curl -sX POST http://localhost:3000/api/loan-council-from-pdf \
     -H "Content-Type: application/json" \
     -d '{"force_ocr_provider":"stub"}' | jq
```

Expected return (truncated):

```json
{
  "final_verdict": "approve",
  "voices": [
    {
      "voice": "Credit Fundamentals",
      "verdict": "approve",
      "confidence": 0.82,
      "rationale": "FICO=720 ≥ 700 (Addendum A) and DTI=0.30 ≤ 0.36 (Addendum B); fundamentals acceptable.",
      "adverse_action_codes": []
    },
    {
      "voice": "Risk Officer",
      "verdict": "approve",
      "rationale": "Concentration HHI within limits; VaR=0.063 ≤ 0.12 (Addendum C); ...",
      ...
    }
    // 3 more voices: Compliance / Quant / Wealth Advisor
  ],
  "ocr": {
    "provider": "stub",
    "latency_ms": 0,
    "char_count": 542,
    "notice": "OCR providers not configured... Using stub demo data."
  },
  "extraction": {
    "confidence": 1.0,
    "extracted_fields": ["credit_score", "debt_to_income", "loan_to_value", "amount", "sector", ...],
    "extraction_method": "regex-stub",
    "notice": "All required fields parsed cleanly."
  },
  "loan_extracted": {
    "credit_score": 720,
    "debt_to_income": 0.30,
    "loan_to_value": 0.75,
    "amount": 250000,
    "sector": "industrials",
    "fair_lending_review_flag": false
  },
  "council_latency_ms": 4,
  "total_latency_ms": 4,
  "timestamp": "2026-06-25T..."
}
```

**Show Hieu:** notice `ocr.provider: "stub"` — when MISTRAL_API_KEY or
ANTHROPIC_API_KEY ships, this auto-flips to real OCR. The scaffold is
production-ready, just gated on credit topup.

### Demo step 2 — show test suite green (30 sec)

```bash
npm test 2>&1 | tail -5
```

Expected: `196/196 pass`.

13 of those are new `loan-council-from-pdf` contract tests covering:
- Stub OCR end-to-end
- OCR meta fields
- Extraction confidence + extracted_fields list
- Latency tracking
- CORS preflight
- Voice shape (5 voices + AA codes per voice)
- Regex coverage on stub PDF (all 4 required + 2 optional fields)
- Low-confidence rejection path
- Partial-parse confidence calculation
- $ + comma amount parsing
- Sector capitalization normalization

### Demo step 3 — wire to Flow Workspace (1 min)

Open Flow free tier (https://a.flow.gl/user/feed) in browser. Show Jason's
"Stock Portfolio - Updated July 2025 v2" 3D viz as reference template.

Explain:
1. Course final project = adapt this template to render
   `/api/loan-council-from-pdf` JSON output
2. 5 voices → 5 podium figures with rationale text overlays
3. `risk_packet.var_95_10d` → 3D bar
4. `traceability` dict → connecting lines from each voice to its BR/Addendum source
5. AA01-05 codes → icon stack visible only when verdict = "escalate" or "block"

Flow handles all WebXR rendering — student only writes the JSON-to-scene mapper.

### Demo step 4 — sources, not theater (1 min)

Open `lib/run-loan-council.js`. Show that `traceability` dict embedded
in council response cites BRD vs Addendum sources verbatim. This is the
**IEEE 2027 abstract's specific contribution** — BRD vs Addenda Source
Separation Principle, named author Loredana C. Levitchi (MIT 2026-06-19).

Open `lib/schemas/adverse-action.js`. Show AA01-05 codes mapped to CFPB
Bulletin 2024-09. These are what banking regulators actually require
when a loan gets blocked.

## Questions for Hieu (have ready)

1. **IEEE co-author confirmation** — your name on the abstract OK? See `~/Desktop/Interview-Prep/Correspondence/ECC-2026/ieee-vr-2027-abstract-v1-2026-06-19.pdf`
2. **Course final project rubric** — does the 3-layer stack (OCR + Shadow + Flow) match your XR-AI course expectations? What additional XR component should we add?
3. **AR device demo logistics** — XReal Air 2 Ultra is in our spec. Do you have a Vision Pro / Quest 3 also? Multi-device demo possible?
4. **Student grouping** — solo vs paired projects for the OCR / Shadow / Flow split?
5. **Mid-July YU Dean+VP demo date** — Lora and you co-presenting? Date locked?

## What NOT to demo

- ❌ Don't open Vercel production URL — Deployment Protection still ON (401)
- ❌ Don't claim Mistral OCR is wired (it's stubbed; transparent about that)
- ❌ Don't pitch Shadow as commercial (it's academic + Lora-grounded for IEEE)
- ❌ Don't promise Flow partnership — Jason gave free tier only, not commercial license

## Fallback if Mac sleep / WiFi dies mid-demo

```bash
node -e "
import('./api/loan-council-from-pdf.js').then(async (m) => {
  const handler = m.default;
  const res = { statusCode: 200, body: null, setHeader(){}, status(c){this.statusCode=c;return this;}, json(p){this.body=p;return this;}, end(){return this;} };
  await handler({ method: 'POST', body: { force_ocr_provider: 'stub' }, headers: {}}, res);
  console.log(JSON.stringify(res.body, null, 2));
});"
```

Runs without dev server, prints full JSON. Hieu still sees 5-voice
output even if `localhost:3000` is down.

## After-demo

If Hieu confirms IEEE co-author: push v1 abstract PDF link via email
(`~/Desktop/Interview-Prep/Correspondence/ECC-2026/ieee-vr-2027-abstract-v1-2026-06-19.pdf`).

If Hieu wants course rubric changes: update this doc + brain index 6/25 entry.

## Shipped 2026-06-23

- `lib/ocr/index.js` — OCR provider abstraction (Mistral → Claude → stub)
- `lib/ocr/extract-loan-fields-stub.js` — regex parser, 6 field patterns
- `api/loan-council-from-pdf.js` — Vercel route end-to-end
- `test/loan-council-from-pdf.test.js` — 13 contract tests, all green
- `lib/flow-export.js` — fixed AA_SOURCES import bug (pre-existing)
- 196/196 total tests passing
