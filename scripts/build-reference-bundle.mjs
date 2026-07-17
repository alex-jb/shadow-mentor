#!/usr/bin/env node
// scripts/build-reference-bundle.mjs
// One-time producer of the committed REFERENCE banking-decision evidence bundle
// (docs/reference/). It runs the real loan council on a sample applicant, turns
// the verdict + adverse-action codes into a signed evidence bundle, and writes
// the static artifacts (bundle + public key + payloads). The private key is
// discarded — like docs/dogfood-evidence/, the committed bundle is a fixture the
// CI test (test/reference-banking-bundle.test.js) verifies against the committed
// PUBLIC key. Re-running mints a new bundle/key; that's expected — the committed
// artifact is the reference, not the regeneration.
//
//   node scripts/build-reference-bundle.mjs
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "../packages/attest-core/session.js";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";
import { checkBankingProfileV1 } from "../lib/enforce-banking-profile.js";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs", "reference");
mkdirSync(OUT, { recursive: true });

// A real adverse credit decision from the deterministic council (block: FICO
// below floor + DTI + LTV + concentration → 4 AA codes, the Reg B maximum).
const loan = { loan_id: "REF-2026-001", credit_score: 640, debt_to_income: 0.44, loan_to_value: 0.88, amount: 310000, sector: "retail" };
const decision = runLoanCouncil(loan);
const reasonCodes = decision.adverse_action_codes.map((a) => a.code);

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const s = createSession({
  agent: { name: "shadow-loan-council", version: "1.5" },
  models: [{ model_id: "council-v1", provider: "deterministic-rules" }],
  environmentFingerprint: { os: process.platform, node_version: process.version },
  keyId: "reference-2026", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  sessionId: "reference-banking-decision-2026-001",
});
const modelPayload = { decision: decision.final_verdict, reason_codes: reasonCodes, aggregated_score: decision.aggregated_score };
appendEvent(s, { event_type: "prompt", actor: "user", payload: { loan } });
appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "bureau_pull", as_of: "2026-07-17T00:00:00Z" } });
appendEvent(s, { event_type: "model_output", actor: "model", payload: modelPayload,
  extensions: { dictionary_hash: computeDictionaryHash(), citation_registry_sha256: "sha256:reference-registry" } });
appendEvent(s, { event_type: "human_approval", actor: "user", payload: { approved: true, reviewer: "credit-committee" } });
const bundle = sealSession(s);
const pub = publicKey.export({ type: "spki", format: "pem" });

// payloads sidecar keyed by seq — enables the value-level checks (reason-code
// count, adverse detection) without exposing them in the (hashed) bundle.
const payloads = { 0: { loan }, 1: { tool: "bureau_pull", as_of: "2026-07-17T00:00:00Z" }, 2: modelPayload, 3: { approved: true, reviewer: "credit-committee" } };

// self-check before writing — never commit a non-conforming reference
const verified = verifyBundle(bundle, { publicKey: pub });
const conf = checkBankingProfileV1(bundle, { verified, payloads });
if (!verified.ok) throw new Error("reference bundle failed verification");
if (!conf.pass) throw new Error(`reference bundle NON-CONFORMANT: missing ${conf.missing_required.join(", ")}`);

writeFileSync(resolve(OUT, "banking-decision.bundle.json"), JSON.stringify(bundle, null, 2) + "\n");
writeFileSync(resolve(OUT, "banking-decision.public.pem"), pub);
writeFileSync(resolve(OUT, "banking-decision.payloads.json"), JSON.stringify(payloads, null, 2) + "\n");
process.stdout.write(`wrote docs/reference/ — decision=${decision.final_verdict}, reason_codes=[${reasonCodes.join(",")}], CONFORMS ${conf.coverage_pct}% (private key discarded).\n`);
