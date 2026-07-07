// v1.5.12 — Batch Ed25519 attestation signing tests.
// Covers happy path + tamper detection on reordering, count mismatch, root hash mismatch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { buildAttestation } from "../lib/attestation.js";
import { computeAttestationHash } from "../lib/attestation-chain.js";
import {
  computeBatchRootHash,
  batchSignAttestations,
  batchVerifyAttestations,
} from "../lib/attestation-batch.js";

function generateEd25519() {
  const kp = generateKeyPairSync("ed25519");
  const publicKey = kp.publicKey.export({ format: "pem", type: "spki" });
  const privateKey = kp.privateKey.export({ format: "pem", type: "pkcs8" });
  return { publicKey, privateKey };
}

function makeAttestation(index, keys) {
  return buildAttestation({
    mode: "ed25519",
    modelId: `shadow-test@1.0.${index}`,
    keyId: "test-key-2026",
    privateKey: keys.privateKey,
    request: { loan_id: `L-${index}`, applicant: "test" },
    response: { verdict: index % 2 === 0 ? "approve" : "escalate", index },
    previousHash: index === 0 ? null : `${index - 1}`.padStart(64, "0"),
  });
}

test("computeBatchRootHash produces deterministic 64-char hex", () => {
  const hashes = [
    "a".repeat(64),
    "b".repeat(64),
    "c".repeat(64),
  ];
  const root1 = computeBatchRootHash(hashes);
  const root2 = computeBatchRootHash(hashes);
  assert.equal(root1, root2, "root hash must be deterministic");
  assert.equal(root1.length, 64);
  assert.match(root1, /^[0-9a-f]{64}$/);
});

test("computeBatchRootHash rejects empty and malformed inputs", () => {
  assert.throws(() => computeBatchRootHash([]), /non-empty array/);
  assert.throws(() => computeBatchRootHash("notarray"), /non-empty array/);
  assert.throws(() => computeBatchRootHash(["short"]), /64-char hex/);
});

test("batchSignAttestations produces a valid signature record", () => {
  const keys = generateEd25519();
  const attestations = [0, 1, 2].map((i) => makeAttestation(i, keys));
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  assert.equal(record.attestation_count, 3);
  assert.equal(record.key_id, "test-key-2026");
  assert.match(record.root_hash, /^[0-9a-f]{64}$/);
  assert.match(record.batch_signature, /^[0-9a-f]+$/);
  assert.equal(record.first_decision_hash, computeAttestationHash(attestations[0]));
  assert.equal(record.last_decision_hash, computeAttestationHash(attestations[2]));
});

test("batchVerifyAttestations returns ok for a valid batch", () => {
  const keys = generateEd25519();
  const attestations = [0, 1, 2, 3, 4].map((i) => makeAttestation(i, keys));
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  const result = batchVerifyAttestations(record, attestations, {
    publicKey: keys.publicKey,
  });
  assert.equal(result.ok, true);
  assert.equal(result.checks.attestation_count_match, true);
  assert.equal(result.checks.root_hash_match, true);
  assert.equal(result.checks.signature_valid, true);
});

test("batchVerifyAttestations detects reordering", () => {
  const keys = generateEd25519();
  const attestations = [0, 1, 2].map((i) => makeAttestation(i, keys));
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  // Reorder
  const reordered = [attestations[2], attestations[0], attestations[1]];
  const result = batchVerifyAttestations(record, reordered, {
    publicKey: keys.publicKey,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /root_hash mismatch/);
});

test("batchVerifyAttestations detects count mismatch", () => {
  const keys = generateEd25519();
  const attestations = [0, 1, 2].map((i) => makeAttestation(i, keys));
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  const truncated = attestations.slice(0, 2);
  const result = batchVerifyAttestations(record, truncated, {
    publicKey: keys.publicKey,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /count mismatch/);
});

test("batchVerifyAttestations detects tampered signature", () => {
  const keys = generateEd25519();
  const attestations = [0, 1].map((i) => makeAttestation(i, keys));
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  const tampered = {
    ...record,
    batch_signature: "0".repeat(record.batch_signature.length),
  };
  const result = batchVerifyAttestations(tampered, attestations, {
    publicKey: keys.publicKey,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature is invalid/);
});

test("batchVerifyAttestations rejects missing publicKey", () => {
  const keys = generateEd25519();
  const attestations = [makeAttestation(0, keys)];
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  const result = batchVerifyAttestations(record, attestations, { publicKey: null });
  assert.equal(result.ok, false);
  assert.match(result.reason, /requires Ed25519 publicKey/);
});

test("batchSignAttestations auto-generates a batch_id when not provided", () => {
  const keys = generateEd25519();
  const attestations = [makeAttestation(0, keys)];
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
  });
  assert.ok(record.batch_id, "batch_id should be auto-generated");
  assert.match(record.batch_id, /^batch-/);
});

test("batchSignAttestations respects custom batch_id", () => {
  const keys = generateEd25519();
  const attestations = [makeAttestation(0, keys)];
  const record = batchSignAttestations(attestations, {
    privateKey: keys.privateKey,
    keyId: "test-key-2026",
    batchId: "loans-2026-07-06-daily",
  });
  assert.equal(record.batch_id, "loans-2026-07-06-daily");
});
