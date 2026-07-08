# FinCEN NPRM 2026-04-07 Alignment (Shadow v1.5.25+)

**References**:
- [FinCEN NPRM 2026-04-07 "Fundamentally Reform Financial Institution AML Programs"](https://www.fincen.gov/news/news-releases/fincen-proposes-rule-fundamentally-reform-financial-institution-programs)
- [Sullivan & Cromwell memo, April 2026](https://www.sullcrom.com/insights/memo/2026/April/Regulators-Issue-Proposed-Rules-Reforming-AML-CFT-Program-Requirements)
- Related brain memory: `feedback_deep_research_use_parallel_agents.md` (regulatory-shift discipline)

## What changed on 2026-04-07

FinCEN + Federal Reserve + OCC + FDIC issued a joint Notice of Proposed Rulemaking to consolidate the AML program framework at 31 CFR 1020.210. This is the largest BSA update since the USA PATRIOT Act. Comment closed 2026-06-09. Final rule is expected late 2026 or early 2027.

**Structural change**: the pre-NPRM four-pillar framework is consolidated into a **risk-based effective AML/CFT program** framework at 31 CFR 1020.210. The Customer Due Diligence rule (previously a distinct "fifth pillar" grafted onto the four-pillar structure via 31 CFR 1010.230) is folded into "internal policies, procedures, and controls."

## Old vs new pillar structure

| Pre-NPRM (through 2026-04-06) | NPRM-proposed / NPRM-final (2026-04-07 onward) |
|---|---|
| **(a)** internal policies, procedures, and controls | consolidated risk-based AML/CFT program at 31 CFR 1020.210 |
| **(b)** BSA compliance officer | preserved as a specific requirement inside the consolidated program |
| **(c)** ongoing training | preserved |
| **(d)** independent testing | preserved |
| **Fifth pillar** (grafted): Customer Due Diligence at 31 CFR 1010.230 | absorbed into (a) as "internal policies, procedures, and controls" |

The verdict semantics do not change. What changes is the citation string a Shadow persona rationale prints. An origination on 2026-Q3 correctly cites 31 CFR 1010.230; an origination on 2027-Q2 (assuming NPRM finalizes) should cite 31 CFR 1020.210. Shadow must be able to render both.

## Shadow's transition path

The transition ships as a **stage-aware citation resolver**, not as a hard-coded citation rewrite. This keeps every deployed instance 100% back-compat while giving forward-looking origination flows the NPRM-consolidated citation.

Three canonical stage values live in `lib/aml-kyc-voice.js:NPRM_STAGES`:

- **`pre-nprm`** — default. Citations render exactly as they did before v1.5.25. Applies to any origination decision written against the four-pillar framework.
- **`nprm-proposed`** — CDD citations append `NPRM 2026-04-07 consolidates as 31 CFR 1020.210 (proposed risk-based AML/CFT program)`. Original citation preserved so downstream auditors can trace back to the pre-NPRM framing.
- **`nprm-final`** — CDD citations replace with `31 CFR 1020.210 (finalized risk-based AML/CFT program, absorbing 31 CFR 1010.230 CDD)`. Use once FinCEN publishes the final rule.

Stage selection sources:

1. Per-call override: `computeAmlKycVoiceWithStage(loan, { stage: NPRM_STAGES.NPRM_PROPOSED })`
2. Env var: `SHADOW_FINCEN_NPRM_STAGE=nprm-proposed`
3. Default: `pre-nprm`

Citations NOT affected by NPRM (statutory or non-FinCEN):

- **BSA structuring** (31 USC 5324) — statutory, untouched
- **OFAC 50% rule** — Treasury OFAC, not FinCEN, untouched
- **USA PATRIOT Act §326 CIP** — statutory, untouched

## Back-compat guarantees

- `computeAmlKycVoice(loan)` — unchanged signature, unchanged output. Every existing caller keeps working.
- `computeAmlKycVoiceWithStage(loan, { stage })` — new. Returns the same voice payload shape plus `metrics.nprm_stage`.
- Verdict + adverse-action codes + confidence: identical across stages. Only the human-readable citation strings shift.

## Attestation implications

None. The NPRM changes citation phrasing, not verdict semantics. The Ed25519 attestation binding continues to cover the request commitment + output commitment + model id + previous hash. `citation_registry_sha256` (v1.5.18) continues to pin the registry snapshot at decision time. If a bank transitions from `pre-nprm` to `nprm-proposed`, the attestation stays valid — only new attestations after the transition carry the new citation strings.

## Related documents

- `docs/CITATION_MAP.md` — Lora Levitchi's regulatory-citation-to-test triple map
- `docs/GAICF-COMPATIBILITY.md` (v1.5.24) — three-layer GAICF matrix
- `docs/JUDGE-CARD.md` (v1.5.23) — reliability metric protocol
- `docs/arxiv-citation-map.md` — arXiv paper anchor index

## When to flip the stage in production

Do not flip until FinCEN publishes the final rule and bank counsel signs off on the transition. Until then, the safe default is `pre-nprm`. `nprm-proposed` is available for banks that want to render both the pre-NPRM citation and the forward-looking NPRM reference during transition (some auditors have signaled preference for dual-citation during comment period).
