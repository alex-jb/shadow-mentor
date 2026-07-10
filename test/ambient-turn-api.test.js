// test/ambient-turn-api.test.js
// v1.5.47 contract tests for POST /api/ambient-turn.

import { test } from "node:test";
import assert from "node:assert/strict";

import handler from "../api/ambient-turn.js";

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    ended: false,
  };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

async function call({ method = "POST", body = {} } = {}) {
  const req = { method, body };
  const res = mockRes();
  await handler(req, res);
  return res;
}


test("GET returns 405", async () => {
  const res = await call({ method: "GET" });
  assert.equal(res.statusCode, 405);
});

test("OPTIONS returns 204 with CORS headers", async () => {
  const res = await call({ method: "OPTIONS" });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});

test("missing question returns 400", async () => {
  const res = await call({
    body: { persona_ids: ["credit_fundamentals"] },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /question/);
});

test("missing persona_ids returns 400", async () => {
  const res = await call({
    body: { question: "Should we approve?" },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /persona_ids/);
});

test("minimum valid request returns descriptor", async () => {
  const res = await call({
    body: {
      question: "Test?",
      persona_ids: ["credit_fundamentals"],
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.descriptor_version, "1.0");
  assert.equal(res.body.personas.length, 1);
  assert.equal(res.body.verdict, null);
});

test("run_council=true without loan_context returns 400", async () => {
  const res = await call({
    body: {
      question: "?",
      persona_ids: ["credit_fundamentals"],
      run_council: true,
    },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /loan_context/);
});

test("run_council=true with invalid loan_context returns 400", async () => {
  const res = await call({
    body: {
      question: "?",
      persona_ids: ["credit_fundamentals"],
      run_council: true,
      loan_context: { credit_score: 1200 }, // out of range
    },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /invalid loan_context/);
});

test("run_council=true with valid loan returns descriptor + verdict", async () => {
  const res = await call({
    body: {
      question: "Should we approve this consumer loan?",
      persona_ids: ["credit_fundamentals", "risk_officer", "fair_lending", "customer_advocate", "macro_contrarian"],
      loan_context: {
        credit_score: 780,
        debt_to_income: 0.20,
        loan_to_value: 0.60,
        amount: 1_500_000,
        sector: "consumer_discretionary",
        borrower_rating: "AA",
        market_proxy_prices: [
          100.0, 100.3, 100.5, 100.4, 100.7, 100.9, 101.1, 101.0,
          101.3, 101.5, 101.6, 101.8, 102.0, 102.1, 102.3,
        ],
      },
      run_council: true,
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "approve");
  assert.equal(res.body.personas.length, 5);
  for (const p of res.body.personas) {
    assert.ok(p.verdict, `${p.id} missing verdict`);
  }
});

test("returns no-store cache header (live descriptor)", async () => {
  const res = await call({
    body: { question: "?", persona_ids: ["credit_fundamentals"] },
  });
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("unknown persona_id returns 400 with clean error", async () => {
  const res = await call({
    body: { question: "?", persona_ids: ["not_a_real_persona"] },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /unknown persona_id/);
});
