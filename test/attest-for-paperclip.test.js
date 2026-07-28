// test/attest-for-paperclip.test.js
// Pins the examples/attest-for-paperclip adapter: an agent-workspace audit
// log sealed through attest-core verifies with only the public key, and any
// row tamper breaks the chain at the exact sequence. The wedge in one test
// file: append-only-as-DB-property → externally checkable proof.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { attestAuditLog, mapRow, ROW_TYPE_MAP } from "../examples/attest-for-paperclip/attest-audit-log.mjs";
import { verifyBundle } from "../packages/attest-core/session.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "examples", "attest-for-paperclip", "sample-paperclip-audit-log.jsonl");
const rows = readFileSync(SAMPLE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const kp = generateKeyPairSync("ed25519");
const pub = kp.publicKey.export({ type: "spki", format: "pem" });

test("sealed audit log verifies with only the public key", () => {
  const bundle = attestAuditLog(rows, { privateKey: kp.privateKey });
  const r = verifyBundle(bundle, { publicKey: pub });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("tampering any event breaks verification at an exact seq", () => {
  const bundle = attestAuditLog(rows, { privateKey: kp.privateKey });
  const t = JSON.parse(JSON.stringify(bundle));
  const h = t.events[2].payload_hash;
  t.events[2].payload_hash = h.slice(0, -1) + (h.endsWith("0") ? "1" : "0");
  const r = verifyBundle(t, { publicKey: pub });
  assert.equal(r.ok, false);
  assert.ok(Number.isInteger(r.failedSeq ?? r.error?.seq), "must name the failing seq");
});

test("reordering rows breaks verification (order is part of the proof)", () => {
  const bundle = attestAuditLog(rows, { privateKey: kp.privateKey });
  const t = JSON.parse(JSON.stringify(bundle));
  [t.events[1], t.events[2]] = [t.events[2], t.events[1]];
  assert.equal(verifyBundle(t, { publicKey: pub }).ok, false);
});

test("wrong public key never verifies", () => {
  const bundle = attestAuditLog(rows, { privateKey: kp.privateKey });
  const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
  assert.equal(verifyBundle(bundle, { publicKey: other }).ok, false);
});

test("mapping: approvals carry the REAL decision, never synthesized", () => {
  const rejected = mapRow({ kind: "approval", actor: "human", decision: "rejected", payload: {} });
  assert.equal(rejected.event_type, "human_approval");
  assert.equal(rejected.payload.approved, false);
  const approved = mapRow({ kind: "hire_approval", actor: "human", decision: "approved", payload: {} });
  assert.equal(approved.payload.approved, true);
});

test("no row is ever dropped: unknown kinds map to tool_call with row preserved", () => {
  const m = mapRow({ kind: "totally_new_kind", actor: "agent", payload: { x: 1 } });
  assert.equal(m.event_type, "tool_call");
  assert.deepEqual(m.payload.original_row.payload, { x: 1 });
  assert.ok(!("totally_new_kind" in ROW_TYPE_MAP));
});
