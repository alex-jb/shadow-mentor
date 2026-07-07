# Shadow Trader Pack — cross-vertical persona pack

**Version:** 0.2 (Risk Sizer wired, 2026-07-07) · **Status:** live at `POST /api/deliberate` with `{"mode": "trading", "trade": {...}}`
**Origin:** Orallexa (`github.com/alex-jb/orallexa-ai-trading-agent`) — Python LangGraph 5-voice debate (Bull / Bear / Judge / Critic / Polyseer) + FinPos Risk Sizer (v1.2.0 + v1.2.1, 2026-07-07)
**Target consumer:** Shadow's `/api/deliberate` trading-mode surface adapter per `docs/strategy/roadmap-2026-2028.md` § "Three-vertical roadmap"

**Purpose:** ground zero for the Shadow trading vertical. Ports Orallexa's 5-voice debate architecture into JavaScript so a Shadow trading-mode HUD (Bloomberg-screen anchor, per v3 Ambient Council design) can deliberate on the same wire format as the banking-mode 5-voice loan council.

---

## Why this exists

Per `docs/strategy/roadmap-2026-2028.md`, the Shadow product surface layer serves three verticals: **Bank / Trading / Data-Science**. Trading and Banking share DNA (5-voice + Brier + hash-chain + reason-code dictionary) but the personas are different:

| Banking (Shadow existing) | Trading (this pack) |
|---|---|
| Credit Fundamentals | Bull (thesis-for) |
| Risk Officer | Bear (thesis-against) |
| Fair Lending Compliance | Judge (synthesis + verdict) |
| Customer Advocate | Critic (Polyseer-style meta-critique) |
| Macro Contrarian | Polyseer (multi-source verifier) |
| AML/KYC Investigator (opt-in) | Risk Sizer (FinPos-style, opt-in) |

The trading personas map 1:1 to Orallexa's Python implementation. The port strategy:

1. **JS voice ports** (this scaffold) — TypeScript / ESM modules that emit the same structured JSON output shape as the banking council.
2. **HTTP proxy path** — for expensive Sonnet-tier voices (Judge, Polyseer), the Shadow trading adapter can `fetch()` the live Orallexa deployment rather than re-implement in JS.
3. **Cross-language attestation** — same Ed25519 signing key + reason-code dictionary hash + hash-chain across banking and trading verticals so a bank's SIEM sees one uniform attestation surface.

---

## What ships in v0.2 (Risk Sizer live at the HTTP boundary)

Interfaces + Risk Sizer port + 7 pure-JS contract tests + 10 HTTP wire-format tests + live dispatch at `/api/deliberate` when `body.mode === "trading"`. No LLM calls yet. The Shadow trading-mode HUD design (v3 Ambient Council) can now hit a real endpoint end-to-end for the pure-computation trading path before we invest in the LangGraph port.

- `types.js` — JSDoc types for `TradingVoice`, `TradingDebateInput`, `TradingDebateOutput`, `TraderRiskSizerInput`, `TraderRiskSizerOutput`. Byte-identical shape to Orallexa's `models/decision.py` and `engine/risk_sizer.py` so cross-language attestation stays byte-identical.
- `risk-sizer.js` — direct JS port of `engine/risk_sizer.py:size_position()` with the same 5 contract invariants and same volatility scalars (low=1.0, med=0.7, high=0.4).
- `test/trader-pack-risk-sizer-contract.test.js` — 7 pure-JS contract tests parallel to Orallexa `tests/test_risk_sizer_contract.py`. Any drift between JS + Python breaks both sides.
- `test/api-deliberate-trading-mode.test.js` — 10 HTTP-boundary contract tests: valid dispatch, never-emit-direction over the wire, no_op → skip envelope, cap enforcement, input validation (missing trade / bad direction / bad regime / missing Kelly fields), banking-mode isolation (bad persona ignored when mode=trading), latency + attestation shape.

Not yet shipped:
- LangGraph-equivalent Bull / Bear / Judge / Critic / Polyseer JS ports (v0.3 — HTTP proxy path to Orallexa live deployment)
- Cross-vertical attestation (v0.4 — hash-chain continuity + shared reason-code dictionary)

---

## Wire-format contract

```
POST /api/deliberate
Content-Type: application/json

{
  "mode": "trading",
  "trade": {
    "direction": "long" | "short" | "no_op",
    "directional_confidence": 0.72,
    "bankroll_usd": 10000,
    "volatility_regime": "low" | "medium" | "high",
    "kelly_p_win": 0.55,
    "kelly_avg_win_pct": 0.04,
    "kelly_avg_loss_pct": 0.02,
    "current_drawdown_pct": 0.0,
    "max_kelly_cap": 0.25
  }
}
```

Response:

```json
{
  "mode": "trading",
  "voices": [
    {
      "voice": "Risk Sizer",
      "verdict": "fund",
      "position_usd": 700.00,
      "kelly_notional": 1000.00,
      "volatility_scalar": 0.7,
      "rationale": "Kelly=1000.00 ...",
      "metrics": { "direction": "long", ... }
    }
  ],
  "verdict": "fund",
  "trader_pack_version": "v0.2",
  "latency_ms": 3,
  "attestation": null
}
```

`verdict` at the envelope level equals the Risk Sizer's verdict (fund/skip). No direction ever appears at the envelope level — that's Contract #1 of the FinPos design and it's asserted in the HTTP tests.

---

## Roadmap

- **v0.3** (~4 hours): HTTP proxy adapter to Orallexa's live deployment for Judge + Polyseer voices; local implementation for Bull + Bear + Critic. When `body.trade.request_debate === true`, the 5 LLM voices run before the Risk Sizer and the Sizer receives the Judge's direction as input (not the caller's).
- **v0.4** (~2 hours): shared reason-code dictionary between banking + trading verticals; hash-chain attestation cross-vertical continuity (`attestation` field will populate).
- **v0.5** — production-ready release. This is when the Shadow trading-mode Ambient Council HUD demo can be built for the 2026-Q4 pitch.

---

## Cross-language attestation invariant

Every trading decision's attestation payload must be byte-identical whether generated by the JS trader-pack or by the Python Orallexa live deployment. This is the property that makes the "banking + trading + data-science on the same audit surface" pitch true at the wire level, not just the marketing level.

Specifically:
- `signing_payload` = pipe-delimited `{model_id}|{request_commitment}|{output_commitment}|{completed_at_utc}|{previous_hash}|{key_id}[|{dictionary_hash}]`
- All string comparisons UTF-8 and case-sensitive
- Timestamps ISO 8601 with UTC-offset in +00:00 form
- Dictionary hash omitted if not present (v1.5.7 back-compat); otherwise appended

This constraint is asserted by `test/python-verify-cross-lang.test.js` (banking) and will be extended by an analogous JS trader-pack cross-lang test in v0.2.

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — port implementation + strategic direction
- Loredana C. Levitchi · [email verify] — banking-domain guidance on cross-vertical persona mapping
- Michael Yang, PhD · Yeshiva Katz School — trading-vertical framing (his ICAIF Milan sister paper covers this material)

*This scaffold is a public artifact of `shadow-mentor` (MIT). Do not `import` from it until v0.2 lands.*
