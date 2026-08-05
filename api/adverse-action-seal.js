// POST /api/adverse-action-seal
// The SIGN-OFF step of the two-phase flow (B4). Body:
//   { application, editedNotices?, officer?, decision?, disputeNote? }
// The officer has reviewed the draft (POST /api/adverse-action { draft:true }) and edited the
// notice prose; this seals the FINAL, signed-off record — both the AI-drafted original AND the
// officer-edited final, plus the sign-off (or a dispute → "returned to model team") — into a
// signed, hash-chained evidence bundle the caller re-verifies offline.
//
// A signed-off exam record MUST carry a stable bank identity, so this endpoint REQUIRES a
// persistent key: SHADOW_ATTESTATION_ED25519_PRIVATE_KEY. Without it → 400 (no ephemeral seal
// for a record that reaches an examiner).
//
// Response: { sealed, decision, officer, adverse_action_codes, edited_codes, verify,
//             public_key, bundle }

import { apiGuard } from "../lib/api-guard.js";
import { sealAdverseAction } from "../lib/adverse-action-review.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only", example: { application: { application_id: "SL-2026-014", credit_score: 648, debt_to_income: 0.45, loan_to_value: 0.9 }, officer: "j.doe", editedNotices: { AA01: "…final wording…" } } });
  }
  if (!apiGuard(req, res, { maxBytes: 512 * 1024, rpm: 60 })) return;

  const application = req.body?.application ?? null;
  if (!application || typeof application !== "object") {
    return res.status(400).json({ error: "missing 'application' object in request body" });
  }

  const privateKey = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY || null;
  if (!privateKey) {
    return res.status(400).json({
      error: "sign-off requires a persistent signing key",
      detail: "Set SHADOW_ATTESTATION_ED25519_PRIVATE_KEY. A signed-off adverse-action record must carry a stable bank identity — Shadow will not seal it with an ephemeral key.",
    });
  }
  const keyId = process.env.SHADOW_ATTESTATION_KEY_ID || undefined;

  let result;
  try {
    result = sealAdverseAction(application, {
      privateKey, keyId,
      officer: req.body?.officer,
      decision: req.body?.decision,
      disputeNote: req.body?.disputeNote,
      editedNotices: req.body?.editedNotices,
    });
  } catch (e) {
    return res.status(400).json({ error: "seal failed", detail: e.message });
  }

  if (!result.sealed) {
    return res.status(200).json({ sealed: false, approved: result.approved, note: "not an adverse action — nothing to sign off" });
  }

  return res.status(200).json({
    sealed: true,
    decision: result.decision,
    officer: result.officer,
    verdict: result.verdict,
    adverse_action_codes: result.adverseActionCodes,
    edited_codes: result.editedCodes,
    verify: result.verify,
    public_key: result.publicKeyPem,
    bundle: result.bundle,
    hint: "Re-verify the bundle offline with the returned public_key: verify.html (drag it in) or npx shadow-verify.",
  });
}
