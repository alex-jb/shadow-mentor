#!/usr/bin/env node
// bin/attestation-acceptance-demo.mjs
// ──────────────────────────────────────────────────────────────────
// End-to-end acceptance demo of the entire v1.4.0 → v1.5.4 attestation
// story. Fires every dispatch surface in-process against a freshly
// generated keypair, and demonstrates tamper detection. All in one
// script, no server startup, no external state.
//
// Procurement reviewer runs:
//     git clone https://github.com/alex-jb/shadow-mentor
//     cd shadow-mentor
//     npm install
//     node bin/attestation-acceptance-demo.mjs
//
// And sees a green ✓ at each step of the whole loop:
//     [1/6] Generate Ed25519 keypair                    ✓
//     [2/6] Run /api/loan-council in-process             ✓
//     [3/6] Verify with lib/attestation.js (CLI path)    ✓
//     [4/6] Verify with /api/verify-attestation (HTTP)   ✓
//     [5/6] Verify with shadow_verify_attestation (MCP)  ✓
//     [6/6] Tamper detection catches silent flip         ✓ (correctly rejected)
//
// Exit codes
// ----------
//     0 — all 6 steps ok (procurement acceptance passed)
//     1 — any step failed (real failure — inspect output)
//
// This is the demo that closes the "does the whole attestation story
// actually work end-to-end" question in 2 seconds. Any regression in
// any of the 5 releases (v1.4.0 signing → v1.5.4 CLI) breaks this
// script. Wired into the test suite as a smoke test.

import { generateKeypair } from "./generate-attestation-keypair.mjs";
// NOTE: The other modules are dynamic-imported AFTER we set env vars
// below, because lib/attestation.js reads SHADOW_ATTESTATION_* at
// module-load time and freezes them. This is the same load-order
// contract a bank deployment respects (env vars set before boot).

const CHECK = "\x1b[32m✓\x1b[0m";
const CROSS = "\x1b[31m✗\x1b[0m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function step(n, label) {
  process.stdout.write(`[${n}/6] ${label.padEnd(52)} `);
}
function pass(msg = "") {
  console.log(`${CHECK}${msg ? " " + DIM + msg + RESET : ""}`);
}
function fail(reason) {
  console.log(`${CROSS} ${reason}`);
  process.exit(1);
}

function mockReq(body, method = "POST") {
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

const CLEAN_LOAN = {
  credit_score: 740,
  debt_to_income: 0.28,
  loan_to_value: 0.65,
  amount: 250000,
  sector: "industrials",
  fair_lending_review_flag: false,
  market_proxy_prices: [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99],
};

async function main() {
  console.log("");
  console.log("Shadow attestation acceptance demo (v1.4.0 → v1.5.4)");
  console.log("─────────────────────────────────────────────────────────────");

  // ─── 1. Generate keypair ────────────────────────────────────────────
  step(1, "Generate Ed25519 keypair");
  const { privateKey, publicKey } = generateKeypair();
  if (!privateKey.includes("BEGIN PRIVATE KEY")) fail("private key PEM missing header");
  if (!publicKey.includes("BEGIN PUBLIC KEY")) fail("public key PEM missing header");
  pass("(keypair generated in-memory, not written to disk)");

  // Wire the fresh keypair into the environment BEFORE loading the
  // handler / attestation modules. This mirrors the real bank
  // deployment contract: env vars must be present at boot time.
  process.env.SHADOW_ATTESTATION_MODE = "ed25519";
  process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = privateKey;
  process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY = publicKey;
  process.env.SHADOW_ATTESTATION_KEY_ID = "acceptance-demo";

  // Dynamic imports so lib/attestation.js reads the env vars we just set.
  const [
    { default: loanCouncilHandler },
    { default: verifyAttestationHandler },
    { verifyAttestation, SIGNATURE_MODES },
    { handleToolCall },
  ] = await Promise.all([
    import("../api/loan-council.js"),
    import("../api/verify-attestation.js"),
    import("../lib/attestation.js"),
    import("../mcp/server.js"),
  ]);

  // ─── 2. Run /api/loan-council in-process ────────────────────────────
  step(2, "Run /api/loan-council in-process");
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: CLEAN_LOAN }), res);
  if (res.statusCode !== 200) fail(`handler returned ${res.statusCode}`);
  if (!res.body.attestation) fail("response body missing attestation field");
  if (res.body.attestation.mode !== SIGNATURE_MODES.ED25519) {
    fail(`wrong mode ${res.body.attestation.mode} (expected ed25519)`);
  }
  const attestation = res.body.attestation;
  const request = { loan: CLEAN_LOAN };
  const response = { ...res.body };
  delete response.attestation;  // response body for verification = everything EXCEPT the attestation
  pass(`(verdict: ${res.body.final_verdict}, key_id: ${attestation.key_id})`);

  // ─── 3. Verify via lib/attestation.js (same primitive the CLI uses) ─
  step(3, "Verify with lib/attestation.js (CLI path)");
  const cliResult = verifyAttestation(attestation, request, response, { publicKey });
  if (!cliResult.ok) fail(`cli-path verify failed: ${cliResult.reason}`);
  pass("(attestation authentic — CLI verifier would print green)");

  // ─── 4. Verify via POST /api/verify-attestation ─────────────────────
  step(4, "Verify with POST /api/verify-attestation");
  const httpRes = mockRes();
  await verifyAttestationHandler(mockReq({
    attestation, original_request: request, original_response: response,
    public_key: publicKey,
  }), httpRes);
  if (httpRes.statusCode !== 200) fail(`http endpoint returned ${httpRes.statusCode}`);
  if (!httpRes.body.ok) fail(`http-path verify failed: ${httpRes.body.reason}`);
  if (httpRes.body.mode !== SIGNATURE_MODES.ED25519) fail("http response mode drift");
  pass(`(mode: ${httpRes.body.mode}, model_id: ${httpRes.body.model_id})`);

  // ─── 5. Verify via shadow_verify_attestation MCP tool ───────────────
  step(5, "Verify with shadow_verify_attestation (MCP)");
  const mcpResult = handleToolCall("shadow_verify_attestation", {
    attestation, original_request: request, original_response: response,
    public_key: publicKey,
  });
  if (!mcpResult.ok) fail(`mcp-path verify failed: ${mcpResult.reason}`);
  if (mcpResult.key_id !== attestation.key_id) fail("mcp key_id drift");
  pass(`(interpretation: ${mcpResult.interpretation.slice(0, 44)}…)`);

  // ─── 6. Tamper detection ────────────────────────────────────────────
  step(6, "Tamper detection catches silent verdict flip");
  const tampered = { ...response, final_verdict: response.final_verdict === "approve" ? "block" : "approve" };
  const tamperResult = verifyAttestation(attestation, request, tampered, { publicKey });
  if (tamperResult.ok) fail("BAD: tamper NOT detected (attestation should have failed)");
  if (!/output commitment mismatch/.test(tamperResult.reason)) {
    fail(`tamper detected but wrong reason: ${tamperResult.reason}`);
  }
  pass("(correctly rejected — reason: output commitment mismatch)");

  console.log("─────────────────────────────────────────────────────────────");
  console.log(`${CHECK} All 6 acceptance steps passed`);
  console.log("");
  console.log("What this proves:");
  console.log("  • v1.4.0 signing — attestation built with a real Ed25519 keypair");
  console.log("  • v1.5.0 CLI verifier — lib primitive verifies");
  console.log("  • v1.5.1 MCP tool — chat-surface dispatch verifies");
  console.log("  • v1.5.2 HTTP endpoint — SIEM-surface dispatch verifies");
  console.log("  • v1.5.4 keypair CLI — generated key round-trips end-to-end");
  console.log("  • tamper detection — silent verdict flip is rejected");
  console.log("");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`\n${CROSS} demo crashed: ${err?.stack ?? err}`);
    process.exit(1);
  });
}

export { main };
