// Tests for Flow real-session export (apps/shadow-lens/flow). The three scenes must
// derive from the REAL session (not hardcoded fixtures) and tag every row real_or_fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportFlowScenes } from "../apps/shadow-lens/flow/export-session.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const session = () => JSON.parse(readFileSync(join(HERE, "..", "apps", "shadow-lens", "fixtures", "example-session.json"), "utf8"));

test("exports 3 scenes derived from the real session, carrying provenance + verification", () => {
  const { scenes, csv, manifest } = exportFlowScenes(session());
  assert.ok(scenes.audit.length >= 5);       // capture→ocr→analysis→decision→verification
  assert.equal(scenes.risk.length, 3);       // one per claim
  assert.equal(scenes.council.length, 1);    // one reviewer in the fixture
  // every row carries the session id + verification status + a real/fixture tag
  for (const row of [...scenes.audit, ...scenes.risk, ...scenes.council]) {
    assert.equal(row.session_id, "sls-2026-07-20-demo-001");
    assert.ok(["verified", "failed", "unknown"].includes(row.verification_status));
    assert.ok(["real", "fixture"].includes(row.real_or_fixture));
    assert.ok(typeof row.scene_node_id === "string");
  }
  // source-bound claims → real risk rows
  assert.ok(scenes.risk.every((r) => r.real_or_fixture === "real"));
  assert.match(csv.audit, /session_id/);
  assert.ok(manifest.real_rows > 0);
});

test("a claim that is not source_bound is tagged fixture, not passed off as real", () => {
  const s = session();
  s.claims[0].validation_status = "uncited";
  const { scenes } = exportFlowScenes(s);
  assert.equal(scenes.risk.find((r) => r.claim_id === "c1").real_or_fixture, "fixture");
});

test("no reviewers → council falls back to a clearly-labeled fixture row", () => {
  const s = session();
  s.reviewers = [];
  const { scenes } = exportFlowScenes(s);
  assert.equal(scenes.council.length, 1);
  assert.equal(scenes.council[0].real_or_fixture, "fixture");
});
