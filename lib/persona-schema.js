// lib/persona-schema.js
// ──────────────────────────────────────────────────────────────────
// Loader + validator for the persona L1/L2/L3 metadata sidecar.
//
// This module reads lib/persona-schema.json (Anthropic Claude
// Constitution v2 3-layer schema, applied per Shadow persona) and
// provides:
//
//   1. `loadPersonaSchema()` — cached read of the sidecar JSON
//   2. `getVoiceLayers(voiceName)` — return {L1, L2, L3} for one voice
//   3. `assertSchemaMatchesRuntime()` — verify each voice mentioned
//      in the schema is a real voice in run-loan-council.js output
//
// Ships 2026-07-02 (v1.4.0 deferred queue item). Does NOT change the
// runtime prompt behavior — the schema is a documentation + audit
// sidecar that makes the L1/L2/L3 alignment story verifiable by
// procurement reviewers without re-reading system prompts.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = join(__dirname, "persona-schema.json");

let _cached = null;

/**
 * Load the persona schema sidecar. Cached after first call.
 */
export function loadPersonaSchema(opts = {}) {
  if (!opts.fresh && _cached) return _cached;
  const text = readFileSync(SCHEMA_PATH, "utf-8");
  const parsed = JSON.parse(text);
  if (!parsed.L1_universal) {
    throw new Error("persona-schema.json: missing L1_universal");
  }
  if (!parsed.voices || typeof parsed.voices !== "object") {
    throw new Error("persona-schema.json: missing voices{}");
  }
  _cached = parsed;
  return parsed;
}


/**
 * Get the {L1, L2, L3} triple for one voice.
 * @param {string} voiceName — must match a key in schema.voices
 * @returns {{L1, L2, L3, adverse_action_codes}} or null if not found
 */
export function getVoiceLayers(voiceName) {
  const schema = loadPersonaSchema();
  const voice = schema.voices[voiceName];
  if (!voice) return null;
  return {
    L1: schema.L1_universal,
    L2: voice.L2_voice_role,
    L3: voice.L3_thresholds,
    adverse_action_codes: voice.adverse_action_codes || [],
  };
}


/**
 * List all voice names documented in the schema.
 */
export function listVoiceNames() {
  const schema = loadPersonaSchema();
  return Object.keys(schema.voices);
}


/**
 * Verify that the schema's L3 threshold values match the runtime
 * constants they reference. Returns a diagnostic; ok=false means the
 * schema is drifted from lib/schemas/loan.js LOAN_DEFAULTS.
 *
 * @param {object} loanDefaults — pass LOAN_DEFAULTS from schemas/loan.js
 * @returns {{ok, mismatches, checked}}
 */
export function verifyL3AgainstLoanDefaults(loanDefaults) {
  const schema = loadPersonaSchema();
  const mismatches = [];
  const checked = [];

  for (const [voiceName, voice] of Object.entries(schema.voices)) {
    const l3 = voice.L3_thresholds || {};
    // Fields we expect to match LOAN_DEFAULTS
    const l3ToDefaults = {
      fico_approve_floor: "fico_approve_floor",
      dti_approve_ceiling: "dti_approve_ceiling",
      ltv_approve_ceiling: "ltv_approve_ceiling",
      var_approve_ceiling: "var_approve_ceiling",
      var_confidence: "var_confidence",
      var_horizon_days: "var_horizon_days",
    };
    for (const [l3Key, defaultsKey] of Object.entries(l3ToDefaults)) {
      if (l3[l3Key] === undefined) continue;
      checked.push({ voice: voiceName, field: l3Key });
      if (l3[l3Key] !== loanDefaults[defaultsKey]) {
        mismatches.push({
          voice: voiceName,
          field: l3Key,
          schema_value: l3[l3Key],
          runtime_value: loanDefaults[defaultsKey],
        });
      }
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
    checked_count: checked.length,
  };
}


// For tests that need to reset the cache
export function _clearCache() { _cached = null; }
