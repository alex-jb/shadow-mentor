// Local 4-tier memory backend for Shadow (v1.5.17, 2026-07-07).
//
// Zero external dependencies. Node stdlib only. Intended for the "runs in
// your VPC, no external service" procurement demand — banks that don't
// want to stand up Elasticsearch just to get agent memory can point
// Shadow at a persistent volume and get roughly the same behavior.
//
// Four tiers (borrowed from the pattern in TencentDB-Agent-Memory but
// simplified for stdlib):
//
//   Tier 1 · Working memory  — recent N entries, in-memory Map,
//                              O(1) recall on the hot path
//   Tier 2 · Session memory  — appended to JSONL per analyst on disk,
//                              survives process restart
//   Tier 3 · Long-term index — same JSONL, queried by scan-and-filter
//                              (small N per analyst; a bank sees hundreds
//                              of decisions per analyst per year, not
//                              millions — no ANN needed)
//   Tier 4 · Calibration     — rolled up Brier + outcome distribution
//                              stats cached in-memory and refreshed on
//                              append
//
// Interface-compatible with InMemoryMemory in lib/memory.js so
// api/recall.js and api/calibration.js don't change.
//
// Activation: SHADOW_MEMORY_BACKEND=tiered + SHADOW_MEMORY_DIR=/path
// in env. Falls back to InMemoryMemory otherwise so the public demo
// keeps working.

import { promises as fs } from "node:fs";
import path from "node:path";

export class LocalTieredMemory {
  constructor({ dir, workingSize = 50 } = {}) {
    if (!dir) throw new Error("LocalTieredMemory requires dir");
    this.dir = dir;
    this.workingSize = workingSize;
    // Tier 1: analyst_id → array of recent entries (bounded)
    this._working = new Map();
    // Tier 4: analyst_id → cached calibration stats { n, mean_brier, outcomes }
    this._statsCache = new Map();
    this._initialized = false;
  }

  async _ensureDir() {
    if (this._initialized) return;
    await fs.mkdir(this.dir, { recursive: true });
    this._initialized = true;
  }

  _pathFor(analystId = "_anon") {
    // Sanitize — no path traversal via analyst_id
    const safe = String(analystId).replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.dir, `analyst-${safe}.jsonl`);
  }

  async _readAll(analystId) {
    await this._ensureDir();
    const p = this._pathFor(analystId);
    try {
      const raw = await fs.readFile(p, "utf-8");
      return raw
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l));
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }

  async append(entry, { analyst_id = "_anon" } = {}) {
    await this._ensureDir();
    const p = this._pathFor(analyst_id);
    await fs.appendFile(p, JSON.stringify(entry) + "\n");

    // Tier 1 update
    if (!this._working.has(analyst_id)) this._working.set(analyst_id, []);
    const w = this._working.get(analyst_id);
    w.unshift(entry);
    if (w.length > this.workingSize) w.length = this.workingSize;

    // Tier 4 invalidate — recompute lazily on next recallCalibrationStats.
    // Cache key is composite (`${analyst_id}::${persona ?? "_all"}`), so
    // drop every key belonging to this analyst rather than just the plain id.
    const prefix = `${analyst_id}::`;
    for (const k of this._statsCache.keys()) {
      if (k.startsWith(prefix)) this._statsCache.delete(k);
    }

    return entry;
  }

  async recall({ persona, scenario, max_results = 5, analyst_id = "_anon" } = {}) {
    // Tier 1 → Tier 2/3 fallback. Try to satisfy from working memory first.
    let candidates = this._working.get(analyst_id) ?? [];
    if (candidates.length === 0) {
      // Cold read from Tier 2/3
      candidates = await this._readAll(analyst_id);
      candidates.reverse(); // most recent first
      // Warm Tier 1
      this._working.set(analyst_id, candidates.slice(0, this.workingSize));
    }

    const filtered = candidates.filter((e) => {
      if (persona && e.persona !== persona) return false;
      if (scenario && e.scenario !== scenario) return false;
      return true;
    });

    return filtered.slice(0, max_results);
  }

  async recallCalibrationStats({ persona, analyst_id = "_anon" } = {}) {
    const cacheKey = `${analyst_id}::${persona ?? "_all"}`;
    if (this._statsCache.has(cacheKey)) return this._statsCache.get(cacheKey);

    const rows = await this._readAll(analyst_id);
    const filtered = persona ? rows.filter((r) => r.persona === persona) : rows;

    const scored = filtered.filter(
      (r) => typeof r.brier_score === "number" && !Number.isNaN(r.brier_score),
    );

    const outcomes = {};
    for (const r of filtered) {
      const o = r.outcome ?? "null";
      outcomes[o] = (outcomes[o] ?? 0) + 1;
    }

    let mean_brier = null;
    if (scored.length > 0) {
      const sum = scored.reduce((a, r) => a + r.brier_score, 0);
      mean_brier = Number((sum / scored.length).toFixed(3));
    }

    const stats = {
      n: filtered.length,
      mean_brier,
      outcome_dist: outcomes,
    };

    this._statsCache.set(cacheKey, stats);
    return stats;
  }
}
