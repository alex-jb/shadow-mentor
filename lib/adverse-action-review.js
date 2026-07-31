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
