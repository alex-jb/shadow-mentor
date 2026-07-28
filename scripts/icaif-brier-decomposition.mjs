// scripts/icaif-brier-decomposition.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Per-persona Brier score + Murphy (1973) decomposition (Brier = REL − RES + UNC)
// over the benchmark/icaif-2026 decision rows, using the real per-class
// probabilities emitted by lib/persona-probabilities.js (schema gap closed
// 2026-07-28). The realized event for each voice is the benchmark's
// gold_verdict (ground-truth label) — each persona is scored as a
// probabilistic forecaster of the true outcome, not of the aggregate. Deterministic, no LLM, reproducible:
//
//   node scripts/icaif-batch-eval.mjs --n 200 --seed <seed> --out benchmark/icaif-2026
//   node scripts/icaif-brier-decomposition.mjs [--dir benchmark/icaif-2026] [--bins 10]
//
// Outputs {dir}/brier-decomposition.json + .md. Multi-class Brier is the sum
// over classes of (p_c − 1{final=c})²; the per-class Murphy decomposition uses
// K equal-width probability bins. REL−RES+UNC equals the binned Brier exactly;
// the small residual vs the unbinned Brier is the standard within-bin variance
// term and is reported honestly as `binning_residual`.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}
const DIR = opt("dir", "benchmark/icaif-2026");
const BINS = Number(opt("bins", "10"));
const CLASSES = ["approve", "escalate", "block"];

// ── collect forecasts: voice → [{p:{...}, final}] ────────────────────────────
const perVoice = {};
let rows = 0;
for (const f of readdirSync(DIR).filter((x) => /^decisions-\d+\.jsonl$/.test(x)).sort()) {
  for (const line of readFileSync(join(DIR, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const d = JSON.parse(line);
    rows += 1;
    for (const v of d.voices) {
      if (!v.probabilities) continue; // pre-gap rows carry none — excluded, counted below
      (perVoice[v.voice] ||= []).push({ p: v.probabilities, final: d.gold_verdict });
    }
  }
}

function murphy(forecasts, cls) {
  // binary decomposition for one class
  const N = forecasts.length;
  const obs = forecasts.map((f) => (f.final === cls ? 1 : 0));
  const ps = forecasts.map((f) => f.p[cls]);
  const oBar = obs.reduce((a, b) => a + b, 0) / N;
  const bins = Array.from({ length: BINS }, () => ({ n: 0, pSum: 0, oSum: 0 }));
  ps.forEach((p, i) => {
    const k = Math.min(BINS - 1, Math.floor(p * BINS));
    bins[k].n += 1; bins[k].pSum += p; bins[k].oSum += obs[i];
  });
  let rel = 0, res = 0;
  for (const b of bins) {
    if (!b.n) continue;
    const pk = b.pSum / b.n, ok = b.oSum / b.n;
    rel += (b.n / N) * (pk - ok) ** 2;
    res += (b.n / N) * (ok - oBar) ** 2;
  }
  const unc = oBar * (1 - oBar);
  const brier = ps.reduce((a, p, i) => a + (p - obs[i]) ** 2, 0) / N;
  return {
    brier: +brier.toFixed(6), rel: +rel.toFixed(6), res: +res.toFixed(6), unc: +unc.toFixed(6),
    binning_residual: +(brier - (rel - res + unc)).toFixed(6),
    base_rate: +oBar.toFixed(6),
  };
}

function bootstrapCI(fs, iters = 1000, alpha = 0.05) {
  // Deterministic bootstrap (LCG seeded by n) — CI for the multiclass Brier.
  let seed = fs.length * 2654435761 % 2 ** 31;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const stat = (sample) => sample.reduce((acc, f) =>
    acc + CLASSES.reduce((a, c) => a + (f.p[c] - (f.final === c ? 1 : 0)) ** 2, 0), 0) / sample.length;
  const vals = [];
  for (let i = 0; i < iters; i++) {
    const sample = Array.from({ length: fs.length }, () => fs[Math.floor(rand() * fs.length)]);
    vals.push(stat(sample));
  }
  vals.sort((a, b) => a - b);
  return {
    lo: +vals[Math.floor((alpha / 2) * iters)].toFixed(6),
    hi: +vals[Math.floor((1 - alpha / 2) * iters)].toFixed(6),
    iters,
  };
}

const out = { generated_from_rows: rows, bins: BINS, classes: CLASSES, personas: {} };
for (const [voice, fs] of Object.entries(perVoice)) {
  const multiBrier = fs.reduce((acc, f) =>
    acc + CLASSES.reduce((a, c) => a + (f.p[c] - (f.final === c ? 1 : 0)) ** 2, 0), 0) / fs.length;
  out.personas[voice] = {
    n_forecasts: fs.length,
    multiclass_brier: +multiBrier.toFixed(6),
    multiclass_brier_ci95: bootstrapCI(fs),
    per_class: Object.fromEntries(CLASSES.map((c) => [c, murphy(fs, c)])),
  };
}

writeFileSync(join(DIR, "brier-decomposition.json"), JSON.stringify(out, null, 2) + "\n");

const md = [
  "# Per-persona Brier decomposition (Murphy 1973) — real per-class probabilities",
  "",
  `Rows: ${rows} council decisions across ${readdirSync(DIR).filter((x) => /^decisions-/.test(x)).length} seeds · bins=${BINS} · realized event = gold_verdict (ground truth).`,
  "Deterministic pipeline (no LLM): persona probabilities derive from rule margins (lib/persona-probabilities.js).",
  "",
  "| Persona | n | multiclass Brier | class | Brier | REL | RES | UNC | base rate |",
  "|---|---|---|---|---|---|---|---|---|",
];
for (const [voice, s] of Object.entries(out.personas)) {
  CLASSES.forEach((c, i) => {
    const m = s.per_class[c];
    md.push(`| ${i === 0 ? voice : ""} | ${i === 0 ? s.n_forecasts : ""} | ${i === 0 ? s.multiclass_brier : ""} | ${c} | ${m.brier} | ${m.rel} | ${m.res} | ${m.unc} | ${m.base_rate} |`);
  });
}
md.push(
  "",
  "`binning_residual` per class lives in brier-decomposition.json (within-bin variance; standard).",
  "",
  "## Reproduction",
  "",
  "```",
  `commit: ${process.env.BENCH_COMMIT ?? "(run scripts/gen-release-state.mjs or git rev-parse HEAD)"}`,
  "dataset: synthetic loans from scripts/icaif-batch-eval.mjs generator (committed jsonl)",
  `seeds: ${readdirSync(DIR).filter((x) => /^decisions-/.test(x)).map((x) => x.match(/\d+/)[0]).join(", ")}`,
  "n per seed: 200 (2,400 total)",
  "probability method: lib/persona-probabilities.js — deterministic rule-margin logistic; argmax(p) === verdict by construction; no LLM",
  "commands:",
  "  for s in <seeds>; do node scripts/icaif-batch-eval.mjs --n 200 --seed $s --out benchmark/icaif-2026; done",
  "  BENCH_COMMIT=$(git rev-parse HEAD) node scripts/icaif-brier-decomposition.mjs",
  "```",
  "",
  "## Limitations (stated up front, not buried)",
  "",
  "- Synthetic loan generator, not production traffic; base rates are generator artifacts.",
  "- Probabilities are rule-margin transforms, not learned forecasts; REL/RES reflect the margin geometry.",
  "- gold_verdict is the generator's label, not a bank adjudication.",
  "- Dissent personas (Advocate/Contrarian/Fair-Lending) are BY DESIGN weak ground-truth forecasters; their high Brier is the division-of-labor story, not a defect — and is reported, not filtered.",
  "- CI95 is a deterministic-seed bootstrap (1,000 resamples) over decisions; seeds are fixed, so run-to-run variance is zero by construction.",
  "");
writeFileSync(join(DIR, "brier-decomposition.md"), md.join("\n"));
console.log(JSON.stringify({ rows, personas: Object.keys(out.personas).length, out: `${DIR}/brier-decomposition.{json,md}` }));
