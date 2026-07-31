# Adverse-Action Review — SL-2026-014
*Independent verification by Shadow · 2026-07-31T04:39:27.640Z · signing: Ed25519 (ephemeral demo key — pass a key for a persistent identity)*

**Decision:** BLOCK
**Applicant signals:** FICO 648 · DTI 0.45 · LTV 0.9

## Reg B / ECOA §1002.9(b)(2) adverse-action reasons

### AA01 — Insufficient credit score for standard approval threshold
This notice is being provided to you because your application for credit was not approved.

The principal reason for this decision is:
Your credit score of 648 is below our standard approval threshold for this product.

You have the right to a statement of the specific reasons for this decision under the Equal Credit Opportunity Act (15 U.S.C. §1691). The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, or age (provided the applicant has the capacity to contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.

### AA02 — Debt-to-income ratio exceeds standard eligibility threshold
This notice is being provided to you because your application for credit was not approved.

The principal reason for this decision is:
Your debt-to-income ratio of 45.0% exceeds our standard eligibility threshold for this product.

You have the right to a statement of the specific reasons for this decision under the Equal Credit Opportunity Act (15 U.S.C. §1691). The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, or age (provided the applicant has the capacity to contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.

### AA04 — Portfolio / market risk appetite threshold exceeded
This notice is being provided to you because your application for credit was not approved.

The principal reason for this decision is:
The requested transaction exceeds our current portfolio risk-appetite threshold for this sector and rating.

You have the right to a statement of the specific reasons for this decision under the Equal Credit Opportunity Act (15 U.S.C. §1691). The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, or age (provided the applicant has the capacity to contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.

### AA03 — Collateral coverage / LTV exceeds standard eligibility threshold
This notice is being provided to you because your application for credit was not approved.

The principal reason for this decision is:
Your loan-to-value ratio of 90.0% exceeds our standard collateral coverage requirement for this product.

You have the right to a statement of the specific reasons for this decision under the Equal Credit Opportunity Act (15 U.S.C. §1691). The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, or age (provided the applicant has the capacity to contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.

## Council reasoning (deterministic verdict; LLM writes rationale only)
- **Credit Fundamentals** — block
- **Risk Officer** — block
- **Fair Lending Compliance** — approve
- **Customer Advocate** — approve
- **Macro Contrarian** — approve

## Evidence record
- Bundle: signed + hash-chained (5 events).
- Re-verify independently, offline with the accompanying public key: `bin/shadow-verify.mjs <bundle.json> --public-key <pub>.pem`, or open `verify.html` and drop the bundle in. No network, no trust in Shadow required.
