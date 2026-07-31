// B5 — one verifier, two runtimes, pinned equal. The browser (WebCrypto) verifier and the
// Node verifyBundle are separate implementations of the same canonicalization + hash-chain +
// payload rebind. If they ever disagree, a bank auditor verifying in verify.html gets a
// different answer than the CLI in CI — the worst possible failure for a trust tool. This
// runs BOTH against the same golden vectors and asserts they agree bit-for-bit on the verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { verifyBundle as nodeVerify } from "shadow-attest-core/session";
import { BROWSER_VERIFY_JS } from "../packages/attest-core/verify-bundle.browser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = JSON.parse(readFileSync(resolve(ROOT, "demos/adverse-action/sample-bundle.json"), "utf8"));
const PUB = readFileSync(resolve(ROOT, "demos/adverse-action/sample-bundle.pub.pem"), "utf8");

// Eval the browser verifier with node's global WebCrypto (crypto.subtle / TextEncoder / atob
// are all globals in Node 24) — the exact code the browser surfaces inline.
const { verifyBundle: browserVerify } = new Function(
  BROWSER_VERIFY_JS + "\n return { verifyBundle };",
)();

const norm = (r) => ({
  ok: !!r.ok,
  reason: r.ok ? null : (r.reason ?? r.error?.reason ?? null),
  seq: r.ok ? null : (typeof r.seq === "number" ? r.seq : (typeof r.failedSeq === "number" ? r.failedSeq : (r.error?.seq ?? null))),
  src: r.sourceResolution ?? null,
});
const clone = (b) => JSON.parse(JSON.stringify(b));

async function agree(label, mutate) {
  const nb = clone(BUNDLE), bb = clone(BUNDLE);
  if (mutate) { mutate(nb); mutate(bb); }
  const n = norm(nodeVerify(nb, { publicKey: PUB }));
  const b = norm(await browserVerify(bb, PUB));
  assert.deepEqual(b, n, `${label}: browser and Node verifiers disagree — ${JSON.stringify({ browser: b, node: n })}`);
  return n;
}

test("clean bundle: both verifiers agree ok + VERIFIED", async () => {
  const r = await agree("clean", null);
  assert.equal(r.ok, true);
  assert.equal(r.src, "VERIFIED");
});

test("plaintext tamper (verdict flip): both agree FAIL at the same seq + reason", async () => {
  const r = await agree("plaintext-tamper", (b) => {
    b.events.find((e) => e.payload && e.payload.kind === "council_verdict").payload.final_verdict = "approve";
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "payload_hash_mismatch");
});

test("hash tamper (payload_hash corrupted): both agree FAIL", async () => {
  const r = await agree("hash-tamper", (b) => { b.events[1].payload_hash = "0".repeat(64); });
  assert.equal(r.ok, false);
});

test("truncated chain: both agree FAIL", async () => {
  const r = await agree("truncate", (b) => { b.events = b.events.slice(0, -1); });
  assert.equal(r.ok, false);
});
