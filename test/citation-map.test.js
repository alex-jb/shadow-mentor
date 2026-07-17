// test/citation-map.test.js
// The citation map is a moat artifact only if it can't silently rot. These
// tests assert: every test file a citation names EXISTS, every persona is REAL,
// the section coverage is intact, and docs/citation-map.json is in sync with
// docs/CITATION_MAP.md (regenerate + commit if this fails).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildFromMarkdown, PERSONAS, AGGREGATE_LABELS } from "../scripts/build-citation-map.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = JSON.parse(readFileSync(resolve(ROOT, "docs/citation-map.json"), "utf8"));
const ALLOWED_PERSONAS = new Set([...PERSONAS, ...AGGREGATE_LABELS]);

test("citation-map.json has entries across all Section-2 subsections", () => {
  assert.ok(json.count >= 30, `expected ≥30 entries, got ${json.count}`);
  assert.equal(json.count, json.entries.length);
  const sections = new Set(json.entries.map((e) => e.section));
  for (const s of ["2.1", "2.2", "2.3", "2.4", "2.6", "2.7"]) {
    assert.ok(sections.has(s), `missing section ${s}`);
  }
});

test("every test file a citation names exists on disk (the map cannot rot)", () => {
  const missing = [];
  for (const e of json.entries) {
    for (const f of e.test_files) if (!existsSync(resolve(ROOT, f))) missing.push(`${e.citation} → ${f}`);
  }
  assert.deepEqual(missing, [], `citation map references test files that no longer exist:\n${missing.join("\n")}`);
});

test("every other code/doc ref (lib/, docs/, shadow-verify/) exists, line suffix stripped", () => {
  const missing = [];
  for (const e of json.entries) {
    for (const r of e.other_refs) {
      const path = r.split(":")[0];
      if (!existsSync(resolve(ROOT, path))) missing.push(`${e.citation} → ${r}`);
    }
  }
  assert.deepEqual(missing, [], `citation map references files that don't exist:\n${missing.join("\n")}`);
});

test("every persona named is a real Shadow persona or an allowed aggregate label", () => {
  const unknown = [];
  for (const e of json.entries) {
    for (const p of e.personas) if (!ALLOWED_PERSONAS.has(p)) unknown.push(`${e.section} ${e.citation} → [${p}]`);
  }
  assert.deepEqual(unknown, [], `citation map names personas that don't exist:\n${unknown.join("\n")}`);
});

test("docs/citation-map.json is in sync with docs/CITATION_MAP.md", () => {
  const md = readFileSync(resolve(ROOT, "docs/CITATION_MAP.md"), "utf8");
  const rebuilt = buildFromMarkdown(md);
  assert.deepEqual(json.entries, rebuilt.entries,
    "citation-map.json is stale — run `node scripts/build-citation-map.mjs` and commit");
});
