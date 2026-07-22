#!/usr/bin/env node
// Deterministic compiler for shadow-guided-story-v1.
//
//   node tools/compile-shadow-guided-story.mjs --input <story.json> --target html|threejs|unity|snapshot [--output <file>] [--validate-only]
//
// It (1) validates a guided story as UNTRUSTED input against the closed vocabulary + schema
// caps, (2) rejects duplicate ids / dangling refs / unknown statuses / executable HTML /
// prototype pollution / forbidden semantic collapses, (3) emits a per-target artifact whose
// `semantic` block is target-INDEPENDENT, so html/threejs/unity share one `semantic_hash`.
//
// Pure + deterministic: no Date.now / Math.random, and NO live model or network — the compiler
// only reshapes validated JSON. Fail-closed: any error throws / exits 1 and emits nothing.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  SEMANTIC_STATUS, TRUST_DIMENSIONS, RELATION_TYPES, ENTITY_KINDS,
  isStatus, isTrustDimension, isEntityKind, isRelationType,
  statusMeta, FORBIDDEN_EQUIVALENCE_PHRASES, findForbiddenEquivalence,
  VOCABULARY_VERSION,
} from "../lib/shadow-semantic-vocabulary.mjs";

export const COMPILER_VERSION = "shadow-guided-story-compiler/1";
export const TARGETS = Object.freeze(["html", "threejs", "unity", "snapshot"]);

// Hard caps (defence in depth alongside the JSON schema) — a malicious story cannot exhaust us.
const CAPS = { entities: 64, relations: 256, scenarios: 16, steps: 32, str: 600, depth: 12, bytes: 262144 };
const STEP_KINDS = new Set(["intro", "reveal", "seal", "tamper", "cascade", "resolve", "synthesis", "abstain", "human_gate", "summary"]);
const LAYOUT_INTENTS = new Set(["timeline", "arc", "dag", "radial", "hybrid"]);
const PROTO_KEYS = new Set(["__proto__", "prototype", "constructor"]);

// executable-payload signatures we reject anywhere in a string value
const EXEC_PATTERNS = [
  /<\s*script/i, /<\s*\/\s*script/i, /javascript\s*:/i, /data\s*:\s*text\/html/i,
  /\son\w+\s*=/i, /<\s*iframe/i, /<\s*img[^>]*\bon\w+/i, /vbscript\s*:/i,
];
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bsk-[A-Za-z0-9]{16,}\b/, /\bAKIA[0-9A-Z]{16}\b/,
];

class StoryError extends Error {}
const fail = (msg) => { throw new StoryError(msg); };

// ── deep structural safety: depth, proto keys, executable/secret strings ──────
function walkSafe(value, depth = 0) {
  if (depth > CAPS.depth) fail(`input nesting exceeds depth cap ${CAPS.depth}`);
  if (typeof value === "string") {
    if (value.length > CAPS.str) fail(`string exceeds length cap ${CAPS.str}`);
    for (const re of EXEC_PATTERNS) if (re.test(value)) fail(`executable/HTML payload rejected: ${re}`);
    for (const re of SECRET_PATTERNS) if (re.test(value)) fail(`secret-like value rejected`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((v) => walkSafe(v, depth + 1)); return; }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      if (PROTO_KEYS.has(k)) fail(`prototype-pollution key rejected: ${k}`);
      walkSafe(value[k], depth + 1);
    }
  }
}

const bilingualOk = (o) => o && typeof o === "object" && typeof o.en === "string" && typeof o.zh === "string";

// ── full semantic validation against the closed vocabulary ────────────────────
export function validateStory(story) {
  if (!story || typeof story !== "object" || Array.isArray(story)) fail("story must be an object");
  walkSafe(story);

  if (story.story_version !== "shadow-guided-story-v1") fail(`story_version must be shadow-guided-story-v1, got ${story.story_version}`);
  if (typeof story.story_id !== "string" || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(story.story_id)) fail(`invalid story_id`);
  if (!["FIXTURE", "LIVE", "DEVICE"].includes(story.provenance_mode)) fail(`invalid provenance_mode`);
  if (!bilingualOk(story.title)) fail("title must be bilingual {en,zh}");

  // entities
  if (!Array.isArray(story.entities) || story.entities.length < 1) fail("entities required");
  if (story.entities.length > CAPS.entities) fail(`too many entities (> ${CAPS.entities})`);
  const entityIds = new Set();
  for (const e of story.entities) {
    if (typeof e.id !== "string") fail("entity.id required");
    if (entityIds.has(e.id)) fail(`duplicate entity id ${e.id}`);
    entityIds.add(e.id);
    if (!isEntityKind(e.kind)) fail(`entity ${e.id}: unknown kind ${e.kind}`);
    if (!Number.isInteger(e.sequence) || e.sequence < 0) fail(`entity ${e.id}: bad sequence`);
    if (!bilingualOk(e.label) || !bilingualOk(e.a11y)) fail(`entity ${e.id}: label + a11y must be bilingual`);
    if (e.trust_dimension != null && !isTrustDimension(e.trust_dimension)) fail(`entity ${e.id}: unknown trust_dimension ${e.trust_dimension}`);
  }

  // trust dimensions (declared subset)
  if (!Array.isArray(story.trust_dimensions) || story.trust_dimensions.length < 1) fail("trust_dimensions required");
  const declaredDims = new Set();
  for (const d of story.trust_dimensions) {
    if (!isTrustDimension(d)) fail(`unknown trust dimension ${d}`);
    if (declaredDims.has(d)) fail(`duplicate trust dimension ${d}`);
    declaredDims.add(d);
  }

  // relations
  const relations = story.relations ?? [];
  if (relations.length > CAPS.relations) fail(`too many relations`);
  const relIds = new Set();
  for (const r of relations) {
    if (relIds.has(r.id)) fail(`duplicate relation id ${r.id}`);
    relIds.add(r.id);
    if (!isRelationType(r.type)) fail(`relation ${r.id}: unknown type ${r.type}`);
    if (!entityIds.has(r.from)) fail(`relation ${r.id}: from unknown entity ${r.from}`);
    if (!entityIds.has(r.to)) fail(`relation ${r.id}: to unknown entity ${r.to}`);
  }

  // scenarios
  if (!Array.isArray(story.scenarios) || story.scenarios.length < 1) fail("scenarios required");
  if (story.scenarios.length > CAPS.scenarios) fail(`too many scenarios`);
  const scenarioIds = new Set();
  for (const sc of story.scenarios) {
    if (scenarioIds.has(sc.id)) fail(`duplicate scenario id ${sc.id}`);
    scenarioIds.add(sc.id);
    if (!bilingualOk(sc.label)) fail(`scenario ${sc.id}: label must be bilingual`);
    for (const [k, v] of Object.entries(sc.entity_status ?? {})) {
      if (!entityIds.has(k)) fail(`scenario ${sc.id}: entity_status references unknown entity ${k}`);
      if (!isStatus(v)) fail(`scenario ${sc.id}: unknown status ${v} for ${k}`);
    }
    for (const [k, v] of Object.entries(sc.dimension_status ?? {})) {
      if (!declaredDims.has(k)) fail(`scenario ${sc.id}: dimension_status references undeclared dimension ${k}`);
      if (!isStatus(v)) fail(`scenario ${sc.id}: unknown status ${v} for ${k}`);
      // honesty guard: analytical correctness is never judged
      if (k === "ANALYTICAL_CORRECTNESS" && v !== "NOT_EVALUATED") fail(`scenario ${sc.id}: ANALYTICAL_CORRECTNESS must be NOT_EVALUATED, got ${v}`);
    }
    if (sc.first_failure != null && !entityIds.has(sc.first_failure) && !declaredDims.has(sc.first_failure))
      fail(`scenario ${sc.id}: first_failure ${sc.first_failure} is neither a declared entity nor a declared dimension`);
    for (const id of sc.affected_downstream ?? []) if (!entityIds.has(id)) fail(`scenario ${sc.id}: affected_downstream unknown entity ${id}`);
    if (sc.note != null && !bilingualOk(sc.note)) fail(`scenario ${sc.id}: note must be bilingual`);
  }

  // steps
  if (!Array.isArray(story.steps) || story.steps.length < 1) fail("steps required");
  if (story.steps.length > CAPS.steps) fail(`too many steps`);
  const stepIds = new Set(), stepIndices = new Set();
  for (const st of story.steps) {
    if (stepIds.has(st.id)) fail(`duplicate step id ${st.id}`);
    stepIds.add(st.id);
    if (!Number.isInteger(st.index) || st.index < 0) fail(`step ${st.id}: bad index`);
    if (stepIndices.has(st.index)) fail(`duplicate step index ${st.index}`);
    stepIndices.add(st.index);
    if (!STEP_KINDS.has(st.kind)) fail(`step ${st.id}: unknown kind ${st.kind}`);
    if (st.scenario_ref != null && !scenarioIds.has(st.scenario_ref)) fail(`step ${st.id}: unknown scenario_ref ${st.scenario_ref}`);
    if (!bilingualOk(st.narration)) fail(`step ${st.id}: narration must be bilingual`);
    for (const id of st.focus_entities ?? []) if (!entityIds.has(id)) fail(`step ${st.id}: focus unknown entity ${id}`);
    if (st.layout_intent != null && !LAYOUT_INTENTS.has(st.layout_intent)) fail(`step ${st.id}: unknown layout_intent ${st.layout_intent}`);
  }

  // forbidden semantic collapses in any rendered copy
  const copyBlocks = [];
  const pushBi = (b) => { if (b) { copyBlocks.push(b.en, b.zh); } };
  pushBi(story.title); pushBi(story.teaches?.proves); pushBi(story.teaches?.does_not_prove);
  for (const sc of story.scenarios) { pushBi(sc.label); pushBi(sc.note); }
  for (const st of story.steps) pushBi(st.narration);
  for (const block of copyBlocks) {
    const hits = findForbiddenEquivalence(block);
    if (hits.length) fail(`forbidden equivalence phrase in copy: ${hits.join(", ")}`);
  }
  return true;
}

// ── canonical, target-INDEPENDENT semantic projection ─────────────────────────
// Sorted keys + sorted collections so the bytes (and the hash) are stable and identical across
// every target. Advisory fields (layout_intent, references) are intentionally excluded.
function sortKeysDeep(o) {
  if (Array.isArray(o)) return o.map(sortKeysDeep);
  if (o && typeof o === "object") return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeysDeep(o[k])]));
  return o;
}
const sortedStatusMap = (m) => Object.fromEntries(Object.keys(m ?? {}).sort().map((k) => [k, m[k]]));

export function canonicalSemantic(story) {
  const entities = [...story.entities]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => ({ id: e.id, kind: e.kind, sequence: e.sequence, label: e.label, a11y: e.a11y, trust_dimension: e.trust_dimension ?? null, evidence_ref: e.evidence_ref ?? null }));
  const relations = [...(story.relations ?? [])]
    .sort((a, b) => (a.type + a.from + a.to + a.id).localeCompare(b.type + b.from + b.to + b.id))
    .map((r) => ({ id: r.id, type: r.type, from: r.from, to: r.to }));
  const scenarios = [...story.scenarios]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((sc) => ({
      id: sc.id, label: sc.label,
      first_failure: sc.first_failure ?? null,
      affected_downstream: [...(sc.affected_downstream ?? [])].sort(),
      entity_status: sortedStatusMap(sc.entity_status),
      dimension_status: sortedStatusMap(sc.dimension_status),
      note: sc.note ?? null,
    }));
  const steps = [...story.steps]
    .sort((a, b) => a.index - b.index)
    .map((st) => ({ id: st.id, index: st.index, kind: st.kind, scenario_ref: st.scenario_ref ?? null, narration: st.narration, focus_entities: [...(st.focus_entities ?? [])].sort(), reveal_upto_sequence: st.reveal_upto_sequence ?? null }));
  const semantic = {
    vocabulary_version: VOCABULARY_VERSION,
    story_version: story.story_version,
    story_id: story.story_id,
    provenance_mode: story.provenance_mode,
    title: story.title,
    teaches: story.teaches ?? null,
    trust_dimensions: [...story.trust_dimensions].sort(),
    entities, relations, scenarios, steps,
  };
  return sortKeysDeep(semantic);
}

export function canonicalJson(obj) { return JSON.stringify(obj); }
export function semanticHash(story) { return createHash("sha256").update(canonicalJson(canonicalSemantic(story))).digest("hex"); }

// ── target-specific render hints (advisory; NOT hashed) ───────────────────────
function statusShapeTable() {
  return Object.fromEntries(Object.keys(SEMANTIC_STATUS).map((s) => {
    const m = statusMeta(s);
    return [s, { text_en: m.text_en, text_zh: m.text_zh, shape: m.shape, icon: m.icon, severity: m.severity }];
  }));
}
function renderHints(story, target) {
  if (target === "snapshot") return null;
  const layoutPerStep = story.steps.map((st) => ({ step: st.id, layout_intent: st.layout_intent ?? "hybrid" }));
  const common = { status_encoding: "shape+icon+label (never colour alone)", status_table: statusShapeTable(), layout_per_step: layoutPerStep };
  if (target === "html") return { ...common, surface: "self-contained-svg", dom_flow: "linear", autoplay: false };
  if (target === "threejs") return { ...common, camera: "orbit", positions: "advisory-hints-only", node_shape_by_status: true };
  if (target === "unity") return { ...common, world_plane_m: 2.0, input: "desktop-mock-behind-interface", note: "positions device-validation-pending" };
  return common;
}

// ── compile ───────────────────────────────────────────────────────────────────
export function compile(story, { target = "snapshot" } = {}) {
  if (!TARGETS.includes(target)) fail(`unknown target ${target}`);
  validateStory(story);
  const semantic = canonicalSemantic(story);
  const semantic_hash = createHash("sha256").update(canonicalJson(semantic)).digest("hex");
  return {
    compiler_version: COMPILER_VERSION,
    target,
    semantic_hash,
    semantic,
    render: renderHints(story, target),
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { target: "snapshot", validateOnly: false, input: null, output: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--target") a.target = argv[++i];
    else if (v === "--input") a.input = argv[++i];
    else if (v === "--output") a.output = argv[++i];
    else if (v === "--validate-only") a.validateOnly = true;
    else fail(`unknown arg ${v}`);
  }
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const a = parseArgs(process.argv.slice(2));
    if (!a.input) fail("--input <story.json> required");
    const raw = readFileSync(a.input, "utf8");
    if (raw.length > CAPS.bytes) fail(`input exceeds byte cap ${CAPS.bytes}`);
    const story = JSON.parse(raw);
    if (a.validateOnly) { validateStory(story); process.stdout.write(`OK ${story.story_id} valid\n`); process.exit(0); }
    const out = compile(story, { target: a.target });
    const text = JSON.stringify(out, null, 2) + "\n";
    if (a.output) { writeFileSync(a.output, text); process.stdout.write(`OK ${story.story_id} → ${a.target} semantic_hash=${out.semantic_hash}\n`); }
    else process.stdout.write(text);
    process.exit(0);
  } catch (err) {
    process.stderr.write(`COMPILE FAILED: ${err.message}\n`);
    process.exit(1);
  }
}
