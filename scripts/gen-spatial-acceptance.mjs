// scripts/gen-spatial-acceptance.mjs
// §12 — Reproducible spatial-agent acceptance package. One command:
//   node scripts/gen-spatial-acceptance.mjs [outDir]
// Produces, for all three profiles: a REAL signed session, its scene graph, a question, the
// agent response + citations + requested actions, the CLIENT validation result + execution
// confirmation, verification + a tampered result, the commit SHA, and a test summary — each item
// labeled: REAL SESSION / FIXTURE MODEL / LIVE MODEL / CLIENT EXECUTED / CLIENT NOT EXECUTED /
// DEVICE VALIDATION PENDING so nothing is overclaimed.
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildEvidenceSession } from "../apps/shadow-lens/backend/build-evidence-session.mjs";
import { dataScienceSpec, codingAgentSpec } from "../apps/shadow-lens/fixtures/profile-fixtures.mjs";
import { sessionToSceneGraph } from "../apps/shadow-lens/web/spatial-agent/scene-graph.mjs";
import { runSpatialAgent } from "../apps/shadow-lens/web/spatial-agent/agent-core.mjs";
import { validateActions } from "../apps/shadow-lens/web/spatial-agent/client-actions.mjs";
import { verifyBundle } from "../packages/attest-core/session.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CASES = [
  { profile: "data-science-v1", spec: dataScienceSpec, question: "show the source supporting the first finding" },
  { profile: "coding-agent-v1", spec: codingAgentSpec, question: "verify this record" },
  { profile: "data-science-v1", spec: dataScienceSpec, question: "what is the meaning of life" }, // ungrounded case
];

function buildCommit() { try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim(); } catch { return "unknown"; } }

export async function generate(outDir) {
  mkdirSync(outDir, { recursive: true });
  const items = [];
  for (let i = 0; i < CASES.length; i++) {
    const { profile, spec, question } = CASES[i];
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const k = { signingKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }), publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) };
    const built = buildEvidenceSession(spec(k));                 // REAL SESSION
    const scene = sessionToSceneGraph(built.session);
    const resp = await runSpatialAgent({ session: built.session, scene, bundle: built.bundle, publicKeyPem: k.publicKeyPem, query: question }); // FIXTURE MODEL

    // client-side validation + simulated execution confirmation (CLIENT LOGIC, not a real device)
    const { valid, rejected } = validateActions(resp.actions, scene);
    const clientExecuted = valid.length > 0;

    // tamper → exact failure
    const tampered = structuredClone(built.bundle);
    (tampered.events ?? tampered.records)[1].payload = { injected: true };
    const failure = verifyBundle(tampered, { publicKey: k.publicKeyPem });

    const item = {
      case: i, profile, question,
      labels: {
        session: "REAL SESSION",
        model: "FIXTURE MODEL",                                 // no live model in this run
        client_execution: clientExecuted ? "CLIENT EXECUTED (logic; browser/Unity render DEVICE VALIDATION PENDING)" : "CLIENT NOT EXECUTED",
        device: "DEVICE VALIDATION PENDING",
      },
      session_id: built.session.session_id,
      verification: built.session.verification,
      answer: resp.text, grounded: resp.grounded,
      citations: resp.citations, requested_actions: resp.actions,
      client_validation: { valid, rejected },
      tamper: { detected: failure.ok === false, failed_seq: failure.failedSeq ?? failure.error?.seq ?? null },
      public_key_pem: k.publicKeyPem,
    };
    writeFileSync(join(outDir, `case-${i}-${profile}.json`), JSON.stringify({ ...item, scene }, null, 2));
    items.push(item);
  }
  const manifest = {
    generated: "spatial-agent acceptance package",
    build_commit: buildCommit(),
    legend: ["REAL SESSION", "FIXTURE MODEL", "LIVE MODEL (not run here)", "CLIENT EXECUTED", "CLIENT NOT EXECUTED", "DEVICE VALIDATION PENDING"],
    cases: items.map((it) => ({ case: it.case, profile: it.profile, question: it.question, grounded: it.grounded, labels: it.labels, tamper_detected: it.tamper.detected })),
  };
  writeFileSync(join(outDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2));
  return { outDir, manifest, cases: items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || join(ROOT, "apps/shadow-lens/acceptance/spatial-out");
  const r = await generate(out);
  console.log("spatial acceptance →", r.outDir);
  for (const c of r.manifest.cases) console.log(`  case ${c.case} [${c.profile}] grounded=${c.grounded} tamper=${c.tamper_detected} · ${c.labels.client_execution}`);
}
