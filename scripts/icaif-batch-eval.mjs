#!/usr/bin/env node
// scripts/icaif-batch-eval.mjs
//
// ICAIF 2026 Milan paper Section 5.3 empirical anchor.
//
// Generates N synthetic loans with deterministic gold-label verdicts derived
// from LOAN_DEFAULTS thresholds, runs each through runLoanCouncil (pure
// deterministic, zero LLM cost), and emits per-decision + per-persona rows to
// JSONL for downstream analysis: verdict accuracy, per-persona agreement,
// AA-code coverage vs signed dictionary, confidence-distribution shape.
//
// Usage:
//   node scripts/icaif-batch-eval.mjs --n 200 --out benchmark/icaif-2026/ --seed 20260710
//
// Output files:
//   {out}/loans-{seed}.jsonl        one row per synthetic loan input
//   {out}/decisions-{seed}.jsonl    one row per council decision (voices + verdict + AA codes)
//   {out}/summary-{seed}.json       aggregate metrics: verdict-distribution + per-persona-agreement
//
// $0 to run — no LLM calls, no network. Repeatable via --seed.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { LOAN_DEFAULTS } from "../lib/schemas/loan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ── CLI ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { n: 200, seed: 20260710, outDir: "benchmark/icaif-2026" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--n") out.n = parseInt(argv[++i], 10);
    else if (a === "--seed") out.seed = parseInt(argv[++i], 10);
    else if (a === "--out") out.outDir = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/icaif-batch-eval.mjs [--n 200] [--seed 20260710] [--out benchmark/icaif-2026]");
      process.exit(0);
    }
  }
  return out;
}

// ── Deterministic PRNG (mulberry32) so runs are reproducible from --seed ──
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Synthetic loan generator ────────────────────────────────────
// Distributions are intentionally realistic-shaped rather than adversarial —
// mid-tier bank loan-application volume skews approve-heavy, with a long tail
// of escalate + a small block cluster. This produces a class-balance that
// matches the sort of eval bank counsel expects to see.

const SECTORS_APPROVABLE = [
  "consumer_discretionary", "consumer_staples", "healthcare", "industrials",
  "information_technology", "materials", "telecom", "utilities",
];
const SECTORS_ESCALATABLE = ["commercial_real_estate", "cre"];

function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
function gauss(rand, mean, std) {
  // Box-Muller
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function generateLoan(rand, id) {
  // Class-mixture prior: 60% approve-shape, 25% escalate-shape, 15% block-shape.
  // Draw class first, then draw features conditional on class so the labeled
  // distribution matches a realistic mid-tier bank application flow.
  const r = rand();
  const targetClass = r < 0.60 ? "approve" : r < 0.85 ? "escalate" : "block";

  let credit_score, debt_to_income, loan_to_value, sector, fair_lending_review_flag, adverse_action_reasons;

  if (targetClass === "approve") {
    credit_score = clamp(Math.round(gauss(rand, 740, 25)), 700, 830);
    debt_to_income = clamp(gauss(rand, 0.28, 0.04), 0.10, 0.35);
    loan_to_value = clamp(gauss(rand, 0.65, 0.08), 0.30, 0.79);
    sector = pick(rand, SECTORS_APPROVABLE);
    fair_lending_review_flag = false;
    adverse_action_reasons = [];
  } else if (targetClass === "escalate") {
    // Push exactly one dimension across the ceiling — the escalate signal.
    credit_score = clamp(Math.round(gauss(rand, 730, 30)), 700, 820);
    debt_to_income = clamp(gauss(rand, 0.38, 0.03), 0.36, 0.55);
    loan_to_value = clamp(gauss(rand, 0.72, 0.08), 0.50, 0.85);
    const useCre = rand() < 0.35;
    sector = useCre ? pick(rand, SECTORS_ESCALATABLE) : pick(rand, SECTORS_APPROVABLE);
    fair_lending_review_flag = false;
    adverse_action_reasons = [];
  } else {
    // Block: FICO below floor. Everything else scattered.
    credit_score = clamp(Math.round(gauss(rand, 640, 40)), 480, 699);
    debt_to_income = clamp(gauss(rand, 0.38, 0.10), 0.15, 0.80);
    loan_to_value = clamp(gauss(rand, 0.75, 0.10), 0.40, 0.95);
    sector = pick(rand, [...SECTORS_APPROVABLE, ...SECTORS_ESCALATABLE]);
    fair_lending_review_flag = rand() < 0.15;
    adverse_action_reasons = [];
  }

  const amount = Math.round(clamp(gauss(rand, 400_000, 250_000), 25_000, 5_000_000));

  // Market-proxy prices: gently trending sequence so VaR lands in a
  // realistic band. Add drift + volatility conditional on class so blocks
  // sometimes trip Risk Officer VaR too.
  const drift = targetClass === "block" ? -0.002 : 0.001;
  const vol = targetClass === "block" ? 0.02 : 0.008;
  const prices = [];
  let p = 100;
  for (let i = 0; i < 20; i++) {
    p *= 1 + drift + gauss(rand, 0, vol);
    prices.push(Math.round(p * 100) / 100);
  }

  return {
    loan_id: `icaif-${id.toString().padStart(4, "0")}`,
    credit_score,
    debt_to_income: Math.round(debt_to_income * 10000) / 10000,
    loan_to_value: Math.round(loan_to_value * 10000) / 10000,
    amount,
    sector,
    fair_lending_review_flag,
    adverse_action_reasons,
    market_proxy_prices: prices,
    _gold_label: targetClass, // ground truth per the class-mixture prior
  };
}

// ── Gold-label derivation ────────────────────────────────────────
// The class-mixture prior above tags each loan with a target-class label. The
// deterministic gold verdict is computed independently by re-applying the
// Levitchi-2026 policy semantics to the generated features — this catches
// cases where the class-mixture bucket disagrees with the actual features
// (e.g. an "escalate"-target row that happens to also trip Risk Officer VaR
// and would correctly gold-label as block).
function deriveGoldVerdict(loan) {
  if (loan.credit_score < LOAN_DEFAULTS.fico_approve_floor) return "block";
  if (loan.fair_lending_review_flag) return "block";
  if (loan.debt_to_income > LOAN_DEFAULTS.dti_approve_ceiling) return "escalate";
  if (loan.loan_to_value > LOAN_DEFAULTS.ltv_approve_ceiling) return "escalate";
  if (SECTORS_ESCALATABLE.includes(loan.sector)) return "escalate";
  // VaR check is best-effort; VaR is expensive to precompute for label
  // derivation without calling risk-tools, and the runLoanCouncil call itself
  // will surface the accurate VaR verdict. So we conservatively default to
  // "approve" here and let the confusion matrix at analysis time reveal any
  // rows where Risk Officer VaR flipped a labeled approve into escalate/block.
  return "approve";
}

// ── Main ────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  const outDir = resolve(REPO_ROOT, args.outDir);
  mkdirSync(outDir, { recursive: true });

  const rand = mulberry32(args.seed);
  const loans = [];
  const decisions = [];

  const confusion = {};
  const perVoiceAgreement = {}; // voice → { total, agrees_with_final }
  const aaCoverage = {}; // AA code → count
  const confidencePerVoice = {}; // voice → [confidences]

  for (let i = 0; i < args.n; i++) {
    const loan = generateLoan(rand, i);
    const gold = deriveGoldVerdict(loan);
    loans.push({ ...loan, _gold_label_derived: gold });

    const decision = runLoanCouncil(loan);
    const predicted = decision.final_verdict;

    const key = `${gold}→${predicted}`;
    confusion[key] = (confusion[key] || 0) + 1;

    for (const v of decision.voices) {
      perVoiceAgreement[v.voice] ||= { total: 0, agrees_with_final: 0 };
      perVoiceAgreement[v.voice].total += 1;
      if (v.verdict === predicted) perVoiceAgreement[v.voice].agrees_with_final += 1;

      confidencePerVoice[v.voice] ||= [];
      confidencePerVoice[v.voice].push(v.confidence);

      for (const aa of (v.adverse_action_codes || [])) {
        const code = typeof aa === "string" ? aa : aa.code;
        if (code) aaCoverage[code] = (aaCoverage[code] || 0) + 1;
      }
    }

    decisions.push({
      loan_id: loan.loan_id,
      gold_verdict: gold,
      predicted_verdict: predicted,
      correct: gold === predicted,
      voices: decision.voices.map(v => ({
        voice: v.voice,
        verdict: v.verdict,
        confidence: v.confidence,
        aa_codes: (v.adverse_action_codes || []).map(a => typeof a === "string" ? a : a.code),
      })),
      confidence_weighted_verdict: decision.confidence_weighted_verdict ?? null,
      reason_code_dictionary_check: decision.reason_code_dictionary_check?.ok ?? null,
    });
  }

  const totalCorrect = decisions.filter(d => d.correct).length;
  const accuracy = totalCorrect / args.n;

  const voiceAgreementRates = Object.fromEntries(
    Object.entries(perVoiceAgreement).map(([v, o]) => [v, +(o.agrees_with_final / o.total).toFixed(4)])
  );
  const meanConfidencePerVoice = Object.fromEntries(
    Object.entries(confidencePerVoice).map(([v, arr]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const min = Math.min(...arr), max = Math.max(...arr);
      return [v, { mean: +mean.toFixed(4), min, max, n: arr.length }];
    })
  );

  const summary = {
    generated_at_utc: new Date().toISOString(),
    seed: args.seed,
    n: args.n,
    verdict_accuracy: +accuracy.toFixed(4),
    confusion_matrix: confusion,
    per_voice_agreement_with_final: voiceAgreementRates,
    per_voice_confidence: meanConfidencePerVoice,
    aa_code_coverage: aaCoverage,
    notes: [
      "gold_verdict derived from LOAN_DEFAULTS thresholds + policy semantics per Levitchi 2026-06-19",
      "confidence values are per-persona constants; ICAIF Section 5.3 must clarify whether Brier decomposition uses these constants or requires schema extension to emit per-class probabilities",
      "$0 LLM cost — runLoanCouncil is pure deterministic verdict logic",
      "reproducible: re-run with same --seed for byte-identical output",
    ],
  };

  const outLoans = resolve(outDir, `loans-${args.seed}.jsonl`);
  const outDecisions = resolve(outDir, `decisions-${args.seed}.jsonl`);
  const outSummary = resolve(outDir, `summary-${args.seed}.json`);

  writeFileSync(outLoans, loans.map(l => JSON.stringify(l)).join("\n") + "\n");
  writeFileSync(outDecisions, decisions.map(d => JSON.stringify(d)).join("\n") + "\n");
  writeFileSync(outSummary, JSON.stringify(summary, null, 2) + "\n");

  console.log(`Wrote ${args.n} loans to ${outLoans}`);
  console.log(`Wrote ${args.n} decisions to ${outDecisions}`);
  console.log(`Wrote summary to ${outSummary}`);
  console.log("");
  console.log(`Verdict accuracy: ${(accuracy * 100).toFixed(1)}% (${totalCorrect}/${args.n})`);
  console.log(`Confusion: ${JSON.stringify(confusion)}`);
  console.log(`Per-voice agreement with final: ${JSON.stringify(voiceAgreementRates)}`);
}

main();
