// POST /api/adverse-action
// The wedge, over HTTP. Body: { application: <AI-denied credit application> }.
// Returns the examiner-ready adverse-action result — Reg B / ECOA §1002.9(b)(2)
// reason codes + compliant notices — bound into a signed, hash-chained evidence
// bundle the caller re-verifies OFFLINE (verify.html / bin/shadow-verify.mjs).
//
// Signing identity: if SHADOW_ATTESTATION_ED25519_PRIVATE_KEY is set, the bundle
// is signed with that persistent key (banks pin the matching public key); otherwise
// an ephemeral key is minted per request and its public key is returned so the
// record still verifies. No PII leaves the customer environment when self-hosted.
//
// Response: { approved, verdict, adverse_action_codes, notices, report,
//             public_key, bundle }  (approved:true → nothing adverse to notice)

import { apiGuard } from "../lib/api-guard.js";
import { reviewAdverseAction } from "../lib/adverse-action-review.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only", example: { application: { application_id: "SL-2026-014", credit_score: 648, debt_to_income: 0.45, loan_to_value: 0.9 } } });
  }
  // No LLM spend here (deterministic council + local crypto), but still rate-limit +
  // size-cap + honor SHADOW_API_KEY so it isn't an open compute/DoS surface.
  if (!apiGuard(req, res, { maxBytes: 256 * 1024, rpm: 60 })) return;

  const application = req.body?.application ?? req.body;
  if (!application || typeof application !== "object") {
    return res.status(400).json({ error: "missing 'application' object in request body" });
  }

  const privateKey = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY || null;
  const keyId = process.env.SHADOW_ATTESTATION_KEY_ID || undefined;

  let result;
  try {
    result = reviewAdverseAction(application, { privateKey, keyId });
  } catch (e) {
    return res.status(400).json({ error: "review failed", detail: e.message });
  }

  return res.status(200).json({
    approved: result.approved,
    verdict: result.verdict,
    adverse_action_codes: result.adverseActionCodes,
    notices: result.notices,
    report: result.report,
    verify: result.verify,
    public_key: result.publicKeyPem,
    ephemeral_key: result.ephemeralKey,
    bundle: result.bundle,
    hint: "Re-verify the bundle offline with the returned public_key: verify.html (drag it in) or bin/shadow-verify.mjs.",
  });
}
