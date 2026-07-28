// UX-01 / UX-05 / UX-09 acceptance: semantic status colour must stay readable in EVERY visual profile.
// The defect this pins is arithmetic — a status colour that ignores the active profile falls to
// 1.03:1 on the bright surface, and status IS the semantic payload of an audit workspace.
// Contrast uses the WCAG 2.x relative-luminance formula over linearised sRGB; the surface is the
// profile's own token, never a generic black/white. No PNG is compared.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SHADOW_SEMANTIC_TOKENS, SHADOW_VISUAL_PROFILES, shadowColorFor, shadowToken }
  from "../generated/shadow-semantic-tokens.generated.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = JSON.parse(readFileSync(join(ROOT, "design/shadow-spatial-tokens.json"), "utf8"));

// ── WCAG 2.x ───────────────────────────────────────────────────────────────────────────────────
const chan = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}
export function contrast(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const round2 = (n) => Math.round(n * 100) / 100;
const why = (o) => `profile=${o.profile} token=${o.token} family=${o.family} fg=${o.fg} bg=${o.bg} ` +
  `Lfg=${luminance(o.fg).toFixed(4)} Lbg=${luminance(o.bg).toFixed(4)} ratio=${round2(contrast(o.fg, o.bg))} required=${o.required}`;

const PROFILES = Object.keys(SHADOW_VISUAL_PROFILES).sort();
const GRAPHIC_ONLY = new Set(["edge_muted"]);           // 3D edges are non-text indicators
const surfacesOf = (p) => {
  const vp = SHADOW_VISUAL_PROFILES[p];
  const s = [vp.surface];
  const cap = SRC.visual_profiles[p].capture_surface;   // the capture rig clears to its own colour
  if (cap && cap !== vp.surface) s.push(cap);
  return s;
};

test("known WCAG reference pairs — the contrast function itself is right", () => {
  assert.equal(round2(contrast("#ffffff", "#000000")), 21);
  assert.equal(round2(contrast("#000000", "#000000")), 1);
  assert.equal(round2(contrast("#777777", "#ffffff")), 4.48); // the classic 4.5-boundary grey
});

// ── A. token schema ────────────────────────────────────────────────────────────────────────────
test("every visual profile defines every colour family exactly once", () => {
  const families = [...new Set(Object.values(SHADOW_SEMANTIC_TOKENS).map((t) => t.family))].sort();
  assert.ok(families.length > 0);
  for (const p of PROFILES) {
    const fam = SHADOW_VISUAL_PROFILES[p].families;
    for (const f of families) assert.ok(fam[f], `profile ${p} is missing family ${f}`);
    assert.equal(Object.keys(fam).length, new Set(Object.keys(fam)).size, `duplicate family key in ${p}`);
    assert.match(SHADOW_VISUAL_PROFILES[p].surface, /^#[0-9a-fA-F]{6}$/);
    assert.match(SHADOW_VISUAL_PROFILES[p].disclaimer, /^#[0-9a-fA-F]{6}$/);
  }
});

test("every Unity ShadowVisualProfile enum member has a palette", () => {
  // A profile the enum can select but the tokens do not define would throw at render time.
  const cs = readFileSync(join(ROOT, "apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowDesignTokens.cs"), "utf8");
  const block = cs.slice(cs.indexOf("enum ShadowVisualProfile"));
  const members = [...block.slice(0, block.indexOf("}")).matchAll(/^\s{12}([A-Za-z]+),/gm)].map((m) => m[1]);
  assert.ok(members.length >= 5, "failed to parse the profile enum");
  for (const m of members) assert.ok(SHADOW_VISUAL_PROFILES[m], `enum profile ${m} has no token palette`);
});

test("a state's canonical colour is its family's DesktopDark rendition", () => {
  for (const t of Object.values(SHADOW_SEMANTIC_TOKENS)) {
    assert.equal(t.color.toLowerCase(), SHADOW_VISUAL_PROFILES.DesktopDark.families[t.family].toLowerCase(),
      `${t.category}.${t.key} drifted out of family ${t.family}`);
  }
});

// ── B. resolver behaviour ──────────────────────────────────────────────────────────────────────
test("the same status resolves differently per profile — no silent DesktopDark fallback", () => {
  const dark = shadowColorFor("status", "VERIFIED", "DesktopDark");
  const ost = shadowColorFor("status", "VERIFIED", "XrealOstBright");
  const a11y = shadowColorFor("status", "VERIFIED", "AccessibilityHighContrast");
  assert.notEqual(ost, dark, "OST resolved through the DesktopDark palette — this is UX-01");
  assert.notEqual(a11y, dark, "AccessibilityHighContrast resolved through DesktopDark — this is UX-05");
  assert.equal(dark, shadowToken("status", "VERIFIED").color);
});

test("an unknown profile throws rather than falling back", () => {
  assert.throws(() => shadowColorFor("status", "VERIFIED", "NoSuchProfile"), /unknown visual profile/);
});

test("identity is profile-invariant — only the rendition changes", () => {
  const t = shadowToken("status", "FIRST_FAILURE");
  for (const p of PROFILES) {
    assert.equal(shadowToken("status", "FIRST_FAILURE").text, t.text);
    assert.equal(shadowToken("status", "FIRST_FAILURE").textZh, t.textZh);
    assert.equal(shadowToken("status", "FIRST_FAILURE").icon, t.icon);
    assert.match(shadowColorFor("status", "FIRST_FAILURE", p), /^#[0-9a-fA-F]{6}$/);
  }
});

// ── C. contrast ────────────────────────────────────────────────────────────────────────────────
test("every semantic state clears its profile's contrast floor on every rendered surface", () => {
  const failures = [];
  for (const p of PROFILES) {
    const vp = SHADOW_VISUAL_PROFILES[p];
    for (const t of Object.values(SHADOW_SEMANTIC_TOKENS)) {
      const fg = shadowColorFor(t.category, t.key, p);
      const required = GRAPHIC_ONLY.has(t.family) ? vp.graphicContrastFloor : vp.textContrastFloor;
      for (const bg of surfacesOf(p)) {
        if (contrast(fg, bg) < required) {
          failures.push(why({ profile: p, token: `${t.category}.${t.key}`, family: t.family, fg, bg, required }));
        }
      }
    }
  }
  assert.deepEqual(failures, [], "contrast failures:\n" + failures.join("\n"));
});

test("SIMULATED — NOT DEVICE VALIDATED clears 4.5:1 on every profile surface", () => {
  const failures = [];
  for (const p of PROFILES) {
    const fg = SHADOW_VISUAL_PROFILES[p].disclaimer;
    for (const bg of surfacesOf(p)) {
      if (contrast(fg, bg) < 4.5) failures.push(why({ profile: p, token: "disclaimer", family: "-", fg, bg, required: 4.5 }));
    }
  }
  assert.deepEqual(failures, [], "disclaimer contrast failures:\n" + failures.join("\n"));
});

test("the four originally-reported OST failures are fixed", () => {
  // 1.08 / 1.03 / 1.94 / 2.33 against #C7CCD4 — the numbers that made this a P0.
  for (const [cat, key] of [["status", "VERIFIED"], ["status", "NOT_CHECKED"], ["status", "NOT_PRESENT"], ["status", "FIRST_FAILURE"]]) {
    const fg = shadowColorFor(cat, key, "XrealOstBright");
    for (const bg of surfacesOf("XrealOstBright")) {
      assert.ok(contrast(fg, bg) >= 4.5, why({ profile: "XrealOstBright", token: `${cat}.${key}`, family: shadowToken(cat, key).family, fg, bg, required: 4.5 }));
    }
  }
});

// ── D/E. semantic separation and stability ─────────────────────────────────────────────────────
test("meaning-critical pairs stay distinguishable in every profile", () => {
  const hue = (hex) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d === 0) return 0;
    const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((x * 60) + 360) % 360;
  };
  const PAIRS = [["verification_green", "neutral_unknown"], ["warning_amber", "failure_red"],
    ["neutral_unknown", "review_grey"], ["verification_green", "warning_amber"],
    ["failure_red", "neutral_unknown"]];
  for (const p of PROFILES) {
    const f = SHADOW_VISUAL_PROFILES[p].families;
    for (const [a, b] of PAIRS) {
      const dh = Math.min(Math.abs(hue(f[a]) - hue(f[b])), 360 - Math.abs(hue(f[a]) - hue(f[b])));
      const ratio = contrast(f[a], f[b]);
      assert.ok(dh >= 25 || ratio >= 1.5,
        `${p}: ${a} (${f[a]}) and ${b} (${f[b]}) are indistinguishable — Δhue=${dh.toFixed(1)}° ratio=${round2(ratio)}`);
    }
  }
});

test("status meaning never rests on colour alone — EN + ZH text survive", () => {
  for (const t of Object.values(SHADOW_SEMANTIC_TOKENS)) {
    assert.ok(t.text && t.text.trim().length > 0, `${t.category}.${t.key} has no text`);
    assert.ok(/[一-鿿]/.test(t.textZh), `${t.category}.${t.key} has no Chinese text`);
    assert.ok(t.icon && t.shape, `${t.category}.${t.key} lost its icon/shape`);
  }
});

test("language does not affect which palette a profile selects", () => {
  // Colour resolution takes (category, key, profile) only — there is no language input, so EN and ZH
  // cannot diverge. Pinned so a future overload cannot quietly introduce a language-dependent colour.
  assert.equal(shadowColorFor.length, 3);
});
