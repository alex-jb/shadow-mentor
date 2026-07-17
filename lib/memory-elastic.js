// Elastic agent-memory backend stub — interface-compatible with InMemoryMemory
// in lib/memory.js so callers can swap implementations without touching code.
//
// Elastic's June 2026 agent-memory architecture demonstrated 0.89 recall on
// the standard memory benchmark with a Elasticsearch + ELSER sparse encoder
// stack. Shadow's production deployment at a regulated bank uses that same
// pattern with the persona/scenario/outcome schema mapped directly to an
// index per analyst.
//
// This file is a STUB — it documents the interface contract and shape so a
// bank engineer can wire @elastic/elasticsearch in 50-80 lines without
// touching api/recall.js or api/calibration.js. Activated when
// SHADOW_MEMORY_BACKEND=elastic + ELASTIC_URL is set in env. Falls back to
// InMemoryMemory otherwise so the public demo keeps working.
//
// Schema (per analyst index, e.g. `shadow-analyst-{hashed_id}`):
//   {
//     entry_id        keyword
//     timestamp_iso   date
//     analyst_id      keyword
//     persona         keyword
//     scenario        keyword
//     question        text   (analyzer: standard)
//     junior_voice    text
//     senior_voice    text
//     third_voice     text
//     followup        text
//     outcome         keyword (approved / blocked / escalated / null)
//     brier_score     float
//     hash_chain_link keyword
//   }
//
// Reference: https://www.elastic.co/search-labs/blog/agent-memory-elasticsearch/

export class ElasticMemory {
  constructor({ url, apiKey, indexPrefix = "shadow-analyst-" } = {}) {
    if (!url) throw new Error("ElasticMemory requires ELASTIC_URL");
    this.url = url;
    this.apiKey = apiKey;
    this.indexPrefix = indexPrefix;
    // In production: this._client = new Client({ node: url, auth: { apiKey } });
    this._client = null;
  }

  _indexFor(analystId = "_anon") {
    return this.indexPrefix + analystId;
  }

  async recall({ persona, scenario, max_results = 5, analyst_id = "_anon" } = {}) {
    // Production query shape:
    //   const r = await this._client.search({
    //     index: this._indexFor(analyst_id),
    //     size: max_results,
    //     query: { bool: { filter: [
    //       persona  ? { term: { persona } }  : null,
    //       scenario ? { term: { scenario } } : null
    //     ].filter(Boolean) }},
    //     sort: [{ timestamp_iso: "desc" }]
    //   });
    //   return r.hits.hits.map((h) => h._source);
    throw new Error("ElasticMemory.recall() stub — wire @elastic/elasticsearch to activate");
  }

  async recallCalibrationStats({ persona, analyst_id = "_anon" } = {}) {
    // Production aggregation shape (avg brier + outcome distribution):
    //   const r = await this._client.search({
    //     index: this._indexFor(analyst_id),
    //     size: 0,
    //     query: persona ? { term: { persona } } : { match_all: {} },
    //     aggs: {
    //       mean_brier: { avg: { field: "brier_score" } },
    //       outcomes:   { terms: { field: "outcome" } },
    //       n:          { value_count: { field: "entry_id" } }
    //     }
    //   });
    //   return {
    //     n: r.aggregations.n.value,
    //     mean_brier: Number(r.aggregations.mean_brier.value.toFixed(3)),
    //     outcome_dist: Object.fromEntries(r.aggregations.outcomes.buckets.map((b) => [b.key, b.doc_count]))
    //   };
    throw new Error("ElasticMemory.recallCalibrationStats() stub — wire @elastic/elasticsearch to activate");
  }

  async append(entry, { analyst_id = "_anon" } = {}) {
    // Production index shape:
    //   await this._client.index({
    //     index: this._indexFor(analyst_id),
    //     id: entry.entry_id,
    //     document: entry,
    //     refresh: "wait_for"
    //   });
    //   return entry;
    throw new Error("ElasticMemory.append() stub — wire @elastic/elasticsearch to activate");
  }
}

// Factory: returns one of three backends based on env config.
//
//   SHADOW_MEMORY_BACKEND=tiered + SHADOW_MEMORY_DIR=/path
//     → LocalTieredMemory. Zero external deps, JSONL-backed, survives
//       process restart. For banks that want in-VPC memory without
//       standing up Elasticsearch. Shipped as usable code in v1.5.17.
//
//   SHADOW_MEMORY_BACKEND=elastic + ELASTIC_URL=...
//     → ElasticMemory (this file). Bank wires @elastic/elasticsearch
//       client into the stub methods to activate. Documented schema
//       above.
//
//   Neither set
//     → InMemoryMemory (public demo default). Ephemeral, zero-config.
//
// All three backends share the same recall / recallCalibrationStats /
// append interface, so a caller can swap them transparently.
//
// CURRENT STATE (do not misread): this factory is the *intended* swap
// point, but api/recall.js + api/calibration.js presently import
// `memorySingleton` (lib/memory.js) DIRECTLY and do NOT route through
// buildMemoryBackend(). Consequences:
//   • Setting SHADOW_MEMORY_BACKEND=tiered|elastic does NOT yet change the
//     live /api/recall + /api/calibration endpoints — they stay in-memory.
//   • The throwing ElasticMemory stub is therefore NOT reachable from any
//     runtime path; only tests construct it. It is a documented seam (a bank
//     fills the three methods with an @elastic/elasticsearch client), not a
//     live footgun. Construct-succeeds / throw-on-unimplemented-method is the
//     correct stub shape — a bank that wires the client sees no throws.
// To actually honor the env-var swap at the endpoints, route them through
// buildMemoryBackend() (a deliberate change to live endpoints, not done here).
export async function buildMemoryBackend() {
  if (process.env.SHADOW_MEMORY_BACKEND === "tiered" && process.env.SHADOW_MEMORY_DIR) {
    const { LocalTieredMemory } = await import("./memory-tiered.js");
    return new LocalTieredMemory({ dir: process.env.SHADOW_MEMORY_DIR });
  }
  if (process.env.SHADOW_MEMORY_BACKEND === "elastic" && process.env.ELASTIC_URL) {
    return new ElasticMemory({
      url: process.env.ELASTIC_URL,
      apiKey: process.env.ELASTIC_API_KEY
    });
  }
  const { memorySingleton } = await import("./memory.js");
  return memorySingleton;
}
