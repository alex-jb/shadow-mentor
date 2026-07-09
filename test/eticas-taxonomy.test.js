// test/eticas-taxonomy.test.js
// v1.5.40 contract tests for Eticas AI Risk Taxonomy v2.0.0 map + attestation binding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createHash } from "node:crypto";

import {
  ETICAS_CATEGORIES,
  ETICAS_SUBCATEGORY_MAP,
  getEticasSubcategory,
  getSubcategoriesInCategory,
  getEticasCoverageMatrix,
  eticasTaxonomyCommitment,
  auditEticasCoverage,
} from "../lib/eticas-taxonomy.js";
import {
  buildAttestation, verifyAttestation, SIGNATURE_MODES,
} from "../lib/attestation.js";


test("ETICAS_CATEGORIES has ≥6 categories from v2.0.0", () => {
  assert.ok(Object.values(ETICAS_CATEGORIES).length >= 6);
  assert.ok(ETICAS_CATEGORIES.DISCRIMINATION_BIAS);
  assert.ok(ETICAS_CATEGORIES.ROBUSTNESS_SECURITY);
  assert.ok(ETICAS_CATEGORIES.TRANSPARENCY_EXPLAINABILITY);
});


test("audit: every subcategory has shadow_control + shadow_test + ≥1 external framework", () => {
  const audit = auditEticasCoverage();
  assert.equal(audit.ok, true);
  assert.deepEqual(audit.invalid_rows, []);
});


test("getEticasSubcategory: unknown → null", () => {
  assert.equal(getEticasSubcategory("nonsense"), null);
});


test("getEticasSubcategory: known subcategory returns row with anchors", () => {
  const row = getEticasSubcategory("adversarial-peer-defense");
  assert.ok(row);
  assert.equal(row.category, ETICAS_CATEGORIES.ROBUSTNESS_SECURITY);
  assert.equal(row.arxiv_anchor, "2606.19826");
  assert.match(row.nist_ai_rmf, /MEASURE/);
});


test("getSubcategoriesInCategory: DISCRIMINATION_BIAS returns ≥2 subcategories", () => {
  const subcats = getSubcategoriesInCategory(ETICAS_CATEGORIES.DISCRIMINATION_BIAS);
  assert.ok(subcats.length >= 2);
  assert.ok(subcats.includes("protected-class-proxy-exclusion"));
  assert.ok(subcats.includes("adverse-action-notice-specificity"));
});


test("getEticasCoverageMatrix: every row has all required fields", () => {
  const matrix = getEticasCoverageMatrix();
  assert.ok(matrix.length >= 12); // 12 subcategories minimum
  for (const row of matrix) {
    assert.ok(row.subcategory);
    assert.ok(row.category);
    assert.ok(row.shadow_control);
    assert.ok(row.shadow_test);
  }
});


test("eticasTaxonomyCommitment: deterministic 64-char hex", () => {
  const a = eticasTaxonomyCommitment();
  const b = eticasTaxonomyCommitment();
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
});


test("Shadow ships coverage across at least 5 Eticas categories", () => {
  const categoriesCovered = new Set(
    Object.values(ETICAS_SUBCATEGORY_MAP).map((row) => row.category),
  );
  assert.ok(categoriesCovered.size >= 5,
    `Shadow should cover ≥5 Eticas categories, covers ${categoriesCovered.size}`);
});


test("BINDING: attestation signs over eticas_taxonomy_sha256 (HMAC)", () => {
  const hash = eticasTaxonomyCommitment();
  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    eticasTaxonomySha256: hash,
  });
  assert.equal(att.eticas_taxonomy_sha256, hash);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("TAMPER DETECTION: silent widening of Eticas map breaks Ed25519 verify", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const originalHash = eticasTaxonomyCommitment();
  const tamperedMap = {
    ...ETICAS_SUBCATEGORY_MAP,
    "fake-subcategory": {
      category: ETICAS_CATEGORIES.ROBUSTNESS_SECURITY,
      shadow_control: "does-not-exist.js",
      shadow_test: "does-not-exist.test.js",
      nist_ai_rmf: "FAKE-1",
    },
  };
  const tamperedHash = createHash("sha256")
    .update(JSON.stringify({
      spec_version: "shadow-eticas-taxonomy/v1",
      anchor: "arXiv:2607.02201",
      eticas_version: "v2.0.0",
      map: tamperedMap,
    }))
    .digest("hex");
  assert.notEqual(originalHash, tamperedHash);

  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    eticasTaxonomySha256: originalHash,
  });
  att.eticas_taxonomy_sha256 = tamperedHash;
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, false);
});


test("BACK-COMPAT: attestation without eticas_taxonomy_sha256 verifies unchanged", () => {
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
  });
  assert.equal(att.eticas_taxonomy_sha256, undefined);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("BINDING: attestation signs over eticas_taxonomy_sha256 (Ed25519)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const hash = eticasTaxonomyCommitment();
  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    eticasTaxonomySha256: hash,
  });
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, true);
});
