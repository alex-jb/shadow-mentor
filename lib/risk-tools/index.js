// Risk-tools — JS port of Loredana C. Levitchi's orallexa.risk Python module
// (Aura Alexa BR document, 120-page institutional risk spec).
//
// Function signatures preserved verbatim so the BR document still reads as
// the source spec. Numeric semantics match the Python reference under
// numpy >= 1.24 (np.quantile linear interpolation default).
//
// Shadow's quant persona pack exposes these as Anthropic tool-use targets
// for the LBO scenario. The compliance × LBO cell currently scoring 100/100
// in the public benchmark gets these as callable tools, lifting "risk
// metrics mentioned in the prompt" to "risk metrics computed at decision
// time."
//
// Coverage today:
//   ✅ historical_var (verbatim port of Lora's numpy impl)
//   ✅ expected_shortfall (verbatim port of Lora's numpy impl)
//   ✅ concentration_limits (per BR spec)
//   ✅ sector_exposure (per BR spec)
//   ✅ correlation_matrix (Pearson, per BR spec)
//   ✅ beta_decomposition (cov/var, per BR spec)
//   ⏳ factor_exposures (multi-variable OLS — next iteration)

function returnsFromPrices(prices) {
  if (!Array.isArray(prices) || prices.length < 3) {
    throw new Error("At least three price observations are required");
  }
  for (const p of prices) {
    if (typeof p !== "number" || p <= 0 || !Number.isFinite(p)) {
      throw new Error("Prices must be positive finite numbers");
    }
  }
  const out = [];
  for (let i = 1; i < prices.length; i++) {
    out.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return out;
}

// numpy.quantile linear interpolation (default method='linear')
function quantile(arr, q) {
  if (q < 0 || q > 1) throw new Error("q must be in [0, 1]");
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function mean(arr) {
  if (arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  const m = mean(arr);
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

function covariance(a, b) {
  if (a.length !== b.length) throw new Error("Arrays must be same length");
  const ma = mean(a);
  const mb = mean(b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / a.length;
}

function pearson(a, b) {
  const cov = covariance(a, b);
  const sa = Math.sqrt(variance(a));
  const sb = Math.sqrt(variance(b));
  if (sa === 0 || sb === 0) return 0;
  return cov / (sa * sb);
}

/**
 * Historical-simulation VaR as positive loss fraction.
 * Verbatim port of orallexa.risk.historical_var.
 */
export function historical_var(prices, confidence = 0.95, horizon_days = 1) {
  if (!(confidence > 0.5 && confidence < 1.0)) {
    throw new Error("confidence must be between 0.5 and 1.0");
  }
  const returns = returnsFromPrices(prices);
  const scale = Math.sqrt(horizon_days);
  const scaled = returns.map((r) => r * scale);
  const q = quantile(scaled, 1 - confidence);
  return Math.max(0, -q);
}

/**
 * Expected Shortfall — average tail loss beyond VaR (positive fraction).
 * Verbatim port of orallexa.risk.expected_shortfall.
 */
export function expected_shortfall(prices, confidence = 0.95, horizon_days = 1) {
  const returns = returnsFromPrices(prices);
  const scale = Math.sqrt(horizon_days);
  const scaled = returns.map((r) => r * scale);
  const q = quantile(scaled, 1 - confidence);
  const tail = scaled.filter((r) => r <= q);
  if (tail.length === 0) return historical_var(prices, confidence, horizon_days);
  return Math.max(0, -mean(tail));
}

/**
 * Concentration check — flag when any single-name weight exceeds max_single.
 * Returns { passes, max_weight, breaches }.
 */
export function concentration_limits(weights, max_single = 0.20) {
  if (typeof weights !== "object" || weights === null || Array.isArray(weights)) {
    throw new Error("weights must be an object {name: weight}");
  }
  if (!(max_single > 0 && max_single <= 1)) {
    throw new Error("max_single must be in (0, 1]");
  }
  const entries = Object.entries(weights);
  let max_weight = 0;
  const breaches = [];
  for (const [name, w] of entries) {
    if (w > max_weight) max_weight = w;
    if (w > max_single) breaches.push({ name, weight: w });
  }
  return { passes: breaches.length === 0, max_weight, breaches, threshold: max_single };
}

/**
 * Sector exposure aggregation — sum weights per sector.
 * positions: [{ ticker, sector, weight }, ...]
 */
export function sector_exposure(positions) {
  if (!Array.isArray(positions)) throw new Error("positions must be an array");
  const out = {};
  for (const p of positions) {
    if (!p.sector) continue;
    out[p.sector] = (out[p.sector] ?? 0) + (p.weight ?? 0);
  }
  return out;
}

/**
 * Pairwise Pearson correlation matrix for n return series.
 * return_series: { name1: [...], name2: [...], ... }
 */
export function correlation_matrix(return_series) {
  const names = Object.keys(return_series);
  const out = {};
  for (const a of names) {
    out[a] = {};
    for (const b of names) {
      out[a][b] = a === b ? 1 : pearson(return_series[a], return_series[b]);
    }
  }
  return out;
}

/**
 * Beta + alpha decomposition vs market.
 * asset_returns, market_returns: parallel arrays of same length.
 * Returns { beta, alpha, residual_std }.
 */
export function beta_decomposition(asset_returns, market_returns) {
  if (asset_returns.length !== market_returns.length) {
    throw new Error("asset_returns and market_returns must be same length");
  }
  if (asset_returns.length < 3) {
    throw new Error("At least 3 observations required");
  }
  const var_m = variance(market_returns);
  if (var_m === 0) throw new Error("market variance is zero");
  const beta = covariance(asset_returns, market_returns) / var_m;
  const alpha = mean(asset_returns) - beta * mean(market_returns);
  const residuals = asset_returns.map((r, i) => r - (alpha + beta * market_returns[i]));
  const residual_std = Math.sqrt(variance(residuals));
  return { beta, alpha, residual_std };
}

/**
 * Anthropic tool-use definitions — pass to messages.create as `tools`.
 * Exposing these to the quant persona for the compliance × LBO cell
 * turns "risk metrics mentioned in prompt" into "risk metrics computed
 * at decision time."
 */
export const RISK_TOOL_DEFINITIONS = [
  {
    name: "historical_var",
    description: "Historical-simulation Value-at-Risk on a price series. Returns the positive loss fraction at the given confidence level over horizon_days.",
    input_schema: {
      type: "object",
      properties: {
        prices: { type: "array", items: { type: "number" }, description: "Price observations, length ≥ 3, all positive" },
        confidence: { type: "number", description: "Confidence level in (0.5, 1.0). Default 0.95" },
        horizon_days: { type: "integer", description: "Horizon in trading days. Default 1" }
      },
      required: ["prices"]
    }
  },
  {
    name: "expected_shortfall",
    description: "Expected Shortfall (Conditional VaR) — average tail loss beyond VaR. Returns positive loss fraction.",
    input_schema: {
      type: "object",
      properties: {
        prices: { type: "array", items: { type: "number" } },
        confidence: { type: "number" },
        horizon_days: { type: "integer" }
      },
      required: ["prices"]
    }
  },
  {
    name: "concentration_limits",
    description: "Single-name concentration check. Returns {passes, max_weight, breaches} given a weights map and threshold.",
    input_schema: {
      type: "object",
      properties: {
        weights: { type: "object", description: "Map of {name: weight_fraction}" },
        max_single: { type: "number", description: "Threshold; weights exceeding this trigger a breach. Default 0.20" }
      },
      required: ["weights"]
    }
  },
  {
    name: "sector_exposure",
    description: "Aggregate portfolio weights by sector.",
    input_schema: {
      type: "object",
      properties: {
        positions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              sector: { type: "string" },
              weight: { type: "number" }
            },
            required: ["sector", "weight"]
          }
        }
      },
      required: ["positions"]
    }
  },
  {
    name: "correlation_matrix",
    description: "Pairwise Pearson correlation matrix across n return series.",
    input_schema: {
      type: "object",
      properties: {
        return_series: { type: "object", description: "Map of {name: number[]}" }
      },
      required: ["return_series"]
    }
  },
  {
    name: "beta_decomposition",
    description: "Beta + alpha + residual-std decomposition vs market returns.",
    input_schema: {
      type: "object",
      properties: {
        asset_returns: { type: "array", items: { type: "number" } },
        market_returns: { type: "array", items: { type: "number" } }
      },
      required: ["asset_returns", "market_returns"]
    }
  }
];

// Dispatch table — call tool by name with parsed input object.
export const RISK_TOOL_DISPATCH = {
  historical_var: (input) => historical_var(input.prices, input.confidence, input.horizon_days),
  expected_shortfall: (input) => expected_shortfall(input.prices, input.confidence, input.horizon_days),
  concentration_limits: (input) => concentration_limits(input.weights, input.max_single),
  sector_exposure: (input) => sector_exposure(input.positions),
  correlation_matrix: (input) => correlation_matrix(input.return_series),
  beta_decomposition: (input) => beta_decomposition(input.asset_returns, input.market_returns)
};
