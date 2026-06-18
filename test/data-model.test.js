import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, "../src/mock-data.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

test("SCENARIOS has all 4 expected entries", () => {
  const scenarios = Object.keys(sandbox.window.SCENARIOS);
  assert.deepEqual(new Set(scenarios), new Set(["lbo", "bloomberg", "cds", "policy"]));
});

test("PERSONAS has all 5 expected entries", () => {
  const personas = Object.keys(sandbox.window.PERSONAS);
  assert.deepEqual(new Set(personas), new Set(["compliance", "quant", "engineer", "trader", "advisor"]));
});

test("Every persona × scenario cell is populated (20/20 coverage)", () => {
  const personas = Object.keys(sandbox.window.PERSONAS);
  const scenarios = Object.keys(sandbox.window.SCENARIOS);
  for (const p of personas) {
    for (const s of scenarios) {
      const cell = sandbox.window.PERSONAS[p].scenarios?.[s];
      assert.ok(cell, `missing cell: ${p} × ${s}`);
      assert.ok(cell.question?.length > 10, `cell ${p}×${s} has no question`);
      assert.ok(cell.voices?.junior?.length > 20, `cell ${p}×${s} junior voice too short`);
      assert.ok(cell.voices?.senior?.length > 20, `cell ${p}×${s} senior voice too short`);
      assert.ok(cell.voices?.third?.length > 20, `cell ${p}×${s} third voice too short`);
      assert.ok(cell.followup?.length > 10, `cell ${p}×${s} has no followup`);
    }
  }
});

test("Every persona has tags with junior/senior/third labels", () => {
  for (const p of Object.values(sandbox.window.PERSONAS)) {
    assert.ok(p.tags?.junior, "missing junior tag");
    assert.ok(p.tags?.senior, "missing senior tag");
    assert.ok(p.tags?.third, "missing third tag");
  }
});

test("Every scenario has canvas content + recognized context", () => {
  for (const s of Object.values(sandbox.window.SCENARIOS)) {
    assert.ok(s.title?.length > 5);
    assert.ok(s.recognized?.length > 5);
    assert.ok(s.canvas?.length > 100, "scenario canvas should be substantive HTML");
  }
});

test("MODES has cloud + local with description + latency", () => {
  assert.ok(sandbox.window.MODES.cloud.description?.length > 20);
  assert.ok(sandbox.window.MODES.cloud.latency?.length > 5);
  assert.ok(sandbox.window.MODES.local.description?.length > 20);
  assert.ok(sandbox.window.MODES.local.latency?.length > 5);
});

test("Compliance persona uses regulatory language across all scenarios", () => {
  const compliance = sandbox.window.PERSONAS.compliance.scenarios;
  const regulatoryTerms = /policy|reg b|reg bi|ecoa|cfpb|finra|sr 11|article 14|fair lend|adverse action|fiduciary|committee/i;
  for (const [s, cell] of Object.entries(compliance)) {
    const combined = cell.voices.junior + cell.voices.senior + cell.voices.third;
    assert.match(combined, regulatoryTerms, `compliance × ${s} should reference a regulatory framework`);
  }
});

test("Quant persona references SR 11-7 or model risk across scenarios", () => {
  const quant = sandbox.window.PERSONAS.quant.scenarios;
  const modelRiskTerms = /SR 11|model risk|effective challenge|PSI|SHAP|drift|calibration|propensity|policy 11/i;
  for (const [s, cell] of Object.entries(quant)) {
    const combined = cell.voices.junior + cell.voices.senior + cell.voices.third;
    assert.match(combined, modelRiskTerms, `quant × ${s} should reference model-risk framework`);
  }
});

test("LBO scenario canvas highlights Senior Leverage Ratio", () => {
  assert.match(sandbox.window.SCENARIOS.lbo.canvas, /Senior Leverage Ratio/);
  assert.match(sandbox.window.SCENARIOS.lbo.canvas, /highlight-cell/);
});

test("Bloomberg scenario canvas includes 12+ fields with field names", () => {
  const canvas = sandbox.window.SCENARIOS.bloomberg.canvas;
  const fields = ["EQY_SH_OUT", "MARKET_CAP", "PX_LAST", "TRR_1MO", "SHORT_INT_RATIO", "BORROW_RATE_AVG", "PE_RATIO", "EV_TO_EBITDA"];
  for (const f of fields) {
    assert.match(canvas, new RegExp(f), `bloomberg canvas missing field ${f}`);
  }
});
