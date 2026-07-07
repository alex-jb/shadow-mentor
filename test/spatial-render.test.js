// v1.5.13 — Spatial-render layout contract tests.
// Guards: deterministic layout, mode switches, focus-persona hiding,
// audit-chain object placement.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSpatialScene,
  RENDER_MODES,
  semicirclePositions,
  REVIEWER_ORIGIN,
} from "../lib/spatial-render.js";

function sampleDeliberateResponse(voiceCount = 5) {
  const voiceNames = [
    "Credit Fundamentals",
    "Risk Officer",
    "Fair Lending Compliance",
    "Customer Advocate",
    "Macro Contrarian",
    "AML/KYC Investigator",
  ];
  return {
    voices: voiceNames.slice(0, voiceCount).map((v, i) => ({
      voice: v,
      verdict: i % 2 === 0 ? "approve" : "escalate",
      rationale_short: `sample rationale for ${v}`,
      confidence: 0.8 - i * 0.05,
      citation: `Addendum ${String.fromCharCode(65 + (i % 3))}`,
      adverse_action_code: `AA0${i + 1}`,
    })),
    verdict: "escalate",
    audit_chain: "0".repeat(64),
  };
}

test("semicirclePositions arranges 5 personas from -90° to +90°", () => {
  const p = semicirclePositions(5);
  assert.equal(p.length, 5);
  assert.equal(p[0].thetaDeg, -90);
  assert.equal(p[4].thetaDeg, 90);
  assert.equal(p[2].thetaDeg, 0); // middle persona faces reviewer directly
});

test("semicirclePositions places single persona at 0°", () => {
  const p = semicirclePositions(1);
  assert.equal(p.length, 1);
  assert.equal(p[0].thetaDeg, 0);
});

test("semicirclePositions rejects zero personas", () => {
  assert.throws(() => semicirclePositions(0), /n >= 1/);
});

test("semicirclePositions y coordinate is eye height (1.6m)", () => {
  const p = semicirclePositions(5);
  for (const pos of p) {
    assert.equal(pos.y, 1.6);
  }
});

test("buildSpatialScene defaults to full mode with 5 personas visible", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5));
  assert.equal(scene.mode, "full");
  assert.equal(scene.personas.length, 5);
  for (const persona of scene.personas) {
    assert.equal(persona.visible, true);
  }
});

test("buildSpatialScene reduced mode disables ambient background", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5), { mode: "reduced" });
  assert.equal(scene.mode, "reduced");
  assert.equal(scene.ambient_background, null);
  assert.equal(scene.personas.length, 5); // still all visible
});

test("buildSpatialScene focus mode hides all but the focus personas", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5), {
    mode: "focus",
    focusPersonas: ["Credit Fundamentals", "Risk Officer"],
  });
  const visibleCount = scene.personas.filter((p) => p.visible).length;
  const hiddenCount = scene.personas.filter((p) => !p.visible).length;
  assert.equal(visibleCount, 2);
  assert.equal(hiddenCount, 3);
  for (const persona of scene.personas.filter((p) => !p.visible)) {
    assert.match(persona.visibility_reason, /hidden_by_focus_mode/);
  }
});

test("buildSpatialScene focus mode defaults to first 2 personas when focus not provided", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5), { mode: "focus" });
  const visible = scene.personas.filter((p) => p.visible);
  assert.equal(visible.length, 2);
  assert.equal(visible[0].persona_name, "Credit Fundamentals");
  assert.equal(visible[1].persona_name, "Risk Officer");
});

test("buildSpatialScene tethered mode sets tethered_hint + keeps ambient", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5), { mode: "tethered" });
  assert.equal(scene.mode, "tethered");
  assert.equal(scene.tethered_hint, true);
  assert.ok(scene.ambient_background, "tethered mode retains ambient bg");
});

test("buildSpatialScene rejects unknown mode", () => {
  assert.throws(
    () => buildSpatialScene(sampleDeliberateResponse(5), { mode: "bogus" }),
    /unknown mode/,
  );
});

test("buildSpatialScene rejects response with no voices", () => {
  assert.throws(
    () => buildSpatialScene({ verdict: "approve" }),
    /no voices found/,
  );
});

test("buildSpatialScene falls back to loan_council.voices when top-level voices missing", () => {
  const response = {
    loan_council: {
      voices: [{ voice: "Credit Fundamentals", verdict: "approve" }],
      verdict: "approve",
    },
  };
  const scene = buildSpatialScene(response);
  assert.equal(scene.personas.length, 1);
  assert.equal(scene.personas[0].persona_name, "Credit Fundamentals");
});

test("buildSpatialScene positions face the reviewer origin", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(3));
  const middle = scene.personas[1]; // theta=0
  assert.equal(middle.position.x, REVIEWER_ORIGIN.x);
});

test("buildSpatialScene audit_chain_object at fixed position when chain present", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5));
  assert.ok(scene.audit_chain_object);
  assert.equal(scene.audit_chain_object.position.x, 0);
  assert.equal(scene.audit_chain_object.position.y, 1.4);
  assert.equal(scene.audit_chain_object.position.z, -2.0);
  assert.equal(scene.audit_chain_object.walk_through, true);
});

test("buildSpatialScene sets scene_schema version + timestamp", () => {
  const scene = buildSpatialScene(sampleDeliberateResponse(5));
  assert.match(scene.scene_schema, /^shadow-spatial\/v\d+\.\d+\.\d+$/);
  assert.ok(scene.generated_at_utc);
});

test("buildSpatialScene layout is deterministic across runs (same input → same positions)", () => {
  const input = sampleDeliberateResponse(5);
  const scene1 = buildSpatialScene(input);
  const scene2 = buildSpatialScene(input);
  for (let i = 0; i < scene1.personas.length; i++) {
    assert.deepEqual(scene1.personas[i].position, scene2.personas[i].position);
    assert.equal(scene1.personas[i].rotation_y_deg, scene2.personas[i].rotation_y_deg);
  }
});

test("RENDER_MODES has exactly 4 modes", () => {
  const modes = Object.values(RENDER_MODES);
  assert.equal(modes.length, 4);
  assert.deepEqual(modes.sort(), ["focus", "full", "reduced", "tethered"]);
});
