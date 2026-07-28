// Narrative contract drift: the C# state machine, the UX spec doc, and the Flow spec must agree on
// the five narrative states in order — so the guided experience can't silently drift from the design.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATES = ["READY", "CASE", "COUNCIL", "DECISION", "FLOW_OR_AUDIT"];

test("the C# narrative state machine declares the five states in order", () => {
  const cs = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowNarrativeStateMachine.cs"), "utf8");
  const m = cs.match(/Order\s*=\s*\{([^}]+)\}/);
  assert.ok(m, "Order array not found");
  const order = [...m[1].matchAll(/\b([A-Z_]+)\b/g)].map((x) => x[1]).filter((s) => STATES.includes(s));
  assert.deepEqual(order, STATES, "C# Order must match the spec state list");
});

test("UX_FLOW_SPEC documents the same five states", () => {
  const spec = readFileSync(join(ROOT, "apps/shadow-lens/docs/UX_FLOW_SPEC.md"), "utf8");
  for (const s of STATES) assert.ok(spec.includes(s), `spec missing ${s}`);
  // the state diagram shows the forward chain
  assert.match(spec, /READY[\s\S]*CASE[\s\S]*COUNCIL[\s\S]*DECISION[\s\S]*FLOW_OR_AUDIT/);
});

test("Reset-from-any-state is specified (guided experience invariant)", () => {
  const spec = readFileSync(join(ROOT, "apps/shadow-lens/docs/UX_FLOW_SPEC.md"), "utf8");
  assert.match(spec, /Reset Demo.*from ANY state|from every state/i);
});

// ── central case core: legible banking-case identity (not a bare sphere) ──
const CASE_LINES = ["MID-MARKET LOAN", "CASE #SL-2026-014", "$8.4M REQUEST"];

test("the fixture carries the three case-core display lines", () => {
  const mjs = readFileSync(join(ROOT, "apps/shadow-lens/fixtures/banking-narrative.mjs"), "utf8");
  for (const line of CASE_LINES) assert.ok(mjs.includes(line), `fixture missing case line: ${line}`);
});

test("the C# narrative data mirrors the fixture case lines exactly (no drift)", () => {
  const cs = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowBankingNarrativeData.cs"), "utf8");
  assert.match(cs, /CaseTitle\s*=\s*"MID-MARKET LOAN"/);
  assert.match(cs, /CaseNumber\s*=\s*"CASE #SL-2026-014"/);
  assert.match(cs, /CaseAmount\s*=\s*"\$8\.4M REQUEST"/);
});

test("the stage builds a labeled case core (ring + 3-line label) with no continuous animation", () => {
  const cs = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Narrative/ShadowStageController.cs"), "utf8");
  assert.match(cs, /BuildCaseCore\(/, "case core builder must exist");
  assert.match(cs, /CaseTitle[\s\S]*CaseNumber[\s\S]*CaseAmount/, "core label must render the three case lines");
  assert.match(cs, /LineRenderer/, "restrained containment ring (LineRenderer) expected");
  // the stage must not add a continuous decorative loop (no Update/coroutine driving the core)
  assert.equal(/\bvoid\s+Update\s*\(/.test(cs), false, "no Update loop (would be continuous animation)");
  assert.equal(/StartCoroutine\s*\(/.test(cs), false, "no coroutine animation on the stage");
});
