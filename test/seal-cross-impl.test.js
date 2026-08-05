// The browser SEALER (seal-bundle.browser.mjs) must produce bundles the Node verifyBundle
// accepts — byte-parity between where a bundle is made (the officer's browser) and where a
// regulator checks it (the CLI). Seals with the browser module under Node's WebCrypto, then
// verifies with Node; also confirms a post-seal plaintext edit still fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyBundle } from "shadow-attest-core/session";
import { BROWSER_SEAL_JS } from "../packages/attest-core/seal-bundle.browser.mjs";

const { sealBundle } = new Function(BROWSER_SEAL_JS + "\n return { sealBundle };")();
const events = [
  { event_type: "session_start", actor: "system", payload: { kind: "adverse_action_signoff", application_id: "SL-2026-014" } },
  { event_type: "model_output", actor: "model", payload: { kind: "council_verdict", final_verdict: "block", adverse_action_codes: ["AA01"] } },
  { event_type: "tool_result", actor: "tool", payload: { kind: "officer_final_notices", notices: [{ code: "AA01", notice: { text: "reason." }, edited: true }] } },
  { event_type: "human_approval", actor: "user", payload: { kind: "sign_off", decision: "signed", officer: "j.doe" } },
];
const agent = { name: "shadow-adverse-action", version: "1.0.0" };
const env = { os: "browser", node_version: "webcrypto" };

test("a browser-sealed bundle verifies with the Node verifier + rebinds (VERIFIED)", async () => {
  const { bundle, publicKeyPem } = await sealBundle({ agent, environmentFingerprint: env, keyId: "browser-demo", startedAtUtc: "2026-08-05T00:00:00.000Z", events });
  const v = verifyBundle(bundle, { publicKey: publicKeyPem });
  assert.equal(v.ok, true, `Node verify failed: ${v.reason}`);
  assert.equal(v.sourceResolution, "VERIFIED");
});

test("editing a browser-sealed payload after the fact FAILS Node verification", async () => {
  const { bundle, publicKeyPem } = await sealBundle({ agent, environmentFingerprint: env, startedAtUtc: "2026-08-05T00:00:00.000Z", events });
  const ev = bundle.events.find((e) => e.payload && e.payload.kind === "sign_off");
  ev.payload.decision = "approved"; // tamper the sealed sign-off
  assert.equal(verifyBundle(bundle, { publicKey: publicKeyPem }).ok, false);
});
