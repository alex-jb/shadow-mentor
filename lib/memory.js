// Cross-session memory layer — recall past council sessions for an analyst.
//
// Production: Elasticsearch index per analyst on customer on-premises. This
// file ships a deterministic in-memory mock with 30 seed entries plus runtime
// session capture, so the browser demo can show the "calibration corridor"
// metaphor without a real Elastic deployment.
//
// Real-Elastic swap = replace the InMemoryMemory class with an ElasticMemory
// class that talks to @elastic/elasticsearch and indexes the same Entry schema.

/**
 * @typedef {Object} MemoryEntry
 * @property {string} entry_id           - SHA-256 of timestamp + persona + scenario
 * @property {string} timestamp_iso
 * @property {string} analyst_id         - hashed
 * @property {string} persona            - compliance / quant / engineer / trader / advisor
 * @property {string} scenario           - lbo / bloomberg / cds / policy
 * @property {string} question
 * @property {string} junior_voice
 * @property {string} senior_voice
 * @property {string} third_voice
 * @property {string} followup
 * @property {string|null} outcome       - approved / blocked / escalated / null when pending
 * @property {number|null} brier_score   - 0..1 once outcome resolves; null when pending
 * @property {string} hash_chain_link    - SHA-256 link to prior entry
 */

const SEED_DATA = [
  { persona: "compliance", scenario: "lbo", outcome: "approved", brier_score: 0.18, days_ago: 87, question: "Senior Leverage 4.3x for B-rated WidgetCo — within policy 4.3?" },
  { persona: "compliance", scenario: "lbo", outcome: "blocked", brier_score: 0.09, days_ago: 76, question: "Senior Leverage 4.7x for B-rated ConsumerDisc TLB — exceed cap?" },
  { persona: "compliance", scenario: "policy", outcome: "escalated", brier_score: 0.22, days_ago: 72, question: "Cov-lite request from PE sponsor on $300M TLB — escalate?" },
  { persona: "compliance", scenario: "lbo", outcome: "approved", brier_score: 0.14, days_ago: 60, question: "TLB at SOFR+450 for healthcare LBO — pricing reasonable?" },
  { persona: "compliance", scenario: "bloomberg", outcome: "approved", brier_score: 0.31, days_ago: 54, question: "AAPL coverage initiation — Reg AC compliance check?" },
  { persona: "compliance", scenario: "cds", outcome: "escalated", brier_score: 0.19, days_ago: 49, question: "CDX widening 28bps — trigger Risk Committee notification?" },
  { persona: "compliance", scenario: "policy", outcome: "approved", brier_score: 0.08, days_ago: 43, question: "Policy 4.3.3 sponsor equity cushion exception — review?" },
  { persona: "compliance", scenario: "lbo", outcome: "blocked", brier_score: 0.11, days_ago: 38, question: "Senior Leverage 4.8x — over policy cap?" },
  { persona: "compliance", scenario: "policy", outcome: "approved", brier_score: 0.21, days_ago: 31, question: "QoE adjustment >12% — accept on B-rated borrower?" },
  { persona: "compliance", scenario: "bloomberg", outcome: "approved", brier_score: 0.16, days_ago: 24, question: "NVDA coverage initiation — borrow rate disclosure?" },
  { persona: "compliance", scenario: "cds", outcome: "approved", brier_score: 0.28, days_ago: 18, question: "Single-name credit widening — desk note material?" },
  { persona: "compliance", scenario: "lbo", outcome: "escalated", brier_score: 0.17, days_ago: 12, question: "B-rated TMT TLB at SOFR+475 — concentration cap reached?" },
  { persona: "compliance", scenario: "lbo", outcome: "approved", brier_score: 0.13, days_ago: 7, question: "Senior Leverage 4.1x on consumer-disc borrower — approve?" },
  { persona: "compliance", scenario: "policy", outcome: "approved", brier_score: 0.25, days_ago: 3, question: "Cov-lite secondary market position — within cap?" },

  { persona: "quant", scenario: "lbo", outcome: "approved", brier_score: 0.11, days_ago: 81, question: "LBO PD model 6.4% — drift attribution check?" },
  { persona: "quant", scenario: "cds", outcome: "escalated", brier_score: 0.34, days_ago: 64, question: "Regime-shift HMM 0.71 probability — alert credit desk?" },
  { persona: "quant", scenario: "lbo", outcome: "blocked", brier_score: 0.09, days_ago: 51, question: "PD divergence from baseline >2pp — file model performance issue?" },
  { persona: "quant", scenario: "bloomberg", outcome: "approved", brier_score: 0.18, days_ago: 39, question: "AAPL factor loading divergence 13bps — material?" },
  { persona: "quant", scenario: "policy", outcome: "approved", brier_score: 0.22, days_ago: 28, question: "PSM-matched cov-lite default rate analysis — Committee submission?" },
  { persona: "quant", scenario: "lbo", outcome: "escalated", brier_score: 0.15, days_ago: 16, question: "PSI tripped on 4 features — review attribution?" },

  { persona: "engineer", scenario: "lbo", outcome: "approved", brier_score: 0.20, days_ago: 70, question: "Refactor credit-decision pipeline async — circuit-breaker needed?" },
  { persona: "engineer", scenario: "policy", outcome: "approved", brier_score: 0.12, days_ago: 45, question: "Policy parser pandoc migration — schema validation layer?" },
  { persona: "engineer", scenario: "bloomberg", outcome: "approved", brier_score: 0.27, days_ago: 21, question: "B-PIPE Kafka consumer ACL — license-seat compliance?" },

  { persona: "trader", scenario: "lbo", outcome: "blocked", brier_score: 0.32, days_ago: 67, question: "TLB syndication SOFR+450 — concentration cap math?" },
  { persona: "trader", scenario: "bloomberg", outcome: "approved", brier_score: 0.19, days_ago: 53, question: "AAPL consolidation $225 — long entry setup?" },
  { persona: "trader", scenario: "cds", outcome: "escalated", brier_score: 0.41, days_ago: 36, question: "CDX widening — rotate to credit protection long?" },

  { persona: "advisor", scenario: "lbo", outcome: "blocked", brier_score: 0.13, days_ago: 59, question: "HNW client $2M into TLB — Reg BI suitability?" },
  { persona: "advisor", scenario: "bloomberg", outcome: "approved", brier_score: 0.24, days_ago: 41, question: "Client 8% AAPL concentration — trim recommendation?" },
  { persona: "advisor", scenario: "cds", outcome: "approved", brier_score: 0.18, days_ago: 22, question: "Client HY exposure — proactive call after spread widening?" },
  { persona: "advisor", scenario: "policy", outcome: "approved", brier_score: 0.16, days_ago: 9, question: "Cov-lite structured note client — policy change disclosure?" }
];

function nowMinusDays(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function fakeHash(input) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

export class InMemoryMemory {
  constructor() {
    /** @type {MemoryEntry[]} */
    this.entries = SEED_DATA.map((s, i) => ({
      entry_id: `seed-${i}`,
      timestamp_iso: nowMinusDays(s.days_ago),
      analyst_id: "maya-chen-hash-a1b2",
      persona: s.persona,
      scenario: s.scenario,
      question: s.question,
      junior_voice: "[seed entry — full voice text in production index]",
      senior_voice: "[seed entry — full voice text in production index]",
      third_voice: "[seed entry — full voice text in production index]",
      followup: "[seed entry — followup in production index]",
      outcome: s.outcome,
      brier_score: s.brier_score,
      hash_chain_link: fakeHash(`seed-${i}-${s.days_ago}`)
    }));
  }

  recall({ persona, scenario, max_results = 5 }) {
    const candidates = this.entries.filter((e) => {
      if (persona && e.persona !== persona) return false;
      if (scenario && e.scenario !== scenario) return false;
      return true;
    });
    return candidates.slice(-max_results).reverse();
  }

  recallCalibrationStats({ persona }) {
    const subset = this.entries.filter((e) => e.persona === persona && e.brier_score !== null);
    if (subset.length === 0) return null;
    const mean_brier = subset.reduce((acc, e) => acc + e.brier_score, 0) / subset.length;
    const outcome_dist = subset.reduce(
      (acc, e) => {
        acc[e.outcome] = (acc[e.outcome] ?? 0) + 1;
        return acc;
      },
      {}
    );
    return { n: subset.length, mean_brier: Number(mean_brier.toFixed(3)), outcome_dist };
  }

  append(entry) {
    this.entries.push(entry);
    return entry;
  }
}

export const memorySingleton = new InMemoryMemory();
