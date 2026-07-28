// Static contract for the guided-stage bootstrap wiring (Node-side, keeps the Unity claim honest:
// this checks the SOURCE wires the stage idempotently with a legacy fallback; the RUNTIME behavior
// is proven by the Unity PlayMode tests, run separately in the editor).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOT = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Bootstrap/ShadowLensRuntimeBootstrap.cs"), "utf8");

test("bootstrap wires the guided stage with a flag + idempotent ensure", () => {
  assert.match(BOOT, /useGuidedStage/);
  assert.match(BOOT, /TryEnsureGuidedStage/);
  assert.match(BOOT, /GetComponent<ShadowStageController>\(\)/, "must reuse an existing stage (idempotent)");
  assert.match(BOOT, /AddComponent<ShadowStageController>\(\)/, "must create one if none exists");
});

test("bootstrap falls back to the legacy MockView/panel and logs ONE material error", () => {
  // guided path returns early; legacy path builds the MockView + spatial panel
  assert.match(BOOT, /GuidedStageActive = false[\s\S]*ShadowLensMockView/);
  assert.match(BOOT, /EnsureSpatialPanel/);
  // a single Debug.LogError in the catch (not per-frame spam), not a re-throw
  assert.equal((BOOT.match(/Debug\.LogError\(/g) || []).length, 1, "exactly one material error log on failure");
  assert.equal(/catch[\s\S]*throw/.test(BOOT), false, "must not re-throw (no per-frame exception loop)");
});

test("guided path returns before building legacy UI (no overlap)", () => {
  assert.match(BOOT, /TryEnsureGuidedStage\(root\)\)\s*\{[\s\S]*GuidedStageActive = true;[\s\S]*return;/);
});
