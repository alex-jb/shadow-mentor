// END-TO-END integration: proves Shadow Lens is ONE product, not disconnected modules.
// A single session_id walks the whole chain — staged lifecycle (create→capture→source-map→
// analyze→review→seal→verify) → real Ed25519 bundle → Flow scene export — and we assert the
// pieces are COHERENT: the capture hash you register is the hash in the sealed bundle is the
// evidence_ref in the Flow audit scene; a ghost-cited finding never becomes a claim and never
// a "real" Flow row; tampering flips the verification status that propagates to Flow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  createSession, registerCapture, validateSourceMap, analyze, review, sealEvidence, verify,
} from "../apps/shadow-lens/backend/lens-api.mjs";
import { computeSourceMapHash } from "../apps/shadow-lens/backend/analyze.mjs";
import { exportFlowScenes } from "../apps/shadow-lens/flow/export-session.mjs";
import { verifyBundle } from "../packages/attest-core/session.js";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("shadow-lens-e2e-frame")]);
const DEVICE = { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" };
const SM = [
  { source_id: "B0L0", text: "FICO Score: 706", bounding_box_normalized: { x: 0.1, y: 0.30, w: 0.40, h: 0.03 }, confidence: 0.97 },
  { source_id: "B0L1", text: "Debt-to-Income: 0.41", bounding_box_normalized: { x: 0.1, y: 0.34, w: 0.46, h: 0.03 }, confidence: 0.95 },
];

async function runWholeChain(k) {
  const c = await createSession({ device: DEVICE, build: { app_commit: "e2e" } });
  const { token, store, session_id } = c;

  const cap = await registerCapture({ token, bytes: PNG, store });
  const sm = await validateSourceMap({ token, sourceMap: SM, store });

  // one honest finding (cites a real id) + one hallucinated finding (cites a ghost id).
  const findings = [
    { claim: "DTI 0.41 exceeds the 0.36 policy ceiling", source_ids: ["B0L1"], quote: "Debt-to-Income: 0.41", severity: "warn", confidence: 0.9 },
    { claim: "coordinates the model invented", source_ids: ["GHOST9"], quote: "x", severity: "critical", confidence: 0.5 },
  ];
  await analyze({ token, findings, store });
  await review({ token, reviewer: { decision: "approved" } , store });
  const seal = await sealEvidence({ token, signingKeyPem: k.priv, publicKeyPem: k.pub, keyId: "e2e", store });
  const ver = await verify({ token, store });
  return { session_id, capture: cap.capture, source_map_hash: sm.source_map_hash, seal, ver };
}

test("one session_id is coherent across staged lifecycle → bundle → Flow", async () => {
  const k = keys();
  const { session_id, capture, source_map_hash, seal, ver } = await runWholeChain(k);

  // seal + verify are real
  assert.equal(seal.ok && seal.verified && seal.valid, true, JSON.stringify(seal.validation_errors));
  assert.equal(ver.record_integrity, "verified");

  // provenance coherence: the hash we registered == the session's capture hash == Flow evidence_ref
  assert.equal(seal.session.capture.capture_sha256, capture.capture_sha256);
  assert.equal(seal.session.provenance.capture_hash, capture.capture_sha256);
  assert.equal(seal.session.provenance.source_map_hash, source_map_hash);
  assert.equal(source_map_hash, computeSourceMapHash(SM), "source_map_hash is content-addressed, not fabricated");

  // un-hallucinable coordinates: the ghost-cited finding never became a claim
  assert.equal(seal.session.claims.length, 1);
  assert.equal(seal.session.claims[0].source_ids[0], "B0L1");
  assert.equal(seal.session.claims.some((c) => c.source_ids.includes("GHOST9")), false);

  // Flow export: SAME session_id on every row; audit scene carries the real hashes; the one
  // real claim is a "real" risk row; verification status propagates.
  const flow = exportFlowScenes(seal.session);
  const allRows = [...flow.scenes.audit, ...flow.scenes.risk, ...flow.scenes.council];
  assert.ok(allRows.length > 0);
  assert.equal(allRows.every((r) => r.session_id === session_id), true, "every Flow row must carry the one session_id");
  assert.equal(allRows.every((r) => r.verification_status === "verified"), true);
  const captureNode = flow.scenes.audit.find((r) => r.stage === "capture");
  assert.equal(captureNode.evidence_ref, capture.capture_sha256, "Flow audit capture node == the real capture hash");
  const ocrNode = flow.scenes.audit.find((r) => r.stage === "ocr");
  assert.equal(ocrNode.evidence_ref, source_map_hash);
  assert.equal(flow.scenes.risk.length, 1);
  assert.equal(flow.scenes.risk[0].real_or_fixture, "real");
});

test("tampering the sealed bundle breaks verification for the SAME chain", async () => {
  const k = keys();
  const { seal } = await runWholeChain(k);
  // the seal produced a real attest-core bundle — corrupt one event and re-verify
  const tampered = structuredClone(seal.bundle);
  const evs = tampered.events ?? tampered.records ?? null;
  assert.ok(Array.isArray(evs) && evs.length > 0, "bundle exposes an events array to tamper");
  const target = evs.find((e) => e.payload) ?? evs[0];
  target.payload = { ...(target.payload || {}), injected: "post-hoc-edit" };
  const v = verifyBundle(tampered, { publicKey: k.pub });
  assert.equal(v.ok, false, "a post-hoc edit must fail verification");
});
