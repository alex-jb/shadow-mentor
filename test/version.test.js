// Contract tests for /api/version — bank compliance reviewers pin a
// review to a specific git SHA. If the shape changes silently, their
// audit trail breaks.

import { test } from "node:test";
import assert from "node:assert/strict";
import versionHandler from "../api/version.js";

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

test("version endpoint returns 200", async () => {
  const res = mockRes();
  await versionHandler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
});

test("version endpoint reports service identity", async () => {
  const res = mockRes();
  await versionHandler({ method: "GET" }, res);
  assert.equal(res.body.service, "shadow-mentor");
  assert.ok(res.body.package_version);
  assert.equal(res.body.rubric_version, "0.3.3");
});

test("version endpoint exposes git fields (null when local)", async () => {
  const res = mockRes();
  await versionHandler({ method: "GET" }, res);
  // local dev: vercel env vars are not set, so these are null. that's the contract.
  assert.ok("git_sha" in res.body);
  assert.ok("git_branch" in res.body);
  assert.ok("git_message" in res.body);
});

test("version endpoint includes node version", async () => {
  const res = mockRes();
  await versionHandler({ method: "GET" }, res);
  assert.match(res.body.node_version, /^v\d+\.\d+\.\d+/);
});

test("version endpoint sets 5-minute cache", async () => {
  const res = mockRes();
  await versionHandler({ method: "GET" }, res);
  assert.match(res.headers["Cache-Control"], /max-age=300/);
});
