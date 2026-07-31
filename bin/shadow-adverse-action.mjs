#!/usr/bin/env node
// bin/shadow-adverse-action.mjs
// ─────────────────────────────────────────────────────────────────────────
// THE WEDGE PRODUCT, in one command.
//
// Input: an AI/ML-denied credit application (JSON). Output, for a fair-lending
// compliance officer: (1) an examiner-ready adverse-action report — the specific
// Reg B / ECOA §1002.9(b)(2) reason codes + compliant notice text grounded in a
// citation registry, and the council reasoning; and (2) a signed, hash-chained
// evidence bundle the customer (or an examiner) can re-verify OFFLINE with
// verify.html / bin/shadow-verify.mjs — independently, without trusting us.
//
// This is the concierge deliverable ("paste one denied application, get the
// exam-ready trace") automated by composing what Shadow already ships:
//   runLoanCouncil → draftAdverseActionNotice → createSession/sealSession.
//
//   shadow-adverse-action <application.json> [--key private.pem] [--key-id id]
//                         [--out-report r.md] [--out-bundle b.json] [--json]
//
// With no --key it signs in dev HMAC mode (a warning prints — NOT independently
// verifiable). For a real, independently-verifiable record, pass an Ed25519 key
// (generate one with bin/generate-attestation-keypair.mjs).
//
// Exit: 0 ok · 2 usage · 3 I/O · 4 the council APPROVED (nothing adverse to notice)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { draftAdverseActionNotice } from "../lib/adverse-action-drafter.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "shadow-attest-core/session";

const argv = process.argv.slice(2);
const die = (code, msg) => { process.stderr.write(msg + "\n"); process.exit(code); };
if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
  process.stdout.write(
    "Usage: shadow-adverse-action <application.json> [--key private.pem] [--key-id id]\n" +
    "                             [--out-report r.md] [--out-bundle b.json] [--json]\n\n" +
    "Turns an AI-denied credit application into an examiner-ready adverse-action\n" +
    "report + a signed, offline-re-verifiable evidence bundle.\n");
  process.exit(argv.length === 0 ? 2 : 0);
}

let appPath = null, keyPath = null, keyId = "adverse-action-dev", outReport = null, outBundle = null, asJson = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--key") keyPath = argv[++i];
  else if (a === "--key-id") keyId = argv[++i];
  else if (a === "--out-report") outReport = argv[++i];
  else if (a === "--out-bundle") outBundle = argv[++i];
  else if (a === "--json") asJson = true;
  else if (!a.startsWith("-") && !appPath) appPath = a;
  else die(2, `unknown argument: ${a}`);
}
if (!appPath) die(2, "shadow-adverse-action: <application.json> is required");

let application, privateKey = null;
try { application = JSON.parse(readFileSync(appPath, "utf8")); }
catch (e) { die(3, `cannot read application: ${e.message}`); }
let ephemeralKey = false, publicKeyPem = null;
if (keyPath) {
  try { privateKey = readFileSync(keyPath, "utf8"); } catch (e) { die(3, `cannot read key: ${e.message}`); }
  try { publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }); }
  catch (e) { die(3, `cannot derive public key from --key: ${e.message}`); }
} else {
  // No key supplied → mint an EPHEMERAL Ed25519 keypair so the record is still
  // independently verifiable (we write the matching public key out beside the
  // bundle). Fine for a demo / concierge run; for a persistent signing identity a
  // bank pins, pass --key (generate one with bin/generate-attestation-keypair.mjs).
  const { privateKey: pk, publicKey: pub } = generateKeyPairSync("ed25519");
  privateKey = pk.export({ type: "pkcs8", format: "pem" });
  publicKeyPem = pub.export({ type: "spki", format: "pem" });
  keyId = keyId === "adverse-action-dev" ? "ephemeral-demo" : keyId;
  ephemeralKey = true;
}

// 1 — run the deterministic council (verdict + AA codes; the LLM never decides).
const council = runLoanCouncil(application);
const verdict = council.final_verdict;
const aaCodes = Array.isArray(council.adverse_action_codes) ? council.adverse_action_codes : [];

if (verdict === "approve" || aaCodes.length === 0) {
  process.stderr.write(
    `Council verdict: ${verdict}. No adverse-action reason codes to draft — this application was not denied.\n`);
  process.exit(4);
}

// 2 — draft a §1002.9(b)(2)-compliant notice for each reason code (grounded, or it refuses).
const language = application.notice_language || "en";
const notices = [];
for (const aa of aaCodes) {
  const code = typeof aa === "string" ? aa : aa.code;
  try {
    const n = draftAdverseActionNotice({ aaCode: code, language, loanContext: application });
    notices.push({ code, label: (typeof aa === "object" && aa.label) || undefined, notice: n });
  } catch (e) {
    notices.push({ code, error: e.message });
  }
}

// 3 — seal it as a signed, hash-chained evidence bundle (v3 evidence-bundle path).
// JSON-normalize each payload first: the council's risk math can emit NaN/Infinity,
// which JSON.stringify turns into null on write — so seal-time and file forms must
// be reconciled BEFORE hashing, or the written bundle won't re-verify.
const jsonSafe = (o) => JSON.parse(JSON.stringify(o ?? null));
const nowIso = new Date().toISOString();
const session = createSession({
  agent: { name: "shadow-adverse-action", version: "1.0.0" },
  models: [], // the verdict is deterministic rules, not an LLM model — recorded in the council_verdict event
  environmentFingerprint: { os: process.platform, node_version: process.version },
  keyId,
  privateKey, // null → dev HMAC (warns, not independently verifiable)
  startedAtUtc: nowIso,
});
appendEvent(session, { event_type: "session_start", actor: "system",
  payload: jsonSafe({ kind: "adverse_action_review", application_id: application.application_id || null }), ts_utc: nowIso });
appendEvent(session, { event_type: "user_message", actor: "user",
  payload: jsonSafe({ kind: "credit_application", application }), ts_utc: nowIso });
appendEvent(session, { event_type: "model_output", actor: "model",
  payload: jsonSafe({ kind: "council_verdict", final_verdict: verdict,
    adverse_action_codes: aaCodes, voices: council.voices, thresholds: council.thresholds }), ts_utc: nowIso });
appendEvent(session, { event_type: "tool_result", actor: "tool",
  payload: jsonSafe({ kind: "adverse_action_notices", language,
    notices: notices.map((n) => ({ code: n.code, notice: n.notice, error: n.error })) }), ts_utc: nowIso });
const bundle = sealSession(session);

// self-check: the bundle we just produced must verify against its public key.
let verifyState = "unknown";
try {
  const r = verifyBundle(bundle, { publicKey: publicKeyPem });
  verifyState = r && r.ok ? "verified" : `FAILED (${r && r.reason})`;
} catch (e) { verifyState = `verify-error: ${e.message}`; }

// 4 — render the examiner-ready report.
function noticeText(n) {
  if (!n.notice) return `  (could not draft: ${n.error})`;
  if (typeof n.notice === "string") return n.notice;
  return n.notice.text || n.notice.reason || JSON.stringify(n.notice);
}
const appId = application.application_id || application.case_id || application.applicant_id || "(unlabeled)";
const lines = [];
lines.push(`# Adverse-Action Review — ${appId}`);
lines.push(`*Independent verification by Shadow · ${nowIso} · signing: Ed25519${ephemeralKey ? " (ephemeral demo key — pass --key for a persistent identity)" : ""}*`);
lines.push("");
lines.push(`**Decision:** ${verdict.toUpperCase()}`);
lines.push(`**Applicant signals:** FICO ${application.credit_score ?? "?"} · DTI ${application.debt_to_income ?? "?"} · LTV ${application.loan_to_value ?? "?"}`);
lines.push("");
lines.push(`## Reg B / ECOA §1002.9(b)(2) adverse-action reasons`);
for (const n of notices) {
  lines.push(`\n### ${n.code}${n.label ? " — " + n.label : ""}`);
  lines.push(noticeText(n));
}
lines.push("");
lines.push(`## Council reasoning (deterministic verdict; LLM writes rationale only)`);
for (const v of council.voices || []) {
  lines.push(`- **${v.voice || v.name}** — ${v.vote || v.verdict}${v.reason ? ": " + v.reason : ""}`);
}
lines.push("");
lines.push(`## Evidence record`);
lines.push(`- Bundle: signed + hash-chained (${bundle.events?.length ?? "?"} events).`);
lines.push(`- Self-check: **${verifyState}**.`);
lines.push(`- Re-verify independently, offline with the accompanying public key: \`bin/shadow-verify.mjs <bundle.json> --public-key <bundle>.pub.pem\` — or open \`verify.html\` and drop the bundle in. No network, no trust in Shadow required.`);
const report = lines.join("\n");

// 5 — output.
if (outReport) { try { writeFileSync(outReport, report + "\n"); } catch (e) { die(3, `cannot write report: ${e.message}`); } }
let pubPath = null;
if (outBundle) {
  try { writeFileSync(outBundle, JSON.stringify(bundle, null, 2) + "\n"); } catch (e) { die(3, `cannot write bundle: ${e.message}`); }
  pubPath = outBundle.replace(/\.json$/, "") + ".pub.pem";
  try { writeFileSync(pubPath, publicKeyPem); } catch { pubPath = null; }
}

if (asJson) {
  process.stdout.write(JSON.stringify({ verdict, adverse_action_codes: aaCodes, notices, verify: verifyState, bundle }, null, 2) + "\n");
} else {
  process.stdout.write(report + "\n");
  if (!outBundle) process.stderr.write(`\n(signed bundle not written — pass --out-bundle b.json to save the re-verifiable record)\n`);
}
