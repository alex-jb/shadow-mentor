// Wiring tests — confirms the EMA OAuth scaffold actually gates the
// /api/loan-council HTTP endpoint when SHADOW_REQUIRE_BEARER=1.
//
// Pins the procurement contract: a bank deploying Shadow can flip one
// env var and every loan-council call requires an enterprise-IdP-issued
// token with the shadow:council scope. Before this commit the scope
// catalog existed only as a pinned data structure; now it's an active
// 401 / 403 surface.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

const VALID_LOAN = {
  credit_score: 740,
  debt_to_income: 0.28,
  loan_to_value: 0.65,
  amount: 250000,
  sector: "industrials",
};

function mockReqRes({ method = "POST", body = { loan: VALID_LOAN }, headers = {} } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; },
  };
  const req = { method, body, headers };
  return { req, res };
}

async function callHandler(env, req, res) {
  // Fresh module load so the REQUIRE_BEARER constant binds to the
  // current process.env. node:test runs tests in the same VM by default
  // so we use an import-time bust via query string + clear cache.
  const prevReq = process.env.SHADOW_REQUIRE_BEARER;
  process.env.SHADOW_REQUIRE_BEARER = env.SHADOW_REQUIRE_BEARER ?? "";
  try {
    // Cache-bust by appending a unique query — ESM module cache is
    // keyed on the resolved URL.
    const ts = `${Date.now()}-${Math.random()}`;
    const mod = await import(`../api/loan-council.js?t=${ts}`);
    await mod.default(req, res);
  } finally {
    if (prevReq === undefined) delete process.env.SHADOW_REQUIRE_BEARER;
    else process.env.SHADOW_REQUIRE_BEARER = prevReq;
  }
}

describe("EMA wiring on /api/loan-council", () => {
  test("backwards-compatible: with no SHADOW_REQUIRE_BEARER, a clean POST returns a council verdict", async () => {
    const { req, res } = mockReqRes();
    await callHandler({ SHADOW_REQUIRE_BEARER: "" }, req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(["approve", "escalate", "block"].includes(res.body.final_verdict));
  });

  test("with SHADOW_REQUIRE_BEARER=1 + no auth header, returns 401 unauthorized + WWW-Authenticate", async () => {
    const { req, res } = mockReqRes();
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "unauthorized");
    assert.equal(res.body.required_scope, "shadow:council");
    assert.match(res.headers["www-authenticate"], /Bearer/);
    assert.match(res.headers["www-authenticate"], /shadow:council/);
  });

  test("with SHADOW_REQUIRE_BEARER=1 + Bearer header but no X-Token-Claims, returns 401 with hint", async () => {
    const { req, res } = mockReqRes({
      headers: { authorization: "Bearer fake.jwt.token" }
    });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.reason, /no X-Token-Claims/);
  });

  test("with SHADOW_REQUIRE_BEARER=1 + X-Token-Claims for read-only scope, returns 403 forbidden", async () => {
    // A user holding shadow:read tries to call shadow_loan_council
    // (which requires shadow:council). Procurement contract: read can
    // never escalate to write.
    const claims = JSON.stringify({ scope: "shadow:read" });
    const { req, res } = mockReqRes({
      headers: { "x-token-claims": claims }
    });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "forbidden");
    assert.match(res.body.reason, /none of \[shadow:read\] grants shadow_loan_council/);
  });

  test("with SHADOW_REQUIRE_BEARER=1 + X-Token-Claims for shadow:council, returns 200 verdict", async () => {
    const claims = JSON.stringify({ scope: "shadow:council openid profile" });
    const { req, res } = mockReqRes({
      headers: { "x-token-claims": claims }
    });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(["approve", "escalate", "block"].includes(res.body.final_verdict));
  });

  test("with SHADOW_REQUIRE_BEARER=1 + X-Token-Claims for shadow:admin, also returns 200 (admin grants council)", async () => {
    const claims = JSON.stringify({ scope: "shadow:admin" });
    const { req, res } = mockReqRes({
      headers: { "x-token-claims": claims }
    });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 200);
  });

  test("with SHADOW_REQUIRE_BEARER=1 + Azure AD scp[] shape claims, returns 200", async () => {
    // Azure AD ships scopes as an array under "scp", not a space string.
    const claims = JSON.stringify({ scp: ["shadow:council"] });
    const { req, res } = mockReqRes({
      headers: { "x-token-claims": claims }
    });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 200);
  });

  test("with SHADOW_REQUIRE_BEARER=1 + malformed X-Token-Claims, returns 401", async () => {
    const { req, res } = mockReqRes({
      headers: { "x-token-claims": "{not-json" }
    });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.reason, /not valid JSON/);
  });

  test("CORS Access-Control-Allow-Headers includes the two auth header names", async () => {
    const { req, res } = mockReqRes({ method: "OPTIONS" });
    await callHandler({ SHADOW_REQUIRE_BEARER: "1" }, req, res);
    assert.equal(res.statusCode, 200);
    const allowed = res.headers["access-control-allow-headers"] || "";
    assert.match(allowed, /Authorization/i);
    assert.match(allowed, /X-Token-Claims/i);
  });
});
