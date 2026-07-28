// Static contract for the Slice-F legibility + perf baseline (Node host). Verifies the SOURCE
// defines the five preview profiles, the legibility checks, and a perf sample that is honestly
// labeled NOT Beam Pro device evidence with the required metric fields. Runtime behavior is
// proven by the authored Unity EditMode tests (ShadowLegibilityTests), run in the editor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const U = "apps/shadow-lens/unity/Assets/ShadowLens/Spatial";
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const PROF = read(`${U}/ShadowLegibilityProfiles.cs`);
const PERF = read(`${U}/ShadowPerfBaseline.cs`);

test("five editor preview profiles incl. glasses safe zone + passthrough", () => {
  const names = [...PROF.matchAll(/new PreviewProfile\("([^"]+)"/g)].map((m) => m[1]);
  assert.equal(names.length, 5, `expected 5 preview profiles, found ${names.length}`);
  assert.ok(names.some((n) => /Safe Zone/.test(n)), "must include the glasses central safe zone");
  assert.ok(names.some((n) => /Passthrough/.test(n)), "must include a high-complexity passthrough profile");
  assert.ok(names.some((n) => /16:9/.test(n)) && names.some((n) => /Narrow/.test(n)) && names.some((n) => /Low-Resolution/i.test(n)));
});

test("the legibility checks are defined", () => {
  for (const fn of ["IsClipped", "Overlaps", "IsUndersized", "RequiresExcessiveHeadTurn", "PanelReadableOverPassthrough"])
    assert.match(PROF, new RegExp(`\\b${fn}\\b`), `missing legibility check ${fn}`);
});

test("perf baseline is honestly labeled NOT Beam Pro and carries the required metrics", () => {
  assert.match(PERF, /NOT_BEAM_PRO_DEVICE_EVIDENCE/, "perf evidence must be labeled non-device");
  for (const field of ["initMs", "transitionMs", "avgFps", "drawCalls", "canvasRebuilds", "gcAllocOnTransition", "stageWorldCount", "hudCanvasCount", "eventSystemCount"])
    assert.match(PERF, new RegExp(`\\b${field}\\b`), `perf sample missing metric ${field}`);
});
