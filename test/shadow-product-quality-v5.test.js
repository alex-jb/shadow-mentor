// Product-quality-v5 fixtures: deeper, genuinely domain-different guided stories (Banking / Data
// Science / Coding). Each must be schema-valid, deterministic, carry pristine + tampered variants,
// a human-review boundary, and a limitation case — with domain-specific entity kinds (not recolored).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile, validateStory, semanticHash } from "../tools/compile-shadow-guided-story.mjs";
import { buildAll } from "../fixtures/product-quality-v5/build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IDS = ["banking-deep", "data-science-deep", "coding-agent-deep"];
const load = (id) => JSON.parse(readFileSync(join(ROOT, `fixtures/product-quality-v5/${id}.guided-story.json`), "utf8"));

test("all product-quality fixtures validate + are deterministic", () => {
  for (const id of IDS) {
    const s = load(id);
    assert.equal(validateStory(s), true, id);
    assert.equal(semanticHash(s), semanticHash(s), id);
  }
});

test("committed fixtures match the generator (no drift)", () => {
  const built = buildAll();
  for (const id of IDS) {
    const onDisk = readFileSync(join(ROOT, `fixtures/product-quality-v5/${id}.guided-story.json`), "utf8");
    assert.equal(onDisk, JSON.stringify(built[`${id}.guided-story.json`], null, 2) + "\n", `${id} drifted`);
  }
});

test("each has pristine + tampered variants with an explicit first failure + downstream", () => {
  for (const id of IDS) {
    const s = load(id);
    const pristine = s.scenarios.find((x) => x.id === "pristine");
    const tampered = s.scenarios.find((x) => x.id === "tampered");
    assert.ok(pristine && tampered, `${id} has pristine + tampered`);
    assert.equal(pristine.first_failure, null);
    assert.ok(tampered.first_failure, `${id} tampered has a first_failure`);
    assert.ok(tampered.affected_downstream.length >= 1, `${id} tampered has downstream`);
  }
});

test("each carries a human-review boundary (analytical NOT evaluated; human approval not present)", () => {
  for (const id of IDS) {
    const s = load(id);
    assert.ok(s.trust_dimensions.includes("ANALYTICAL_CORRECTNESS"), `${id} has analytical dim`);
    assert.ok(s.trust_dimensions.includes("HUMAN_APPROVAL"), `${id} has human approval dim`);
    for (const sc of s.scenarios) {
      if (sc.dimension_status.ANALYTICAL_CORRECTNESS) assert.equal(sc.dimension_status.ANALYTICAL_CORRECTNESS, "NOT_EVALUATED", `${id}/${sc.id}`);
      if (sc.dimension_status.HUMAN_APPROVAL) assert.equal(sc.dimension_status.HUMAN_APPROVAL, "NOT_PRESENT", `${id}/${sc.id}`);
    }
  }
});

test("each has a limitation case (missing/contradictory/drift/failing) beyond pristine+tampered", () => {
  const limits = { "banking-deep": "missing_evidence", "data-science-deep": "feature_drift", "coding-agent-deep": "failing_test" };
  for (const id of IDS) {
    const s = load(id);
    const lim = s.scenarios.find((x) => x.id === limits[id]);
    assert.ok(lim, `${id} has limitation ${limits[id]}`);
    // the limitation must surface a non-pass status somewhere (UNSUPPORTED/WARNING/FAILED/NOT_PRESENT)
    const statuses = Object.values(lim.entity_status).concat(Object.values(lim.dimension_status));
    assert.ok(statuses.some((v) => ["UNSUPPORTED", "WARNING", "FAILED", "NOT_PRESENT"].includes(v)), `${id} limitation surfaces a concern`);
  }
});

test("profiles are genuinely different — domain-specific entity kinds, not recolored banking", () => {
  const kinds = (id) => new Set(load(id).entities.map((e) => e.kind));
  assert.ok(kinds("data-science-deep").has("dataset") && kinds("data-science-deep").has("model") && kinds("data-science-deep").has("metric"), "data-science kinds");
  assert.ok(kinds("coding-agent-deep").has("issue") && kinds("coding-agent-deep").has("diff") && kinds("coding-agent-deep").has("commit"), "coding kinds");
  assert.ok(kinds("banking-deep").has("claim") && kinds("banking-deep").has("recommendation"), "banking kinds");
  // no two profiles share the same kind-set
  assert.notDeepEqual([...kinds("data-science-deep")].sort(), [...kinds("coding-agent-deep")].sort());
});

test("no private data markers; every fixture labels itself a product-quality fixture", () => {
  for (const id of IDS) {
    const raw = readFileSync(join(ROOT, `fixtures/product-quality-v5/${id}.guided-story.json`), "utf8");
    assert.match(raw, /PRODUCT-QUALITY FIXTURE/);
    assert.equal(/\bSSN\b|\bDOB\b|@[a-z]+\.(com|org)|\b\d{3}-\d{2}-\d{4}\b/i.test(raw), false, `${id} looks free of private data`);
  }
});

test("compiling to every target keeps one semantic hash", () => {
  for (const id of IDS) {
    const s = load(id);
    const hashes = ["html", "threejs", "unity", "snapshot"].map((t) => compile(s, { target: t }).semantic_hash);
    assert.equal(new Set(hashes).size, 1, `${id} cross-target parity`);
  }
});
