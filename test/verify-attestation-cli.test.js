// test/verify-attestation-cli.test.js
// ──────────────────────────────────────────────────────────────────
// End-to-end tests for the public verifier CLI shipped 2026-07-04.
// Pins the auditor-facing contract: same response → ✓, tampered
// response → ✗ with specific reason.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { buildAttestation, SIGNATURE_MODES } from "../lib/attestation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "..", "bin", "verify-attestation.mjs");


function runCli(args, env = {}) {
  return spawnSync("node", [CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });
}


function mktemp() {
  return mkdtempSync(join(tmpdir(), "verify-cli-"));
}


// ═══════════════════════════════════════════════════════════════
// --help / --usage
// ═══════════════════════════════════════════════════════════════

test("--help prints usage + exits 0", () => {
  const r = runCli(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Shadow — public attestation verifier/);
  assert.match(r.stdout, /--response/);
  assert.match(r.stdout, /RFC 8032/);
});


// ═══════════════════════════════════════════════════════════════
// Argument validation
// ═══════════════════════════════════════════════════════════════

test("missing --response → exit 2 + specific message", () => {
  const r = runCli([]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--response is required/);
});


test("nonexistent response file → exit 2", () => {
  const r = runCli(["--response", "/nonexistent/path.json"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cannot read/);
});


// ═══════════════════════════════════════════════════════════════
// Ed25519 happy path — the procurement demo
// ═══════════════════════════════════════════════════════════════

test("PROCUREMENT DEMO: signed response + public key → ✓ verified", () => {
  const dir = mktemp();
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const req = { loan: { credit_score: 720, dti: 0.30 } };
    const rsp = { final_verdict: "approve", voices: [] };
    const att = buildAttestation({
      request: req, response: rsp, modelId: "test-model",
      mode: SIGNATURE_MODES.ED25519, privateKey, keyId: "test-v1",
    });
    const responseWithAtt = { ...rsp, attestation: att, _request: req };

    writeFileSync(join(dir, "pub.pem"), publicKey);
    writeFileSync(join(dir, "response.json"), JSON.stringify(responseWithAtt));

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--public-key", join(dir, "pub.pem"),
    ]);
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}. stderr: ${r.stderr}`);
    assert.match(r.stdout, /✓ attestation verified/);
    assert.match(r.stdout, /mode:.*ed25519/);
    assert.match(r.stdout, /model_id:.*test-model/);
    assert.match(r.stdout, /request_hash:/);
    assert.match(r.stdout, /output_hash:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ═══════════════════════════════════════════════════════════════
// Tampering detection — the auditor's red flag
// ═══════════════════════════════════════════════════════════════

test("TAMPER TEST: verdict changed → ✗ output commitment mismatch", () => {
  const dir = mktemp();
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const req = { loan_id: "L1" };
    const rsp = { final_verdict: "approve" };
    const att = buildAttestation({
      request: req, response: rsp, modelId: "test",
      mode: SIGNATURE_MODES.ED25519, privateKey,
    });
    // Tamper: change the verdict AFTER signing
    const tampered = { ...rsp, final_verdict: "block", attestation: att, _request: req };

    writeFileSync(join(dir, "pub.pem"), publicKey);
    writeFileSync(join(dir, "response.json"), JSON.stringify(tampered));

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--public-key", join(dir, "pub.pem"),
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✗ attestation FAILED/);
    assert.match(r.stderr, /output commitment mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("TAMPER TEST: model_id substituted → ✗ signature mismatch", () => {
  const dir = mktemp();
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const req = { loan_id: "L1" };
    const rsp = { final_verdict: "approve" };
    const att = buildAttestation({
      request: req, response: rsp, modelId: "claude-sonnet-4-6",
      mode: SIGNATURE_MODES.ED25519, privateKey,
    });
    // Tamper the model_id in the attestation
    att.model_id = "claude-haiku-4-5";
    const tampered = { ...rsp, attestation: att, _request: req };

    writeFileSync(join(dir, "pub.pem"), publicKey);
    writeFileSync(join(dir, "response.json"), JSON.stringify(tampered));

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--public-key", join(dir, "pub.pem"),
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✗ attestation FAILED/);
    assert.match(r.stderr, /ed25519 signature mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("TAMPER TEST: wrong public key → ✗ signature mismatch", () => {
  const dir = mktemp();
  try {
    const good = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const attackerKey = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const req = { loan_id: "L1" };
    const rsp = { final_verdict: "approve" };
    const att = buildAttestation({
      request: req, response: rsp, modelId: "test",
      mode: SIGNATURE_MODES.ED25519, privateKey: good.privateKey,
    });
    const signed = { ...rsp, attestation: att, _request: req };

    writeFileSync(join(dir, "attacker-pub.pem"), attackerKey.publicKey);
    writeFileSync(join(dir, "response.json"), JSON.stringify(signed));

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--public-key", join(dir, "attacker-pub.pem"),
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✗/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ═══════════════════════════════════════════════════════════════
// HMAC path (dev-only, back-compat)
// ═══════════════════════════════════════════════════════════════

test("HMAC mode works with --secret", () => {
  const dir = mktemp();
  try {
    const secret = "test-hmac-secret-12345";
    const req = { loan_id: "L1" };
    const rsp = { verdict: "ok" };
    const att = buildAttestation({
      request: req, response: rsp, modelId: "test",
      mode: SIGNATURE_MODES.HMAC, secret,
    });
    const signed = { ...rsp, attestation: att, _request: req };

    writeFileSync(join(dir, "response.json"), JSON.stringify(signed));

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--secret", secret,
    ]);
    assert.equal(r.status, 0, `expected 0, got ${r.status}. stderr: ${r.stderr}`);
    assert.match(r.stdout, /✓ attestation verified/);
    assert.match(r.stdout, /mode:.*hmac-sha256/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("HMAC mode with WRONG secret → ✗", () => {
  const dir = mktemp();
  try {
    const req = { loan_id: "L1" };
    const rsp = { verdict: "ok" };
    const att = buildAttestation({
      request: req, response: rsp, modelId: "test",
      mode: SIGNATURE_MODES.HMAC, secret: "correct",
    });
    writeFileSync(join(dir, "response.json"),
      JSON.stringify({ ...rsp, attestation: att, _request: req }));

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--secret", "wrong-secret",
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /signature mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ═══════════════════════════════════════════════════════════════
// Ed25519 mode without --public-key → helpful error
// ═══════════════════════════════════════════════════════════════

test("ed25519 mode without --public-key AND no env → exit 2 with hint", () => {
  const dir = mktemp();
  try {
    const { privateKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const att = buildAttestation({
      request: {}, response: {}, modelId: "test",
      mode: SIGNATURE_MODES.ED25519, privateKey,
    });
    writeFileSync(join(dir, "response.json"),
      JSON.stringify({ attestation: att, _request: {} }));

    const r = runCli([
      "--response", join(dir, "response.json"),
    ], {
      SHADOW_ATTESTATION_ED25519_PUBLIC_KEY: "",  // clear env
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /public.?key/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ═══════════════════════════════════════════════════════════════
// Missing attestation field → clear error
// ═══════════════════════════════════════════════════════════════

test("response without attestation field → exit 2 with clear message", () => {
  const dir = mktemp();
  try {
    writeFileSync(join(dir, "response.json"),
      JSON.stringify({ some: "response", but: "no attestation" }));

    const r = runCli(["--response", join(dir, "response.json")]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no 'attestation' field/);
    assert.match(r.stderr, /v1\.4\.0\+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ═══════════════════════════════════════════════════════════════
// Missing request → clear error
// ═══════════════════════════════════════════════════════════════

test("no _request field AND no --request flag → clear error", () => {
  const dir = mktemp();
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding:  { type: "spki",  format: "pem" },
    });
    const att = buildAttestation({
      request: { x: 1 }, response: { y: 2 }, modelId: "test",
      mode: SIGNATURE_MODES.ED25519, privateKey,
    });
    // Save WITHOUT _request
    writeFileSync(join(dir, "response.json"),
      JSON.stringify({ y: 2, attestation: att }));
    writeFileSync(join(dir, "pub.pem"), publicKey);

    const r = runCli([
      "--response", join(dir, "response.json"),
      "--public-key", join(dir, "pub.pem"),
    ]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--request path AND response has no _request field/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
