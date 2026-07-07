// Shadow Trader Pack — Risk Sizer (v0.1 direct port of Orallexa engine/risk_sizer.py)
//
// Ports the FinPos Risk Sizer voice from Python (Orallexa v1.2.0) to JS so
// Shadow's trading-mode surface can size positions in the same wire format
// as the banking-mode loan council. Contract preserved:
//
//   1. size_position() MUST NOT return a direction
//   2. Respects Kelly max-cap
//   3. Returns skip on no_op direction
//   4. Scales inversely with volatility regime
//   5. Shrinks under drawdown-adjusted Kelly
//
// Reference: FinPos (arXiv 2510.27251), Orallexa engine/risk_sizer.py.

const VOL_SCALARS = Object.freeze({
  low: 1.0,
  medium: 0.7,
  high: 0.4,
});

/**
 * Compute Kelly notional given account size + strategy stats.
 *
 * Mirrors Orallexa engine/kelly_sizing.py kelly_notional() logic (fractional
 * Kelly, drawdown-adjusted, max-cap-enforced). Returns dollars, not fraction.
 *
 * @param {{
 *   accountUsd: number,
 *   pWin: number,
 *   avgWinPct: number,
 *   avgLossPct: number,
 *   fraction?: number,
 *   maxCap?: number,
 *   currentDrawdownPct?: number,
 *   maxTolerableDrawdownPct?: number,
 * }} p
 */
function kellyNotional(p) {
  const {
    accountUsd,
    pWin,
    avgWinPct,
    avgLossPct,
    fraction = 0.5,        // half-Kelly per default
    maxCap = 0.25,         // 25% max
    currentDrawdownPct = 0,
    maxTolerableDrawdownPct = 15.0,
  } = p;

  if (pWin <= 0 || pWin >= 1 || avgWinPct <= 0 || avgLossPct <= 0) return 0;
  const R = avgWinPct / avgLossPct;
  // Full Kelly fraction of bankroll.
  const kellyFrac = pWin - (1 - pWin) / R;
  if (kellyFrac <= 0) return 0;
  let scaled = kellyFrac * fraction;
  // Drawdown adjustment: linear shrink as drawdown grows toward max tolerable.
  if (currentDrawdownPct > 0 && maxTolerableDrawdownPct > 0) {
    const ddRatio = Math.min(currentDrawdownPct / maxTolerableDrawdownPct, 1.0);
    scaled = scaled * (1 - ddRatio);
  }
  const capped = Math.min(scaled, maxCap);
  return Math.max(0, capped * accountUsd);
}

/**
 * Trader Risk Sizer voice — separates position sizing from directional reasoning.
 *
 * @param {import("./types.js").TraderRiskSizerInput} inp
 * @returns {import("./types.js").TraderRiskSizerOutput}
 */
export function sizePosition(inp) {
  // Contract test 3: no_op skips
  if (inp.direction === "no_op") {
    return {
      voice: "Risk Sizer",
      verdict: "skip",
      position_usd: null,
      kelly_notional: null,
      volatility_scalar: 1.0,
      rationale: "Judge emitted no_op; no position to size.",
      metrics: { direction: inp.direction },
    };
  }

  // Kelly notional
  const kelly = kellyNotional({
    accountUsd: inp.bankroll_usd,
    pWin: inp.kelly_p_win,
    avgWinPct: inp.kelly_avg_win_pct,
    avgLossPct: inp.kelly_avg_loss_pct,
    currentDrawdownPct: (inp.current_drawdown_pct ?? 0) <= 1
      ? (inp.current_drawdown_pct ?? 0) * 100
      : (inp.current_drawdown_pct ?? 0),
  });

  const cap = (inp.max_kelly_cap ?? 0.25) * inp.bankroll_usd;

  // Contract test 2 (negative-Kelly): skip cleanly
  if (kelly <= 0) {
    return {
      voice: "Risk Sizer",
      verdict: "skip",
      position_usd: null,
      kelly_notional: kelly,
      volatility_scalar: 1.0,
      rationale: `Kelly notional non-positive (${kelly.toFixed(2)}); p_win=${
        inp.kelly_p_win.toFixed(2)
      } does not clear break-even given avg_win=${
        (inp.kelly_avg_win_pct * 100).toFixed(2)
      }% and avg_loss=${(inp.kelly_avg_loss_pct * 100).toFixed(2)}%.`,
      metrics: { kelly_raw: kelly, cap, direction: inp.direction },
    };
  }

  const capped = Math.min(kelly, cap);
  const vs = VOL_SCALARS[inp.volatility_regime] ?? 1.0;
  const scaled = capped * vs;
  const final = Math.min(scaled, inp.bankroll_usd);

  return {
    voice: "Risk Sizer",
    verdict: "fund",
    position_usd: Math.round(final * 100) / 100,
    kelly_notional: Math.round(kelly * 100) / 100,
    volatility_scalar: vs,
    rationale: `Kelly=${kelly.toFixed(2)} (p_win=${
      inp.kelly_p_win.toFixed(2)
    }, avg_win/avg_loss=${(inp.kelly_avg_win_pct * 100).toFixed(2)}%/${
      (inp.kelly_avg_loss_pct * 100).toFixed(2)
    }%); capped at ${((inp.max_kelly_cap ?? 0.25) * 100).toFixed(0)}%=${
      cap.toFixed(2)
    }; volatility=${inp.volatility_regime} scalar=${vs.toFixed(
      2,
    )}; drawdown-adjusted final=${final.toFixed(2)}. Direction was fixed by Judge upstream.`,
    metrics: {
      kelly_raw: kelly,
      cap,
      vol_scalar: vs,
      drawdown_pct: inp.current_drawdown_pct ?? 0,
      direction: inp.direction,
    },
  };
}

export { kellyNotional, VOL_SCALARS };
