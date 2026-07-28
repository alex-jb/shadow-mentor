// Static contract for the Unity XR visualization slice (Node-side, keeps the Unity claim
// honest: this checks the SOURCE wires the audit arc / labels / head-directed focus
// correctly; RUNTIME behavior is proven by the authored Unity PlayMode tests, run in the
// editor). Also enforces: no continuous animation on the stage, no eye-tracking claim, no
// XREAL SDK hard-dependency in the Mock build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PROVENANCE_ORDER } from "../lib/claim-evidence-graph.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const U = "apps/shadow-lens/unity/Assets/ShadowLens";
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const STAGE = read(`${U}/Narrative/ShadowStageController.cs`);
const CHAIN = read(`${U}/Narrative/ShadowAuditChainData.cs`);
const FOCUS = read(`${U}/Spatial/ShadowHeadDirectedFocus.cs`);

test("the stage builds the 3D audit arc from the existing tested geometry", () => {
  assert.match(STAGE, /BuildAuditChain\(/);
  assert.match(STAGE, /SpatialLayout\.AuditArc\(/, "must reuse the tested AuditArc geometry");
  assert.match(STAGE, /ShadowAuditChainData/, "arc must walk the provenance spine");
  assert.match(STAGE, /LineRenderer/);
});

test("the stage stays static — no continuous animation (no Update / coroutine on the stage)", () => {
  assert.equal(/\bvoid\s+Update\s*\(/.test(STAGE), false, "no Update loop on the stage");
  assert.equal(/StartCoroutine\s*\(/.test(STAGE), false, "no coroutine on the stage");
});

test("council spheres get flat perspective labels (readable topology, not anonymous balls)", () => {
  assert.match(STAGE, /_voiceLabels/);
  assert.match(STAGE, /FlatWorldLabel\(/);
});

test("the audit chain mirrors the Claim-Evidence provenance spine, in order", () => {
  const spine = PROVENANCE_ORDER; // source → … → audit_record
  const types = [...CHAIN.matchAll(/new ShadowAuditLink\(\d+,\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(types, spine, "ShadowAuditChainData must mirror PROVENANCE_ORDER exactly");
  // broken link freezes downstream as NOT VERIFIED
  assert.match(CHAIN, /IsVerified/);
  assert.match(STAGE, /NOT VERIFIED/);
});

test("head-directed focus is hover-only, never approves, and is NOT eye tracking", () => {
  assert.match(FOCUS, /TriggersApproval\s*=\s*false/, "focus must declare it never approves");
  assert.match(FOCUS, /HEAD-DIRECTED FOCUS/);
  assert.match(FOCUS, /Camera\.main.*forward|\.forward/, "ray comes from head forward direction");
  // never an affirmative eye-tracking / gaze-detection claim
  assert.equal(/uses eye tracking|is eye tracking|user is looking at/i.test(FOCUS), false, "must not claim eye tracking");
  // SelectHovered must be a no-op by contract (no approval/submit)
  assert.match(FOCUS, /no-op by contract/i);
});

test("Mock build has no XREAL SDK hard dependency", () => {
  for (const [name, src] of [["stage", STAGE], ["focus", FOCUS], ["chain", CHAIN]]) {
    assert.equal(/using\s+Xreal|NRSDK|import.*xreal/i.test(src), false, `${name} must not import the XREAL SDK`);
    assert.equal(/#if\s+SHADOW_XREAL_SDK/.test(src) && !/#endif/.test(src), false, `${name} XREAL guard must be balanced`);
  }
});
