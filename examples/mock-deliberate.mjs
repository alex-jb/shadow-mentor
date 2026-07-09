// examples/mock-deliberate.mjs
// ──────────────────────────────────────────────────────────────────
// Offline demo path for the Dr. NGO 2026-07-16 presentation.
// Runs against ZERO live LLM keys — produces a pre-canned response
// that mirrors the v1.5.38 /api/deliberate shape so Alex can demo
// the whole stack even if:
//   - ANTHROPIC_API_KEY billing is dry
//   - Vercel deploy is broken
//   - Wi-Fi is out
//
// Usage:
//   node examples/mock-deliberate.mjs
//   node examples/mock-deliberate.mjs --loan '{"fico":720,"aml_flags":["OFAC_SDN_MATCH"]}'
//
// The output is byte-for-byte the shape a real /api/deliberate response
// would produce — every field a compliance officer would see in Postman.

import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan } from "../lib/schemas/loan.js";
import { buildAttestation } from "../lib/attestation.js";
import {
  detectAvailableProviders,
  assignProvidersToVoices,
} from "../lib/provider-diversity.js";
import {
  enforceAndCommit,
  DEFAULT_MIN_PROVIDERS,
} from "../lib/heterogeneous-debate.js";
import { buildReproducibilityManifest } from "../lib/reproducibility.js";
import {
  computeDictionaryHash,
} from "../lib/enforce-reason-code-dictionary.js";
import { maybeRefuseToServe } from "../lib/refuse-to-serve.js";
import {
  buildTypedClaimEnvelope,
  classifyClaimType,
} from "../lib/typed-claims.js";
import { defaultStore as chainStore } from "../lib/attestation-chain-store.js";


function parseArgs(argv) {
  const args = { loan: null, persona: "compliance", scenario: "lbo" };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === "--loan" && val) {
      args.loan = JSON.parse(val);
      i++;
    } else if (flag === "--persona" && val) {
      args.persona = val;
      i++;
    } else if (flag === "--scenario" && val) {
      args.scenario = val;
      i++;
    }
  }
  return args;
}


const CANNED_VOICE_TEXT = {
  junior:
    "Underwriter view: applicant profile passes standard credit-fundamental floors on FICO (720) and DTI (0.30), and collateral coverage at LTV 0.70 sits comfortably below the institution's approve ceiling. However, the AML flag is present on the file, which under our policy layer is a threshold event that supersedes any credit-fundamental analysis. Recommend forwarding to compliance for a non-discretionary review path.",
  senior:
    "Risk officer view: portfolio-level VaR and sector concentration remain within appetite. The application does not shift institutional risk posture materially. That said, the OFAC SDN indicator on the applicant record is not a portfolio-level decision — it is a statutory eligibility question that the compliance officer resolves per 31 CFR 501.603. My verdict at the portfolio layer is neutral; the operative decision lies elsewhere.",
  third:
    "Compliance officer view: an OFAC SDN match on the applicant record removes credit discretion under 31 CFR 501.603 and the applicable Executive Order framework. Origination is prohibited by law, not by policy. Per §5318(g)(2) of the Bank Secrecy Act, the borrower-facing notice may not disclose the specific basis. The record must be routed to the sanctions-review workflow and the applicant will receive the standard §1002.9(b)(1) notice-in-lieu.",
};


function generateMockResponse(input) {
  const { loan, persona, scenario } = input;

  const response = {
    junior: CANNED_VOICE_TEXT.junior,
    senior: CANNED_VOICE_TEXT.senior,
    third: CANNED_VOICE_TEXT.third,
    followup: "What is the workflow-owner assignment for OFAC SDN-flagged loan files, and is the sanctions-review queue currently staffed within the required 24-hour SLA?",
    latency_ms: 1234,
    model: "claude-sonnet-4-5-mock",
    provider: "mock",
    persona,
    scenario,
    provider_diversity: null, // filled below
  };

  const availableProviders = detectAvailableProviders(process.env);
  const providersForDiv = availableProviders.length > 0
    ? availableProviders
    : ["mock"];
  const diversityDiag = assignProvidersToVoices(
    ["junior", "senior", "third"],
    providersForDiv,
    { persona, scenario, provider: "mock" },
  );
  response.provider_diversity = {
    assignment: diversityDiag.assignment,
    diversity_score: diversityDiag.diversity_score,
    unique_providers_used: diversityDiag.unique_providers_used,
    providers_available_count: diversityDiag.providers_available_count,
    assignment_method: "shuffle_and_walk_v1",
    actually_routed_diverse: false,
    per_voice_models: null,
    note: "MOCK MODE — no live LLM calls. See examples/mock-deliberate.mjs.",
  };

  // LBO branch — compute deterministic verdict
  if (scenario === "lbo" && loan) {
    const v = validateLoan(loan);
    if (v.valid) {
      const council = runLoanCouncil(loan);
      response.verdict = council.final_verdict;
      response.loan_council = council;

      const amlKycFindings = {
        findings: Array.isArray(loan.aml_flags)
          ? loan.aml_flags.map((f) =>
              typeof f === "string" ? { rule_id: f } : (f || {}))
          : [],
      };
      const refusal = maybeRefuseToServe({ loan, amlKycFindings });
      if (refusal) {
        response.verdict = refusal.verdict;
        response.refuse_to_serve = refusal;
      }
    }
  }

  // v1.5.34 heterogeneity block
  const actualProvidersSet = [...new Set(Object.values(diversityDiag.assignment).filter(Boolean))].sort();
  const heterogeneityEnforcement = enforceAndCommit({
    voiceNames: ["junior", "senior", "third"],
    availableProviders: actualProvidersSet,
    minProviders: DEFAULT_MIN_PROVIDERS,
    seed: { persona, scenario, provider: "mock", actual: true },
  });
  response.heterogeneity_enforcement = {
    ok: heterogeneityEnforcement.ok,
    min_required: heterogeneityEnforcement.min_required,
    unique_providers_used: heterogeneityEnforcement.unique_providers_used,
    providers_used_sorted: heterogeneityEnforcement.providers_used_sorted,
    commitment_sha256: heterogeneityEnforcement.commitment_sha256,
    strict_mode_requested: false,
    anchor: "arXiv:2606.19826",
  };

  // v1.5.38 typed claim
  const effectiveClaimType = classifyClaimType({
    scenario, loan, verdict: response.verdict,
  });
  const claimTypeEnvelope = buildTypedClaimEnvelope(effectiveClaimType);
  response.claim_type_envelope = {
    claim_type: claimTypeEnvelope.claim_type,
    audit_expectation_class: claimTypeEnvelope.audit_expectation_class,
    additional_hashes_required: claimTypeEnvelope.additional_hashes_required,
    envelope_hash_sha256: claimTypeEnvelope.envelope_hash_sha256,
    caller_override: false,
    anchor: "arXiv:2605.20312",
  };

  // Attestation
  response.attestation = buildAttestation({
    request: { persona, scenario, loan },
    response,
    modelId: "mock/claude-sonnet-4-5-mock",
    previousHash: chainStore.getPreviousHash(),
    heterogeneityCommitmentSha256: heterogeneityEnforcement.commitment_sha256,
    claimTypeSha256: claimTypeEnvelope.envelope_hash_sha256,
  });

  // v1.5.33 reproducibility manifest
  let dictionaryHash = null;
  try { dictionaryHash = computeDictionaryHash(); } catch { /* optional */ }
  response.reproducibility_manifest = buildReproducibilityManifest({
    borrowerSnapshotHash: response.attestation.request_commitment,
    decisionTimestampUtc: response.attestation.completed_at_utc,
    modelId: response.attestation.model_id,
    providersUsedSorted: actualProvidersSet,
    nodeVersion: process.version,
    dictionaryHash,
    heterogeneityCommitmentHash: heterogeneityEnforcement.commitment_sha256,
  });

  return response;
}


const args = parseArgs(process.argv);
const loan = args.loan ?? {
  credit_score: 720,
  debt_to_income: 0.30,
  loan_to_value: 0.70,
  amount: 4500000,
  sector: "commercial_real_estate",
  borrower_rating: "BBB",
  aml_flags: ["OFAC_SDN_MATCH"],
};

console.error("──────────────────────────────────────────────────────");
console.error("MOCK MODE — /api/deliberate offline demo (v1.5.38)");
console.error("Zero live LLM calls. Zero API key required.");
console.error("──────────────────────────────────────────────────────");
console.error(`Persona: ${args.persona}`);
console.error(`Scenario: ${args.scenario}`);
console.error(`Loan: ${JSON.stringify(loan)}`);
console.error("──────────────────────────────────────────────────────");
console.error("");

const response = generateMockResponse({
  loan, persona: args.persona, scenario: args.scenario,
});

console.log(JSON.stringify(response, null, 2));
