// demos/replay/3d/study/score.mjs
// ─────────────────────────────────────────────────────────────────
// Scoring harness for the user study (Method §3.6). Turns a participant's
// answers into the two primary outcomes, objectively against ground truth:
//   • localization correctness — binary: did they name the altered event?
//   • impact-scope accuracy    — F1 (and Jaccard) of their named affected-set
//                                vs. the true downstream set.
// Reported separately so a fast-but-wrong localization can't inflate the scope
// score. Pure functions are exported for the test suite.
//
// Run:
//   node score.mjs --selftest
//   node score.mjs --key trials/answer-key.json --responses responses.json
//
// responses.json shape:
//   { "trial-01": { "altered_seq": 6, "affected_set": [7,8,9,10,11] }, ... }
// ─────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// F1 / precision / recall / Jaccard between a guessed set and the truth set.
export function setScores(guess, truth) {
  const g = new Set(guess), t = new Set(truth);
  let tp = 0;
  for (const x of g) if (t.has(x)) tp++;
  const fp = g.size - tp;
  const fn = t.size - tp;
  const precision = g.size ? tp / g.size : (t.size ? 0 : 1);
  const recall = t.size ? tp / t.size : (g.size ? 0 : 1);
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 1;
  const union = g.size + t.size - tp;
  const jaccard = union ? tp / union : 1;
  return { tp, fp, fn, precision, recall, f1, jaccard };
}

// Score one trial: {localized: bool, scope: {...}}.
export function scoreTrial(response, truth) {
  const localized = Number(response?.altered_seq) === Number(truth.altered_seq);
  const scope = setScores(response?.affected_set ?? [], truth.affected_set);
  return { localized, scope };
}

// Score a whole response file against an answer key. Returns per-trial rows +
// aggregate means (localization rate, mean scope F1/Jaccard).
export function scoreAll(responses, key) {
  const rows = [];
  for (const [name, truth] of Object.entries(key.trials)) {
    const resp = responses[name];
    if (!resp) continue;
    const s = scoreTrial(resp, truth);
    rows.push({ trial: name, localized: s.localized, f1: s.scope.f1, jaccard: s.scope.jaccard,
      precision: s.scope.precision, recall: s.scope.recall });
  }
  const n = rows.length || 1;
  const mean = (k) => rows.reduce((a, r) => a + (typeof r[k] === "boolean" ? (r[k] ? 1 : 0) : r[k]), 0) / n;
  return { rows, aggregate: { trials: rows.length, localization_rate: mean("localized"),
    mean_f1: mean("f1"), mean_jaccard: mean("jaccard") } };
}

function selftest() {
  const truth = { altered_seq: 6, affected_set: [7, 8, 9, 10, 11] };
  const perfect = scoreTrial({ altered_seq: 6, affected_set: [7, 8, 9, 10, 11] }, truth);
  const partial = scoreTrial({ altered_seq: 6, affected_set: [7, 8, 9] }, truth); // missed 10,11
  const over = scoreTrial({ altered_seq: 5, affected_set: [6, 7, 8, 9, 10, 11] }, truth); // wrong loc + over-claim
  const ok = perfect.localized && perfect.scope.f1 === 1
    && !over.localized && Math.abs(partial.scope.recall - 0.6) < 1e-9
    && Math.abs(partial.scope.f1 - 0.75) < 1e-9;
  console.log("perfect:", JSON.stringify(perfect));
  console.log("partial (missed 2):", JSON.stringify(partial.scope));
  console.log("wrong-loc + over-claim:", JSON.stringify(over));
  console.log(ok ? "[selftest] PASS" : "[selftest] FAIL");
  process.exit(ok ? 0 : 1);
}

// CLI only when run directly (not when imported by the test suite).
const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly) {
  if (process.argv.includes("--selftest")) selftest();
  else {
    const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : null; };
    const keyPath = arg("key"), respPath = arg("responses");
    if (!keyPath || !respPath) {
      console.error("usage: node score.mjs --key trials/answer-key.json --responses responses.json  (or --selftest)");
      process.exit(2);
    }
    const key = JSON.parse(readFileSync(keyPath, "utf8"));
    const responses = JSON.parse(readFileSync(respPath, "utf8"));
    const result = scoreAll(responses, key);
    console.table(result.rows);
    console.log("aggregate:", JSON.stringify(result.aggregate, null, 2));
  }
}
