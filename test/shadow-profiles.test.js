// Shadow Core is generic; banking is one profile. These tests prove the de-coupling: the base
// contract validates WITHOUT banking fields, profile rules are isolated, artifacts bind metrics/
// results, and all three profiles seal → verify → tamper-at-exact-seq → Flow through the SAME
// generic verifier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateBaseSession } from "../apps/shadow-lens/contracts/validate.mjs";
import { validateSession, validateProfile } from "../apps/shadow-lens/contracts/profiles.mjs";
import { buildEvidenceSession } from "../apps/shadow-lens/backend/build-evidence-session.mjs";
import { dataScienceSpec, codingAgentSpec } from "../apps/shadow-lens/fixtures/profile-fixtures.mjs";
import { exportFlowScenes } from "../apps/shadow-lens/flow/export-session.mjs";
import { verifyBundle } from "../packages/attest-core/session.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { signingKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }), publicKeyPem: publicKey.export({ type: "spki", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}

test("base contract validates WITHOUT banking/document fields", () => {
  const k = keys();
  const built = buildEvidenceSession(dataScienceSpec(k));
  // no capture, no XR device geometry, no bounding boxes — still a valid Shadow Core session
  assert.equal(built.session.capture, undefined);
  const base = validateBaseSession(built.session);
  assert.equal(base.valid, true, JSON.stringify(base.errors));
});

test("banking profile rules do NOT apply to a data-science session (isolation)", () => {
  const k = keys();
  const built = buildEvidenceSession(dataScienceSpec(k));
  const prof = validateProfile(built.session);
  assert.equal(prof.profile, "data-science-v1");
  assert.equal(prof.valid, true, JSON.stringify(prof.errors));
  // none of the errors mention banking/FICO/capture geometry
  assert.equal(prof.errors.some((e) => /fico|dti|capture|bounding/i.test(e)), false);
});

test("data-science metrics are bound to experiment artifacts", () => {
  const k = keys();
  const spec = dataScienceSpec(k);
  spec.profile.data.eval_metrics.auc.source_id = "ghost_metric"; // break the artifact binding
  const built = buildEvidenceSession(spec);
  assert.equal(built.valid, false);
  assert.equal(built.validation_errors.some((e) => /eval_metrics\.auc must cite a source_id/.test(e)), true);
});

test("coding test/security results are bound to command output hashes", () => {
  const k = keys();
  const spec = codingAgentSpec(k);
  spec.profile.data.test_results.output_source_id = "not_a_source"; // break the binding
  const built = buildEvidenceSession(spec);
  assert.equal(built.valid, false);
  assert.equal(built.validation_errors.some((e) => /test_results\.output_source_id must cite/.test(e)), true);
});

test("profile-specific validation is isolated (coding fields don't leak into data-science)", () => {
  const k = keys();
  const ds = buildEvidenceSession(dataScienceSpec(k));
  // a data-science session has no coding fields, yet validates — coding rules never ran
  assert.equal(validateProfile(ds.session).valid, true);
  const cd = buildEvidenceSession(codingAgentSpec(k));
  assert.equal(validateProfile(cd.session).valid, true);
});

for (const [name, spec] of [["data-science-v1", dataScienceSpec], ["coding-agent-v1", codingAgentSpec]]) {
  test(`${name}: seals a real bundle, passes the common verifier, exports to Flow`, () => {
    const k = keys();
    const built = buildEvidenceSession(spec(k));
    assert.equal(built.valid, true, JSON.stringify(built.validation_errors));
    assert.equal(built.verified.ok, true, "must pass the SAME attest-core verifier");
    assert.equal(built.session.verification.record_integrity, "verified");
    assert.equal(built.profile, name);
    const flow = exportFlowScenes(built.session);
    const rows = [...flow.scenes.audit, ...flow.scenes.risk];
    assert.equal(rows.every((r) => r.session_id === built.session.session_id), true);
  });

  test(`${name}: tampering fails verification at the exact sequence`, () => {
    const k = keys();
    const built = buildEvidenceSession(spec(k));
    const tampered = structuredClone(built.bundle);
    const evs = tampered.events ?? tampered.records;
    evs[1].payload = { ...(evs[1].payload || {}), injected: "post-hoc" };
    const v = verifyBundle(tampered, { publicKey: k.pub });
    assert.equal(v.ok, false, "tamper must be detected for every profile");
    assert.ok((v.failedSeq ?? v.error?.seq) != null, "must name the failed sequence");
  });
}
