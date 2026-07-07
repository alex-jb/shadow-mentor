// Shadow Trader Pack — types (v0.1 scaffold, 2026-07-07)
//
// Byte-identical wire format to Orallexa (Python) so cross-language
// attestation stays valid across the banking and trading verticals.
//
// See lib/personas/trader-pack/README.md for the full port strategy.

/**
 * A single trading voice's contribution to the debate.
 *
 * @typedef {Object} TradingVoice
 * @property {string} voice
 *   One of "Bull", "Bear", "Judge", "Critic", "Polyseer", or "Risk Sizer".
 * @property {"BUY"|"SELL"|"WAIT"} verdict
 *   The three-verdict enum used by Orallexa (mirrors banking approve/escalate/block).
 * @property {number} confidence
 *   0.0 to 1.0; the confidence-weighted-verdict aggregator uses this.
 * @property {string} rationale
 *   Short paragraph with regulatory-anchor citations if applicable (Reg BI,
 *   FINRA 2111, MiFID II best-execution).
 * @property {string[]} adverse_action_codes
 *   Empty for trading (no consumer adverse-action codes apply). Kept as
 *   empty array for wire-format symmetry with banking side.
 * @property {Object} metrics
 *   Free-form dict of raw signals (VaR, ES, correlation, factor loadings).
 */

/**
 * Input to run_trading_council(). Mirrors banking-side normalizeLoan()
 * but for a trade proposal instead of a loan.
 *
 * @typedef {Object} TradingDebateInput
 * @property {string} ticker
 * @property {number} price
 * @property {number} spread_bps
 * @property {"long"|"short"|"no_op"} initial_direction
 *   The proposed trade direction — the council debates whether to confirm.
 * @property {number} bankroll_usd
 * @property {number[]} recent_returns
 *   Trailing daily returns for VaR / volatility context.
 * @property {string} sector
 * @property {Object} macro_context
 *   Optional regime signals (VIX, yield curve, sector flows).
 */

/**
 * Output of run_trading_council(). Mirrors banking runLoanCouncil().
 *
 * @typedef {Object} TradingDebateOutput
 * @property {TradingVoice[]} voices
 * @property {"BUY"|"SELL"|"WAIT"} verdict
 *   Deterministic resolver: ANY WAIT → WAIT (conservative); ANY SELL → SELL;
 *   ALL BUY → BUY. Same conservatism as banking-side block > escalate > approve.
 * @property {Object} risk_packet
 *   Portfolio-level VaR + ES + concentration + sector exposure.
 * @property {string} attestation_signing_payload
 *   Pipe-delimited byte-identical to Orallexa side. See README § "Cross-language
 *   attestation invariant".
 * @property {string[]} adverse_action_codes
 *   Always empty for trading — kept for wire-format symmetry.
 */

/**
 * Input to size_position() — direct port of Orallexa v1.2.0.
 *
 * @typedef {Object} TraderRiskSizerInput
 * @property {"long"|"short"|"no_op"} direction
 * @property {number} directional_confidence
 * @property {number} bankroll_usd
 * @property {"low"|"medium"|"high"} volatility_regime
 * @property {number} kelly_p_win
 * @property {number} kelly_avg_win_pct
 * @property {number} kelly_avg_loss_pct
 * @property {number} [current_drawdown_pct]
 * @property {number} [max_kelly_cap]
 */

/**
 * Output of size_position() — mirrors Orallexa RiskSizerOutput.
 *
 * @typedef {Object} TraderRiskSizerOutput
 * @property {"Risk Sizer"} voice
 * @property {"fund"|"skip"} verdict
 * @property {number|null} position_usd
 * @property {number|null} kelly_notional
 * @property {number} volatility_scalar
 * @property {string} rationale
 * @property {Object} metrics
 */

// No runtime exports — this is a types-only module.
export const _TYPES_VERSION = "trader-pack/v0.1.0";
