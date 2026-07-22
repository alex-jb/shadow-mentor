// Emits the canonical cross-engine parity anchors: for each guided story, the compiler's
// target-independent `semantic` block + its `semantic_hash`. These are the golden records the
// parity test (test/shadow-guided-story-parity.test.js) and the Unity adapter both consume, so a
// meaning change anywhere is caught. Also mirrors the semantic block into the Unity assets folder
// (Unity cannot run the Node compiler; it renders this pre-compiled block).
// Run: node fixtures/guided-stories/snapshots/build-snapshots.mjs
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "../../../tools/compile-shadow-guided-story.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const UNITY = join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/Snapshots");
const STORIES = ["audit-chain", "reason-code-attestation", "persona-deliberation"];

export function buildSnapshots() {
  mkdirSync(UNITY, { recursive: true });
  const out = {};
  for (const id of STORIES) {
    const story = JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8"));
    const compiled = compile(story, { target: "snapshot" });
    const dir = join(HERE, id);
    mkdirSync(dir, { recursive: true });
    const semanticText = JSON.stringify(compiled.semantic, null, 2) + "\n";
    writeFileSync(join(dir, "semantic.json"), semanticText);
    writeFileSync(join(dir, "hash.txt"), compiled.semantic_hash + "\n");
    // Unity copy (semantic block only; render hints are engine-specific and not needed on device)
    writeFileSync(join(UNITY, `${id}.semantic.json`), semanticText);
    out[id] = compiled.semantic_hash;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hashes = buildSnapshots();
  for (const [id, h] of Object.entries(hashes)) console.log(`${id}  ${h}`);
}
