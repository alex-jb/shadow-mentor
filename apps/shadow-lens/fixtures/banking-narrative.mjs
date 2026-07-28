// apps/shadow-lens/fixtures/banking-narrative.mjs
// The deterministic banking decision the Wednesday stage tells: a mid-market loan case, the five
// Shadow council voices (stance / confidence / one reason / vote), the metrics + evidence they cite,
// their relationships, and the resulting decision. Non-secret demo data only — no customer PII, no
// keys. FIXTURE MODEL: this is a fixed narrative, NOT live production AI output.

export const BANKING_NARRATIVE = {
  case_id: "case-2026-Q3-0042",
  fixture_timestamp: "2026-07-22T00:00:00.000Z",     // deterministic (not Date.now)
  borrower: { label: "Mid-market loan applicant", exposure_usd: 310000 },
  // the three lines the central 3D case core shows (mirrored 1:1 in ShadowBankingNarrativeData.cs)
  case_display: { title: "MID-MARKET LOAN", number: "CASE #SL-2026-014", amount: "$8.4M REQUEST" },

  metrics: [
    { name: "DTI", value: 0.41, category: "warn" },    // over the 0.36 policy ceiling
    { name: "FICO", value: 706, category: "ok" },       // clears the 700 floor
    { name: "LTV", value: 0.83, category: "warn" },     // over the 0.80 preferred
    { name: "AnnualIncome", value: 82400, category: "info" },
  ],
  evidence: [
    { evidence_id: "B0L1", label: "Debt-to-income: 0.41" },
    { evidence_id: "B0L2", label: "Policy ceiling: 0.36" },
    { evidence_id: "B0L0", label: "Annual income: $82,400" },
  ],
  // one voice is visually dominant at a time in the guided sequence (Council state)
  council: [
    { voice: "Credit Fundamentals",     stance: "approve-with-conditions", confidence: 0.72, reason: "FICO 706 clears the 700 floor; DTI over ceiling needs a compensating factor.", vote: "challenge" },
    { voice: "Risk Officer",            stance: "caution",                 confidence: 0.68, reason: "DTI 0.41 and LTV 0.83 stack — concentration risk is elevated.",                 vote: "challenge" },
    { voice: "Fair Lending Compliance", stance: "no-disparate-impact",     confidence: 0.80, reason: "Drivers are DTI/LTV, not protected-class proxies.",                            vote: "agree" },
    { voice: "Customer Advocate",       stance: "support-with-structure",  confidence: 0.61, reason: "Restructure the term to bring DTI under 0.36.",                               vote: "challenge" },
    { voice: "Macro Contrarian",        stance: "abstain",                 confidence: 0.50, reason: "Rate-path uncertainty; defer to the compensating-factor review.",             vote: "abstain" },
  ],
  relationships: [
    { from: "Risk Officer",        to: "B0L1",               type: "cites" },
    { from: "Credit Fundamentals", to: "B0L2",               type: "cites" },
    { from: "Risk Officer",        to: "Credit Fundamentals", type: "disagrees" },
    { from: "Customer Advocate",   to: "B0L1",               type: "cites" },
  ],
  decision: {
    recommendation: "REVIEW",           // not APPROVE / not DECLINE — routed to a human
    risk_level: "elevated",
    compliance_status: "clear",
    confidence: 0.67,
    dissent: 3,                          // council voices that did not "agree"
    evidence_count: 3,
    signed_result_status: "sealed-verified",   // the Node acceptance package proves the real Ed25519
    audit_reference: "hash-chain:demo",
    mode_label: "FIXTURE MODEL",         // honesty label — carried into the Flow export
  },
};
