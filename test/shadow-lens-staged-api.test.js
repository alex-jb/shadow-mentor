// End-to-end test of the staged Shadow Lens lifecycle: create → capture → source-map →
// analyze → review → seal → verify, all over one store + ephemeral token. Uses a real
// Ed25519 key for the seal so the verification is genuine (not a mock).
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  createSession, registerCapture, validateSourceMap, analyze, review, sealEvidence, verify,
} from "../apps/shadow-lens/backend/lens-api.mjs";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}
// tiny valid PNG (8-byte signature + IHDR-ish) — enough for magic-byte sniffing
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const SM = [
  { source_id: "B0L0", text: "FICO Score: 706", bounding_box_normalized: { x: 0.1, y: 0.3, w: 0.4, h: 0.03 }, confidence: 0.97 },
  { source_id: "B0L1", text: "Debt-to-Income: 0.41", bounding_box_normalized: { x: 0.1, y: 0.34, w: 0.46, h: 0.03 }, confidence: 0.95 },
];

test("full staged lifecycle seals a real, verifiable session", async () => {
  const c = await createSession({ device: { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" }, build: { app_commit: "abc" } });
  assert.equal(c.ok, true);
  const { token, store } = c;

  const cap = await registerCapture({ token, bytes: PNG, store });
  assert.equal(cap.ok, true);
  assert.match(cap.capture.capture_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(cap.capture.format, "image/png");

  const sm = await validateSourceMap({ token, sourceMap: SM, store });
  assert.equal(sm.ok, true);
  assert.equal(sm.entries, 2);

  // fixture analysis: one finding cites a real id, one cites a ghost id → gate drops it.
  const findings = [
    { claim: "DTI is 0.41", source_ids: ["B0L1"], quote: "Debt-to-Income: 0.41", severity: "medium", confidence: 0.9 },
    { claim: "hallucinated", source_ids: ["B9L9"], quote: "x", severity: "high", confidence: 0.5 },
  ];
  const an = await analyze({ token, findings, store });
  assert.equal(an.ok, true);
  assert.equal(an.analysis.source_bound_count, 1, "ghost-cited finding must be gated out");

  const rv = await review({ token, reviewer: { decision: "approved" }, store });
  assert.equal(rv.ok, true);

  const k = keys();
  const seal = await sealEvidence({ token, signingKeyPem: k.priv, publicKeyPem: k.pub, keyId: "test", store });
  assert.equal(seal.ok, true);
  assert.equal(seal.verified, true, "sealed bundle must verify against its public key");
  assert.equal(seal.valid, true, "assembled session must be contract-valid");
  assert.equal(seal.session.verification.record_integrity, "verified");

  const vr = await verify({ token, store });
  assert.equal(vr.ok, true);
  assert.equal(vr.contract_valid, true);
  assert.equal(vr.record_integrity, "verified");
});

test("stages reject an invalid token", async () => {
  const { store } = await createSession({});
  const bad = await registerCapture({ token: "forged.token", bytes: PNG, store });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "unauthorized");
});

test("modified/rejected review requires override_rationale (CAAT)", async () => {
  const c = await createSession({});
  await registerCapture({ token: c.token, bytes: PNG, store: c.store });
  await validateSourceMap({ token: c.token, sourceMap: SM, store: c.store });
  await analyze({ token: c.token, findings: [], store: c.store });
  const noRationale = await review({ token: c.token, reviewer: { decision: "rejected" }, store: c.store });
  assert.equal(noRationale.ok, false);
  assert.equal(noRationale.code, "rationale_required");
  const withRationale = await review({ token: c.token, reviewer: { decision: "rejected", override_rationale: "DTI over policy" }, store: c.store });
  assert.equal(withRationale.ok, true);
});

test("analyze with neither findings nor llm asks for a provider (503)", async () => {
  const c = await createSession({});
  await registerCapture({ token: c.token, bytes: PNG, store: c.store });
  await validateSourceMap({ token: c.token, sourceMap: SM, store: c.store });
  const r = await analyze({ token: c.token, store: c.store });
  assert.equal(r.ok, false);
  assert.equal(r.http, 503);
});

test("seal before analyze is refused", async () => {
  const c = await createSession({});
  await registerCapture({ token: c.token, bytes: PNG, store: c.store });
  const k = keys();
  const r = await sealEvidence({ token: c.token, signingKeyPem: k.priv, publicKeyPem: k.pub, store: c.store });
  assert.equal(r.ok, false);
  assert.equal(r.code, "not_analyzed");
});
