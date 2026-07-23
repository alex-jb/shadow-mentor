// Token code-generation guards. The canonical JSON (design/shadow-spatial-tokens.json) is the SINGLE source;
// scripts/generate-tokens.mjs emits Unity C#, JS and CSS adapters. These tests prove the committed generated
// files match the canonical source (stale detection), are deterministic + leak-free, and cover every
// semantic key with no extras and full EN/ZH.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SHADOW_SEMANTIC_TOKENS } from "../generated/shadow-semantic-tokens.generated.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tok = JSON.parse(readFileSync(join(ROOT, "design", "shadow-spatial-tokens.json"), "utf8"));
const CATEGORIES = ["status", "governance", "trust_posture", "tracking", "interaction", "capability"];
const GEN = {
  cs: readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Generated/ShadowSemanticTokens.Generated.cs"), "utf8"),
  js: readFileSync(join(ROOT, "generated/shadow-semantic-tokens.generated.js"), "utf8"),
  css: readFileSync(join(ROOT, "generated/shadow-semantic-tokens.generated.css"), "utf8"),
};

test("STALE-GENERATED-FILES-DETECTED: committed generated files match the canonical source (--check exits 0)", () => {
  // if this throws, the generated files are stale — run `node scripts/generate-tokens.mjs`
  execFileSync("node", ["scripts/generate-tokens.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
});

test("CODEGEN-DETERMINISTIC: regenerating produces byte-identical output (no diff)", () => {
  const before = { ...GEN };
  execFileSync("node", ["scripts/generate-tokens.mjs"], { cwd: ROOT, stdio: "pipe" });
  for (const [k, rel] of [["cs", "apps/shadow-lens/unity/Assets/ShadowLens/Generated/ShadowSemanticTokens.Generated.cs"], ["js", "generated/shadow-semantic-tokens.generated.js"], ["css", "generated/shadow-semantic-tokens.generated.css"]]) {
    assert.equal(readFileSync(join(ROOT, rel), "utf8"), before[k], `${k} not deterministic`);
  }
});

test("generated files carry the generated-warning + canonical source + no timestamp/username/abs-path", () => {
  for (const [k, s] of Object.entries(GEN)) {
    assert.match(s, /AUTO-GENERATED/, `${k} missing generated warning`);
    assert.match(s, /design\/shadow-spatial-tokens\.json/, `${k} missing canonical source path`);
    assert.match(s, /shadow-spatial-tokens\/2/, `${k} missing schema version`);
    assert.doesNotMatch(s, /\/Users\/|\/home\/|C:\\\\/, `${k} contains an absolute path`);
    assert.doesNotMatch(s, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, `${k} contains a timestamp`);
  }
});

test("UNITY/BROWSER-TOKENS-GENERATED: JS adapter covers every canonical key, no extras, values match", () => {
  const canonical = new Set();
  for (const cat of CATEGORIES) for (const key of Object.keys(tok[cat])) canonical.add(`${cat}.${key}`);
  const generated = new Set(Object.keys(SHADOW_SEMANTIC_TOKENS));
  assert.deepEqual([...generated].sort(), [...canonical].sort(), "generated JS keys must equal canonical keys exactly (no missing, no extra)");
  // spot-check values round-trip
  for (const cat of CATEGORIES) for (const [key, v] of Object.entries(tok[cat])) {
    const g = SHADOW_SEMANTIC_TOKENS[`${cat}.${key}`];
    assert.equal(g.color, v.color); assert.equal(g.text, v.text); assert.equal(g.textZh, v.text_zh);
    assert.equal(g.icon, v.icon); assert.equal(g.shape, v.shape);
    assert.ok(g.a11y && g.a11yZh, `${cat}.${key} missing a11y in generated`);
  }
});

test("C# + CSS adapters represent every semantic key", () => {
  for (const cat of CATEGORIES) for (const key of Object.keys(tok[cat])) {
    assert.ok(GEN.cs.includes(`Key="${key}"`), `C# missing ${cat}.${key}`);
    const varname = `--shadow-${cat.replace(/_/g, "-")}-${key.toLowerCase().replace(/_/g, "-")}-color`;
    assert.ok(GEN.css.includes(varname), `CSS missing ${varname}`);
  }
});

test("ENGLISH-CHINESE-PARITY: every generated token has non-empty EN + Chinese labels", () => {
  for (const [id, t] of Object.entries(SHADOW_SEMANTIC_TOKENS)) {
    assert.ok(t.text && t.text.length, `${id} empty EN text`);
    assert.ok(/[一-鿿]/.test(t.textZh), `${id} zh label not Chinese`);
    assert.ok(/[一-鿿]/.test(t.a11yZh), `${id} zh a11y not Chinese`);
  }
});
