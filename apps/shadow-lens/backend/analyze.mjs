// apps/shadow-lens/backend/analyze.mjs
// Source-bound analysis (Section 10): given an OCR source_map, produce findings that may
// ONLY cite source_id values that exist, with a coverage metric + the provenance hashes
// that make the result independently verifiable. The LLM is INJECTED so the pipeline
// (assemble → gate → coverage → hashes) is fully testable without a key; a Claude adapter
// is provided for the live path. Coordinates never touch the model (see input-guards).
import { createHash } from "node:crypto";
import { assembleSourceBoundInput, gateFindings } from "./input-guards.mjs";

const sha = (s) => "sha256:" + createHash("sha256").update(s, "utf-8").digest("hex");
function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}

/** Stable hash of the OCR source_map — bound into provenance so a post-hoc edit is caught. */
export function computeSourceMapHash(sourceMap) {
  return sha(canonicalize(sourceMap ?? []));
}

/** % of source_map entries cited by at least one source_bound finding. */
export function sourceCoverage(sourceBoundFindings, sourceMap) {
  const total = (sourceMap ?? []).length;
  if (!total) return 0;
  const cited = new Set();
  for (const f of sourceBoundFindings ?? []) for (const id of f.source_ids ?? []) cited.add(id);
  return +((100 * cited.size) / total).toFixed(1);
}

/**
 * Run source-bound analysis over an OCR source_map.
 * @param {Array} sourceMap - [{source_id, text, normalized_value?}]
 * @param {{ llm:(system_rule:string, fenced_input:string)=>Promise<{findings:Array}|Array>, model?:string }} opts
 *   llm is REQUIRED (inject the Claude adapter or a mock). It receives ONLY the fenced,
 *   coordinate-free input and must return findings that cite source_ids.
 * @returns {Promise<{findings, source_bound_count, rejected_count, source_map_hash, model_id, prompt_hash, source_coverage_pct}>}
 */
export async function analyzeSourceBound(sourceMap, { llm, model = "claude-haiku-4-5" } = {}) {
  if (typeof llm !== "function") throw new Error("analyzeSourceBound requires an injected llm(system_rule, fenced_input) function");
  const { system_rule, fenced_input } = assembleSourceBoundInput(sourceMap);
  const raw = await llm(system_rule, fenced_input);
  const findings = Array.isArray(raw) ? raw : (raw?.findings ?? []);
  const gated = gateFindings(findings, sourceMap);      // the resolvability gate — un-hallucinable coords
  const sourceBound = gated.filter((f) => f.validation_status === "source_bound");
  return {
    findings: gated,
    source_bound_count: sourceBound.length,
    rejected_count: gated.filter((f) => f.validation_status === "rejected").length,
    uncited_count: gated.filter((f) => f.validation_status === "uncited").length,
    source_map_hash: computeSourceMapHash(sourceMap),
    model_id: model,
    prompt_hash: sha(system_rule),
    source_coverage_pct: sourceCoverage(sourceBound, sourceMap),
  };
}

/**
 * Claude adapter for the live path — matches the injected llm signature. Needs
 * ANTHROPIC_API_KEY; the caller (endpoint) decides when to use it vs a fixture. Uses
 * tool-use to force a structured findings object (no regex parsing).
 */
export function makeClaudeLlm({ apiKey, model = "claude-haiku-4-5" }) {
  return async function claudeLlm(system_rule, fenced_input) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const tool = {
      name: "record_findings",
      description: "Record document findings, each citing source_id values that exist in the input.",
      input_schema: {
        type: "object",
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                claim: { type: "string" }, source_ids: { type: "array", items: { type: "string" } },
                quote: { type: "string" }, severity: { type: "string" }, confidence: { type: "number" },
              },
              required: ["claim", "source_ids"],
            },
          },
        },
        required: ["findings"],
      },
    };
    const resp = await client.messages.create({
      model, max_tokens: 1500,
      system: system_rule,
      tools: [tool], tool_choice: { type: "tool", name: "record_findings" },
      messages: [{ role: "user", content: fenced_input }],
    });
    const use = resp.content.find((b) => b.type === "tool_use" && b.name === "record_findings");
    if (!use) throw new Error("model did not return findings");
    return use.input;
  };
}
