#!/usr/bin/env node
// GLM-5.2 vs Anthropic Sonnet 4.6 A/B benchmark — closes 6/26 daily-brief
// distill action #6 + 6/27 brief's GLM-5.2 step-change framing.
//
// Hypothesis (per Nathan Lambert 2026-06-27): GLM-5.2 crossed the open-agent
// capability threshold and is now a genuine substitute for Sonnet on the
// 5-voice council voice-prompts. If true, Shadow's "Mainland China bank"
// pitch deck gets a hardened number, not vibes; if false, we learn the
// failure modes and don't lead with the GLM angle.
//
// 5 prompts × 2 providers × N runs (default 3) = 30 calls per fire.
// Cost estimate: Sonnet 4.6 ~$0.03/call × 15 = $0.45; GLM-5.2 ~$0.005/call
// × 15 = $0.075. Total ~$0.55 per full run.
//
// Usage:
//   ANTHROPIC_API_KEY=$(cat ~/.config/anthropic_key) \
//   GLM_API_KEY=$(cat ~/.config/glm_key) \
//   node eval/glm-vs-sonnet-ab.mjs
//
//   ANTHROPIC_API_KEY=$(cat ~/.config/anthropic_key) \
//   GLM_API_KEY=$(cat ~/.config/glm_key) \
//   node eval/glm-vs-sonnet-ab.mjs --runs 5 --providers anthropic,glm
//
// Output:
//   benchmark/provider-ab/ab-YYYY-MM-DD-HHMMSS.json (raw per-call)
//   benchmark/provider-ab/SUMMARY.md (running aggregate, append-only)
//
// Gate condition: do not run before Anthropic quota resets 2026-07-01.
// The 2026-06-28 envelope check will skip Anthropic gracefully and run
// GLM-only if the quota is still hit when this fires.

import { writeFileSync, mkdirSync, existsSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { callGlm } from "../lib/glm-call.js";
import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONNET_MODEL = "claude-sonnet-4-5-20250929";

// 5 voice-prompt cells representative of the 5-voice council. We use
// already-shipped PERSONA_PROMPTS + SCENARIO_CONTEXTS so the test
// hits the actual prompts that drive /api/deliberate in production.
const CELLS = [
  { id: "compliance-policy",  persona: "compliance", scenario: "policy",    voice: "junior",  question: "Cov-lite request — what documentation do I need before Credit Committee?", expected_terms: ["Credit Committee", "cov-lite", "Policy"] },
  { id: "quant-cds",          persona: "quant",      scenario: "cds",       voice: "senior",  question: "Regime-shift HMM at 0.74 — alert credit desk?", expected_terms: ["regime", "VIX", "false-positive"] },
  { id: "engineer-lbo",       persona: "engineer",   scenario: "lbo",       voice: "junior",  question: "Refactor credit-decision pipeline — service boundary?", expected_terms: ["async", "circuit-breaker", "Fair Lending"] },
  { id: "trader-cds",         persona: "trader",     scenario: "cds",       voice: "senior",  question: "CDX widened 34bps WoW — rotate to credit protection?", expected_terms: ["carry", "regime", "Policy"] },
  { id: "advisor-lbo",        persona: "advisor",    scenario: "lbo",       voice: "third",   question: "HNW client $2M into TLB — Reg BI suitable?", expected_terms: ["Reg BI", "IPS", "suitability"] },
];

const ENVELOPE_PATTERNS = [
  /usage limit/i,
  /api usage limits/i,
  /credit_balance_too_low/i,
  /insufficient_quota/i,
  /reached your specified/i,
];

function parseArgs(argv) {
  const out = { runs: 3, providers: ["anthropic", "glm"] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--runs") out.runs = parseInt(argv[++i], 10);
    else if (a === "--providers") out.providers = argv[++i].split(",");
  }
  return out;
}

function isEnvelopeError(err) {
  const msg = err?.message || "";
  return ENVELOPE_PATTERNS.some((re) => re.test(msg));
}

function buildUserMessage(cell) {
  const ctx = SCENARIO_CONTEXTS[cell.scenario];
  return `Scenario context:\n${ctx}\n\nUser question: ${cell.question}\n\nRespond with a single paragraph in your voice. No preamble. Plain prose.`;
}

async function callAnthropic(cell) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompts = PERSONA_PROMPTS[cell.persona];
  const systemPrompt = prompts[cell.voice];
  const t0 = Date.now();
  const resp = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 220,
    system: systemPrompt,
    messages: [{ role: "user", content: buildUserMessage(cell) }],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return { text, latency_ms: Date.now() - t0, provider: "anthropic", model: SONNET_MODEL };
}

async function callGlmProvider(cell) {
  const prompts = PERSONA_PROMPTS[cell.persona];
  const systemPrompt = prompts[cell.voice];
  const t0 = Date.now();
  const r = await callGlm({
    systemPrompt,
    userMessage: buildUserMessage(cell),
    maxTokens: 220,
  });
  return { text: r.text, latency_ms: Date.now() - t0, provider: "glm", model: r.model };
}

// Same deterministic structural scoring as benchmark/runner.js so the two
// numbers are comparable. Length 100-600 + term coverage + ends with a period.
function scoreResponse(text, expected_terms) {
  let termHits = 0;
  for (const term of expected_terms) {
    if (text.toLowerCase().includes(term.toLowerCase())) termHits++;
  }
  return {
    length_ok: text.length >= 100 && text.length <= 600,
    char_count: text.length,
    term_coverage: termHits / expected_terms.length,
    ends_with_period: /[.!?]$/.test(text.trim()),
  };
}

async function runOneCall(cell, provider) {
  try {
    if (provider === "anthropic") return await callAnthropic(cell);
    if (provider === "glm")       return await callGlmProvider(cell);
    throw new Error(`unknown provider: ${provider}`);
  } catch (err) {
    if (isEnvelopeError(err)) {
      return { skipped: true, reason: "envelope", message: err.message.slice(0, 200), provider };
    }
    return { error: err.message, provider };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`GLM vs Sonnet A/B benchmark`);
  console.log(`runs: ${args.runs}  providers: ${args.providers.join(",")}  cells: ${CELLS.length}`);
  console.log(`total calls: ${args.runs * args.providers.length * CELLS.length}`);
  console.log("");

  const report = {
    run_at: new Date().toISOString(),
    runs_per_cell: args.runs,
    providers: args.providers,
    n_cells: CELLS.length,
    results: [],
  };

  for (const cell of CELLS) {
    for (const provider of args.providers) {
      for (let r = 0; r < args.runs; r++) {
        process.stdout.write(`[${cell.id} × ${provider} × run-${r + 1}] `);
        const result = await runOneCall(cell, provider);
        if (result.skipped) {
          console.log(`SKIP envelope: ${result.message.slice(0, 80)}`);
          report.results.push({ cell: cell.id, provider, run: r + 1, skipped: true, reason: result.reason });
          continue;
        }
        if (result.error) {
          console.log(`ERROR: ${result.error.slice(0, 120)}`);
          report.results.push({ cell: cell.id, provider, run: r + 1, error: result.error });
          continue;
        }
        const scored = scoreResponse(result.text, cell.expected_terms);
        console.log(`len=${scored.char_count} terms=${(scored.term_coverage * 100).toFixed(0)}% latency=${result.latency_ms}ms`);
        report.results.push({
          cell: cell.id,
          provider,
          model: result.model,
          run: r + 1,
          ...scored,
          latency_ms: result.latency_ms,
          text_sample: result.text.slice(0, 200),
        });
      }
    }
  }

  // Aggregate per-provider × per-cell
  const summary = {};
  for (const r of report.results) {
    if (r.skipped || r.error) continue;
    const key = `${r.provider}/${r.cell}`;
    if (!summary[key]) summary[key] = { n: 0, term_coverage_sum: 0, latency_sum: 0, length_ok_count: 0 };
    summary[key].n++;
    summary[key].term_coverage_sum += r.term_coverage;
    summary[key].latency_sum += r.latency_ms;
    if (r.length_ok) summary[key].length_ok_count++;
  }
  report.summary = {};
  for (const [key, s] of Object.entries(summary)) {
    report.summary[key] = {
      n: s.n,
      mean_term_coverage: +(s.term_coverage_sum / s.n).toFixed(3),
      mean_latency_ms: Math.round(s.latency_sum / s.n),
      length_ok_rate: +(s.length_ok_count / s.n).toFixed(3),
    };
  }

  // Write the raw report
  const outdir = join(__dirname, "..", "benchmark", "provider-ab");
  mkdirSync(outdir, { recursive: true });
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
  const outpath = join(outdir, `ab-${ts}.json`);
  writeFileSync(outpath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outpath}`);

  // Append to SUMMARY.md
  const summaryPath = join(outdir, "SUMMARY.md");
  if (!existsSync(summaryPath)) {
    writeFileSync(summaryPath,
      `# Shadow Provider A/B Benchmark — Running Log\n\n` +
      `> 5 voice-prompts × 2 providers (Anthropic Sonnet 4.6 / GLM-5.2) × N runs.\n` +
      `> Deterministic structural scoring (length 100-600, expected-term coverage, ends-with-period).\n` +
      `> Closes 2026-06-26 daily-brief distill action #6.\n\n`
    );
  }
  let rows = `## Run ${report.run_at}\n\nruns/cell: ${args.runs}  providers: ${args.providers.join(",")}\n\n`;
  rows += `| Cell × Provider | n | term cov | latency ms | length-ok rate |\n|---|---|---|---|---|\n`;
  for (const [key, s] of Object.entries(report.summary)) {
    rows += `| ${key} | ${s.n} | ${s.mean_term_coverage} | ${s.mean_latency_ms} | ${s.length_ok_rate} |\n`;
  }
  rows += "\n";
  appendFileSync(summaryPath, rows);
  console.log(`Summary: ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
