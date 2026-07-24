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
// Invariants are expressed on the COLOUR FAMILY, not a literal hex, so re-shading a profile can never
// silently disable them (a hex-literal guard stops matching the moment a rendition changes).
const GREEN_FAMILY = "verification_green";
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
    if (typeof v.color_family !== "string" || !v.color_family) die(`${id} missing color_family (profile resolution needs it)`);
    if (!/[一-鿿]/.test(v.text_zh)) die(`${id} text_zh not Chinese`);
    states.push({ cat, key, id, ...v });
  }
}
// invariant guards
const greenAllowed = new Set(["status.VERIFIED", "trust_posture.TIME_ANCHORED", "tracking.TRACKED_3DOF", "tracking.TRACKED_6DOF", "capability.DEVICE_VALIDATED", "capability.PRODUCTION_READY"]);
for (const s of states) if (s.color_family === GREEN_FAMILY && !greenAllowed.has(s.id)) die(`verification-green misused by ${s.id}`);
const g = tok.governance;
if (g.APPROVAL_PRESENT.color_family === GREEN_FAMILY) die("approval shares verification green");
if (g.APPROVAL_PRESENT.icon === g.HUMAN_REVIEW_RECORDED.icon) die("review and approval alias (same icon)");
if (tok.status.FIRST_FAILURE.color_family === tok.status.DOWNSTREAM_AFFECTED.color_family && tok.status.FIRST_FAILURE.icon === tok.status.DOWNSTREAM_AFFECTED.icon) die("first-failure/downstream alias");
if (tok.tracking.SCANNING.color_family === tok.tracking.LOST.color_family) die("scanning/lost alias");

// ── visual profiles: every family every profile, and the per-state colour must be that family's
// DesktopDark rendition, so a state can never silently drift out of its own family.
const PROFILES = Object.keys(tok.visual_profiles ?? {}).sort();
if (PROFILES.length === 0) die("missing visual_profiles");
// families come from EVERY coloured entry in the source, not only the six validated categories —
// edge_type / provenance_mode also render semantic colour and must resolve per profile.
const ALL_COLOURED = [];
for (const [grp, val] of Object.entries(tok)) {
  if (grp === "$comment" || grp === "version" || grp === "visual_profiles" || typeof val !== "object") continue;
  for (const [key, e] of Object.entries(val)) {
    if (e && typeof e === "object" && typeof e.color === "string") {
      if (typeof e.color_family !== "string" || !e.color_family) die(`${grp}.${key} missing color_family`);
      ALL_COLOURED.push({ id: `${grp}.${key}`, color: e.color, color_family: e.color_family });
    }
  }
}
const FAMILIES = [...new Set(ALL_COLOURED.map((s) => s.color_family))].sort();
for (const p of PROFILES) {
  const vp = tok.visual_profiles[p];
  if (!/^#[0-9a-fA-F]{6}$/.test(vp.surface ?? "")) die(`visual_profiles.${p} bad surface`);
  if (!/^#[0-9a-fA-F]{6}$/.test(vp.disclaimer ?? "")) die(`visual_profiles.${p} bad disclaimer colour`);
  if (typeof vp.text_contrast_floor !== "number" || typeof vp.graphic_contrast_floor !== "number")
    die(`visual_profiles.${p} missing contrast floors`);
  for (const f of FAMILIES) {
    if (!/^#[0-9a-fA-F]{6}$/.test(vp.families?.[f] ?? "")) die(`visual_profiles.${p} missing/bad family ${f}`);
  }
  for (const f of Object.keys(vp.families)) if (!FAMILIES.includes(f)) die(`visual_profiles.${p} unknown family ${f}`);
}
for (const s of ALL_COLOURED) {
  const dd = tok.visual_profiles.DesktopDark.families[s.color_family];
  if (dd && dd.toLowerCase() !== s.color.toLowerCase())
    die(`${s.id} colour ${s.color} is not its family's DesktopDark rendition (${s.color_family} = ${dd})`);
}

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
  L.push("        public struct Token { public string Category, Key, Text, TextZh, Icon, Shape, ColorHex, Family, A11y, A11yZh; }");
  L.push("        public static readonly Token[] All = new Token[]");
  L.push("        {");
  for (const s of ordered) {
    L.push(`            new Token { Category="${s.cat}", Key="${esc(s.key)}", Text="${esc(s.text)}", TextZh="${esc(s.text_zh)}", Icon="${esc(s.icon)}", Shape="${esc(s.shape)}", ColorHex="${s.color}", Family="${s.color_family}", A11y="${esc(s.a11y)}", A11yZh="${esc(s.a11y_zh)}" },`);
  }
  L.push("        };");
  L.push("        public struct ProfilePalette { public string Profile, Surface, Disclaimer; public double TextFloor, GraphicFloor; public string[] FamilyKeys, FamilyColors; }");
  L.push("        public static readonly ProfilePalette[] Profiles = new ProfilePalette[]");
  L.push("        {");
  for (const pr of PROFILES) {
    const vp = tok.visual_profiles[pr];
    const fk = Object.keys(vp.families).sort();
    L.push(`            new ProfilePalette { Profile="${pr}", Surface="${vp.surface}", Disclaimer="${vp.disclaimer}", TextFloor=${vp.text_contrast_floor}, GraphicFloor=${vp.graphic_contrast_floor}, FamilyKeys=new string[]{${fk.map((k) => `"${k}"`).join(",")}}, FamilyColors=new string[]{${fk.map((k) => `"${vp.families[k]}"`).join(",")}} },`);
  }
  L.push("        };");
  L.push("        // Resolve a semantic state's colour FOR A PROFILE. An unknown profile throws — a status");
  L.push("        // renderer must never silently fall back to the DesktopDark palette (UX-01).");
  L.push("        public static string ColorFor(string category, string key, string profile)");
  L.push("        {");
  L.push("            var t = Get(category, key);");
  L.push("            var p = PaletteFor(profile);");
  L.push("            for (int i = 0; i < p.FamilyKeys.Length; i++) if (p.FamilyKeys[i] == t.Family) return p.FamilyColors[i];");
  L.push("            throw new System.ArgumentException(\"profile \" + profile + \" has no family \" + t.Family);");
  L.push("        }");
  L.push("        public static ProfilePalette PaletteFor(string profile)");
  L.push("        {");
  L.push("            foreach (var p in Profiles) if (p.Profile == profile) return p;");
  L.push("            throw new System.ArgumentException(\"unknown visual profile \" + profile);");
  L.push("        }");
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
    L.push(`  "${s.cat}.${s.key}": Object.freeze({ category: "${s.cat}", key: "${esc(s.key)}", text: "${esc(s.text)}", textZh: "${esc(s.text_zh)}", icon: "${esc(s.icon)}", shape: "${esc(s.shape)}", color: "${s.color}", family: "${esc(s.color_family)}", a11y: "${esc(s.a11y)}", a11yZh: "${esc(s.a11y_zh)}" }),`);
  }
  L.push("});");
  L.push("export const SHADOW_VISUAL_PROFILES = Object.freeze({");
  for (const p of PROFILES) {
    const vp = tok.visual_profiles[p];
    const fk = Object.keys(vp.families).sort();
    L.push(`  "${p}": Object.freeze({ surface: "${vp.surface}", disclaimer: "${vp.disclaimer}", textContrastFloor: ${vp.text_contrast_floor}, graphicContrastFloor: ${vp.graphic_contrast_floor}, families: Object.freeze({ ${fk.map((k) => `"${k}": "${vp.families[k]}"`).join(", ")} }) }),`);
  }
  L.push("});");
  L.push("// Resolve a semantic state's colour FOR A PROFILE. Throws on an unknown profile so a renderer");
  L.push("// can never silently fall back to the DesktopDark palette (UX-01).");
  L.push("export function shadowColorFor(category, key, profile) {");
  L.push("  const t = shadowToken(category, key);");
  L.push("  const p = SHADOW_VISUAL_PROFILES[profile];");
  L.push("  if (!p) throw new Error('unknown visual profile ' + profile);");
  L.push("  const c = p.families[t.family];");
  L.push("  if (!c) throw new Error('profile ' + profile + ' has no family ' + t.family);");
  L.push("  return c;");
  L.push("}");
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
  for (const p of PROFILES) {
    const vp = tok.visual_profiles[p];
    L.push(`[data-shadow-profile="${p}"] {`);
    L.push(`  --shadow-surface: ${vp.surface};`);
    L.push(`  --shadow-disclaimer: ${vp.disclaimer};`);
    for (const f of Object.keys(vp.families).sort()) L.push(`  --shadow-family-${f.replace(/_/g, "-")}: ${vp.families[f]};`);
    L.push("}");
  }
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
