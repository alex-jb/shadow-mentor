// test/ocsf-export-surfaces.test.js
// The HTTP endpoint (POST /api/ocsf-export) and the CLI (shadow-ocsf) must
// produce the SAME OCSF projection as the library — one primitive, three surfaces.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createSession, appendEvent, sealSession } from "../packages/attest-core/session.js";
import { bundleToOcsf } from "../packages/adapter-ocsf/index.js";
import handler from "../api/ocsf-export.js";

const CLI = fileURLToPath(new URL("../packages/adapter-ocsf/cli-ocsf.mjs", import.meta.url));

function sealed() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "loan-council", version: "1.0.0", identity_ref: "op:acme-bank" },
    models: [{ model_id: "anthropic:claude-opus-4", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin-25.3.0", node_version: "24.14.1" },
    keyId: "prod-2026-q3", privateKey,
  });
  appendEvent(s, { event_type: "model_call", actor: "model", payload: { prompt: "score" } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { decision: "sign_off" } });
  return sealSession(s);
}

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
    end() { return this; },
  };
}

test("POST /api/ocsf-export returns the same events the library produces", async () => {
  const bundle = sealed();
  const res = mockRes();
  await handler({ method: "POST", body: { bundle } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.schema_version, "1.9.0");
  assert.equal(res.body.count, bundle.events.length);
  const lib = bundleToOcsf(bundle);
  assert.deepEqual(res.body.events, lib.events);
});

test("endpoint passes charter through to ai_agent.charter", async () => {
  const bundle = sealed();
  const res = mockRes();
  await handler({ method: "POST", body: { bundle, charter: "fair-lending council" } }, res);
  assert.equal(res.body.events[0].ai_agent.charter, "fair-lending council");
});

test("endpoint rejects a missing/malformed bundle with 400, not 500", async () => {
  const noBody = mockRes();
  await handler({ method: "POST", body: {} }, noBody);
  assert.equal(noBody.statusCode, 400);
  assert.match(noBody.body.error, /missing 'bundle'/);

  const bad = mockRes();
  await handler({ method: "POST", body: { bundle: { header: { agent: {} }, events: [] } } }, bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.body.ok, false);
});

test("endpoint rejects non-POST with 405", async () => {
  const res = mockRes();
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 405);
});

test("CLI shadow-ocsf emits the same events as the library", () => {
  const bundle = sealed();
  const dir = mkdtempSync(join(tmpdir(), "ocsf-cli-"));
  const path = join(dir, "bundle.json");
  writeFileSync(path, JSON.stringify(bundle));
  const stdout = execFileSync("node", [CLI, path], { encoding: "utf8" });
  const cliEvents = JSON.parse(stdout);
  assert.deepEqual(cliEvents, bundleToOcsf(bundle).events);
});

test("CLI --help exits 0 and prints usage; missing bundle exits 2", () => {
  const help = execFileSync("node", [CLI, "--help"], { encoding: "utf8" });
  assert.match(help, /shadow-ocsf/);
  assert.throws(
    () => execFileSync("node", [CLI], { encoding: "utf8", stdio: "pipe" }),
    (e) => e.status === 2,
  );
});
