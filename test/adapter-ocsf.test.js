// test/adapter-ocsf.test.js
// Contract tests for the Shadow evidence bundle → OCSF 1.9.0 record_integrity adapter.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createSession,
  appendEvent,
  sealSession,
  eventOwnHash,
} from "../packages/attest-core/session.js";
import {
  bundleToOcsf,
  mapEvent,
  OCSF_SCHEMA_VERSION,
} from "../packages/adapter-ocsf/index.js";

function sealedBundle({ embedPayloads = false } = {}) {
  const { privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "loan-council", version: "1.0.0", identity_ref: "op:acme-bank" },
    models: [{ model_id: "anthropic:claude-opus-4", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin-25.3.0", node_version: "24.14.1" },
    keyId: "prod-2026-q3",
    privateKey,
    embedPayloads,
  });
  appendEvent(s, { event_type: "model_call", actor: "model", payload: { prompt: "score applicant" } });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { verdict: "BLOCK" } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { decision: "sign_off" } });
  return sealSession(s);
}

test("bundleToOcsf emits one OCSF event per bundle event, tagged OCSF 1.9.0", () => {
  const bundle = sealedBundle();
  const { events, warnings } = bundleToOcsf(bundle);
  assert.equal(events.length, bundle.events.length);
  assert.equal(warnings.length, 0);
  for (const e of events) {
    assert.equal(e.metadata.version, OCSF_SCHEMA_VERSION);
    assert.ok(e.metadata.profiles.includes("record_integrity"));
    assert.equal(e.metadata.product.name, "Shadow");
  }
});

test("attestation.fingerprint equals attest-core eventOwnHash (zero hashing drift)", () => {
  const bundle = sealedBundle();
  const { events } = bundleToOcsf(bundle);
  bundle.events.forEach((ev, i) => {
    assert.equal(events[i].attestation.fingerprint.value, eventOwnHash(ev));
    assert.equal(events[i].attestation.fingerprint.algorithm_id, 3); // SHA-256
  });
});

test("prev_event chain: each event's prev_event.fingerprint is the prior event's own-hash", () => {
  const bundle = sealedBundle();
  const { events } = bundleToOcsf(bundle);
  // genesis (seq 0) has no prev_event
  assert.equal(events[0].attestation.prev_event, undefined);
  for (let i = 1; i < bundle.events.length; i++) {
    const priorOwnHash = eventOwnHash(bundle.events[i - 1]);
    assert.equal(events[i].attestation.prev_event.fingerprint.value, priorOwnHash);
    assert.equal(events[i].attestation.prev_event.fingerprint.value, bundle.events[i].prev_hash);
  }
});

test("chain_uid + authority_uid map to session_id + signing key_id", () => {
  const bundle = sealedBundle();
  const { events } = bundleToOcsf(bundle);
  for (const e of events) {
    assert.equal(e.attestation.chain_uid, bundle.header.session_id);
    assert.equal(e.attestation.authority_uid, bundle.signatures[0].key_id);
  }
});

test("only the terminal event carries the Ed25519 signature + batch_root", () => {
  const bundle = sealedBundle();
  const { events } = bundleToOcsf(bundle);
  const withSig = events.filter(e => e.attestation.signatures);
  assert.equal(withSig.length, 1);
  const terminal = events[events.length - 1];
  assert.equal(terminal.attestation.signatures[0].algorithm, "ed25519");
  assert.equal(terminal.attestation.signatures[0].value, bundle.signatures[0].signature);
  assert.equal(terminal.attestation.batch_root, bundle.batch_root);
});

test("ai_agent object carries operator identity + optional charter", () => {
  const bundle = sealedBundle();
  const { events } = bundleToOcsf(bundle, { charter: "You are a fair-lending compliance council." });
  for (const e of events) {
    assert.equal(e.ai_agent.uid, "op:acme-bank");
    assert.equal(e.ai_agent.name, "loan-council");
    assert.equal(e.ai_agent.charter, "You are a fair-lending compliance council.");
  }
  // charter is omitted when not supplied
  const { events: noCharter } = bundleToOcsf(bundle);
  assert.equal(noCharter[0].ai_agent.charter, undefined);
});

test("a tampered event breaks the OCSF fingerprint chain (tamper is detectable through the projection)", () => {
  const bundle = sealedBundle({ embedPayloads: true });
  const clean = bundleToOcsf(bundle);
  // Adversary flips a signed field (BLOCK -> APPROVE) on the model_output event.
  const tampered = structuredClone(bundle);
  const target = tampered.events.find(e => e.event_type === "model_output");
  target.event_type = "model_output"; // unchanged type, but flip a signed field:
  target.actor = "system";            // actor is inside the signed shape
  const dirty = bundleToOcsf(tampered);
  const i = tampered.events.findIndex(e => e === target);
  // The tampered event's own fingerprint diverges from the clean projection...
  assert.notEqual(dirty.events[i].attestation.fingerprint.value, clean.events[i].attestation.fingerprint.value);
  // ...and the NEXT event's prev_event no longer matches the tampered event's new fingerprint,
  // so the chain is broken exactly at the edit site.
  if (i + 1 < tampered.events.length) {
    const nextPrev = dirty.events[i + 1].attestation.prev_event.fingerprint.value;
    assert.notEqual(nextPrev, dirty.events[i].attestation.fingerprint.value);
  }
});

test("bundleToOcsf rejects an unsealed / malformed bundle", () => {
  assert.throws(() => bundleToOcsf(null), /bundle object required/);
  assert.throws(() => bundleToOcsf({ header: { agent: {} } }), /events\[\] required/);
  assert.throws(() => bundleToOcsf({ events: [{ seq: 0 }] }), /header\.agent required/);
});

test("bundle without signatures warns but still emits fingerprints + chain", () => {
  const bundle = sealedBundle();
  delete bundle.signatures;
  const { events, warnings } = bundleToOcsf(bundle);
  assert.equal(events.length, bundle.events.length);
  assert.ok(warnings.some(w => /no signatures/.test(w)));
  assert.equal(events[0].attestation.authority_uid, undefined);
  assert.ok(events[0].attestation.fingerprint.value); // fingerprints still present
});

test("mapEvent is pure — same input, identical output", () => {
  const bundle = sealedBundle();
  const ctx = {
    header: bundle.header,
    sessionSignature: bundle.signatures[0],
    batchRoot: bundle.batch_root,
    isTerminal: false,
    charter: undefined,
  };
  const a = mapEvent(bundle.events[1], ctx);
  const b = mapEvent(bundle.events[1], ctx);
  assert.deepEqual(a, b);
});
