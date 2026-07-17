// demos/spatial-finance/providers/portfolio-fixture.mjs
// The canonical demo portfolio — the single data contract every spatial-finance
// view reads. index.html inlines a byte-equivalent copy of this object (it runs
// offline as a classic script and can't import); test/spatial-finance-provider.test.js
// guards the two against drift. To wire real data, implement OpenBBMarketDataProvider
// to return an object of THIS shape (see providers/README.md).
export const PORTFOLIO = {
  horizon_years: 5, projected_gain_pct: 41, confidence: 0.84,
  one_liner: "AI leaders overweight via a capped conviction tilt, hedged by lower-beta names; concentration risk elevated. We compete on auditability and calibration, not on beating the market.",
  positions: [
    { t: "NVDA", name: "NVIDIA", w: .16, base: .10, tilt: .06, rc: .13, risk: "HIGH", vol: .42, ret: .62, conf: .72, action: "hold", bull: .95, bear: -.28 },
    { t: "MSFT", name: "Microsoft", w: .13, base: .13, tilt: 0, rc: .09, risk: "MED", vol: .26, ret: .34, conf: .80, action: "hold", bull: .55, bear: -.12 },
    { t: "AAPL", name: "Apple", w: .12, base: .13, tilt: -.01, rc: .09, risk: "MED", vol: .24, ret: .30, conf: .81, action: "hold", bull: .50, bear: -.10 },
    { t: "GOOGL", name: "Alphabet", w: .11, base: .11, tilt: 0, rc: .10, risk: "MED", vol: .28, ret: .36, conf: .78, action: "hold", bull: .58, bear: -.14 },
    { t: "AMZN", name: "Amazon", w: .10, base: .10, tilt: 0, rc: .10, risk: "MED", vol: .30, ret: .40, conf: .75, action: "hold", bull: .66, bear: -.18 },
    { t: "META", name: "Meta", w: .09, base: .09, tilt: 0, rc: .10, risk: "MED", vol: .33, ret: .44, conf: .73, action: "hold", bull: .72, bear: -.22 },
    { t: "AVGO", name: "Broadcom", w: .08, base: .08, tilt: 0, rc: .10, risk: "HIGH", vol: .36, ret: .50, conf: .70, action: "hold", bull: .80, bear: -.24 },
    { t: "RKLB", name: "Rocket Lab (SpaceX proxy)", w: .07, base: .05, tilt: .02, rc: .11, risk: "HIGH", vol: .58, ret: .88, conf: .55, action: "hold", bull: 1.6, bear: -.45 },
    { t: "PLTR", name: "Palantir", w: .07, base: .06, tilt: .01, rc: .10, risk: "HIGH", vol: .52, ret: .70, conf: .60, action: "trim", bull: 1.2, bear: -.4 },
    { t: "TSLA", name: "Tesla", w: .07, base: .09, tilt: -.02, rc: .10, risk: "HIGH", vol: .55, ret: .55, conf: .52, action: "trim", bull: 1.1, bear: -.5 },
  ],
  risks: [
    { label: "Concentration (top-3 = 41%)", lvl: "HIGH", by: "Risk Agent", conf: .88, src: "holdings", upd: "18:42" },
    { label: "AI-capex cycle drawdown", lvl: "MED", by: "Macro Agent", conf: .71, src: "market_data_api", upd: "18:41" },
    { label: "Regulatory (antitrust)", lvl: "LOW", by: "Compliance Agent", conf: .66, src: "news", upd: "18:40" },
  ],
  agents: [
    { name: "Fundamentals", stance: "bullish", conf: .86, note: "AI-leader revenue momentum intact" },
    { name: "Risk", stance: "cautious", conf: .88, note: "concentration + high-vol tail names" },
    { name: "Macro", stance: "neutral", conf: .70, note: "rate path balanced, capex cycle mid" },
    { name: "Compliance", stance: "no issue", conf: .92, note: "no adverse-action / suitability flag" },
    { name: "Technical", stance: "positive", conf: .74, note: "momentum positive, breadth narrowing" },
  ],
};
