// demos/spatial-finance/providers/provider.mjs
// The market-data provider boundary the docs describe — now real, not just prose.
// Every spatial-finance view reads one object (the PORTFOLIO contract below); a
// provider's getPortfolio() returns an object of that shape. Swap providers with
// one factory call; the views never change.
//
//   const provider = await getProvider("mock");     // or "openbb"
//   const portfolio = await provider.getPortfolio();
//
// A MarketDataProvider implements:
//   name: string
//   async getPortfolio(): Promise<Portfolio>   // conforms to the contract

/** The de-facto data contract every view reads. Keep OpenBB output mapped onto this. */
export const PORTFOLIO_CONTRACT = {
  horizon_years: "number", projected_gain_pct: "number", confidence: "0..1",
  one_liner: "string",
  positions: "Array<{ t, name, w, base, tilt, rc, risk, vol, ret, conf, action, bull, bear }>",
  risks: "Array<{ label, lvl, by, conf, src, upd }>",
  agents: "Array<{ name, stance, conf, note }>",
};

/** Returns a list of human-readable problems; empty array = valid. */
export function validatePortfolio(p) {
  const errs = [];
  if (!p || typeof p !== "object") return ["portfolio is not an object"];
  for (const k of ["horizon_years", "projected_gain_pct", "confidence", "one_liner", "positions", "risks", "agents"]) {
    if (!(k in p)) errs.push(`missing field: ${k}`);
  }
  if (typeof p.confidence === "number" && (p.confidence < 0 || p.confidence > 1)) errs.push("confidence must be 0..1");
  if (Array.isArray(p.positions)) {
    if (!p.positions.length) errs.push("positions is empty");
    for (const [i, pos] of p.positions.entries()) {
      for (const f of ["t", "name", "w", "risk", "vol", "ret", "conf", "action", "bull", "bear"]) {
        if (!(f in pos)) errs.push(`positions[${i}] missing ${f}`);
      }
    }
    const sum = p.positions.reduce((a, x) => a + (x.w || 0), 0);
    if (Math.abs(sum - 1) > 0.02) errs.push(`weights sum to ${sum.toFixed(3)}, expected ~1.0`);
  } else errs.push("positions is not an array");
  return errs;
}

/** Factory. Dynamic import so selecting "mock" never loads the OpenBB path. */
export async function getProvider(name = process.env.SF_PROVIDER || "mock") {
  if (name === "mock") return new (await import("./mock-provider.mjs")).MockMarketDataProvider();
  if (name === "openbb") return new (await import("./openbb-provider.mjs")).OpenBBMarketDataProvider();
  throw new Error(`unknown market-data provider "${name}" — use "mock" or "openbb"`);
}
