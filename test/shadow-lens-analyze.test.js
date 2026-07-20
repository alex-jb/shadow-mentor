// Tests for source-bound analysis (apps/shadow-lens/backend/analyze.mjs). The LLM is
// mocked so the assemble→gate→coverage→provenance pipeline is verified without a key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSourceBound, computeSourceMapHash, sourceCoverage } from "../apps/shadow-lens/backend/analyze.mjs";

const SM = [
  { source_id: "L1", text: "Revenue: $84,500", normalized_value: 84500 },
  { source_id: "L2", text: "Debt-to-Income: 0.41", normalized_value: 0.41 },
];

test("computeSourceMapHash is stable + moves when the map changes", () => {
  const h = computeSourceMapHash(SM);
  assert.match(h, /^sha256:[0-9a-f]{64}$/);
  assert.equal(h, computeSourceMapHash(SM));
  assert.notEqual(h, computeSourceMapHash([...SM, { source_id: "L3", text: "x" }]));
});

test("sourceCoverage = % of source_map entries cited by a source_bound finding", () => {
  assert.equal(sourceCoverage([{ source_ids: ["L1"] }], SM), 50);
  assert.equal(sourceCoverage([{ source_ids: ["L1", "L2"] }], SM), 100);
  assert.equal(sourceCoverage([], SM), 0);
});

test("analyzeSourceBound: gates a nonexistent-id finding to rejected + reports provenance", async () => {
  const mockLlm = async () => ({
    findings: [
      { claim: "DTI 0.41 over ceiling", source_ids: ["L2"], quote: "Debt-to-Income: 0.41", confidence: 0.9 },
      { claim: "Revenue fell 40%", source_ids: ["L9"], quote: "fabricated", confidence: 0.8 }, // L9 doesn't exist
      { claim: "General note", source_ids: [], quote: "", confidence: 0.3 },
    ],
  });
  const r = await analyzeSourceBound(SM, { llm: mockLlm });
  assert.equal(r.source_bound_count, 1);
  assert.equal(r.rejected_count, 1);   // the L9 cite is rejected, never rendered
  assert.equal(r.uncited_count, 1);
  assert.equal(r.findings.find((f) => f.source_ids.includes("L9")).validation_status, "rejected");
  assert.equal(r.source_coverage_pct, 50); // only L2 cited by a source_bound finding
  assert.equal(r.source_map_hash, computeSourceMapHash(SM));
  assert.match(r.prompt_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(r.model_id, "claude-haiku-4-5");
});

test("analyzeSourceBound requires an injected llm (no silent guessing)", async () => {
  await assert.rejects(() => analyzeSourceBound(SM, {}), /requires an injected llm/);
});
