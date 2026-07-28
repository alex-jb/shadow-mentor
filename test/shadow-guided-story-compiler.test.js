// The deterministic guided-story compiler: it validates untrusted stories against the closed
// vocabulary, rejects duplicate ids / dangling refs / unknown statuses / executable HTML /
// prototype pollution / forbidden semantic collapses, and emits a target-independent semantic
// projection whose hash is identical across html/threejs/unity/snapshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile, validateStory, canonicalSemantic, semanticHash, TARGETS } from "../tools/compile-shadow-guided-story.mjs";
import { buildAll } from "../fixtures/guided-stories/build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORY_IDS = ["audit-chain", "reason-code-attestation", "persona-deliberation"];
const load = (id) => JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));

test("all three canonical fixtures validate against the vocabulary", () => {
  for (const id of STORY_IDS) assert.equal(validateStory(load(id)), true, id);
});

test("the committed fixtures are exactly what the deterministic generator produces (no drift)", () => {
  const built = buildAll();
  for (const id of STORY_IDS) {
    const onDisk = readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8");
    const regenerated = JSON.stringify(built[`${id}.guided-story.json`], null, 2) + "\n";
    assert.equal(onDisk, regenerated, `${id} fixture drifted from its generator`);
  }
});

test("semantic hash is identical across every target (cross-engine parity at the compiler)", () => {
  for (const id of STORY_IDS) {
    const story = load(id);
    const hashes = TARGETS.map((t) => compile(story, { target: t }).semantic_hash);
    assert.equal(new Set(hashes).size, 1, `${id} hashes differ across targets: ${hashes}`);
    // and the semantic block itself is byte-identical across targets
    const sems = TARGETS.map((t) => JSON.stringify(compile(story, { target: t }).semantic));
    assert.equal(new Set(sems).size, 1, `${id} semantic block differs across targets`);
  }
});

test("only the render block differs per target; snapshot has no render", () => {
  const story = load("audit-chain");
  assert.equal(compile(story, { target: "snapshot" }).render, null);
  assert.ok(compile(story, { target: "html" }).render.surface);
  assert.ok(compile(story, { target: "threejs" }).render.camera);
  assert.ok(compile(story, { target: "unity" }).render.world_plane_m);
});

test("compile is deterministic (same bytes on repeat)", () => {
  for (const id of STORY_IDS) {
    const story = load(id);
    assert.equal(JSON.stringify(compile(story, { target: "snapshot" })), JSON.stringify(compile(story, { target: "snapshot" })), id);
    assert.equal(semanticHash(story), semanticHash(story), id);
  }
});

test("advisory fields (layout_intent) never change the semantic hash", () => {
  const story = load("audit-chain");
  const h0 = semanticHash(story);
  const mutated = clone(story);
  mutated.steps.forEach((s) => { s.layout_intent = "dag"; });
  mutated.references = { scene_clean: "something-else" };
  assert.equal(semanticHash(mutated), h0, "layout_intent / references must be advisory (excluded from hash)");
});

test("meaning DOES change the semantic hash (a status flip is caught)", () => {
  const story = load("audit-chain");
  const h0 = semanticHash(story);
  const mutated = clone(story);
  mutated.scenarios[0].entity_status[story.entities[0].id] = "FAILED";
  assert.notEqual(semanticHash(mutated), h0, "a status change must change the hash");
});

test("fail-closed: duplicate entity id", () => {
  const s = load("audit-chain"); s.entities.push({ ...s.entities[0] });
  assert.throws(() => compile(s, { target: "snapshot" }), /duplicate entity id/);
});

test("fail-closed: dangling relation / scenario refs", () => {
  const a = load("audit-chain"); a.relations[0].to = "ghost";
  assert.throws(() => compile(a, { target: "snapshot" }), /unknown entity ghost/);
  const b = load("audit-chain"); b.scenarios[1].first_failure = "nonexistent";
  assert.throws(() => compile(b, { target: "snapshot" }), /neither a declared entity nor a declared dimension/);
  const c = load("audit-chain"); c.scenarios[0].entity_status["ghost"] = "VERIFIED";
  assert.throws(() => compile(c, { target: "snapshot" }), /unknown entity ghost/);
});

test("fail-closed: unknown status / undeclared dimension", () => {
  const a = load("audit-chain"); a.scenarios[0].entity_status[a.entities[0].id] = "MADE_UP";
  assert.throws(() => compile(a, { target: "snapshot" }), /unknown status MADE_UP/);
  const b = load("audit-chain"); b.scenarios[0].dimension_status["HUMAN_APPROVAL"] = "VERIFIED";
  assert.throws(() => compile(b, { target: "snapshot" }), /undeclared dimension HUMAN_APPROVAL/);
});

test("fail-closed: executable HTML / javascript: / data:text/html anywhere in a string", () => {
  for (const payload of ["<script>alert(1)</script>", "javascript:alert(1)", "data:text/html,<b>x", "<img src=x onerror=alert(1)>"]) {
    const s = load("audit-chain"); s.steps[0].narration.en = payload;
    assert.throws(() => compile(s, { target: "snapshot" }), /executable\/HTML payload rejected/, payload);
  }
});

test("fail-closed: real prototype-pollution key from JSON", () => {
  const raw = JSON.stringify(load("audit-chain"));
  const polluted = JSON.parse(raw.replace(/"entities":\[/, '"entities":[{"__proto__":{"polluted":true},"id":"x","kind":"source","sequence":0,"label":{"en":"x","zh":"x"},"a11y":{"en":"x","zh":"x"}},'));
  assert.equal(Object.keys(polluted.entities[0]).includes("__proto__"), true, "vector present");
  assert.throws(() => validateStory(polluted), /prototype-pollution key rejected/);
});

test("fail-closed: forbidden equivalence phrase in rendered copy", () => {
  for (const phrase of ["verified means trusted", "majority means correct", "已验证即合规"]) {
    const s = load("audit-chain"); s.steps[0].narration.en = "context " + phrase; s.steps[0].narration.zh = phrase;
    assert.throws(() => compile(s, { target: "snapshot" }), /forbidden equivalence phrase/, phrase);
  }
});

test("honesty guard: ANALYTICAL_CORRECTNESS must always be NOT_EVALUATED", () => {
  const s = load("audit-chain"); s.scenarios[0].dimension_status.ANALYTICAL_CORRECTNESS = "VERIFIED";
  assert.throws(() => compile(s, { target: "snapshot" }), /ANALYTICAL_CORRECTNESS must be NOT_EVALUATED/);
});

test("fail-closed: size caps (too many entities)", () => {
  const s = load("audit-chain");
  for (let i = 0; i < 70; i++) s.entities.push({ id: `x${i}`, kind: "source", sequence: 100 + i, label: { en: "x", zh: "x" }, a11y: { en: "x", zh: "x" } });
  assert.throws(() => compile(s, { target: "snapshot" }), /too many entities/);
});

test("audit-chain semantic preserves the seq-3 first failure + downstream 4,5,6", () => {
  const sem = canonicalSemantic(load("audit-chain"));
  const tamper = sem.scenarios.find((s) => s.id === "tamper_seq_3");
  assert.equal(tamper.first_failure, "banking-v1:n3:claim");
  assert.deepEqual(tamper.affected_downstream.sort(), ["banking-v1:n4:recommendation", "banking-v1:n5:signature", "banking-v1:n6:audit_record"].sort());
  assert.equal(tamper.entity_status["banking-v1:n3:claim"], "FIRST_FAILURE");
  assert.equal(tamper.dimension_status.ANALYTICAL_CORRECTNESS, "NOT_EVALUATED");
});
