// Genuinely-running Node test for the Unity contract: the generated C# constants must match the
// SHARED web registries (no second schema definition), and the committed .g.cs must be current.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render } from "../scripts/gen-unity-contract.mjs";
import { CLIENT_ACTIONS } from "../apps/shadow-lens/web/spatial-agent/client-actions.mjs";
import { FlowState, ExecStatus } from "../apps/shadow-lens/web/spatial-agent/src/app/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CS = join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialContract.g.cs");

test("committed ShadowSpatialContract.g.cs is up to date (no drift)", () => {
  const committed = readFileSync(CS, "utf8");
  assert.equal(committed, render(), "run `node scripts/gen-unity-contract.mjs` to regenerate");
});

test("generated C# carries the SAME action set as the shared registry", () => {
  const cs = render();
  for (const a of Object.keys(CLIENT_ACTIONS)) assert.ok(cs.includes(`"${a}"`), `missing action ${a}`);
});

test("generated C# carries the SAME states + statuses as the shared types", () => {
  const cs = render();
  for (const s of Object.values(FlowState)) assert.ok(cs.includes(`"${s}"`), `missing state ${s}`);
  for (const s of Object.values(ExecStatus)) assert.ok(cs.includes(`"${s}"`), `missing status ${s}`);
});
