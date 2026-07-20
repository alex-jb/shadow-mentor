// apps/shadow-lens/contracts/profiles.mjs
// Profiles sit on top of the GENERIC Shadow Core. Banking is the flagship profile, not the
// core boundary. Each profile validator is ISOLATED — a data-science session is never subject
// to banking rules, and vice-versa. Every profile still passes the same generic verifier
// (attest-core) and the same claim-resolvability gate.
import { validateBaseSession, validateShadowLensSession, PROFILES } from "./validate.mjs";

const missing = (obj, keys) => keys.filter((k) => obj?.[k] === undefined || obj?.[k] === null);

// banking-v1 — the flagship: the strict document/scan validator (unchanged, not weakened).
function validateBankingV1(s) {
  return validateShadowLensSession(s); // device + capture + OCR geometry + claim gate
}

// data-science-v1 — an experiment replay: metrics/selection must be bound to experiment artifacts.
function validateDataScienceV1(s) {
  const base = validateBaseSession(s);
  const errors = [...base.errors];
  const d = s.profile?.data || {};
  const need = ["dataset_hash", "preprocessing", "split", "feature_config", "model_candidates",
    "eval_metrics", "calibration", "selected_model", "environment", "code_commit", "human_approval"];
  for (const k of missing(d, need)) errors.push(`data-science-v1: profile.data.${k} required`);
  if (d.split && (d.split.train == null || d.split.test == null)) errors.push("data-science-v1: split needs train + test");
  if (d.environment && !Array.isArray(d.environment.packages)) errors.push("data-science-v1: environment.packages must be an array");
  if (Array.isArray(d.model_candidates) && d.selected_model && !d.model_candidates.includes(d.selected_model))
    errors.push("data-science-v1: selected_model must be one of model_candidates");
  // metrics must be bound to experiment artifacts: every eval_metric names a source_id in the map.
  const ids = new Set((s.source_map || []).map((e) => e.source_id));
  for (const [name, m] of Object.entries(d.eval_metrics || {}))
    if (!m || !ids.has(m.source_id)) errors.push(`data-science-v1: eval_metrics.${name} must cite a source_id present in source_map (metric bound to artifact)`);
  return { valid: errors.length === 0, errors };
}

// coding-agent-v1 — a coding session replay: test/security results bound to command/output hashes.
function validateCodingAgentV1(s) {
  const base = validateBaseSession(s);
  const errors = [...base.errors];
  const d = s.profile?.data || {};
  const need = ["issue", "agent_config", "files_read", "commands", "diffs", "dependency_changes",
    "test_results", "security_lint", "reviewer_interaction", "human_approval", "final_commit"];
  for (const k of missing(d, need)) errors.push(`coding-agent-v1: profile.data.${k} required`);
  for (const k of ["files_read", "commands", "diffs"]) if (d[k] !== undefined && !Array.isArray(d[k])) errors.push(`coding-agent-v1: ${k} must be an array`);
  // test/security results must be bound to a command's recorded output hash (a source_id in the map).
  const ids = new Set((s.source_map || []).map((e) => e.source_id));
  for (const key of ["test_results", "security_lint"]) {
    const r = d[key];
    if (r && !ids.has(r.output_source_id)) errors.push(`coding-agent-v1: ${key}.output_source_id must cite a source_id in source_map (result bound to command output)`);
  }
  return { valid: errors.length === 0, errors };
}

const VALIDATORS = {
  "banking-v1": validateBankingV1,
  "data-science-v1": validateDataScienceV1,
  "coding-agent-v1": validateCodingAgentV1,
};

/** Validate a session's profile extension (isolated per profile). */
export function validateProfile(s) {
  const name = s?.profile?.name;
  if (!name) return { valid: true, errors: [], profile: null }; // profile-less = pure generic core
  const fn = VALIDATORS[name];
  if (!fn) return { valid: false, errors: [`unknown profile ${name} (expected ${PROFILES.join(", ")})`], profile: name };
  return { ...fn(s), profile: name };
}

/** Full validation = generic core + the session's profile (if any). */
export function validateSession(s) {
  // banking-v1 IS the strict document validator, so run it directly (don't double-run base).
  if (s?.profile?.name === "banking-v1") return { ...validateBankingV1(s), profile: "banking-v1" };
  const base = validateBaseSession(s);
  const prof = validateProfile(s);
  return { valid: base.valid && prof.valid, errors: [...base.errors, ...prof.errors], profile: prof.profile };
}
