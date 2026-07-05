// Cross-language proof: Node signs an attestation, Python verifies it.
//
// This is the load-bearing test for shipping python/shadow_verify/. If the
// Python canonicalize() drifts from Node's canonicalize(), or the signing
// payload construction drifts, or the base64 vs hex encoding of the
// signature drifts, this test breaks loudly.
//
// The test skips (does not fail) when Python 3.9+ or the `cryptography`
// package aren't available on the runner — CI environments without Python
// stay green, but Python-equipped environments actively prove compat.
//
// A bank running this suite gets one of two outcomes:
//   1. Python + cryptography installed → cross-lang proof runs → verified
//   2. Not installed → tests skip with an informative reason
// Either outcome documents whether Python-side reach was actually proved.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawnSync as _spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateKeyPairSync } from "node:crypto";
import { buildAttestation, SIGNATURE_MODES } from "../lib/attestation.js";

// ─── Setup: detect Python + cryptography once ────────────────────

function detectPython() {
  const py = spawnSync("python3", ["-c", "import cryptography, sys; print(sys.version_info[:2])"], {
    encoding: "utf8",
  });
  if (py.status !== 0) {
    return { available: false, reason: "python3 or cryptography not installed" };
  }
  return { available: true, version: py.stdout.trim() };
}

const PYTHON = detectPython();

const PY_HARNESS = `
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[0]).resolve().parent))
from shadow_verify import verify_attestation

data = json.load(sys.stdin)
result = verify_attestation(
    attestation=data["attestation"],
    original_request=data["request"],
    original_response=data["response"],
    public_key_pem=data.get("public_key"),
    hmac_key=data.get("hmac_key"),
)
print(json.dumps(result))
`;

function pyVerify({ attestation, request, response, publicKey, hmacKey }) {
  const tmp = mkdtempSync(join(tmpdir(), "shadow-cross-lang-"));
  try {
    // Copy the shadow_verify package into a directory the harness can import.
    const harnessPath = join(tmp, "harness.py");
    writeFileSync(harnessPath, PY_HARNESS, "utf8");
    // Symlink or copy the module. Easiest: use PYTHONPATH.
    const modulePath = new URL("../python", import.meta.url).pathname;
    const payload = JSON.stringify({
      attestation,
      request,
      response,
      public_key: publicKey ?? null,
      hmac_key: hmacKey ?? null,
    });
    const r = spawnSync("python3", [harnessPath], {
      input: payload,
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: modulePath },
    });
    if (r.status !== 0) {
      throw new Error(`Python harness crashed:\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    }
    return JSON.parse(r.stdout.trim());
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ─── Ed25519 cross-language proof ────────────────────────────────

test("CROSS-LANG: Node signs Ed25519 attestation → Python verifies", { skip: !PYTHON.available && PYTHON.reason }, () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan_id: "CROSS-001", credit_score: 720, sector: "consumer_secured" };
  const response = { verdict: "approve", voices: [{ voice: "Credit", score: 1 }] };
  const attestation = buildAttestation({
    request, response, modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519, privateKey, keyId: "cross-lang-test",
  });

  const result = pyVerify({ attestation, request, response, publicKey });
  assert.equal(result.ok, true, `Python verify failed: ${result.reason}`);
  assert.equal(result.mode, "ed25519");
  assert.equal(result.model_id, "claude-sonnet-4-6");
  assert.equal(result.key_id, "cross-lang-test");
});

test("CROSS-LANG: Python detects Node-signed attestation with tampered response", { skip: !PYTHON.available && PYTHON.reason }, () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan_id: "CROSS-002" };
  const response = { verdict: "block" };
  const attestation = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.ED25519, privateKey,
  });

  const tamperedResponse = { ...response, verdict: "approve" };
  const result = pyVerify({ attestation, request, response: tamperedResponse, publicKey });
  assert.equal(result.ok, false);
  assert.match(result.reason, /output commitment mismatch/);
});

// ─── HMAC cross-language proof ───────────────────────────────────

test("CROSS-LANG: Node signs HMAC attestation → Python verifies", { skip: !PYTHON.available && PYTHON.reason }, () => {
  const request = { loan_id: "CROSS-HMAC-001" };
  const response = { verdict: "escalate", voices: [{ voice: "Compliance", score: 0 }] };
  const secret = "cross-lang-hmac-secret";
  const attestation = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret,
  });

  const result = pyVerify({ attestation, request, response, hmacKey: secret });
  assert.equal(result.ok, true, `Python HMAC verify failed: ${result.reason}`);
  assert.equal(result.mode, "hmac-sha256");
});

test("CROSS-LANG: Python detects Node-signed HMAC with wrong secret", { skip: !PYTHON.available && PYTHON.reason }, () => {
  const request = { loan_id: "CROSS-HMAC-002" };
  const response = { verdict: "approve" };
  const attestation = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret: "real-secret",
  });

  const result = pyVerify({ attestation, request, response, hmacKey: "wrong-secret" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature mismatch/);
});

// ─── Canonicalization drift catch ────────────────────────────────

test("CROSS-LANG: Node signs with dictionary_hash → Python verifies (v1.5.8+)", { skip: !PYTHON.available && PYTHON.reason }, () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan_id: "CROSS-DICT-001" };
  const response = { verdict: "escalate" };
  const dictionaryHash = "e".repeat(64);
  const attestation = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.ED25519, privateKey, dictionaryHash,
  });
  const result = pyVerify({ attestation, request, response, publicKey });
  assert.equal(result.ok, true, `dictionary_hash cross-lang failed: ${result.reason}`);
});

test("CROSS-LANG: Python still verifies Node-signed attestation WITHOUT dictionary_hash (back-compat)", { skip: !PYTHON.available && PYTHON.reason }, () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan_id: "CROSS-DICT-COMPAT-001" };
  const response = { verdict: "approve" };
  const attestation = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.ED25519, privateKey,
    // no dictionaryHash — old shape
  });
  const result = pyVerify({ attestation, request, response, publicKey });
  assert.equal(result.ok, true, "back-compat: pre-v1.5.8 attestation MUST verify in Python");
});

test("CROSS-LANG: nested-array-in-nested-object payload survives canonicalization drift", { skip: !PYTHON.available && PYTHON.reason }, () => {
  // The nastiest canonicalization edge case is nested arrays inside
  // objects with non-alphabetical keys. If Python and Node disagree
  // on how to serialize this, EVERY audit for a real loan (which has
  // this shape) fails. Pin it explicitly.
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = {
    zebra: "last-key",
    alpha: "first-key",
    voices: [
      { voice: "b", score: 1, meta: { z: 1, a: 2 } },
      { voice: "a", score: 0, meta: { z: 3, a: 4 } },
    ],
    thresholds: { fico: 700, dti: 0.36, ltv: 0.80 },
  };
  const response = { verdict: "approve", nested: [[1, 2], [3, {"deep": "value"}]] };

  const attestation = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.ED25519, privateKey,
  });

  const result = pyVerify({ attestation, request, response, publicKey });
  assert.equal(result.ok, true,
    `canonicalization drift between Node and Python! ${result.reason}`);
});
