// shadow-3d-scene-v1 contract: the engine-neutral scene both Unity and Three.js adapt. Validates
// the 4 fixtures against the schema's key constraints + the semantic invariants that must not drift
// between engines (IDs, sequence, edge refs, exact tamper failure + downstream, per-profile node
// types, the six-check verification with analytical-correctness NOT_EVALUATED, deterministic hash).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildAll, buildScene } from "../fixtures/shadow-3d/build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "schemas/shadow-3d-scene-v1.schema.json"), "utf8"));
const FIX = ["banking-seven-node", "banking-tampered", "data-science-lineage", "coding-agent-replay"]
  .map((n) => [n, JSON.parse(readFileSync(join(ROOT, `fixtures/shadow-3d/${n}.json`), "utf8"))]);

const NODE_STATUS = SCHEMA.properties.nodes.items.properties.status.enum;
const EDGE_TYPES = SCHEMA.properties.edges.items.properties.type.enum;

test("every fixture has the required top-level fields + version", () => {
  for (const [name, s] of FIX) {
    assert.equal(s.scene_version, "shadow-3d-scene-v1", name);
    for (const k of SCHEMA.required) assert.ok(k in s, `${name} missing ${k}`);
    assert.equal(s.status_mode, "FIXTURE", name);
    assert.ok(["arc", "dag", "timeline", "hybrid"].includes(s.layout_mode), name);
  }
});

test("node IDs are unique, sequence is dense 0..n-1, statuses are valid", () => {
  for (const [name, s] of FIX) {
    const ids = s.nodes.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, `${name} duplicate node id`);
    s.nodes.forEach((n, i) => {
      assert.equal(n.sequence, i, `${name} node ${i} sequence`);
      assert.ok(NODE_STATUS.includes(n.status), `${name} bad status ${n.status}`);
      assert.ok(["P0", "P1", "P2", "P3"].includes(n.label_priority), `${name} bad label_priority`);
      assert.equal(typeof n.accessibility, "string", `${name} node ${i} missing a11y`);
    });
  }
});

test("edges reference existing nodes and use valid types", () => {
  for (const [name, s] of FIX) {
    const ids = new Set(s.nodes.map((n) => n.id));
    for (const e of s.edges) {
      assert.ok(EDGE_TYPES.includes(e.type), `${name} bad edge type ${e.type}`);
      assert.ok(ids.has(e.from), `${name} edge from unknown ${e.from}`);
      assert.ok(ids.has(e.to), `${name} edge to unknown ${e.to}`);
    }
  }
});

test("the six independent checks are present + analytical correctness is NOT_EVALUATED (never collapsed)", () => {
  for (const [name, s] of FIX) {
    for (const k of ["record_integrity", "signature", "hash_chain", "profile", "source_resolution", "external_anchor"])
      assert.ok(k in s.verification, `${name} missing verification.${k}`);
    assert.equal(s.verification.analytical_correctness, "NOT_EVALUATED", name);
  }
});

test("exact tamper failure + downstream propagation is consistent", () => {
  const clean = FIX.find(([n]) => n === "banking-seven-node")[1];
  assert.equal(clean.tamper, null);
  assert.ok(clean.nodes.every((n) => n.status === "VERIFIED"));

  const t = FIX.find(([n]) => n === "banking-tampered")[1];
  assert.equal(t.tamper.failed_sequence, 3);
  assert.deepEqual(t.tamper.downstream_sequences, [4, 5, 6]);
  assert.equal(t.nodes[3].status, "TAMPERED");                       // the mutated node
  assert.ok(t.nodes.slice(4).every((n) => n.status === "NOT_VERIFIED")); // downstream frozen
  assert.equal(t.verification.record_integrity, "FAILED");
  // downstream_sequences must equal exactly the sequences after the failure
  assert.deepEqual(t.tamper.downstream_sequences, t.nodes.filter((n) => n.sequence > 3).map((n) => n.sequence));
});

test("each profile carries its own node types (not a recolored banking layout)", () => {
  const types = (name) => FIX.find(([n]) => n === name)[1].nodes.map((n) => n.type);
  assert.deepEqual(types("banking-seven-node").slice(0, 3), ["source", "snapshot", "evidence"]);
  assert.deepEqual(types("data-science-lineage").slice(0, 3), ["dataset", "feature", "model"]);
  assert.deepEqual(types("coding-agent-replay").slice(0, 3), ["issue", "tool_call", "diff"]);
});

test("scene serialization is deterministic (attestable) — rebuild yields identical bytes + hash", () => {
  const a = JSON.stringify(buildAll());
  const b = JSON.stringify(buildAll());
  assert.equal(a, b);
  const h = (s) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
  assert.equal(h(buildScene({ profile: "banking-v1", tamperSeq: 3 })), h(buildScene({ profile: "banking-v1", tamperSeq: 3 })));
});

test("layout hints are advisory only — no engine names in the contract", () => {
  const raw = readFileSync(join(ROOT, "fixtures/shadow-3d/banking-seven-node.json"), "utf8");
  assert.equal(/GameObject|MonoBehaviour|Object3D|THREE\.|UnityEngine/.test(raw), false, "no engine-specific names in the scene");
});
