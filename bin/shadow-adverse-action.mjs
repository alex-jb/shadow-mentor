#!/usr/bin/env node
// bin/shadow-adverse-action.mjs
// ─────────────────────────────────────────────────────────────────────────
// THE WEDGE PRODUCT, in one command. (Core logic in lib/adverse-action-review.js,
// shared with api/adverse-action.js so the CLI and the HTTP surface match.)
//
// Input: an AI/ML-denied credit application (JSON). Output for a fair-lending
// compliance officer: (1) an examiner-ready adverse-action report — the specific
// Reg B / ECOA §1002.9(b)(2) reason codes + compliant notice text; and (2) a
// signed, hash-chained evidence bundle the customer (or an examiner) re-verifies
// OFFLINE with verify.html / bin/shadow-verify.mjs — independently, no trust in us.
//
//   shadow-adverse-action <application.json> [--key private.pem] [--key-id id]
//                         [--out-report r.md] [--out-bundle b.json] [--json]
//
// With no --key it mints an ephemeral Ed25519 key so the record is still
// independently verifiable (the matching public key is written beside the bundle).
//
// Exit: 0 ok · 2 usage · 3 I/O · 4 the council APPROVED (nothing adverse to notice)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { reviewAdverseAction } from "../lib/adverse-action-review.js";

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

let appPath = null, keyPath = null, keyId = null, outReport = null, outBundle = null, asJson = false;
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
if (keyPath) { try { privateKey = readFileSync(keyPath, "utf8"); } catch (e) { die(3, `cannot read key: ${e.message}`); } }

let result;
try { result = reviewAdverseAction(application, { privateKey, keyId: keyId || undefined }); }
catch (e) { die(3, `review failed: ${e.message}`); }

if (result.approved) {
  process.stderr.write(`Council verdict: ${result.verdict}. No adverse-action reason codes to draft — this application was not denied.\n`);
  process.exit(4);
}

let pubPath = null;
if (outReport) { try { writeFileSync(outReport, result.report + "\n"); } catch (e) { die(3, `cannot write report: ${e.message}`); } }
if (outBundle) {
  try { writeFileSync(outBundle, JSON.stringify(result.bundle, null, 2) + "\n"); } catch (e) { die(3, `cannot write bundle: ${e.message}`); }
  pubPath = outBundle.replace(/\.json$/, "") + ".pub.pem";
  try { writeFileSync(pubPath, result.publicKeyPem); } catch { pubPath = null; }
}

if (asJson) {
  process.stdout.write(JSON.stringify({ verdict: result.verdict, adverse_action_codes: result.adverseActionCodes,
    notices: result.notices, verify: result.verify, public_key: result.publicKeyPem, bundle: result.bundle }, null, 2) + "\n");
} else {
  process.stdout.write(result.report + "\n");
  process.stdout.write(`\n(self-check: ${result.verify})\n`);
  if (!outBundle) process.stderr.write(`(signed bundle not written — pass --out-bundle b.json to save the re-verifiable record + its .pub.pem)\n`);
}
