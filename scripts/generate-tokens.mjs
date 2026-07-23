// Canonical token code-generation bridge: design/shadow-spatial-tokens.json → deterministic runtime
// adapters for Unity C#, browser/Three.js JS, and browser CSS. The JSON is the SINGLE source; these outputs
// are generated (never hand-edited). Validates the canonical invariants and exits non-zero on any violation.
// Deterministic: sorted keys, no timestamp / username / absolute path. Run twice → byte-identical.
//   node scripts/generate-tokens.mjs           # generate
//   node scripts/generate-tokens.mjs --check    # fail if generated files are stale (CI/test guard)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_REL = "design/shadow-spatial-tokens.json";
const tok = JSON.parse(readFileSync(join(ROOT, SRC_REL), "utf8"));
const CHECK = process.argv.includes("--check");

const CATEGORIES = ["status", "governance", "trust_posture", "tracking", "interaction", "capability"];
const GREEN = "#4ade80", RED = "#ef4444", BLUE = "#3b82f6";
const die = (m) => { console.error("generate-tokens: " + m); process.exit(1); };

// ── validate ──
const seen = new Set();
const states = [];
for (const cat of CATEGORIES) {
  if (!tok[cat] || typeof tok[cat] !== "object") die(`missing category ${cat}`);
  for (const key of Object.keys(tok[cat])) {
    const v = tok[cat][key];
    const id = `${cat}.${key}`;
    if (seen.has(id)) die(`duplicate semantic key ${id}`);
    seen.add(id);
    for (const f of ["text", "text_zh", "icon", "shape", "color", "a11y", "a11y_zh"]) {
      if (typeof v[f] !== "string" || !v[f]) die(`${id} missing/empty ${f} (never colour alone; EN+ZH required)`);
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(v.color)) die(`${id} bad colour ${v.color}`);
    if (!/[一-鿿]/.test(v.text_zh)) die(`${id} text_zh not Chinese`);
    states.push({ cat, key, id, ...v });
  }
}
// invariant guards
const greenAllowed = new Set(["status.VERIFIED", "trust_posture.TIME_ANCHORED", "tracking.TRACKED_3DOF", "tracking.TRACKED_6DOF", "capability.DEVICE_VALIDATED", "capability.PRODUCTION_READY"]);
for (const s of states) if (s.color.toLowerCase() === GREEN && !greenAllowed.has(s.id)) die(`verification-green misused by ${s.id}`);
const g = tok.governance;
if (g.APPROVAL_PRESENT.color.toLowerCase() === GREEN) die("approval shares verification green");
if (g.APPROVAL_PRESENT.icon === g.HUMAN_REVIEW_RECORDED.icon) die("review and approval alias (same icon)");
if (tok.status.FIRST_FAILURE.color === tok.status.DOWNSTREAM_AFFECTED.color && tok.status.FIRST_FAILURE.icon === tok.status.DOWNSTREAM_AFFECTED.icon) die("first-failure/downstream alias");
if (tok.tracking.SCANNING.color === tok.tracking.LOST.color) die("scanning/lost alias");

// deterministic ordering: category order fixed above, keys sorted within category
const ordered = [];
for (const cat of CATEGORIES) for (const key of Object.keys(tok[cat]).sort()) ordered.push({ cat, key, ...tok[cat][key] });
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const HEADER_LINES = [
  "AUTO-GENERATED — DO NOT EDIT.",
  `Source: ${SRC_REL} (${tok.version})`,
  "Generator: scripts/generate-tokens.mjs — run it to regenerate. Deterministic; no timestamp/path.",
];

// ── C# ──
function genCs() {
  const L = [];
  L.push("// " + HEADER_LINES.join("\n// "));
  L.push("#if UNITY_2020_1_OR_NEWER");
  L.push("namespace ShadowLens.Generated");
  L.push("{");
  L.push("    // Semantic identity table generated from the canonical token source. VISUAL PROFILE overrides");
  L.push("    // (ShadowDesignTokens.Resolve) may re-shade a state, but text/icon/shape/meaning are fixed here.");
  L.push("    public static class ShadowSemanticTokens");
  L.push("    {");
  L.push("        public struct Token { public string Category, Key, Text, TextZh, Icon, Shape, ColorHex, A11y, A11yZh; }");
  L.push("        public static readonly Token[] All = new Token[]");
  L.push("        {");
  for (const s of ordered) {
    L.push(`            new Token { Category="${s.cat}", Key="${esc(s.key)}", Text="${esc(s.text)}", TextZh="${esc(s.text_zh)}", Icon="${esc(s.icon)}", Shape="${esc(s.shape)}", ColorHex="${s.color}", A11y="${esc(s.a11y)}", A11yZh="${esc(s.a11y_zh)}" },`);
  }
  L.push("        };");
  L.push("        public static Token Get(string category, string key)");
  L.push("        {");
  L.push("            foreach (var t in All) if (t.Category == category && t.Key == key) return t;");
  L.push("            throw new System.ArgumentException(\"unknown semantic token \" + category + \".\" + key);");
  L.push("        }");
  L.push("    }");
  L.push("}");
  L.push("#endif");
  return L.join("\n") + "\n";
}

// ── JS ──
function genJs() {
  const L = [];
  L.push("// " + HEADER_LINES.join("\n// "));
  L.push("// Frozen semantic token table for browser + Three.js. Import and read; do not mutate.");
  L.push("export const SHADOW_SEMANTIC_TOKENS = Object.freeze({");
  for (const s of ordered) {
    L.push(`  "${s.cat}.${s.key}": Object.freeze({ category: "${s.cat}", key: "${esc(s.key)}", text: "${esc(s.text)}", textZh: "${esc(s.text_zh)}", icon: "${esc(s.icon)}", shape: "${esc(s.shape)}", color: "${s.color}", a11y: "${esc(s.a11y)}", a11yZh: "${esc(s.a11y_zh)}" }),`);
  }
  L.push("});");
  L.push("export function shadowToken(category, key) {");
  L.push("  const t = SHADOW_SEMANTIC_TOKENS[category + '.' + key];");
  L.push("  if (!t) throw new Error('unknown semantic token ' + category + '.' + key);");
  L.push("  return t;");
  L.push("}");
  return L.join("\n") + "\n";
}

// ── CSS ──
function genCss() {
  const L = [];
  L.push("/* " + HEADER_LINES.join(" | ") + " */");
  L.push(":root {");
  for (const s of ordered) {
    const varname = `--shadow-${s.cat.replace(/_/g, "-")}-${s.key.toLowerCase().replace(/_/g, "-")}`;
    L.push(`  ${varname}-color: ${s.color};`);
  }
  L.push("}");
  return L.join("\n") + "\n";
}

// Deterministic Unity .meta so import is stable across machines (fixed GUID — never random,
// no timestamp). Unity tracks .meta in this repo (160 committed), so the generated .cs needs one.
function genCsMeta() {
  return [
    "fileFormatVersion: 2",
    "guid: 5ad0c7e2f1b34c0a9d6e8f2b1a3c4d5e", // fixed GUID for the generated semantic-token table
    "MonoImporter:",
    "  externalObjects: {}",
    "  serializedVersion: 2",
    "  defaultReferences: []",
    "  executionOrder: 0",
    "  icon: {instanceID: 0}",
    "  userData: ",
    "  assetBundleName: ",
    "  assetBundleVariant: ",
  ].join("\n") + "\n";
}

function genFolderMeta() {
  return [
    "fileFormatVersion: 2",
    "guid: 4c9b6d1e0a2f3b4c5d6e7f8a9b0c1d2e", // fixed GUID for the Generated/ folder
    "folderAsset: yes",
    "DefaultImporter:",
    "  externalObjects: {}",
    "  userData: ",
    "  assetBundleName: ",
    "  assetBundleVariant: ",
  ].join("\n") + "\n";
}

const outputs = [
  ["apps/shadow-lens/unity/Assets/ShadowLens/Generated.meta", genFolderMeta()],
  ["apps/shadow-lens/unity/Assets/ShadowLens/Generated/ShadowSemanticTokens.Generated.cs", genCs()],
  ["apps/shadow-lens/unity/Assets/ShadowLens/Generated/ShadowSemanticTokens.Generated.cs.meta", genCsMeta()],
  ["generated/shadow-semantic-tokens.generated.js", genJs()],
  ["generated/shadow-semantic-tokens.generated.css", genCss()],
];

let stale = 0;
for (const [rel, content] of outputs) {
  const p = join(ROOT, rel);
  if (CHECK) {
    let cur = ""; try { cur = readFileSync(p, "utf8"); } catch { cur = "<missing>"; }
    if (cur !== content) { console.error("STALE: " + rel + " does not match the canonical source — run scripts/generate-tokens.mjs"); stale++; }
  } else {
    writeFileSync(p, content);
    console.log("wrote", rel);
  }
}
if (CHECK && stale) process.exit(1);
if (CHECK) console.log("all generated token files are up to date");
if (!CHECK) console.log(`generated ${outputs.length} adapters from ${ordered.length} semantic states`);
