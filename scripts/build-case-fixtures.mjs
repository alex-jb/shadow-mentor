#!/usr/bin/env node
// scripts/build-case-fixtures.mjs
// Produces the ② case-state signed evidence bundles the audit room needs
// beyond the single tamper demo: APPROVED (resting), REJECTED (hard block),
// MULTI-REVIEWER CONFLICT (approved vs rejected → pending, never silently
// resolved — FINDING-C1 semantics), and AML-FLAGGED. Each is a real attest-core
// bundle produced from the deterministic loan council, droppable into the 3D
// room's bundle loader (bundle-loader.js). Determinism: seq/hash are stable;
// signing keys are per-run (fixtures verify against their committed public key).
//
//   node scripts/build-case-fixtures.mjs
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "../packages/attest-core/session.js";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "demos", "replay", "3d", "case-fixtures");
mkdirSync(OUT, { recursive: true });
const STARTED = "2026-07-30T12:00:00.000Z";

function seal({ id, loan, extraLoan = {}, reviewers, kind }) {
  const decision = runLoanCouncil({ ...loan, ...extraLoan });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "shadow-loan-council", version: "1.5" },
    models: [{ model_id: "council-v1", provider: "deterministic-rules" }],
    environmentFingerprint: { os: process.platform, node_version: process.version },
    keyId: `case-${id}`, privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    sessionId: `case-${id}`, startedAtUtc: STARTED,
  });
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { loan: { ...loan, ...extraLoan } } });
  appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "bureau_pull", as_of: STARTED } });
  appendEvent(s, {
    event_type: "model_output", actor: "model",
    payload: {
      decision: decision.final_verdict,
      reason_codes: decision.adverse_action_codes.map((a) => a.code),
      voices: decision.voices.map((v) => ({ voice: v.voice, verdict: v.verdict, probabilities: v.probabilities })),
    },
  });
  // Reviewer decisions — the honest part: multiple, verbatim, never collapsed.
  for (const r of reviewers) {
    appendEvent(s, {
      event_type: "human_approval", actor: "user",
      payload: { approved: r.decision === "approved", reviewer_interaction: r },
    });
  }
  const bundle = sealSession(s, { endedAtUtc: STARTED });
  const pub = publicKey.export({ type: "spki", format: "pem" });
  const verified = verifyBundle(bundle, { publicKey: pub });
  if (!verified.ok) throw new Error(`${id} failed verification`);
  writeFileSync(resolve(OUT, `${id}.bundle.json`), JSON.stringify(bundle, null, 2) + "\n");
  writeFileSync(resolve(OUT, `${id}.public.pem`), pub);
  return { id, kind, verdict: decision.final_verdict, events: bundle.events.length, reviewers: reviewers.length };
}

const CASES = [
  { id: "approved", kind: "resting clean decision (5/5 approve)", loan: { loan_id: "CASE-APPROVED", credit_score: 780, debt_to_income: 0.22, loan_to_value: 0.55, amount: 200000, sector: "technology",
      // low-volatility market proxy so Risk Officer's VaR clears the 12% Addendum-C ceiling — a GENUINE clean approve, not a mislabeled escalate
      market_proxy_prices: Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 9) * 0.25) },
    reviewers: [{ decision: "approved", reviewer_id: "credit-committee", review_duration_ms: 42000 }] },
  { id: "rejected", kind: "hard block (FICO floor)", loan: { loan_id: "CASE-REJECTED", credit_score: 640, debt_to_income: 0.44, loan_to_value: 0.9, amount: 310000, sector: "retail" },
    reviewers: [{ decision: "rejected", reviewer_id: "credit-committee", override_rationale: "FICO below Addendum A floor; hard block per policy" }] },
  { id: "multi-reviewer-conflict", kind: "approved vs rejected → pending (FINDING-C1)", loan: { loan_id: "CASE-CONFLICT", credit_score: 705, debt_to_income: 0.35, loan_to_value: 0.79, amount: 250000, sector: "healthcare" },
    reviewers: [
      { decision: "approved", reviewer_id: "reviewer-a", review_duration_ms: 30000 },
      { decision: "rejected", reviewer_id: "reviewer-b", override_rationale: "sector concentration concern; disagree with approval" },
    ] },
  { id: "aml-flagged", kind: "AML/KYC 6th-voice flag", loan: { loan_id: "CASE-AML", credit_score: 760, debt_to_income: 0.28, loan_to_value: 0.6, amount: 150000, sector: "technology" },
    extraLoan: { aml_flags: ["structuring_pattern"] },
    reviewers: [{ decision: "modified", reviewer_id: "aml-investigator", override_rationale: "structuring pattern — enhanced due diligence before any approval" }] },
];

const summary = CASES.map(seal);
// Honesty guard: the fixture id must match the council's actual verdict class,
// never a wished-for label. approved→approve, rejected→block; escalate cases
// (conflict/aml) are honestly escalate.
const EXPECT = { approved: "approve", rejected: "block", "multi-reviewer-conflict": "escalate", "aml-flagged": "escalate" };
for (const c of summary) {
  if (EXPECT[c.id] && c.verdict !== EXPECT[c.id]) {
    throw new Error(`fixture "${c.id}" labeled as ${EXPECT[c.id]} but council returned ${c.verdict} — refusing to mislabel`);
  }
}
writeFileSync(resolve(OUT, "README.md"),
  "# Audit-room case-state fixtures (②)\n\nDrop any `*.bundle.json` into the 3D room (bundle-loader.js) to render that case.\nEach is a real signed attest-core bundle from the deterministic council. Verify with its `*.public.pem`.\n\n" +
  "| case | kind | verdict | events | reviewers |\n|---|---|---|---|---|\n" +
  summary.map((c) => `| ${c.id} | ${c.kind} | ${c.verdict} | ${c.events} | ${c.reviewers} |`).join("\n") + "\n");
console.log(JSON.stringify(summary, null, 2));
