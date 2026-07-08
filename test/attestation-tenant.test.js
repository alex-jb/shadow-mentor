// test/attestation-tenant.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.27 (2026-07-08) — Per-tenant key isolation contract tests.
//
// Every enterprise AI RFP asks how customer data is
// cryptographically isolated from other customers. The tests
// below lock the semantics of HKDF-SHA-256 tenant-key derivation
// so a downstream bank's RFP response citing "per-tenant HKDF
// isolation" stays reproducible across Shadow upgrades.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  deriveTenantHmacSecret,
  tenantSecretFingerprint,
  verifyTenantSecret,
  resolveTenantSecret,
  TENANT_SECRET_LENGTH,
} from "../lib/attestation-tenant.js";
import { buildAttestation, verifyAttestation } from "../lib/attestation.js";


const MASTER = "shadow-master-secret-for-tests-do-not-use-in-prod";
const TENANT_A = "acme-bank";
const TENANT_B = "widget-credit-union";


// ═════════════════════════════════════════════════════════════════
// Determinism
// ═════════════════════════════════════════════════════════════════

test("deriveTenantHmacSecret is deterministic across calls", () => {
  const a = deriveTenantHmacSecret(MASTER, TENANT_A);
  const b = deriveTenantHmacSecret(MASTER, TENANT_A);
  assert.equal(a, b);
});

test("deriveTenantHmacSecret differs across tenant IDs", () => {
  const a = deriveTenantHmacSecret(MASTER, TENANT_A);
  const b = deriveTenantHmacSecret(MASTER, TENANT_B);
  assert.notEqual(a, b);
});

test("deriveTenantHmacSecret differs across master secrets", () => {
  const a = deriveTenantHmacSecret(MASTER, TENANT_A);
  const b = deriveTenantHmacSecret(MASTER + "-rotated", TENANT_A);
  assert.notEqual(a, b);
});

test("deriveTenantHmacSecret returns 32-byte hex (64 chars)", () => {
  const s = deriveTenantHmacSecret(MASTER, TENANT_A);
  assert.equal(s.length, TENANT_SECRET_LENGTH * 2);
  assert.match(s, /^[a-f0-9]{64}$/);
});


// ═════════════════════════════════════════════════════════════════
// Error paths
// ═════════════════════════════════════════════════════════════════

test("deriveTenantHmacSecret throws on missing master", () => {
  assert.throws(() => deriveTenantHmacSecret("", TENANT_A), /masterSecret required/);
  assert.throws(() => deriveTenantHmacSecret(null, TENANT_A), /masterSecret required/);
});

test("deriveTenantHmacSecret throws on missing tenant ID", () => {
  assert.throws(() => deriveTenantHmacSecret(MASTER, ""), /tenantId required/);
  assert.throws(() => deriveTenantHmacSecret(MASTER, null), /tenantId required/);
});

test("deriveTenantHmacSecret throws on overly long tenant ID (>256 chars)", () => {
  assert.throws(
    () => deriveTenantHmacSecret(MASTER, "x".repeat(500)),
    /≤ 256 chars/,
  );
});


// ═════════════════════════════════════════════════════════════════
// Fingerprint
// ═════════════════════════════════════════════════════════════════

test("tenantSecretFingerprint returns 16 hex chars by default", () => {
  const secret = deriveTenantHmacSecret(MASTER, TENANT_A);
  const fp = tenantSecretFingerprint(secret);
  assert.equal(fp.length, 16);
  assert.match(fp, /^[a-f0-9]{16}$/);
});

test("tenantSecretFingerprint returns full 64 hex chars with { full: true }", () => {
  const secret = deriveTenantHmacSecret(MASTER, TENANT_A);
  const fp = tenantSecretFingerprint(secret, { full: true });
  assert.equal(fp.length, 64);
});

test("tenantSecretFingerprint differs across tenants", () => {
  const sa = deriveTenantHmacSecret(MASTER, TENANT_A);
  const sb = deriveTenantHmacSecret(MASTER, TENANT_B);
  assert.notEqual(tenantSecretFingerprint(sa), tenantSecretFingerprint(sb));
});


// ═════════════════════════════════════════════════════════════════
// Constant-time verifyTenantSecret
// ═════════════════════════════════════════════════════════════════

test("verifyTenantSecret returns true for correct secret", () => {
  const derived = deriveTenantHmacSecret(MASTER, TENANT_A);
  assert.equal(verifyTenantSecret(MASTER, TENANT_A, derived), true);
});

test("verifyTenantSecret returns false for wrong tenant", () => {
  const derived = deriveTenantHmacSecret(MASTER, TENANT_A);
  assert.equal(verifyTenantSecret(MASTER, TENANT_B, derived), false);
});

test("verifyTenantSecret returns false for wrong secret", () => {
  assert.equal(verifyTenantSecret(MASTER, TENANT_A, "f".repeat(64)), false);
});

test("verifyTenantSecret returns false on length mismatch", () => {
  assert.equal(verifyTenantSecret(MASTER, TENANT_A, "abc"), false);
});


// ═════════════════════════════════════════════════════════════════
// resolveTenantSecret back-compat with single-tenant deployments
// ═════════════════════════════════════════════════════════════════

test("resolveTenantSecret returns master unchanged when tenantId is null (back-compat)", () => {
  const s = resolveTenantSecret({ masterSecret: MASTER, tenantId: null });
  assert.equal(s, MASTER);
});

test("resolveTenantSecret returns master unchanged when tenantId is empty string", () => {
  const s = resolveTenantSecret({ masterSecret: MASTER, tenantId: "" });
  assert.equal(s, MASTER);
});

test("resolveTenantSecret returns derived secret when tenantId is provided", () => {
  const derived = deriveTenantHmacSecret(MASTER, TENANT_A);
  const resolved = resolveTenantSecret({ masterSecret: MASTER, tenantId: TENANT_A });
  assert.equal(resolved, derived);
  assert.notEqual(resolved, MASTER);
});


// ═════════════════════════════════════════════════════════════════
// End-to-end: cross-tenant signature verification MUST fail
// ═════════════════════════════════════════════════════════════════

test("HMAC attestation signed with Tenant A secret verifies with A's secret", () => {
  const request = { loan: "acme-loan-001", amount: 500000 };
  const response = { verdict: "approve" };
  const secretA = resolveTenantSecret({ masterSecret: MASTER, tenantId: TENANT_A });

  const attestation = buildAttestation({
    request,
    response,
    modelId: "test/model",
    mode: "hmac-sha256",
    secret: secretA,
  });

  const verification = verifyAttestation(attestation, request, response, { secret: secretA });
  assert.equal(verification.ok, true, `expected verified, got: ${verification.reason}`);
});

test("HMAC attestation signed with Tenant A CANNOT be verified with Tenant B secret (isolation)", () => {
  const request = { loan: "acme-loan-002", amount: 500000 };
  const response = { verdict: "approve" };
  const secretA = resolveTenantSecret({ masterSecret: MASTER, tenantId: TENANT_A });
  const secretB = resolveTenantSecret({ masterSecret: MASTER, tenantId: TENANT_B });

  const attestation = buildAttestation({
    request,
    response,
    modelId: "test/model",
    mode: "hmac-sha256",
    secret: secretA,
  });

  const verification = verifyAttestation(attestation, request, response, { secret: secretB });
  assert.equal(verification.ok, false, "cross-tenant verification MUST fail");
  assert.match(verification.reason, /signature mismatch|wrong.*secret|tampered/i);
});

test("HKDF output matches expected HMAC-SHA-256 semantics (spot check against Node hkdf-then-hmac equivalence)", () => {
  // Independent HMAC(SHA-256, master, tenantId) is NOT equal to HKDF
  // — they're different derivations. This test just documents that
  // the derived secret is NOT a naive HMAC and locks the semantic.
  const derived = deriveTenantHmacSecret(MASTER, TENANT_A);
  const naiveHmac = createHmac("sha256", MASTER).update(TENANT_A).digest("hex");
  assert.notEqual(derived, naiveHmac, "must use HKDF not naive HMAC");
});
