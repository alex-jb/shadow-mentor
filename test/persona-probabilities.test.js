// test/persona-probabilities.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Pins the design contract of lib/persona-probabilities.js:
//   1. argmax(probabilities) === the voice's deterministic verdict on a dense
//      grid of loans (probabilities refine, never contradict, the rules);
//   2. probabilities sum to 1 and are deterministic;
//   3. monotone: further from the threshold → more mass on the verdict class;
//   4. the runLoanCouncil response carries `probabilities` on every voice
//      while `confidence` and the 5-voice shape stay byte-compatible.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import {
  creditFundamentalsProbabilities,
  roundProbabilities,
  MARGIN_SCALES,
  BINARY_MARGIN,
} from "../lib/persona-probabilities.js";

const BASE = {
  applicant_id: "prob-0001",
  credit_score: 760,
  debt_to_income: 0.28,
  loan_to_value: 0.6,
  loan_amount: 250000,
  sector: "technology",
};

function argmax(p) {
  return Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
}

test("every voice's argmax(probabilities) equals its verdict across a loan grid", () => {
  const ficos = [580, 650, 699, 700, 701, 740, 820];
  const dtis = [0.1, 0.3, 0.36, 0.37, 0.5];
  const ltvs = [0.4, 0.8, 0.85, 0.95];
  const flags = [false, true];
  let checked = 0;
  for (const credit_score of ficos)
    for (const debt_to_income of dtis)
      for (const loan_to_value of ltvs)
        for (const fair_lending_review_flag of flags) {
          const res = runLoanCouncil({
            ...BASE, credit_score, debt_to_income, loan_to_value, fair_lending_review_flag,
          });
          for (const v of res.voices) {
            assert.ok(v.probabilities, `${v.voice} missing probabilities`);
            assert.equal(
              argmax(v.probabilities), v.verdict,
              `${v.voice}: argmax ${JSON.stringify(v.probabilities)} !== verdict ${v.verdict} ` +
              `(fico=${credit_score} dti=${debt_to_income} ltv=${loan_to_value} flag=${fair_lending_review_flag})`,
            );
            checked += 1;
          }
        }
  assert.ok(checked >= 5 * ficos.length * dtis.length * ltvs.length * flags.length);
});

test("probabilities sum to 1 (±1e-9) and every entry is within (0,1)", () => {
  const res = runLoanCouncil({ ...BASE, credit_score: 640, debt_to_income: 0.41 });
  for (const v of res.voices) {
    const { approve, escalate, block } = v.probabilities;
    assert.ok(Math.abs(approve + escalate + block - 1) < 1e-9, v.voice);
    for (const x of [approve, escalate, block]) assert.ok(x > 0 && x < 1, v.voice);
  }
});

test("deterministic: identical input → identical probabilities", () => {
  const a = runLoanCouncil({ ...BASE });
  const b = runLoanCouncil({ ...BASE });
  assert.deepEqual(
    a.voices.map((v) => v.probabilities),
    b.voices.map((v) => v.probabilities),
  );
});

test("monotone: deeper FICO failure moves mass toward block", () => {
  const shallow = creditFundamentalsProbabilities({ ...BASE, credit_score: 695, debt_to_income: 0.3 });
  const deep = creditFundamentalsProbabilities({ ...BASE, credit_score: 560, debt_to_income: 0.3 });
  assert.ok(deep.block > shallow.block, `deep=${deep.block} shallow=${shallow.block}`);
});

test("threshold edge: verdict class holds exactly 0.5 at zero margin", () => {
  const edge = creditFundamentalsProbabilities({
    ...BASE, credit_score: 700, debt_to_income: 0.36, // both margins exactly 0 → weakest = 0
  });
  assert.equal(argmax(edge), "approve");
  assert.ok(Math.abs(edge.approve - 0.5) < 1e-9, `edge approve=${edge.approve}`);
});

test("binary rules saturate but never reach certainty", () => {
  const res = runLoanCouncil({ ...BASE, fair_lending_review_flag: true });
  const fl = res.voices.find((v) => v.voice === "Fair Lending Compliance");
  assert.equal(argmax(fl.probabilities), "block");
  assert.ok(fl.probabilities.block > 0.85 && fl.probabilities.block < 1);
  const expected = 0.5 + 0.49 * (BINARY_MARGIN / (1 + BINARY_MARGIN));
  assert.ok(Math.abs(fl.probabilities.block - Math.round(expected * 1e6) / 1e6) < 1e-6);
});

test("back-compat: confidence constants and 5-voice shape are untouched", () => {
  const res = runLoanCouncil({ ...BASE });
  assert.equal(res.voices.length, 5);
  assert.deepEqual(
    res.voices.map((v) => v.confidence),
    [0.82, 0.78, 0.91, 0.74, 0.69],
  );
});

test("roundProbabilities keeps the sum at exactly 1 after 6dp rounding", () => {
  const p = roundProbabilities({ approve: 1 / 3, escalate: 1 / 3, block: 1 / 3 });
  assert.ok(Math.abs(p.approve + p.escalate + p.block - 1) < 1e-9);
});

test("MARGIN_SCALES drift guard: scales are calibration-only tuning surface", () => {
  // Scales must stay positive and finite; a zero/negative scale would flip
  // margins and break argmax-consistency silently.
  for (const [k, v] of Object.entries(MARGIN_SCALES)) {
    assert.ok(Number.isFinite(v) && v > 0, k);
  }
});
