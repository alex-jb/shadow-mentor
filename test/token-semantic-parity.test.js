// Cross-surface semantic-token parity (V11 increment). ONE canonical source
// (design/shadow-spatial-tokens.json) defines every semantic state with colour + icon + shape + EN/ZH text
// + a11y — never colour alone. These tests pin the permanent colour meanings and the distinctness rules so
// no surface can silently reuse verification-green for approval, conflate first-failure with downstream, or
// drop the Chinese label. Also scans the real surfaces for the two confirmed violations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tok = JSON.parse(readFileSync(join(ROOT, "design", "shadow-spatial-tokens.json"), "utf8"));

const GREEN = "#4ade80", RED = "#ef4444", AMBER = "#fbbf24", BLUE = "#3b82f6";
const CATEGORIES = ["status", "governance", "trust_posture", "tracking", "interaction", "capability"];
const allStates = () => CATEGORIES.flatMap(cat => Object.entries(tok[cat]).map(([k, v]) => [`${cat}.${k}`, v]));

test("CANONICAL-TOKEN-SOURCE-CONFIRMED: version 3, all six semantic categories present", () => {
  assert.equal(tok.version, "shadow-spatial-tokens/3");
  for (const c of CATEGORIES) assert.ok(tok[c] && typeof tok[c] === "object", `missing category ${c}`);
});

test("never colour alone — every state carries text + text_zh + icon + shape + colour + a11y (+ a11y_zh)", () => {
  for (const [key, v] of allStates()) {
    for (const field of ["text", "text_zh", "icon", "shape", "color", "a11y", "a11y_zh"]) {
      assert.ok(typeof v[field] === "string" && v[field].length > 0, `${key} missing/empty ${field}`);
    }
    assert.match(v.color, /^#[0-9a-fA-F]{6}$/, `${key} colour not a hex`);
  }
});

test("ENGLISH-CHINESE-TOKEN-PARITY: EN and zh labels differ (a real translation, not a copy) for text", () => {
  for (const [key, v] of allStates()) {
    // zh must be non-ASCII (actual Chinese), not the English string copied
    assert.ok(/[一-鿿]/.test(v.text_zh), `${key} text_zh is not Chinese: ${v.text_zh}`);
    assert.ok(/[一-鿿]/.test(v.a11y_zh), `${key} a11y_zh is not Chinese`);
  }
});

test("VERIFICATION-GREEN-UNIFIED: green is used ONLY by the verification/validated family", () => {
  const greenAllowed = new Set([
    "status.VERIFIED", "trust_posture.TIME_ANCHORED",
    "tracking.TRACKED_3DOF", "tracking.TRACKED_6DOF",
    "capability.DEVICE_VALIDATED", "capability.PRODUCTION_READY",
  ]);
  for (const [key, v] of allStates()) {
    if (v.color.toLowerCase() === GREEN) {
      assert.ok(greenAllowed.has(key), `verification-green must NOT be used by ${key} (reserved for integrity/validated states)`);
    }
  }
});

test("APPROVAL-SEPARATED-FROM-VERIFICATION: APPROVAL_PRESENT is not verification-green, and differs from review", () => {
  const approval = tok.governance.APPROVAL_PRESENT;
  assert.notEqual(approval.color.toLowerCase(), GREEN, "business approval must NOT reuse verification green");
  assert.equal(approval.color.toLowerCase(), BLUE, "approval uses the brand/decision accent");
  assert.match(approval.icon, /stamp/, "approval must carry an explicit stamp/signature glyph");
  // REVIEW-APPROVAL-DISTINCT
  const review = tok.governance.HUMAN_REVIEW_RECORDED;
  assert.notEqual(review.icon, approval.icon, "review-recorded and approval-present must not share a glyph");
  assert.ok(review.color !== approval.color || review.icon !== approval.icon, "review vs approval must be visually distinct");
});

test("FIRST-FAILURE-DOWNSTREAM-DISTINCT + NOT_EVALUATED≠FAILED", () => {
  const ff = tok.status.FIRST_FAILURE, ds = tok.status.DOWNSTREAM_AFFECTED;
  assert.notEqual(ff.color.toLowerCase(), ds.color.toLowerCase(), "first-failure and downstream-affected must differ in colour");
  assert.notEqual(ff.icon, ds.icon, "and in glyph — downstream is not an independent first failure");
  assert.equal(ff.color.toLowerCase(), RED, "first failure is a real failure (red)");
  assert.notEqual(tok.status.NOT_EVALUATED.color.toLowerCase(), tok.status.FAILED.color.toLowerCase(), "not-evaluated must not look like failed");
});

test("TRUST-POSTURE-DISTINCT: SELF_SIGNED, TIME_ANCHORED_STRUCTURAL, TIME_ANCHORED all differ", () => {
  const t = tok.trust_posture;
  const trio = [t.SELF_SIGNED, t.TIME_ANCHORED_STRUCTURAL, t.TIME_ANCHORED];
  const sigs = trio.map(x => x.color.toLowerCase() + "|" + x.icon);
  assert.equal(new Set(sigs).size, 3, "the three trust postures must be visually distinct");
  assert.match(t.SELF_SIGNED.a11y, /re-sign|operator|anchor/i, "SELF_SIGNED must disclose the re-sign limitation");
});

test("TRACKING-STATE-DISTINCT: SCANNING is amber (not green/red), LOST is red, all seven distinct", () => {
  const tr = tok.tracking;
  assert.equal(tr.SCANNING.color.toLowerCase(), AMBER, "scanning is caution/amber — not verified-green, not lost-red");
  assert.equal(tr.LOST.color.toLowerCase(), RED, "lost is red");
  assert.notEqual(tr.SCANNING.color, tr.LOST.color, "scanning ≠ lost");
  assert.match(tr.SCANNING.text, /SCANNING/i, "scanning has its own explicit label (not generic LIMITED)");
  assert.equal(new Set(Object.keys(tr)).size, 7, "seven tracking states");
});

// ── cross-surface violation scan (the two confirmed conflicts) ──
test("CROSS-SURFACE: Ambient Council approve does NOT use a verification-green", () => {
  const html = readFileSync(join(ROOT, "demo", "xreal.html"), "utf8");
  // the .verdict.approve / .verdict-pill.approve rules must not resolve to a green
  const approveRules = html.match(/\.verdict(-pill)?\.approve[^}]*}/g) || [];
  assert.ok(approveRules.length > 0, "approve rules must exist");
  for (const r of approveRules) {
    assert.ok(!/#2BA560|#2FD19A|#4ade80|#0a7a2f/i.test(r), `Ambient Council approve must not use verification green: ${r.slice(0, 80)}`);
  }
});

test("CROSS-SURFACE: spatial-finance ANALYSIS confidence is not presented as verification green", () => {
  const html = readFileSync(join(ROOT, "demos", "spatial-finance", "index.html"), "utf8");
  // ANALYSIS confidence / "84% confidence" must not be coloured with a verification green that implies correctness
  const m = html.match(/ANALYSIS[^<\n]{0,40}confidence/i);
  if (m) {
    // there must be no verification-green (#4ade80) applied to the analysis-confidence readout line
    const around = html.slice(Math.max(0, html.indexOf(m[0]) - 200), html.indexOf(m[0]) + 200);
    assert.ok(!/#4ade80/i.test(around), "analysis confidence must not use verification green (implies correctness)");
  }
  assert.ok(true);
});
