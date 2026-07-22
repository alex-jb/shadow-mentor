// Shared production default-secret guard (§9). Imported by BOTH the v1 signer (attestation.js) and the v2
// signer (attestation-v2.js) so EVERY public HMAC signing path fails loud in production when it would
// otherwise sign with the insecure dev default. This module imports nothing from those files, so there is
// no circular dependency. Each caller throws its OWN typed error carrying INSECURE_SECRET_CODE (v2 wraps
// it as AttestationV2Error; v1 throws a code-tagged Error) — the predicate here is the single source of
// truth for "is this an insecure default secret in production".
//
// Ed25519 signing uses a key, not a shared secret, so it is never subject to this guard.
export const DEV_DEFAULT_SECRET = "dev-shadow-attestation-secret-DO-NOT-USE-IN-PROD";
export const INSECURE_SECRET_CODE = "ERR_INSECURE_DEFAULT_SECRET";
// Message deliberately names the remediation and NEVER echoes the secret value.
export const INSECURE_SECRET_MESSAGE =
  "insecure default HMAC secret in production — configure SHADOW_ATTESTATION_SECRET or use an ed25519/KMS signer";

export function isProductionEnv(env = process.env) {
  return env.NODE_ENV === "production" || env.SHADOW_ENV === "production";
}

// True when an HMAC signing call in production would use the insecure dev default (explicitly, or by
// falling through to it). The caller throws; this never throws itself.
export function isInsecureDefaultSecret(secret, mode, env = process.env) {
  if (mode !== "hmac-sha256") return false;   // ed25519 has no shared secret
  if (!isProductionEnv(env)) return false;
  return secret === undefined || secret === null || secret === DEV_DEFAULT_SECRET;
}
