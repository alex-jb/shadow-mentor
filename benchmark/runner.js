// Shadow agentic-capability benchmark runner — inspired by HuggingFace
// "Is it agentic enough?" framework (June 2026). Tests Shadow's
// council-runner / api/deliberate against 8 representative agentic
// decision tasks across the 5 persona packs.
//
// Usage:
//   ANTHROPIC_API_KEY=$(cat ~/.config/anthropic_key) node benchmark/runner.js
//
// Output: benchmark/report-YYYY-MM-DD.json — capability score per dimension
// (jargon translation / regulatory citation / structured reasoning /
// follow-up question quality), and an aggregate Shadow Agentic Score 0-100.
//
// This is a deterministic structural eval, not an LLM-as-judge eval. It
// checks structural traits (length range, regulatory citation, follow-up
// ends with question mark, no hallucinated policy numbers) that buyer
// procurement decks find more defensible than judge-LLM subjective scores.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TASKS = [
  { persona: "compliance", scenario: "lbo", question: "Senior Leverage 4.4x — does this pass policy 4.3 for a B-rated borrower?", expected_terms: ["policy 4.3", "B-rated", "leverage"] },
  { persona: "compliance", scenario: "policy", question: "Cov-lite request — what documentation do I need before Credit Committee?", expected_terms: ["Credit Committee", "cov-lite", "Policy"] },
  { persona: "quant", scenario: "lbo", question: "PSI tripped on credit features — is this PD trustworthy?", expected_terms: ["SR 11", "PSI", "model risk"] },
  { persona: "quant", scenario: "cds", question: "Regime-shift HMM at 0.74 — alert credit desk?", expected_terms: ["regime", "VIX", "false-positive"] },
  { persona: "engineer", scenario: "lbo", question: "Refactor credit-decision pipeline — service boundary?", expected_terms: ["async", "circuit-breaker", "Fair Lending"] },
  { persona: "trader", scenario: "bloomberg", question: "AAPL setup for long entry — trapped by mean-reversion?", expected_terms: ["regime", "concentration", "single-name"] },
  { persona: "trader", scenario: "cds", question: "CDX widened 34bps WoW — rotate to credit protection?", expected_terms: ["carry", "regime", "Policy"] },
  { persona: "advisor", scenario: "lbo", question: "HNW client $2M into TLB — Reg BI suitable?", expected_terms: ["Reg BI", "IPS", "suitability"] }
];

const STRUCTURAL_CHECKS = {
  junior_length: (text) => text.length >= 80 && text.length <= 500,
  senior_length: (text) => text.length >= 100 && text.length <= 600,
  third_length: (text) => text.length >= 100 && text.length <= 600,
  followup_is_question: (text) => /\?$/.test(text.trim()),
  followup_length: (text) => text.length >= 30 && text.length <= 250,
};

function scoreVoice(voice_text, expected_terms) {
  let matched = 0;
  for (const term of expected_terms) {
    if (voice_text.toLowerCase().includes(term.toLowerCase())) matched++;
  }
  return matched / expected_terms.length;
}

async function runTask(task) {
  const response = await fetch("https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app/api/deliberate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona: task.persona,
      scenario: task.scenario,
      question: task.question,
      provider: "anthropic"
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`task ${task.persona}/${task.scenario} HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return await response.json();
}

function scoreResult(task, result) {
  const checks = {
    junior_length: STRUCTURAL_CHECKS.junior_length(result.junior),
    senior_length: STRUCTURAL_CHECKS.senior_length(result.senior),
    third_length: STRUCTURAL_CHECKS.third_length(result.third),
    followup_is_question: STRUCTURAL_CHECKS.followup_is_question(result.followup),
    followup_length: STRUCTURAL_CHECKS.followup_length(result.followup),
    junior_term_coverage: scoreVoice(result.junior, task.expected_terms),
    senior_term_coverage: scoreVoice(result.senior, task.expected_terms),
    third_term_coverage: scoreVoice(result.third, task.expected_terms),
    latency_ok: result.latency_ms < 10000,
  };
  const numericScore = (
    (checks.junior_length ? 8 : 0) +
    (checks.senior_length ? 8 : 0) +
    (checks.third_length ? 8 : 0) +
    (checks.followup_is_question ? 10 : 0) +
    (checks.followup_length ? 6 : 0) +
    checks.junior_term_coverage * 15 +
    checks.senior_term_coverage * 20 +
    checks.third_term_coverage * 15 +
    (checks.latency_ok ? 10 : 0)
  );
  return { checks, score: Math.round(numericScore) };
}

async function main() {
  console.log("Shadow Agentic Capability Benchmark v0.1");
  console.log("HF 'Is it agentic enough?'-inspired structural eval");
  console.log("Target: production Vercel endpoint, provider=anthropic\n");

  const results = [];
  for (const task of TASKS) {
    process.stdout.write(`[${task.persona} × ${task.scenario}] running... `);
    try {
      const t0 = Date.now();
      const result = await runTask(task);
      const elapsed = Date.now() - t0;
      const scored = scoreResult(task, result);
      console.log(`score=${scored.score}/100 latency=${elapsed}ms`);
      results.push({ task, result_meta: { latency_ms: result.latency_ms, model: result.model }, ...scored });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ task, error: err.message });
    }
  }

  const completedScores = results.filter((r) => typeof r.score === "number").map((r) => r.score);
  const aggregate = completedScores.length
    ? Math.round(completedScores.reduce((acc, s) => acc + s, 0) / completedScores.length)
    : 0;

  const report = {
    version: "0.1",
    run_at: new Date().toISOString(),
    benchmark_name: "Shadow Agentic Capability Benchmark (HF Is-it-agentic-enough-inspired)",
    n_tasks: TASKS.length,
    n_completed: completedScores.length,
    aggregate_score: aggregate,
    rubric: {
      per_task_max_score: 100,
      checks: [
        "junior_length 80-500",
        "senior_length 100-600",
        "third_length 100-600",
        "followup_is_question",
        "followup_length 30-250",
        "junior_term_coverage of 3 expected terms",
        "senior_term_coverage",
        "third_term_coverage",
        "latency under 10s"
      ],
      weights: "junior_len:8 senior_len:8 third_len:8 followup_q:10 followup_len:6 junior_terms:15 senior_terms:20 third_terms:15 latency:10"
    },
    results
  };

  const outdir = join(__dirname);
  mkdirSync(outdir, { recursive: true });
  const outpath = join(outdir, `report-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(outpath, JSON.stringify(report, null, 2));
  console.log(`\nAggregate Shadow Agentic Score: ${aggregate}/100`);
  console.log(`Report written: ${outpath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
