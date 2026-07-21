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
