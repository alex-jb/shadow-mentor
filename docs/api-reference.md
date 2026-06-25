# Shadow API Reference

> All endpoints are JSON. CORS open (`Access-Control-Allow-Origin: *`). The Vercel public demo is gated behind Deployment Protection until Alex toggles it off; the local `npm run dev` server at `:3000` has no gate.

## Quick map

| Endpoint | Method | Purpose | Cost per call |
|---|---|---|---|
| `/api/deliberate` | POST | 3-voice council + follow-up | ~$0.04 Anthropic / ~$0.02 GLM |
| `/api/recall` | GET | Cross-session memory + Brier stats | $0 |
| `/api/calibration` | GET | Per-persona Brier stats | $0 |
| `/api/scenarios` | GET | Surface discovery | $0 |
| `/api/health` | GET | Liveness + score | $0 |
| `/api/badge` | GET | shields.io endpoint | $0 |
| `/api/version` | GET | Git SHA + region | $0 |

---

## POST /api/deliberate

Real 3-voice council deliberation. The expensive one.

**Body:**
```json
{
  "persona": "compliance",
  "scenario": "lbo",
  "question": "Senior Leverage 4.4x — does this pass policy 4.3 for a B-rated borrower?",
  "context": null,
  "provider": "anthropic"
}
```

- `persona`: `"compliance" | "quant" | "engineer" | "trader" | "advisor"` (default `compliance`)
- `scenario`: `"lbo" | "bloomberg" | "cds" | "policy"` (default `lbo`)
- `question`: free-form analyst question (default is a generic explanatory prompt)
- `context`: optional scenario context override (default pulls from `SCENARIO_CONTEXTS[scenario]`)
- `provider`: `"anthropic" | "glm"` (default `anthropic`)

**Response:**
```json
{
  "junior": "...",
  "senior": "...",
  "third": "...",
  "followup": "...?",
  "latency_ms": 8543,
  "model": "claude-sonnet-4-5-20250929",
  "provider": "anthropic",
  "persona": "compliance",
  "scenario": "lbo"
}
```

**Errors:** 400 unknown persona / scenario / provider · 500 missing API key

---

## GET /api/recall

Pull the analyst's last N council deliberations for this persona + scenario, plus calibration stats.

**Query:**
- `persona` (optional) — filter by persona
- `scenario` (optional) — filter by scenario
- `max_results` (default 5) — cap the entry list

**Response:**
```json
{
  "entries": [
    {
      "entry_id": "sha256...",
      "timestamp_iso": "2026-06-18T...",
      "analyst_id": "hashed",
      "persona": "compliance",
      "scenario": "lbo",
      "question": "...",
      "junior_voice": "...",
      "senior_voice": "...",
      "third_voice": "...",
      "followup": "...?",
      "outcome": "approved",
      "brier_score": 0.18,
      "hash_chain_link": "..."
    }
  ],
  "calibration_stats": {
    "n": 14,
    "mean_brier": 0.176,
    "outcome_dist": { "approved": 9, "blocked": 2, "escalated": 3 }
  }
}
```

---

## GET /api/calibration

Standalone Brier calibration. Bank model-risk reviewers asked for this dedicated endpoint to feed SR 26-2 (formerly SR 11-7) dashboards without pulling full session histories.

**Query:** `persona` (optional)

**Response (with persona):**
```json
{
  "persona": "compliance",
  "n": 14,
  "mean_brier": 0.176,
  "outcome_dist": { "approved": 9, "blocked": 2, "escalated": 3 },
  "rubric_version": "0.3.3",
  "brier_interpretation": "0 = perfect calibration, 0.25 = unhelpful baseline (always 50%), 1 = perfectly wrong"
}
```

**Response (no persona, all-personas snapshot):**
```json
{
  "personas": {
    "compliance": { "n": 14, "mean_brier": 0.176, "outcome_dist": {...} },
    "quant": {...},
    "engineer": {...},
    "trader": {...},
    "advisor": {...}
  },
  "rubric_version": "0.3.3",
  "brier_interpretation": "..."
}
```

---

## GET /api/scenarios

One-call surface discovery — list every persona, scenario, device client, provider, and endpoint.

**Response:**
```json
{
  "service": "shadow-mentor",
  "rubric_version": "0.3.3",
  "personas": [{ "id": "compliance", "voices": ["junior","senior","third"] }, ...],
  "scenarios": [{ "id": "lbo", "short_context": "AcmeCo Leveraged Buyout..." }, ...],
  "devices": [...],
  "providers": [...],
  "endpoints": [...],
  "cells_total": 20,
  "rubric_link": "/benchmark/history/SUMMARY.md",
  "docs_link": "/llms.txt"
}
```

---

## GET /api/health

Procurement-deck table-stakes liveness.

**Response:**
```json
{
  "status": "ok",
  "service": "shadow-mentor",
  "version": "1.4",
  "providers_wired": { "anthropic": true, "glm": false },
  "shadow_agentic_score": 89,
  "rubric_version": "0.3.3",
  "timestamp": "2026-06-18T..."
}
```

`providers_wired` returns booleans only — never the keys themselves.

---

## GET /api/badge

shields.io endpoint serving the live Shadow Agentic Score. README badges can swap from static to live once Deployment Protection lifts.

**Response (shields.io schema v1):**
```json
{
  "schemaVersion": 1,
  "label": "shadow agentic score",
  "message": "89/100",
  "color": "brightgreen",
  "namedLogo": "anthropic"
}
```

**Color thresholds:** ≥90 brightgreen · ≥75 green · ≥60 yellowgreen · ≥40 yellow · ≥20 orange · <20 red.

---

## GET /api/version

Audit-trail pin. Bank compliance reviewers cite a specific git SHA in their review docs; this endpoint exposes it.

**Response:**
```json
{
  "service": "shadow-mentor",
  "package_version": "1.0.0",
  "rubric_version": "0.3.3",
  "git_sha": "e83e017...",
  "git_branch": "main",
  "git_message": "feat: /api/version + ...",
  "deployment_url": "shadow-mentor-XXXXX.vercel.app",
  "deployment_region": "iad1",
  "node_version": "v22.x.x",
  "timestamp": "2026-06-18T..."
}
```

Git fields are `null` in local dev (Vercel env vars not set).

---

## Rate limiting + cost discipline

`/api/deliberate` is the only expensive endpoint. The crawler-facing `robots.txt` Disallows it explicitly so AI crawlers don't fan out free deliberations. All read-only endpoints set `Cache-Control: public, max-age=60` (calibration) to `max-age=3600` (badge / scenarios), so a procurement reviewer hammering refresh is harmless.
