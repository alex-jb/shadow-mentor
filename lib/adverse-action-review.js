// lib/adverse-action-review.js
// The wedge in one function: an AI-denied credit application → the examiner-ready
// adverse-action result (Reg B / ECOA §1002.9(b)(2) reason codes + compliant notices)
// bound into a signed, hash-chained evidence bundle that re-verifies OFFLINE.
//
// Pure compute + crypto, no file I/O — shared by the CLI (bin/shadow-adverse-action.mjs)
// and the HTTP surface (api/adverse-action.js) so both produce byte-identical records.

import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { runLoanCouncil } from "./run-loan-council.js";
import { draftAdverseActionNotice } from "./adverse-action-drafter.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "shadow-attest-core/session";

const jsonSafe = (o) => JSON.parse(JSON.stringify(o ?? null));

/**
 * @param {object} application  the AI-denied credit application
 * @param {object} [opts]
 * @param {string} [opts.privateKey]  Ed25519 private key (PEM). If omitted, an
 *   EPHEMERAL keypair is minted so the record is still independently verifiable
 *   (the matching public key is returned as publicKeyPem).
 * @param {string} [opts.keyId]
 * @param {string} [opts.nowIso]  fixed timestamp (for deterministic tests)
 * @returns {{ approved:boolean, verdict:string, adverseActionCodes:any[],
 *   notices:any[], bundle:object|null, publicKeyPem:string|null, verify:string,
 *   report:string, ephemeralKey:boolean }}
 */
export function reviewAdverseAction(application, opts = {}) {
  if (!application || typeof application !== "object") throw new Error("reviewAdverseAction: application object required");

  // 0 — validate the fields the council dereferences, so a real LOS record with a
  // missing/out-of-range ratio yields a legible error (problem + cause + range)
  // instead of a `Cannot read properties of undefined (reading 'toFixed')` crash
  // (run-loan-council.js dereferences these directly). CLI + API both inherit it.
  const REQUIRED = [
    ["credit_score", 300, 850, "FICO"],
    ["debt_to_income", 0, 2, "DTI"],
    ["loan_to_value", 0, 2, "LTV"],
  ];
  const problems = [];
  for (const [field, lo, hi, label] of REQUIRED) {
    const v = application[field];
    if (v === undefined || v === null) problems.push(`missing required field '${field}' (${label}; expected a number in [${lo}, ${hi}])`);
    else if (!Number.isFinite(v)) problems.push(`field '${field}' (${label}) must be a finite number, got ${JSON.stringify(v)}`);
    else if (v < lo || v > hi) problems.push(`field '${field}' (${label}) = ${v} is out of range [${lo}, ${hi}]`);
  }
  if (problems.length) throw new Error(`invalid application — ${problems.join("; ")}`);

  // 1 — deterministic council (verdict + AA codes; the LLM never decides).
  const council = runLoanCouncil(application);
  const verdict = council.final_verdict;
  const aaCodes = Array.isArray(council.adverse_action_codes) ? council.adverse_action_codes : [];

  if (verdict === "approve" || aaCodes.length === 0) {
    return { approved: true, verdict, adverseActionCodes: aaCodes, notices: [], bundle: null,
      publicKeyPem: null, verify: "n/a", report: "", ephemeralKey: false };
  }

  // 2 — a §1002.9(b)(2)-compliant notice per reason code (grounded, or it refuses).
  const language = application.notice_language || "en";
  const notices = [];
  for (const aa of aaCodes) {
    const code = typeof aa === "string" ? aa : aa.code;
    try {
      const notice = draftAdverseActionNotice({ aaCode: code, language, loanContext: application });
      notices.push({ code, label: (typeof aa === "object" && aa.label) || undefined, notice });
    } catch (e) { notices.push({ code, error: e.message }); }
  }

  // B4 — draft mode: return the reasons + notices UNSIGNED so the officer can review and
  // edit them before anything is sealed. The app calls draft during review, then calls this
  // function again with the final edited application + a PERSISTENT key to seal at sign-off
  // (never seal eagerly with an ephemeral key for a record that reaches an exam).
  if (opts.draft) {
    return { approved: false, verdict, adverseActionCodes: aaCodes, notices, council, bundle: null,
      publicKeyPem: null, verify: "draft", ephemeralKey: false, draft: true,
      report: renderReport({ application, verdict, notices, council, bundle: null, ephemeralKey: false, nowIso: opts.nowIso || "(draft)" }) };
  }

  // 3 — key material (persistent if given, else ephemeral so the record still verifies).
  let privateKey = opts.privateKey || null, publicKeyPem = null, ephemeralKey = false;
  let keyId = opts.keyId || "adverse-action";
  if (privateKey) {
    publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  } else {
    const { privateKey: pk, publicKey: pub } = generateKeyPairSync("ed25519");
    privateKey = pk.export({ type: "pkcs8", format: "pem" });
    publicKeyPem = pub.export({ type: "spki", format: "pem" });
    keyId = opts.keyId || "ephemeral-demo";
    ephemeralKey = true;
  }

  // 4 — seal into a signed, hash-chained bundle (v3 evidence-bundle path). Payloads
  // are JSON-normalized before hashing so the sealed and serialized forms match
  // (the council's risk math can emit NaN/Infinity → null on write). models=[] on
  // purpose: the verdict is deterministic rules, not an LLM model.
  const nowIso = opts.nowIso || new Date().toISOString();
  const session = createSession({
    agent: { name: "shadow-adverse-action", version: "1.0.0" },
    models: [],
    environmentFingerprint: { os: process.platform, node_version: process.version },
    keyId, privateKey, startedAtUtc: nowIso,
    // Self-contained record: embed the plaintext so an examiner's offline verify
    // both checks the signature AND rebinds the content to it (source_resolution:
    // VERIFIED). Without this the bundle attests a hash of content it doesn't carry.
    embedPayloads: true,
  });
  appendEvent(session, { event_type: "session_start", actor: "system",
    payload: jsonSafe({ kind: "adverse_action_review", application_id: application.application_id || null }), ts_utc: nowIso });
  appendEvent(session, { event_type: "user_message", actor: "user",
    payload: jsonSafe({ kind: "credit_application", application }), ts_utc: nowIso });
  appendEvent(session, { event_type: "model_output", actor: "model",
    payload: jsonSafe({ kind: "council_verdict", final_verdict: verdict, adverse_action_codes: aaCodes,
      voices: council.voices, thresholds: council.thresholds }), ts_utc: nowIso });
  appendEvent(session, { event_type: "tool_result", actor: "tool",
    payload: jsonSafe({ kind: "adverse_action_notices", language,
      notices: notices.map((n) => ({ code: n.code, notice: n.notice, error: n.error })) }), ts_utc: nowIso });
  const bundle = sealSession(session);

  let verify = "unknown";
  try { const r = verifyBundle(bundle, { publicKey: publicKeyPem }); verify = r && r.ok ? "verified" : `FAILED (${r && r.reason})`; }
  catch (e) { verify = `verify-error: ${e.message}`; }

  return { approved: false, verdict, adverseActionCodes: aaCodes, notices, bundle,
    publicKeyPem, verify, report: renderReport({ application, verdict, notices, council, bundle, ephemeralKey, nowIso }),
    ephemeralKey };
}

/**
 * B4 — seal a decision AT SIGN-OFF, with a persistent key. This is the two-phase flow a real
 * deployment uses: draft (reviewAdverseAction with {draft:true}) → the officer reviews/edits the
 * notice prose → sealAdverseAction() seals the FINAL, signed-off record. Unlike the one-shot
 * reviewAdverseAction, this:
 *   - REQUIRES a persistent Ed25519 key (a signed-off exam record must carry a stable bank
 *     identity — never an ephemeral throwaway);
 *   - seals BOTH the AI-drafted originals AND the officer-edited finals, so the delta between
 *     "what the model produced" and "what the officer sent" is itself sealed evidence (the
 *     reconciliation an examiner asks for — design brief F2);
 *   - records the sign-off (or a dispute → "returned to model team", F3) as a human_approval event.
 *
 * @param {object} application
 * @param {object} opts
 * @param {string} opts.privateKey  Ed25519 private key (PEM) — REQUIRED.
 * @param {string} [opts.keyId]
 * @param {string} [opts.officer]   who signed off (recorded in the sealed record).
 * @param {"signed"|"disputed"} [opts.decision="signed"]
 * @param {string} [opts.disputeNote]  required-in-spirit when decision==="disputed".
 * @param {Object<string,string>|Array<{code:string,text:string}>} [opts.editedNotices]
 *        the officer's FINAL wording per AA code; codes not present keep the AI draft verbatim.
 * @param {string} [opts.nowIso]
 * @returns {object} { approved, sealed, decision, officer, verdict, adverseActionCodes,
 *   aiNotices, officerNotices, editedCodes, bundle, publicKeyPem, verify, ephemeralKey:false }
 */
export function sealAdverseAction(application, opts = {}) {
  if (!application || typeof application !== "object") throw new Error("sealAdverseAction: application object required");
  if (!opts.privateKey) {
    throw new Error("sealAdverseAction: a persistent Ed25519 private key is required to seal a signed-off record (opts.privateKey) — a sign-off must carry a stable bank identity, never an ephemeral key");
  }
  const nowIso = opts.nowIso || new Date().toISOString();

  // Reuse the review path for validation + deterministic council + AI-drafted notices.
  const draft = reviewAdverseAction(application, { draft: true, nowIso });
  if (draft.approved) {
    return { approved: true, sealed: false, decision: "n/a", verdict: draft.verdict,
      adverseActionCodes: draft.adverseActionCodes, aiNotices: [], officerNotices: [], editedCodes: [],
      bundle: null, publicKeyPem: null, verify: "n/a", ephemeralKey: false };
  }

  const aiNotices = draft.notices; // [{ code, label, notice }]
  const language = application.notice_language || "en";

  // Normalize the officer's final wording → { code: text }.
  const edits = {};
  if (Array.isArray(opts.editedNotices)) for (const e of opts.editedNotices) { if (e && e.code) edits[e.code] = e.text; }
  else if (opts.editedNotices && typeof opts.editedNotices === "object") Object.assign(edits, opts.editedNotices);

  const officerNotices = aiNotices.map((n) => {
    const finalText = edits[n.code];
    if (finalText == null) return { code: n.code, notice: n.notice, error: n.error, edited: false };
    const notice = (n.notice && typeof n.notice === "object") ? { ...n.notice, text: finalText } : finalText;
    return { code: n.code, notice, error: n.error, edited: true };
  });
  const editedCodes = officerNotices.filter((n) => n.edited).map((n) => n.code);
  const decision = opts.decision === "disputed" ? "disputed" : "signed";
  const officer = opts.officer || "unspecified-officer";

  const publicKeyPem = createPublicKey(opts.privateKey).export({ type: "spki", format: "pem" });
  const keyId = opts.keyId || "adverse-action";

  const session = createSession({
    agent: { name: "shadow-adverse-action", version: "1.0.0" },
    models: [],
    environmentFingerprint: { os: process.platform, node_version: process.version },
    keyId, privateKey: opts.privateKey, startedAtUtc: nowIso, embedPayloads: true,
  });
  appendEvent(session, { event_type: "session_start", actor: "system",
    payload: jsonSafe({ kind: "adverse_action_signoff", application_id: application.application_id || null }), ts_utc: nowIso });
  appendEvent(session, { event_type: "user_message", actor: "user",
    payload: jsonSafe({ kind: "credit_application", application }), ts_utc: nowIso });
  appendEvent(session, { event_type: "model_output", actor: "model",
    payload: jsonSafe({ kind: "council_verdict", final_verdict: draft.verdict, adverse_action_codes: draft.adverseActionCodes,
      voices: draft.council.voices, thresholds: draft.council.thresholds }), ts_utc: nowIso });
  // The AI's original draft AND the officer's final are BOTH sealed — the diff is the evidence.
  appendEvent(session, { event_type: "tool_result", actor: "tool",
    payload: jsonSafe({ kind: "ai_drafted_notices", language,
      notices: aiNotices.map((n) => ({ code: n.code, notice: n.notice, error: n.error })) }), ts_utc: nowIso });
  appendEvent(session, { event_type: "tool_result", actor: "tool",
    payload: jsonSafe({ kind: "officer_final_notices", language, edited_codes: editedCodes,
      notices: officerNotices.map((n) => ({ code: n.code, notice: n.notice, error: n.error, edited: n.edited })) }), ts_utc: nowIso });
  appendEvent(session, { event_type: "human_approval", actor: "user",
    payload: jsonSafe({ kind: "sign_off", decision, officer,
      dispute_note: decision === "disputed" ? (opts.disputeNote || null) : null, signed_at_utc: nowIso }), ts_utc: nowIso });
  const bundle = sealSession(session);

  let verify = "unknown";
  try { const r = verifyBundle(bundle, { publicKey: publicKeyPem }); verify = r && r.ok ? "verified" : `FAILED (${r && r.reason})`; }
  catch (e) { verify = `verify-error: ${e.message}`; }

  return { approved: false, sealed: true, decision, officer, verdict: draft.verdict,
    adverseActionCodes: draft.adverseActionCodes, aiNotices, officerNotices, editedCodes,
    bundle, publicKeyPem, verify, ephemeralKey: false };
}

/** Render the examiner-ready adverse-action report (markdown). */
export function renderReport({ application, verdict, notices, council, bundle, ephemeralKey, nowIso }) {
  const noticeText = (n) => !n.notice ? `  (could not draft: ${n.error})`
    : (typeof n.notice === "string" ? n.notice : (n.notice.text || n.notice.reason || JSON.stringify(n.notice)));
  const appId = application.application_id || application.case_id || application.applicant_id || "(unlabeled)";
  const L = [];
  L.push(`# Adverse-Action Review — ${appId}`);
  L.push(`*Independent verification by Shadow · ${nowIso} · signing: Ed25519${ephemeralKey ? " (ephemeral demo key — pass a key for a persistent identity)" : ""}*`);
  L.push("");
  L.push(`**Decision:** ${String(verdict).toUpperCase()}`);
  L.push(`**Applicant signals:** FICO ${application.credit_score ?? "?"} · DTI ${application.debt_to_income ?? "?"} · LTV ${application.loan_to_value ?? "?"}`);
  L.push("");
  L.push(`## Reg B / ECOA §1002.9(b)(2) adverse-action reasons`);
  for (const n of notices) { L.push(`\n### ${n.code}${n.label ? " — " + n.label : ""}`); L.push(noticeText(n)); }
  L.push("");
  L.push(`## Council reasoning (deterministic verdict; LLM writes rationale only)`);
  for (const v of council.voices || []) L.push(`- **${v.voice || v.name}** — ${v.vote || v.verdict}${v.reason ? ": " + v.reason : ""}`);
  L.push("");
  L.push(`## Evidence record`);
  L.push(`- Bundle: signed + hash-chained (${bundle?.events?.length ?? "?"} events).`);
  L.push(`- Re-verify independently, offline with the accompanying public key: \`bin/shadow-verify.mjs <bundle.json> --public-key <pub>.pem\`, or open \`verify.html\` and drop the bundle in. No network, no trust in Shadow required.`);
  return L.join("\n");
}
