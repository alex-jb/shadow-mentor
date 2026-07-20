#!/usr/bin/env node
// Validate + hash a Shadow `execution_environment` evidence extension (the CubeSandbox
// spike). Dependency-free (node:crypto only). Deletable research prototype — NOT core.
// The point: record WHAT ENVIRONMENT the agent ran in, with the sandbox's own logs
// hash-bound so the evidence can't detach from the Shadow record.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HASH_FIELDS = ["template_digest", "image_digest", "network_policy_hash", "credential_policy_hash", "egress_log_hash"];
const HASH_RE = /^sha256:[0-9a-f]{64}$/i;

function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}

/** Stable digest of the env block (excluding any embedded hash) — pin it into the bundle. */
export function computeExecutionEnvHash(env) {
  const { execution_environment_hash, ...rest } = env ?? {};
  return "sha256:" + createHash("sha256").update(canonicalize(rest), "utf-8").digest("hex");
}

/** Structural validation + the discipline warnings. @returns {{valid,errors,warnings}} */
export function validateExecutionEnvironment(env) {
  const errors = [], warnings = [];
  if (!env || typeof env !== "object") return { valid: false, errors: ["execution_environment must be an object"], warnings };
  if (typeof env.provider !== "string" || !env.provider.trim()) errors.push("provider must be a non-empty string");
  for (const f of HASH_FIELDS) {
    if (env[f] !== undefined && !HASH_RE.test(String(env[f]))) errors.push(`${f} must be 'sha256:<64 hex>' if present`);
  }
  if (env.outbound_domains !== undefined && !Array.isArray(env.outbound_domains)) errors.push("outbound_domains must be an array");
  if (env.process_exit_code !== undefined && !Number.isInteger(env.process_exit_code)) errors.push("process_exit_code must be an integer");
  // THE discipline: a claim about network activity with no bound log behind it.
  if (Array.isArray(env.outbound_domains) && env.outbound_domains.length && !env.egress_log_hash) {
    warnings.push("outbound_domains listed without egress_log_hash — the network claim has no bound evidence; execution evidence can detach from the record");
  }
  if (!env.template_digest && !env.image_digest) {
    warnings.push("neither template_digest nor image_digest present — the environment is not pinned to a reproducible image");
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ── demonstrator ────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url));
  const env = JSON.parse(readFileSync(join(here, "fixtures", "example.execution-environment.json"), "utf-8"));
  const v = validateExecutionEnvironment(env);
  console.log(JSON.stringify({
    valid: v.valid, errors: v.errors, warnings: v.warnings,
    execution_environment_hash: computeExecutionEnvHash(env),
    provider: env.provider, exit_code: env.process_exit_code,
  }, null, 2));

  // the discipline in action: drop the egress binding and the validator warns
  const detached = { ...env }; delete detached.egress_log_hash;
  console.log("\n-- variant missing egress_log_hash (network claim with no bound log) --");
  console.log(JSON.stringify({ warnings: validateExecutionEnvironment(detached).warnings }, null, 2));
}
