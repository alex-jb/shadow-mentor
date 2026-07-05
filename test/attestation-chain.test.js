// v1.5.10 — hash-chain integrity contract tests.
//
// Chain integrity is the hardest evidence to forge — any single-record
// edit cascades forward through every link. This suite pins:
//   - the primitive: computeAttestationHash + verifyChain
//   - the HTTP endpoint: POST /api/verify-chain
//   - the CLI: bin/verify-chain.mjs against JSONL logs
//
// Attack surface intentionally covered: reordering, insertion, deletion,
// tampering with prior-record content, and empty/singleton edge cases.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { computeAttestationHash, verifyChain } from "../lib/attestation-chain.js";
import { buildAttestation, SIGNATURE_MODES } from "../lib/attestation.js";
import verifyChainHandler from "../api/verify-chain.js";

function mockReq(body = {}, method = "POST") {
  return { method, body, headers: { "content-type": "application/json" } };
}
function mockRes() {
  const res = {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; }
  };
  return res;
}

function makeChain(n) {
  const { privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const chain = [];
  let previousHash = null;
  for (let i = 0; i < n; i++) {
    const att = buildAttestation({
      request: { loan_id: `CHAIN-${i}` },
      response: { verdict: i % 3 === 0 ? "block" : "approve" },
      modelId: "sonnet",
      mode: SIGNATURE_MODES.ED25519, privateKey,
      previousHash,
    });
    chain.push(att);
    previousHash = computeAttestationHash(att);
  }
  return chain;
}

describe("computeAttestationHash primitive", () => {
  test("returns 64-char lowercase hex", () => {
    const att = buildAttestation({
      request: {}, response: {}, modelId: "sonnet",
      mode: SIGNATURE_MODES.HMAC, secret: "s",
    });
    const h = computeAttestationHash(att);
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  test("deterministic — same input → same hash", () => {
    const att = buildAttestation({
      request: { a: 1 }, response: { b: 2 }, modelId: "sonnet",
      mode: SIGNATURE_MODES.HMAC, secret: "s",
    });
    assert.equal(computeAttestationHash(att), computeAttestationHash(att));
  });

  test("differs when signature differs", () => {
    const att1 = buildAttestation({
      request: {}, response: {}, modelId: "sonnet",
      mode: SIGNATURE_MODES.HMAC, secret: "s1",
    });
    const att2 = buildAttestation({
      request: {}, response: {}, modelId: "sonnet",
      mode: SIGNATURE_MODES.HMAC, secret: "s2",
      completedAtUtc: att1.completed_at_utc,  // isolate diff to signature
    });
    assert.notEqual(computeAttestationHash(att1), computeAttestationHash(att2));
  });

  test("throws on non-object", () => {
    assert.throws(() => computeAttestationHash(null));
    assert.throws(() => computeAttestationHash("string"));
  });
});

describe("verifyChain — happy paths", () => {
  test("empty chain → ok", () => {
    const r = verifyChain([]);
    assert.equal(r.ok, true);
    assert.equal(r.length, 0);
    assert.equal(r.links_verified, 0);
  });

  test("single-element chain with null previous_hash → ok", () => {
    const chain = makeChain(1);
    const r = verifyChain(chain);
    assert.equal(r.ok, true);
    assert.equal(r.length, 1);
    assert.equal(r.links_verified, 0);
  });

  test("5-element intact chain → all links verify", () => {
    const chain = makeChain(5);
    const r = verifyChain(chain);
    assert.equal(r.ok, true);
    assert.equal(r.length, 5);
    assert.equal(r.links_verified, 4);
    assert.equal(r.broken_at_index, null);
  });
});

describe("verifyChain — attack detection", () => {
  test("first element has previous_hash → chain truncation detected", () => {
    const chain = makeChain(3);
    // Simulate: attacker deleted the first entry, leaving what was #2
    // as the "new first" — but its previous_hash points to the deleted #1.
    const truncated = chain.slice(1);
    const r = verifyChain(truncated);
    assert.equal(r.ok, false);
    assert.equal(r.broken_at_index, 0);
    assert.match(r.reason, /truncated|deleted/);
  });

  test("reordering breaks the chain at the first swapped pair", () => {
    const chain = makeChain(4);
    // Swap indices 1 and 2
    const reordered = [chain[0], chain[2], chain[1], chain[3]];
    const r = verifyChain(reordered);
    assert.equal(r.ok, false);
    assert.equal(r.broken_at_index, 1);
  });

  test("mid-chain insertion of a fabricated record breaks the following link", () => {
    const chain = makeChain(3);
    const fabricated = buildAttestation({
      request: { loan_id: "INJECTED" }, response: { verdict: "approve" },
      modelId: "sonnet", mode: SIGNATURE_MODES.HMAC, secret: "attacker-key",
      previousHash: computeAttestationHash(chain[0]),
    });
    // Attacker inserts fabricated between 0 and 1. Their own previous_hash
    // matches chain[0], so link at index 1 verifies. But chain[1]'s
    // previous_hash still points to chain[0], not to fabricated — so
    // link at index 2 is where the break is detected.
    const attacked = [chain[0], fabricated, chain[1], chain[2]];
    const r = verifyChain(attacked);
    assert.equal(r.ok, false);
    assert.equal(r.broken_at_index, 2);
  });

  test("editing a prior record's response body cascades — detected at next link", () => {
    const chain = makeChain(3);
    // Attacker edits chain[0]'s output_commitment (as if they tampered
    // with the persisted response body of decision 0).
    chain[0] = {
      ...chain[0],
      output_commitment: "ff".repeat(32),
    };
    const r = verifyChain(chain);
    assert.equal(r.ok, false);
    assert.equal(r.broken_at_index, 1);
  });

  test("chain of one bad-shape input fails cleanly", () => {
    const r = verifyChain("not-an-array");
    assert.equal(r.ok, false);
    assert.match(r.reason, /array/);
  });
});

describe("POST /api/verify-chain endpoint", () => {
  test("verifies an intact 3-chain end-to-end", async () => {
    const chain = makeChain(3);
    const res = mockRes();
    await verifyChainHandler(mockReq({ attestations: chain }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.length, 3);
    assert.equal(res.body.links_verified, 2);
    assert.match(res.body.interpretation, /intact/);
  });

  test("returns compromised interpretation on broken chain", async () => {
    const chain = makeChain(3);
    chain[1].previous_hash = "cc".repeat(32);
    const res = mockRes();
    await verifyChainHandler(mockReq({ attestations: chain }), res);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.broken_at_index, 1);
    assert.match(res.body.interpretation, /COMPROMISED/);
  });

  test("rejects missing body with 400", async () => {
    const res = mockRes();
    await verifyChainHandler(mockReq({}), res);
    assert.equal(res.statusCode, 400);
  });

  test("rejects non-array attestations with 400", async () => {
    const res = mockRes();
    await verifyChainHandler(mockReq({ attestations: "not-array" }), res);
    assert.equal(res.statusCode, 400);
  });

  test("GET returns 405 with usage example", async () => {
    const res = mockRes();
    await verifyChainHandler(mockReq({}, "GET"), res);
    assert.equal(res.statusCode, 405);
    assert.ok(res.body.example.attestations);
  });
});

describe("bin/verify-chain.mjs CLI", () => {
  const CLI = join(process.cwd(), "bin", "verify-chain.mjs");

  test("intact JSONL log → exit 0 + green ✓", () => {
    const dir = mkdtempSync(join(tmpdir(), "shadow-chain-cli-"));
    try {
      const chain = makeChain(3);
      // Persist as envelopes (real Shadow shape)
      const jsonl = chain.map((att) => JSON.stringify({
        request: { any: true },
        response: { verdict: "approve", attestation: att },
      })).join("\n");
      const log = join(dir, "log.jsonl");
      writeFileSync(log, jsonl);
      const r = spawnSync("node", [CLI, "--log", log], { encoding: "utf8" });
      assert.equal(r.status, 0, `CLI failed: ${r.stderr}${r.stdout}`);
      assert.match(r.stdout, /chain intact/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("broken JSONL log → exit 1 + broken_at_index reported", () => {
    const dir = mkdtempSync(join(tmpdir(), "shadow-chain-cli-"));
    try {
      const chain = makeChain(3);
      chain[2].previous_hash = "cc".repeat(32);  // break link at index 2
      const jsonl = chain.map((att) => JSON.stringify({
        response: { attestation: att },
      })).join("\n");
      const log = join(dir, "log.jsonl");
      writeFileSync(log, jsonl);
      const r = spawnSync("node", [CLI, "--log", log], { encoding: "utf8" });
      assert.equal(r.status, 1);
      assert.match(r.stdout, /COMPROMISED/);
      assert.match(r.stdout, /broken_at_index: 2/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--field '' treats each line as raw attestation", () => {
    const dir = mkdtempSync(join(tmpdir(), "shadow-chain-cli-"));
    try {
      const chain = makeChain(2);
      const jsonl = chain.map((a) => JSON.stringify(a)).join("\n");
      const log = join(dir, "log.jsonl");
      writeFileSync(log, jsonl);
      const r = spawnSync("node", [CLI, "--log", log, "--field", ""], { encoding: "utf8" });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /chain intact/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing --log exits 2", () => {
    const r = spawnSync("node", [CLI], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--log is required/);
  });

  test("missing file exits 2", () => {
    const r = spawnSync("node", [CLI, "--log", "/nonexistent/audit.jsonl"], { encoding: "utf8" });
    assert.equal(r.status, 2);
  });
});
