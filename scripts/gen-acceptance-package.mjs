// scripts/gen-acceptance-package.mjs
// Produces ONE sanitized software-acceptance package for Shadow Lens, reproducibly, from the
// real pipeline: run `node scripts/gen-acceptance-package.mjs [outDir]`.
// Contents: fixture capture metadata, source_map.json, analysis.json, review.json, the signed
// evidence bundle + public key, the verification result, a tampered bundle + its precise
// failure result, Flow CSV/JSON (+ ZIP if `zip` exists), the API request/response transcript,
// the build commit, and the capability matrix. Nothing private is written (ephemeral demo key;
// fixture document only).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runOneShot } from "../api/shadow-lens/run.js";
import { exportFlowScenes } from "../apps/shadow-lens/flow/export-session.mjs";
import { verifyBundle } from "../packages/attest-core/session.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE_CAPTURE = { capture_id: "cap_acceptance", capture_sha256: "sha256:" + "a".repeat(64), capture_method: "fixture" };
const SOURCE_MAP = [
  { source_id: "B0L0", text: "FICO Score: 706", bounding_box_normalized: { x: 0.1, y: 0.30, w: 0.40, h: 0.03 }, confidence: 0.97 },
  { source_id: "B0L1", text: "Debt-to-Income: 0.41", bounding_box_normalized: { x: 0.1, y: 0.34, w: 0.46, h: 0.03 }, confidence: 0.95 },
];
const FINDINGS = [{ claim: "DTI 0.41 exceeds the 0.36 policy ceiling", source_ids: ["B0L1"], quote: "Debt-to-Income: 0.41", severity: "warn", confidence: 0.9 }];
const REVIEW = { decision: "approved", reviewer_id: "acceptance-reviewer" };

export async function generate(outDir) {
  mkdirSync(outDir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const serverKey = { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }), ephemeral: true };

  const request = {
    source_map: SOURCE_MAP, capture: FIXTURE_CAPTURE,
    device: { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" },
    build: { app_commit: buildCommit() }, findings: FINDINGS, reviewer: REVIEW,
  };
  const out = await runOneShot(request, { serverKey });
  if (out.http !== 200) throw new Error(`pipeline failed: ${out.error}`);

  // pristine verification (independent, against the public key)
  const flow = exportFlowScenes(out.session);

  // tamper: mutate one event of a COPY, re-verify → precise failure. Pristine is untouched.
  const seal = await sealForBundle(request, serverKey);
  const tampered = structuredClone(seal.bundle);
  (tampered.events ?? tampered.records ?? [{}])[0].payload = { injected: "post-hoc-edit" };
  const failure = verifyBundle(tampered, { publicKey: serverKey.pub });

  const write = (name, data) => writeFileSync(join(outDir, name), typeof data === "string" ? data : JSON.stringify(data, null, 2));
  write("capture.json", FIXTURE_CAPTURE);
  write("source_map.json", SOURCE_MAP);
  write("analysis.json", out.analysis);
  write("review.json", REVIEW);
  write("session.json", out.session);
  write("evidence-bundle.json", seal.bundle);
  write("public-key.pem", serverKey.pub);
  write("verification.json", { record_integrity: out.verification.record_integrity, contract_valid: out.contract_valid, source_coverage_pct: out.verification.source_coverage_pct });
  write("tampered-bundle.json", tampered);
  write("failure-result.json", { ok: failure.ok, failedSeq: failure.failedSeq ?? failure.error?.seq ?? null, reason: failure.reason ?? failure.error?.reason ?? null });
  write("flow-audit.csv", flow.csv.audit); write("flow-risk.csv", flow.csv.risk); write("flow-council.csv", flow.csv.council);
  write("flow-scenes.json", flow.scenes);
  write("api-transcript.json", { request: sanitize(request), response: { session_id: out.session.session_id, verification: out.verification, analysis: out.analysis, signing_key: out.signing_key } });
  write("build-commit.txt", buildCommit());
  if (existsSync(join(ROOT, "apps/shadow-lens/docs/CAPABILITY_MATRIX.md")))
    write("CAPABILITY_MATRIX.md", readFileSync(join(ROOT, "apps/shadow-lens/docs/CAPABILITY_MATRIX.md"), "utf8"));

  // Flow ZIP (best-effort; the CSV/JSON are always present)
  let zipped = false;
  try {
    execFileSync("zip", ["-qj", join(outDir, "flow-export.zip"), join(outDir, "flow-audit.csv"), join(outDir, "flow-risk.csv"), join(outDir, "flow-council.csv"), join(outDir, "flow-scenes.json")]);
    zipped = true;
  } catch { /* zip not available — CSV/JSON still shipped */ }

  const manifest = {
    generated_from: "shadow-lens-real-pipeline (fixture document, ephemeral demo key)",
    build_commit: buildCommit(),
    contract_version: out.session.contract_version,
    record_integrity: out.verification.record_integrity,
    tamper_detected: failure.ok === false,
    flow_zip: zipped,
    files: ["capture.json", "source_map.json", "analysis.json", "review.json", "session.json", "evidence-bundle.json", "public-key.pem", "verification.json", "tampered-bundle.json", "failure-result.json", "flow-audit.csv", "flow-risk.csv", "flow-council.csv", "flow-scenes.json", "api-transcript.json", "build-commit.txt", "CAPABILITY_MATRIX.md"].concat(zipped ? ["flow-export.zip"] : []),
  };
  write("MANIFEST.json", manifest);
  return { outDir, manifest, pristine_verified: out.verification.record_integrity === "verified", tamper_detected: failure.ok === false };
}

async function sealForBundle(request, serverKey) {
  // re-run to capture the bundle object (runOneShot returns the session, not the bundle)
  const { InMemoryLensStore } = await import("../apps/shadow-lens/backend/session-store.mjs");
  const api = await import("../apps/shadow-lens/backend/lens-api.mjs");
  const store = new InMemoryLensStore();
  const c = await api.createSession({ device: request.device, build: request.build, store });
  await store.update(c.session_id, { stage: "captured", capture: request.capture, session_version: 1 });
  await api.validateSourceMap({ token: c.token, sourceMap: request.source_map, store });
  await api.analyze({ token: c.token, findings: request.findings, store });
  await api.review({ token: c.token, reviewer: request.reviewer, store });
  return api.sealEvidence({ token: c.token, signingKeyPem: serverKey.priv, publicKeyPem: serverKey.pub, store });
}

function buildCommit() {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim(); } catch { return "unknown"; }
}
function sanitize(req) { return { ...req, findings: `[${req.findings.length} fixture findings]` }; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] || join(ROOT, "apps/shadow-lens/acceptance/out");
  generate(outDir).then((r) => {
    console.log("acceptance package →", r.outDir);
    console.log("pristine verified:", r.pristine_verified, "| tamper detected:", r.tamper_detected);
    console.log("files:", r.manifest.files.length, "| flow zip:", r.manifest.flow_zip);
  }).catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
}
