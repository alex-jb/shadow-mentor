// Smoke tests for /api/health and /api/badge — bank procurement reviewers
// hit these endpoints first, so a contract regression is a blocker.

import { test } from "node:test";
import assert from "node:assert/strict";
import healthHandler from "../api/health.js";
import badgeHandler from "../api/badge.js";

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  return res;
}

test("health endpoint returns ok status", async () => {
  const res = mockRes();
  await healthHandler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.service, "shadow-mentor");
});

test("health endpoint reports provider key state", async () => {
  const res = mockRes();
  await healthHandler({ method: "GET" }, res);
  assert.ok("providers_wired" in res.body);
  assert.ok("anthropic" in res.body.providers_wired);
  assert.ok("glm" in res.body.providers_wired);
});

test("health endpoint exposes current Shadow Agentic Score", async () => {
  const res = mockRes();
  await healthHandler({ method: "GET" }, res);
  const score = res.body.shadow_agentic_score;
  assert.ok(score === null || (typeof score === "number" && score >= 0 && score <= 100));
});

test("health endpoint sets no-store cache", async () => {
  const res = mockRes();
  await healthHandler({ method: "GET" }, res);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("badge endpoint returns shields.io schema", async () => {
  const res = mockRes();
  await badgeHandler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schemaVersion, 1);
  assert.equal(res.body.label, "shadow agentic score");
  assert.match(res.body.message, /^\d+\/100$/);
});

test("badge endpoint picks a valid shields color", async () => {
  const res = mockRes();
  await badgeHandler({ method: "GET" }, res);
  const validColors = ["brightgreen", "green", "yellowgreen", "yellow", "orange", "red"];
  assert.ok(validColors.includes(res.body.color));
});

test("badge endpoint sets shareable cache", async () => {
  const res = mockRes();
  await badgeHandler({ method: "GET" }, res);
  assert.match(res.headers["Cache-Control"], /max-age=\d+/);
});
