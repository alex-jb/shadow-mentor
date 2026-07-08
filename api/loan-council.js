// POST /api/loan-council
// Pure-compute structured loan-council endpoint. No LLM calls — just runs
// Loredana's 5-voice deterministic council + verdict resolver on a typed
// loan dict. Bank model-risk teams want a way to fire the rule layer
// independently of the LLM deliberation for SR 11-7 evidence and unit
// reproducibility.
//
// Body shape (validated via lib/schemas/loan.js):
//   {
//     loan: {
//       credit_score: number 300..850,
//       debt_to_income: number 0..2,
//       loan_to_value: number 0..2,
//       amount: number > 0,
//       borrower_rating?: "BB" | "B" | "BBB" | ...,
//       sector?: string,
//       fair_lending_review_flag?: boolean,
//       adverse_action_reasons?: string[],
//       market_proxy_prices?: number[],         // ≥3 positive
//       collateral_positions?: { ticker, sector, weight }[],
//       borrower_exposure_weights?: { name: weight }
//     }
//   }

import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan } from "../lib/schemas/loan.js";
import { parseBearer, validateToolScope } from "../lib/auth/oauth-scaffold.js";
import { buildAttestation } from "../lib/attestation.js";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";
import { registryMetadata } from "../lib/citation-registry.js";
import { proxySchemaMetadata } from "../lib/proxy-detector.js";

// Opt-in MCP EMA scope enforcement. When SHADOW_REQUIRE_BEARER is set,
// every call to /api/loan-council must carry an Authorization: Bearer
// token whose claims (parsed by the upstream edge / IdP) include the
// shadow:council scope. Default (no env var) is off so existing demos /
// unauthenticated procurement walkthroughs keep working.
//
// In production behind a bank's IdP, set SHADOW_REQUIRE_BEARER=1 + run
// the JWT signature validation in Vercel middleware so this layer can
// trust the parsed claims it receives in the X-Token-Claims header.
const REQUIRE_BEARER = process.env.SHADOW_REQUIRE_BEARER === "1";

function parseClaimsHeader(req) {
  // Two intake shapes for the same claims object:
  //  - X-Token-Claims (JSON-encoded) — set by upstream edge / Auth proxy
  //  - Authorization: Bearer <opaque>  — accepted but treated as
  //    "claims unavailable" since we don't validate the JWT here.
  // The procurement contract is: the *bank* runs JWT validation in
  // their edge / API gateway. This layer enforces *authorization*
  // (which scope ↔ which tool), not authentication (is the token real).
  const xtc = req.headers["x-token-claims"];
  if (typeof xtc === "string" && xtc.length > 0) {
    try { return { ok: true, claims: JSON.parse(xtc) }; }
    catch { return { ok: false, error: "X-Token-Claims is not valid JSON" }; }
  }
  const auth = req.headers.authorization;
  if (parseBearer(auth)) {
    return { ok: false, error: "Bearer token present but no X-Token-Claims; configure edge JWT validator" };
  }
  return { ok: false, error: "no Authorization or X-Token-Claims header" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Token-Claims");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // EMA scope check (opt-in via SHADOW_REQUIRE_BEARER=1)
  if (REQUIRE_BEARER) {
    const parsed = parseClaimsHeader(req);
    if (!parsed.ok) {
      res.setHeader("WWW-Authenticate", `Bearer realm="shadow", scope="shadow:council"`);
      return res.status(401).json({
        error: "unauthorized",
        reason: parsed.error,
        required_scope: "shadow:council",
        docs: "lib/auth/oauth-scaffold.js"
      });
    }
    const scoped = validateToolScope(parsed.claims, "shadow_loan_council");
    if (!scoped.ok) {
      res.setHeader("WWW-Authenticate", `Bearer realm="shadow", scope="shadow:council"`);
      return res.status(403).json({
        error: "forbidden",
        reason: scoped.reason,
        required_scope: "shadow:council",
        docs: "lib/auth/oauth-scaffold.js"
      });
    }
  }

  const { loan } = req.body ?? {};
  if (!loan) {
    return res.status(400).json({
      error: "missing 'loan' in request body",
      example: {
        loan: {
          credit_score: 720,
          debt_to_income: 0.30,
          loan_to_value: 0.75,
          amount: 250000
        }
      }
    });
  }

  const v = validateLoan(loan);
  if (!v.valid) {
    return res.status(400).json({ error: "invalid loan", validation_errors: v.errors });
  }

  const t0 = Date.now();
  const result = runLoanCouncil(loan);
  const latency_ms = Date.now() - t0;

  const responseBody = {
    ...result,
    latency_ms,
    timestamp: new Date().toISOString(),
  };

  // AEX-style attestation binding request → output → model.
  // 2026-07-02 upgrade. See lib/attestation.js docstring for refs.
  // model_id is "runLoanCouncil/pure-compute" because this endpoint
  // does no LLM call — it's deterministic 5-voice policy math. The
  // attestation still matters because it lets auditors verify the
  // response wasn't tampered in transit + it's linked to the exact
  // input that produced it.
  // v1.5.8+: bind the counsel-signed reason-code dictionary hash into the
  // attestation. Any post-hoc edit to lib/schemas/reason-code-dictionary.json
  // breaks verification because the file hash no longer matches what the
  // attestation was signed with.
  const attestation = buildAttestation({
    request: { loan },
    response: responseBody,
    modelId: "runLoanCouncil/pure-compute",
    dictionaryHash: computeDictionaryHash(),
    // v1.5.18: bind the CFR citation registry SHA-256 into the
    // signature. Post-hoc registry edit (adding hallucinated section
    // numbers, editing verbatim snippets, flipping valid_for_aa_codes)
    // breaks Ed25519 verification the same way dictionaryHash does.
    citationRegistrySha256: registryMetadata().registry_sha256,
    // v1.5.19: bind the ECOA §701 protected-classes schema SHA-256.
    // Post-hoc softening of the blocklist (e.g. moving a class from
    // hard_block to advisory) breaks verification.
    proxySchemaSha256: proxySchemaMetadata().proxy_schema_sha256,
  });

  return res.status(200).json({
    ...responseBody,
    attestation,
  });
}
