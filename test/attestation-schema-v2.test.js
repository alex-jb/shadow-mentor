// test/attestation-schema-v2.test.js
// v2.0.0-rc3 contract tests for the frozen attestation schema.
//
// Locks two invariants:
//   1. spec/attestation.schema.json's $defs.signed_fields_v2 lists the
//      exact fields the code signs. If lib/attestation.js starts
//      accepting a new signing parameter, this test fails until the
//      schema is updated (and if the update is a top-level add, the
//      author must also bump schema_version).
//   2. Pre-schema-freeze attestations (v1.x-era, minimal core-only)
//      still verify against the current verifier — the append-only
//      contract holds across the schema freeze.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";

import {
  buildAttestation,
  verifyAttestation,
  SIGNATURE_MODES,
} from "../lib/attestation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCHEMA_PATH = join(REPO_ROOT, "spec", "attestation.schema.json");
const ATTESTATION_SRC_PATH = join(REPO_ROOT, "lib", "attestation.js");

const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
const attestationSrc = readFileSync(ATTESTATION_SRC_PATH, "utf-8");


// Map schema wire-format snake_case names to the camelCase parameter
// names the internal _signingPayload function accepts.
const WIRE_TO_PARAM = {
  spec_version: null, // constant, not passed as a param
  mode: "mode",
  request_commitment: "requestCommitment",
  output_commitment: "outputCommitment",
  model_id: "modelId",
  completed_at_utc: "completedAtUtc",
  previous_hash: "previousHash",
  key_id: "keyId",
  dictionary_hash: "dictionaryHash",
  citation_registry_sha256: "citationRegistrySha256",
  proxy_schema_sha256: "proxySchemaSha256",
  original_content_hash: "originalContentHash",
  policy_invariance_score_sha256: "policyInvarianceScoreSha256",
  adverse_action_notice_sha256: "adverseActionNoticeSha256",
  sampling_seed_commitment_sha256: "samplingSeedCommitmentSha256",
  evidence_partition_scheme_sha256: "evidencePartitionSchemeSha256",
  heterogeneity_commitment_sha256: "heterogeneityCommitmentSha256",
  claim_type_sha256: "claimTypeSha256",
  bian_coverage_sha256: "bianCoverageSha256",
  eticas_taxonomy_sha256: "eticasTaxonomySha256",
  sive_fixture_set_sha256: "siveFixtureSetSha256",
  calibration_ranking_split_sha256: "calibrationRankingSplitSha256",
};


// Extract the _signingPayload parameter list from source. We don't
// call the function; we parse its destructuring signature so a change
// to the parameters is caught even if nobody calls it with the new
// field yet.
function extractSigningPayloadParams() {
  const match = attestationSrc.match(/function\s+_signingPayload\(\{([\s\S]*?)\}\)/);
  if (!match) throw new Error("could not locate _signingPayload signature");
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}


test("schema $defs.signed_fields_v2 present + well-formed", () => {
  const defs = schema.$defs && schema.$defs.signed_fields_v2;
  assert.ok(defs, "$defs.signed_fields_v2 missing");
  assert.ok(Array.isArray(defs.required_core), "required_core missing");
  assert.ok(Array.isArray(defs.optional_append_only), "optional_append_only missing");
  assert.ok(defs.required_core.length >= 6, "required_core suspiciously short");
});


test("schema schema_version is constant 2", () => {
  assert.equal(schema.properties.schema_version.const, 2);
});


test("code _signingPayload accepts exactly the schema-declared parameters", () => {
  const paramsInCode = new Set(extractSigningPayloadParams());
  const paramsExpectedFromSchema = new Set();
  for (const wireName of [
    ...schema.$defs.signed_fields_v2.required_core,
    ...schema.$defs.signed_fields_v2.optional_append_only,
  ]) {
    const param = WIRE_TO_PARAM[wireName];
    if (param !== null) paramsExpectedFromSchema.add(param);
  }

  const missingInCode = [...paramsExpectedFromSchema].filter((p) => !paramsInCode.has(p));
  const extraInCode = [...paramsInCode].filter((p) => !paramsExpectedFromSchema.has(p));

  assert.deepEqual(
    { missingInCode, extraInCode },
    { missingInCode: [], extraInCode: [] },
    "spec/attestation.schema.json and lib/attestation.js _signingPayload have drifted — update the schema (and bump schema_version if adding a top-level field) or fix the code",
  );
});


test("extensions map is declared as an object with additionalProperties=true", () => {
  const ext = schema.properties.extensions;
  assert.equal(ext.type, "object");
  assert.equal(ext.additionalProperties, true);
});


test("BACK-COMPAT: a minimal v1-era attestation (core-only, no bindings) verifies", () => {
  // Simulates an attestation from before any of the 14 optional
  // bindings were added. Verifier must still accept it because the
  // append-only contract holds: absent bindings are simply absent.
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request,
    response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret-v1",
  });

  const v = verifyAttestation(att, request, response, "test-secret-v1");
  assert.equal(v.ok, true, `verification failed: ${v.reason}`);
});


test("BACK-COMPAT: minimal ed25519 attestation verifies with only the required core", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const request = { anything: "here" };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request,
    response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
  });

  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, true, `verification failed: ${v.reason}`);
});


test("SCHEMA FREEZE: adding a new signing parameter without bumping schema_version fails this test", () => {
  // This is a documentation-and-tripwire test. It reads the current
  // signed_fields_v2 field count and pins it. When the count changes
  // legitimately, update both the pin and schema_version.
  const declaredCount =
    schema.$defs.signed_fields_v2.required_core.length +
    schema.$defs.signed_fields_v2.optional_append_only.length;
  assert.equal(
    declaredCount,
    22,
    "signed_fields_v2 field count drifted from the v2 freeze baseline (22 = 8 core + 14 append-only). Bump schema_version and update this pin together.",
  );
});
