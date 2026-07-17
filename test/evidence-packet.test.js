// test/evidence-packet.test.js
// The examiner-ready evidence packet: structured fields + honest conclusion, and
// a markdown render an examiner can read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createSession, appendEvent, sealSession, verifyBundle } from "../packages/attest-core/session.js";
import { buildExaminerPacket, renderPacketMarkdown } from "../lib/evidence-packet.js";

function conformingBundle() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "loan-council", version: "1.5" },
    models: [{ model_id: "council-v1", provider: "anthropic" }],
    environmentFingerprint: { os: "linux", node_version: "v24" },
    keyId: "bank-key", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  });
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { q: "credit" } });
  appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "bureau_pull" } });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { decision: "deny" },
    extensions: { dictionary_hash: "sha256:abc", citation_registry_sha256: "sha256:def" } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { approved: true } });
  return { bundle: sealSession(s), pub: publicKey.export({ type: "spki", format: "pem" }) };
}

test("packet on a conforming bundle: verified, CONFORMS, evidence rows, honest conclusion", () => {
  const { bundle, pub } = conformingBundle();
  const verified = verifyBundle(bundle, { publicKey: pub });
  const p = buildExaminerPacket(bundle, { verified });
  assert.equal(p.conformance.result, "CONFORMS");
  assert.equal(p.integrity.startsWith("verified"), true);
  assert.ok(p.evidence.length >= 8);
  for (const e of p.evidence) assert.ok(Array.isArray(e.reg_hooks) && e.reg_hooks.length, `${e.id} missing reg_hooks`);
  // the honest bound must be stated
  assert.match(p.conclusion, /does NOT certify/i);
});

test("markdown render includes the header, the evidence table, and the conclusion", () => {
  const { bundle, pub } = conformingBundle();
  const p = buildExaminerPacket(bundle, { verified: verifyBundle(bundle, { publicKey: pub }) });
  const md = renderPacketMarkdown(p);
  assert.match(md, /# Credit-decision evidence packet/);
  assert.match(md, /\| Status \| Requirement \| Level \| Regulatory hook \| Where \/ detail \|/);
  assert.match(md, /## Conclusion/);
  assert.match(md, /Reg B 12 CFR 1002\.9/); // a real regulatory hook is surfaced
});

test("integrity line reflects a missing public key vs a real verify", () => {
  const { bundle } = conformingBundle();
  const p = buildExaminerPacket(bundle); // no verified
  assert.match(p.integrity, /not checked/);
  assert.match(p.conclusion, /not checked/i);
});
