// Every committed Shadow explainer animation must be self-contained (no external network / CDN /
// third-party code — so no CC-NC-ND risk and no runtime dependency), CSP-safe, bilingual, honest
// (integrity ≠ correctness), and accessible (reduced-motion). Host-testable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../apps/shadow-lens/explainers");
const htmls = readdirSync(DIR).filter((f) => f.endsWith(".html"));

test("there is at least one committed explainer (the reference)", () => {
  assert.ok(htmls.includes("audit-chain.html"), "audit-chain.html reference expected");
});

for (const f of htmls) {
  const H = readFileSync(join(DIR, f), "utf8");

  test(`${f}: self-contained — no external script/link/fetch/CDN, no eval`, () => {
    assert.equal(/<script[^>]+src\s*=/.test(H), false, "no external <script src>");
    assert.equal(/<link[^>]+href\s*=\s*["']https?:/.test(H), false, "no external stylesheet/font");
    assert.equal(/fetch\(|XMLHttpRequest|import\s+.*https?:|new WebSocket/.test(H), false, "no network");
    assert.equal(/[^.\w]eval\s*\(|new Function\s*\(/.test(H), false, "no eval/Function");
    assert.equal(/unpkg|cdn|jsdelivr|googleapis|fonts\./i.test(H), false, "no CDN reference");
  });

  test(`${f}: CSP present + default-src none`, () => {
    assert.match(H, /Content-Security-Policy/);
    assert.match(H, /default-src 'none'/);
  });

  test(`${f}: bilingual EN + 简体中文 + reduced-motion`, () => {
    assert.match(H, /中文|简体/);            // has Chinese
    assert.ok(/lang-zh|zh-CN|zh:/.test(H), "has a zh path");
    assert.match(H, /prefers-reduced-motion|reduced.motion|data-reduce/i);
  });

  test(`${f}: honest — integrity not correctness, status not colour-only`, () => {
    assert.match(H, /integrity/i);
    assert.ok(/not.*correct|NOT judged|不判断|不证明决策正确/i.test(H), "must state integrity ≠ correctness");
    // status carries a text label, not colour alone
    assert.ok(/VERIFIED|已验证|TAMPERED|已篡改|NOT VERIFIED|未验证/.test(H), "status has text labels");
  });
}
