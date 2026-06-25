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

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";
import { checkCellRegression } from "../lib/benchmark-stats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

// compliance × LBO question reframed 2026-06-18 night with Loredana C. Levitchi's
// Aura Alexa BR thresholds verbatim (FICO 700 / DTI 0.36 / LTV 0.80) per
// 2026-06-18 integration email item 5. Rerun + variance report deferred to
// 2026-06-19 morning to allow honest-not-tired score reporting. Pre-BR
// baseline: 100/100 n=3 stable; post-BR result will be appended to
// benchmark/history/ with explicit version tag.
const TASKS = [
  { persona: "compliance", scenario: "lbo", question: "Borrower FICO 720, DTI 0.32, LTV 0.78 — does this pass Policy 4.3 thresholds for a B-rated TLB?", expected_terms: ["Policy 4.3", "B-rated", "FICO", "DTI", "LTV"] },
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

// Direct Anthropic SDK call — bypasses Vercel network entirely so the
// benchmark works regardless of Deployment Protection state.
async function runTask(task) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompts = PERSONA_PROMPTS[task.persona];
  const ctx = SCENARIO_CONTEXTS[task.scenario];
  if (!prompts || !ctx) throw new Error(`unknown persona/scenario: ${task.persona}/${task.scenario}`);
  const userMessage = `Scenario context:\n${ctx}\n\nUser question: ${task.question}\n\nRespond with a single paragraph in your voice. No preamble. Plain prose.`;

  // v0.2 — prompt caching on system prompt (the long persona instruction)
  // reduces re-tokenization cost + ~30-40% latency
  async function callVoice(systemPrompt) {
    const r = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 180,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }]
    });
    return r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }

  const t0 = Date.now();
  // v0.2 — voices in parallel
  const [junior, senior, third] = await Promise.all([
    callVoice(prompts.junior),
    callVoice(prompts.senior),
    callVoice(prompts.third)
  ]);
  // v0.3 — follow-up uses Haiku, hard-capped to fit rubric 30-250 chars and must end with ?
  const followupResponse = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 50,
    system: "You generate exactly ONE follow-up question a VP would ask next. HARD LIMIT: MAXIMUM 180 characters total. Must end with a question mark. No preamble. No 'Follow-up:' prefix. Just the question.",
    messages: [{ role: "user", content: `Original: ${task.question}\n\nJunior: ${junior}\n\nSenior: ${senior}\n\nCompliance: ${third}\n\nThe single most important follow-up question (max 180 chars, ends with ?):` }]
  });
  let followup = followupResponse.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  // strip common preambles + force terminal ?
  followup = followup.replace(/^(Follow-up question:|Follow-up:|Question:)\s*/i, "").trim();
  if (!/\?$/.test(followup)) followup = followup.replace(/[.!]+$/, "") + "?";
  const latency_ms = Date.now() - t0;
  return { junior, senior, third, followup, latency_ms, model: CLAUDE_MODEL, persona: task.persona, scenario: task.scenario };
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
  console.log("Shadow Agentic Capability Benchmark v0.2");
  console.log("HF 'Is it agentic enough?'-inspired structural eval");
  console.log("Calling Anthropic SDK directly (bypasses Vercel network)");
  console.log("Optimizations: prompt caching on system + Haiku for follow-up + parallel voices\n");

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
  // Use LOCAL date for filename, not UTC. Otherwise a late-evening run
  // (e.g. 21:30 NY EDT = 01:30 UTC next day) silently writes to a different
  // filename than humans expect — caught 2026-06-18 night when 3 BR
  // benchmark runs were almost copied from a stale pre-BR report file.
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const outpath = join(outdir, `report-${yyyy}-${mm}-${dd}.json`);
  writeFileSync(outpath, JSON.stringify(report, null, 2));
  console.log(`\nAggregate Shadow Agentic Score: ${aggregate}/100`);
  console.log(`Report written: ${outpath}`);

  // Per-cell regression gate — fails non-zero exit if any persona × scenario
  // cell drops more than 5 points below its historical n=6 minimum. Catches
  // prompt-edit regressions that the aggregate badge would hide.
  const gate = checkCellRegression(report);
  if (gate.passed) {
    console.log(`Per-cell regression gate: PASS (all 8 cells within tolerance)`);
  } else {
    console.error(`\n⚠️  Per-cell regression gate: FAIL — ${gate.violations.length} cell(s) regressed`);
    for (const v of gate.violations) {
      if (v.kind === "regression") {
        console.error(`  - ${v.cell}: scored ${v.score}, floor ${v.floor}, min allowed ${v.min_allowed} (delta ${v.delta})`);
      } else if (v.kind === "unknown-cell") {
        console.error(`  - ${v.cell}: not in CELL_HISTORICAL_FLOORS (extend lib/benchmark-stats.js)`);
      }
    }
    // Non-fatal in standalone runs (we want the report file written), but
    // CI scripts that pipe to grep "FAIL" can hard-fail their job step.
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
