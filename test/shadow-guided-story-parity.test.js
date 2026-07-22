// Cross-engine parity: HTML, Three.js, and Unity all render ONE meaning. The compiler already makes
// the `semantic` block target-independent; this locks it down against committed anchors and proves
// the Unity C# side (which cannot run the Node compiler) mirrors the same vocabulary + status→shape
// mapping and consumes byte-identical snapshot data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile, TARGETS } from "../tools/compile-shadow-guided-story.mjs";
import { buildSnapshots } from "../fixtures/guided-stories/snapshots/build-snapshots.mjs";
import { SEMANTIC_STATUS, SEMANTIC_STATUS_IDS, TRUST_DIMENSION_IDS } from "../lib/shadow-semantic-vocabulary.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const STORY_IDS = ["audit-chain", "reason-code-attestation", "persona-deliberation"];
const story = (id) => JSON.parse(read(`fixtures/guided-stories/${id}.guided-story.json`));

test("every target yields the same semantic hash + block, matching the committed anchor", () => {
  for (const id of STORY_IDS) {
    const s = story(id);
    const outs = TARGETS.map((t) => compile(s, { target: t }));
    const hashes = new Set(outs.map((o) => o.semantic_hash));
    assert.equal(hashes.size, 1, `${id}: targets disagree on hash`);
    const anchorHash = read(`fixtures/guided-stories/snapshots/${id}/hash.txt`).trim();
    assert.equal([...hashes][0], anchorHash, `${id}: hash drifted from committed anchor`);
    const anchorSemantic = read(`fixtures/guided-stories/snapshots/${id}/semantic.json`);
    assert.equal(JSON.stringify(outs[0].semantic, null, 2) + "\n", anchorSemantic, `${id}: semantic block drifted from anchor`);
  }
});

test("committed snapshot anchors are exactly what the generator produces (no drift)", () => {
  const built = buildSnapshots();
  for (const id of STORY_IDS) {
    assert.equal(built[id], read(`fixtures/guided-stories/snapshots/${id}/hash.txt`).trim(), `${id} regenerated hash differs`);
  }
});

test("the Unity semantic copy is byte-identical to the parity anchor", () => {
  for (const id of STORY_IDS) {
    const anchor = read(`fixtures/guided-stories/snapshots/${id}/semantic.json`);
    const unity = read(`apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/Snapshots/${id}.semantic.json`);
    assert.equal(unity, anchor, `${id}: Unity snapshot copy diverged from the anchor`);
  }
});

// ── the Unity vocabulary mirror (parsed straight from the C# source) matches the Node vocabulary ──
function parseCsArray(src, name) {
  const re = new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}`, "m");
  const m = src.match(re);
  assert.ok(m, `C# array ${name} not found`);
  return [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]);
}

test("Unity ShadowGuidedStoryStatus mirrors the Node status + dimension sets exactly", () => {
  const cs = read("apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryStatus.cs");
  assert.deepEqual(parseCsArray(cs, "Statuses"), [...SEMANTIC_STATUS_IDS], "status set/order mismatch");
  assert.deepEqual(parseCsArray(cs, "TrustDimensions"), [...TRUST_DIMENSION_IDS], "dimension set/order mismatch");
});

test("Unity ShapeOf(status) mirrors the Node vocabulary shapes for every status", () => {
  const cs = read("apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryStatus.cs");
  // extract the ShapeOf switch: map each returned shape to the statuses that fall through to it
  const body = cs.slice(cs.indexOf("string ShapeOf"));
  const end = body.indexOf("static string") > 0 ? body.indexOf("static string", 10) : body.length;
  const seg = body.slice(0, end);
  // walk case labels accumulating until a `return "<shape>";`
  const lines = seg.split("\n");
  let pending = [];
  const csShape = {};
  for (const line of lines) {
    const cases = [...line.matchAll(/case\s+"([A-Z_]+)"\s*:/g)].map((m) => m[1]);
    pending.push(...cases);
    const ret = line.match(/return\s+"([a-z]+)"\s*;/);
    if (ret) {
      if (/default\s*:/.test(line) || pending.length === 0) { csShape.__default = ret[1]; }
      for (const s of pending) csShape[s] = ret[1];
      pending = [];
    }
  }
  const defaultShape = csShape.__default ?? "box";
  for (const status of Object.keys(SEMANTIC_STATUS)) {
    const expected = SEMANTIC_STATUS[status].shape;
    const actual = csShape[status] ?? defaultShape;
    assert.equal(actual, expected, `ShapeOf(${status}) C#=${actual} != vocab=${expected}`);
  }
});
