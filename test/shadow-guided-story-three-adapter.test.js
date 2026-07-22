// Three.js layout adapter + status materials — the pure, Node-testable half of the Three.js
// adapter (no WebGL). Positions are advisory; the semantic identity carried through (statuses,
// first-failure, downstream, edges) must match the compiled snapshot exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "../tools/compile-shadow-guided-story.mjs";
import { statusVisual, ALL_STATUS_VISUALS } from "../prototypes/shadow-3d-v2/src/shadow-status-materials.mjs";
import { layoutScene, LAYOUT_MODES } from "../prototypes/shadow-3d-v2/src/shadow-guided-story-three-adapter.mjs";
import { SEMANTIC_STATUS } from "../lib/shadow-semantic-vocabulary.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sem = (id) => compile(JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8")), { target: "threejs" }).semantic;
const STORIES = ["audit-chain", "reason-code-attestation", "persona-deliberation"];
const finite3 = (p) => Array.isArray(p) && p.length === 3 && p.every((n) => Number.isFinite(n));

test("every semantic status has a shape + colour + bilingual text (never colour alone)", () => {
  assert.equal(ALL_STATUS_VISUALS.length, Object.keys(SEMANTIC_STATUS).length);
  for (const s of Object.keys(SEMANTIC_STATUS)) {
    const v = statusVisual(s);
    assert.ok(v.shape && v.geometry && typeof v.color === "number", `${s} has shape+geometry+color`);
    assert.ok(v.text_en && v.text_zh, `${s} has bilingual text`);
  }
});

test("statusVisual fails closed on an unknown status", () => {
  assert.throws(() => statusVisual("MADE_UP"), /unknown semantic status/);
});

test("layoutScene projects every node with finite positions and preserves semantics", () => {
  for (const id of STORIES) {
    const s = sem(id);
    for (const sc of s.scenarios) {
      const layout = s.steps.find((st) => st.scenario_ref === sc.id)?.layout_intent ?? "timeline";
      const model = layoutScene(s, { scenarioId: sc.id, layout });
      assert.equal(model.nodes.length, s.entities.length, `${id}/${sc.id} node count`);
      for (const n of model.nodes) {
        assert.ok(finite3(n.pos), `${id}/${sc.id} ${n.id} finite pos`);
        assert.ok(n.status in SEMANTIC_STATUS, `${id}/${sc.id} ${n.id} valid status`);
      }
      // first failure + downstream flags mirror the scenario
      assert.equal(model.first_failure, sc.first_failure ?? null, `${id}/${sc.id} first_failure`);
      const ff = model.nodes.filter((n) => n.is_first_failure).map((n) => n.id);
      if (sc.first_failure && s.entities.some((e) => e.id === sc.first_failure)) assert.deepEqual(ff, [sc.first_failure]);
      const down = model.nodes.filter((n) => n.is_downstream).map((n) => n.id).sort();
      assert.deepEqual(down, [...(sc.affected_downstream ?? [])].sort(), `${id}/${sc.id} downstream`);
      // edges only reference existing nodes
      const ids = new Set(model.nodes.map((n) => n.id));
      for (const e of model.edges) { assert.ok(ids.has(e.from) && ids.has(e.to)); assert.ok(finite3(e.from_pos) && finite3(e.to_pos)); }
    }
  }
});

test("all five layout modes produce finite, distinct-enough positions", () => {
  const s = sem("persona-deliberation");
  for (const layout of LAYOUT_MODES) {
    const model = layoutScene(s, { scenarioId: "consensus_with_evidence", layout });
    assert.ok(model.nodes.every((n) => finite3(n.pos)), `${layout} finite`);
    const uniq = new Set(model.nodes.map((n) => n.pos.map((x) => x.toFixed(3)).join(",")));
    assert.ok(uniq.size >= Math.min(model.nodes.length, 3), `${layout} not all-collapsed`);
  }
});

test("focus+context: with a focus set, only those nodes are focused; the rest dim", () => {
  const s = sem("audit-chain");
  const focus = ["banking-v1:n3:claim"];
  const model = layoutScene(s, { scenarioId: "tamper_seq_3", layout: "timeline", focusEntities: focus });
  assert.equal(model.nodes.find((n) => n.id === focus[0]).focused, true);
  assert.equal(model.nodes.find((n) => n.id === focus[0]).dimmed, false);
  assert.ok(model.nodes.filter((n) => n.id !== focus[0]).every((n) => n.dimmed === true));
  // empty focus set → everything focused, nothing dimmed
  const all = layoutScene(s, { scenarioId: "tamper_seq_3", layout: "timeline", focusEntities: [] });
  assert.ok(all.nodes.every((n) => n.focused && !n.dimmed));
});

test("audit-chain tamper scene: seq-3 first failure ring + downstream degraded edges", () => {
  const s = sem("audit-chain");
  const model = layoutScene(s, { scenarioId: "tamper_seq_3", layout: "timeline" });
  const ff = model.nodes.find((n) => n.is_first_failure);
  assert.equal(ff.id, "banking-v1:n3:claim");
  assert.equal(ff.status, "FIRST_FAILURE");
  assert.ok(model.nodes.filter((n) => n.is_downstream).every((n) => n.status === "AFFECTED_DOWNSTREAM"));
  // trust dimensions carried, analytical correctness not evaluated
  assert.equal(model.trust_dimensions.find((d) => d.dimension === "ANALYTICAL_CORRECTNESS").status, "NOT_EVALUATED");
});
