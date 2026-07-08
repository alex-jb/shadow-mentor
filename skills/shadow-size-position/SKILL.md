---
name: shadow-size-position
description: >
  Size a trading position with FinPos discipline. Takes a direction from an
  upstream Judge (long / short / no_op), a bankroll, a volatility regime,
  and Kelly parameters — returns a fund/skip verdict with Kelly-cap-
  respecting, drawdown-adjusted position size. Never emits a direction
  (that's the Judge's job upstream). Cross-vertical wire format identical
  to the Orallexa Python engine so banking + trading audit trails share
  one schema.
version: 1.0.0
author: Alex Xiaoyu Ji
scope: shadow:council
depends_on:
  - shadow_size_position MCP tool (v1.5.15+)
  - orallexa engine/risk_sizer.py (Python source of truth)
---

# Shadow Size Position (trader-pack)

Position sizing with direction/sizing separation. Direction is an input.

## When to invoke

The user's request combines all of:

1. A stated direction — long, short, or no_op.
2. Bankroll in USD.
3. Volatility regime — low, medium, high.
4. Kelly parameters — historical win rate (0–1), average win %, average loss %.

Optional but recommended:
- `current_drawdown_pct` — will shrink position size linearly if provided.
- `max_kelly_cap` — defaults to 0.25 (25% of bankroll) if not specified.

If any of the four required inputs is missing, ask for it. Do not fabricate a Kelly p_win.

## What it does

Calls `shadow_size_position` MCP tool. Under the hood:

1. **Kelly notional** — fractional Kelly (default 0.5 = half-Kelly) computed from p_win + R:R ratio.
2. **Max cap** — hard-limits at `max_kelly_cap × bankroll`. If Kelly says 40% but cap is 25%, cap wins.
3. **Volatility scalar** — low = 1.0, medium = 0.7, high = 0.4. Multiplied into the cap-limited notional.
4. **Drawdown adjustment** — shrinks linearly toward zero as drawdown approaches max tolerable.
5. **Round to cents** — final position_usd is a real dollar amount.

Returns:

```json
{
  "voice": "Risk Sizer",
  "verdict": "fund" | "skip",
  "position_usd": 350.00,
  "kelly_notional": 500.00,
  "volatility_scalar": 0.7,
  "rationale": "Kelly=500 (p_win=0.55, R=2:1); capped at 25%=2500; volatility=medium scalar=0.70; drawdown-adjusted final=350. Direction was fixed by Judge upstream.",
  "metrics": { ... }
}
```

## The named invariants

1. **Never emits a direction.** The output has no `direction` field. `metrics.direction` echoes the input for audit only.
2. **`no_op` short-circuits to skip.** Position_usd is null. Kelly is not computed.
3. **Negative Kelly skips cleanly.** If p_win is too low relative to R:R, verdict is skip and rationale cites the specific p_win / R:R that failed break-even.
4. **Cap always wins over Kelly.** Even if half-Kelly says 40%, max_kelly_cap of 25% wins.

Contract test coverage in `test/trader-pack-risk-sizer-contract.test.js` (7 tests, mirrors Orallexa Python).

## Approval boundary

If the Judge that supplied direction had `verdict=escalate` or `verdict=block`, the sizer should not fire. The trader-pack contract puts direction upstream — no direction, no sizing. This skill assumes the caller enforces that.

## Non-goals

- Not a directional signal. Never opines on whether to buy or sell.
- Not a portfolio-level VaR or concentration limit.
- Not a broker or execution surface.
- Not a full trading system. Pairs with an upstream Judge.

## Reference

- FinPos: arXiv 2510.27251.
- `lib/personas/trader-pack/risk-sizer.js` — the JS implementation.
- Orallexa `engine/risk_sizer.py` — byte-identical Python.
