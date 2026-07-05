// Contract tests for bin/generate-attestation-keypair.mjs — the deploy
// bootstrap CLI shipped in v1.5.4.
//
// Two things we cannot let drift:
//   1. The generated keypair MUST round-trip through verifyAttestation()
//      end-to-end. If someone breaks the key format (PEM headers,
//      encoding), every downstream Shadow deployment silently produces
//      unverifiable signatures.
//   2. File permissions on the private key. If chmod 0600 stops working
//      on the runner, the CI matrix may write world-readable private
//      keys on shared systems. Pin the mode.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, statSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { generateKeypair, envBlockFor } from "../bin/generate-attestation-keypair.mjs";
import { buildAttestation, verifyAttestation, SIGNATURE_MODES } from "../lib/attestation.js";

const CLI = join(process.cwd(), "bin", "generate-attestation-keypair.mjs");

function tmp() {
  const d = mkdtempSync(join(tmpdir(), "shadow-keypair-test-"));
  return { dir: d, cleanup: () => rmSync(d, { recursive: true, force: true }) };
}

describe("keypair primitive", () => {
  test("generated keypair round-trips through verifyAttestation()", () => {
    const { privateKey, publicKey } = generateKeypair();
    const request = { loan: { credit_score: 720 } };
    const response = { verdict: "approve" };
    const att = buildAttestation({
      request, response, modelId: "sonnet",
      mode: SIGNATURE_MODES.ED25519, privateKey, keyId: "test-round-trip",
    });
    const result = verifyAttestation(att, request, response, { publicKey });
    assert.equal(result.ok, true, "generated keypair must verify against itself");
    assert.equal(att.key_id, "test-round-trip");
  });

  test("generated private key is PEM PKCS8", () => {
    const { privateKey } = generateKeypair();
    assert.ok(privateKey.includes("-----BEGIN PRIVATE KEY-----"),
      "private key missing PEM header — Node's crypto.sign will reject it");
    assert.ok(privateKey.includes("-----END PRIVATE KEY-----"),
      "private key missing PEM footer");
  });

  test("generated public key is PEM SPKI", () => {
    const { publicKey } = generateKeypair();
    assert.ok(publicKey.includes("-----BEGIN PUBLIC KEY-----"),
      "public key missing PEM header — verifiers will reject it");
    assert.ok(publicKey.includes("-----END PUBLIC KEY-----"),
      "public key missing PEM footer");
  });
});

describe("envBlockFor formatter", () => {
  test("stamps SHADOW_ATTESTATION_MODE=ed25519 (not hmac fallback)", () => {
    const block = envBlockFor("PEM", "key-abc");
    assert.match(block, /SHADOW_ATTESTATION_MODE=ed25519/);
    assert.match(block, /SHADOW_ATTESTATION_KEY_ID=key-abc/);
  });

  test("JSON-quotes the PEM so embedded newlines survive shell paste", () => {
    const { privateKey } = generateKeypair();
    const block = envBlockFor(privateKey, "v1");
    // JSON.stringify escapes \n to literal \\n — this is what makes
    // multiline PEMs survive dashboard paste-boxes.
    assert.ok(block.includes("SHADOW_ATTESTATION_ED25519_PRIVATE_KEY=\""),
      "env block does not quote the PEM");
    assert.ok(block.includes("\\n"),
      "env block does not escape newlines — pasted PEM will fail to parse");
  });
});

describe("CLI end-to-end (subprocess)", () => {
  test("writes both files with correct modes 0600 / 0644", (t) => {
    const { dir, cleanup } = tmp();
    t.after(cleanup);
    const r = spawnSync("node", [CLI, "--out", dir, "--key-id", "cli-e2e"], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `CLI exited ${r.status}: ${r.stderr}`);

    const privPath = join(dir, "shadow-private.pem");
    const pubPath = join(dir, "shadow-public.pem");
    assert.ok(existsSync(privPath), "shadow-private.pem not written");
    assert.ok(existsSync(pubPath), "shadow-public.pem not written");

    // Mode check — mask off file-type bits.
    // Skip on Windows runners where chmod is a no-op.
    if (process.platform !== "win32") {
      const privMode = statSync(privPath).mode & 0o777;
      const pubMode = statSync(pubPath).mode & 0o777;
      assert.equal(privMode, 0o600,
        `private key mode is ${privMode.toString(8)}, expected 600 — world-readable private key is a leak vector`);
      assert.equal(pubMode, 0o644,
        `public key mode is ${pubMode.toString(8)}, expected 644`);
    }
  });

  test("refuses to overwrite existing files without --force", (t) => {
    const { dir, cleanup } = tmp();
    t.after(cleanup);
    // First run: succeeds
    let r = spawnSync("node", [CLI, "--out", dir], { encoding: "utf8" });
    assert.equal(r.status, 0);
    // Second run: refuses
    r = spawnSync("node", [CLI, "--out", dir], { encoding: "utf8" });
    assert.equal(r.status, 1, "second run without --force must exit 1");
    assert.match(r.stderr, /already exists/);
    assert.match(r.stderr, /--force/);
  });

  test("overwrites with --force", (t) => {
    const { dir, cleanup } = tmp();
    t.after(cleanup);
    let r = spawnSync("node", [CLI, "--out", dir], { encoding: "utf8" });
    assert.equal(r.status, 0);
    const firstKey = readFileSync(join(dir, "shadow-private.pem"), "utf8");
    r = spawnSync("node", [CLI, "--out", dir, "--force"], { encoding: "utf8" });
    assert.equal(r.status, 0);
    const secondKey = readFileSync(join(dir, "shadow-private.pem"), "utf8");
    assert.notEqual(firstKey, secondKey, "--force should rotate to a new keypair");
  });

  test("--print-only writes nothing to disk", (t) => {
    const { dir, cleanup } = tmp();
    t.after(cleanup);
    const r = spawnSync(
      "node", [CLI, "--out", dir, "--print-only"], { encoding: "utf8" }
    );
    assert.equal(r.status, 0);
    assert.equal(existsSync(join(dir, "shadow-private.pem")), false);
    assert.equal(existsSync(join(dir, "shadow-public.pem")), false);
    assert.match(r.stdout, /BEGIN PUBLIC KEY/);
    assert.match(r.stdout, /BEGIN PRIVATE KEY/);
    assert.match(r.stdout, /SHADOW_ATTESTATION_MODE=ed25519/);
  });

  test("--help exits 0 without generating a key", () => {
    const r = spawnSync("node", [CLI, "--help"], { encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /Usage:/);
  });

  test("unknown flag exits 2 with a message", () => {
    const r = spawnSync("node", [CLI, "--rocket-boosters"], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown flag/);
  });
});
