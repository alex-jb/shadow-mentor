// test/spatial-finance-provider.test.js
// The spatial-finance market-data provider boundary: the mock returns a valid
// portfolio, the OpenBB provider is an honest AGPL-isolated stub, the factory
// routes, and — the load-bearing guard — the offline fixture stays in sync with
// the copy index.html inlines (they can't import each other, so a test must).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PORTFOLIO } from "../demos/spatial-finance/providers/portfolio-fixture.mjs";
import { validatePortfolio, getProvider } from "../demos/spatial-finance/providers/provider.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the fixture conforms to the PORTFOLIO contract", () => {
  assert.deepEqual(validatePortfolio(PORTFOLIO), []);
});

test("MockMarketDataProvider returns a valid portfolio with weights summing ~1.0", async () => {
  const provider = await getProvider("mock");
  assert.equal(provider.name, "mock");
  const p = await provider.getPortfolio();
  assert.deepEqual(validatePortfolio(p), []);
  const sum = p.positions.reduce((a, x) => a + x.w, 0);
  assert.ok(Math.abs(sum - 1) < 0.02, `weights sum ${sum}`);
  // returns a copy — mutating it must not affect the shared fixture
  p.positions[0].w = 999;
  assert.notEqual(PORTFOLIO.positions[0].w, 999);
});

test("OpenBBMarketDataProvider constructs but getPortfolio() throws an AGPL-isolated stub error", async () => {
  const provider = await getProvider("openbb");
  assert.equal(provider.name, "openbb");
  await assert.rejects(() => provider.getPortfolio(), /AGPL|not implemented/i);
});

test("the factory rejects unknown providers", async () => {
  await assert.rejects(() => getProvider("bloomberg"), /unknown market-data provider/);
});

test("index.html's inline PORTFOLIO stays in sync with the fixture (no drift)", () => {
  const html = readFileSync(resolve(ROOT, "demos/spatial-finance/index.html"), "utf8");
  // headline numbers
  assert.match(html, new RegExp(`projected_gain_pct:\\s*${PORTFOLIO.projected_gain_pct}`), "projected_gain_pct drifted");
  assert.match(html, new RegExp(`confidence:\\s*${PORTFOLIO.confidence}`), "confidence drifted");
  // every position: ticker present, and its inline weight equals the fixture
  // weight NUMERICALLY (compare parsed numbers, not string forms — .10 === 0.1)
  for (const pos of PORTFOLIO.positions) {
    const m = html.match(new RegExp(`t:"${pos.t}"[^}]*?w:\\s*(-?\\.?\\d[\\d.]*)`));
    assert.ok(m, `inline PORTFOLIO missing position ${pos.t}`);
    assert.equal(parseFloat(m[1]), pos.w, `inline weight for ${pos.t} drifted (${m[1]} vs ${pos.w})`);
  }
});
