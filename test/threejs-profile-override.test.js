// Guard for the ONE deliberate colour deviation in the stack: the Three.js Audit Room's
// `AuditRoomProvenance` profile. The flat semantic table paints VERIFIED green (#4ade80); the
// Audit Room instead uses a NEUTRAL resting surface and carries verification by DEVIATION
// (red tamper + transient green heal pulse). This test pins that named override so it can never
// silently drift into "any card can be any colour". See reports/spatial-ux-v11/TOKEN_PROFILE_OVERRIDE_POLICY.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SHADOW_SEMANTIC_TOKENS } from "../generated/shadow-semantic-tokens.generated.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "demos/replay/3d/constants.js"), "utf8");
const hexOf = (name) => (src.match(new RegExp(`${name}:\\s*"(#[0-9a-fA-F]{6})"`)) || [])[1];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const isGreen = (h) => { const [r, g, b] = rgb(h); return g > 0.45 && g > r + 0.1 && g > b + 0.1; };
const isRed = (h) => { const [r, g, b] = rgb(h); return r > 0.55 && r > g + 0.2 && r > b + 0.1; };
const isNeutral = (h) => { const [r, g, b] = rgb(h); const m = (r + g + b) / 3; return Math.max(r, g, b) - Math.min(r, g, b) < 0.06 && m > 0.5; };

test("PROFILE-OVERRIDES-EXPLICIT: Audit Room resting/verified surface is NEUTRAL, not semantic green", () => {
  const intact = hexOf("intact");
  assert.ok(intact, "STATUS.intact must be defined");
  assert.ok(isNeutral(intact), `intact surface must be neutral paper (profile override), got ${intact}`);
  assert.ok(!isGreen(intact), "intact surface must NOT reuse verification green as a resting fill");
  // and it must NOT accidentally equal the flat semantic VERIFIED colour
  assert.notEqual(intact.toLowerCase(), SHADOW_SEMANTIC_TOKENS["status.VERIFIED"].color.toLowerCase(),
    "Audit Room surface must be a NAMED override, distinct from the flat VERIFIED token");
});

test("THREEJS-VERIFIED-DIVERGENCE-RESOLVED: verification still carried — green heal pulse + red tamper", () => {
  // green is not dropped from the vocabulary; it is the verify/reset EVENT cue.
  assert.ok(isGreen(hexOf("healed")), "healed pulse must stay GREEN (verification event cue)");
  assert.ok(isRed(hexOf("tampered")), "tampered must stay RED (chain break)");
  // the deviation is documented, not silent
  assert.match(src, /AuditRoomProvenance/, "the profile must be named in-source");
  assert.match(src, /TOKEN_PROFILE_OVERRIDE_POLICY\.md/, "in-source pointer to the policy doc required");
});
