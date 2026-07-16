// test/replay-3d.test.js
// ─────────────────────────────────────────────────────────────────
// Contract tests for The Audit Room (Shadow M5 XR, demos/replay/3d).
// Covers the load-bearing, DOM-free logic:
//   • voice intent parser — the ONLY place free speech becomes a bounded
//     command; must stay a closed enum and degrade to UNKNOWN (Phase 4.1).
//   • verify / tamper / annotate — the real WebCrypto path the browser runs
//     (Phase 3 + 4.2). Uses Node's built-in WebCrypto, same primitive the
//     browser has. The scene/label/three modules are intentionally NOT
//     imported here (they need a DOM); the logic under test does not.
// ─────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseIntent, INTENTS } from "../demos/replay/3d/voice.js";
import { verifyWorking, runTamperCycle, annotate, clonePristine } from "../demos/replay/3d/verify.js";
import { DEMO_BUNDLE, DEMO_PUBLIC_KEY_PEM } from "../demos/replay/3d/demo-data.js";
import { setScores, scoreTrial } from "../demos/replay/3d/study/score.mjs";

test("voice: every parse yields a member of the closed intent enum", () => {
  const samples = [
    "show me every shell command in this session",
    "focus on event six", "apply the security lens", "clear lens",
    "go to beat three", "tamper with it", "reset", "show trust levels",
    "explain seq 2", "banana quux zolt", "",
  ];
  for (const s of samples) assert.ok(INTENTS.includes(parseIntent(s).intent), `"${s}" → enum`);
});

test("voice: the Jarvis demo line filters shell commands", () => {
  assert.equal(parseIntent("show me every shell command in this session").intent, "FILTER_BY_TYPE");
});

test("voice: number words and digits both resolve a seq", () => {
  assert.equal(parseIntent("focus on event six").seq, 6);
  assert.equal(parseIntent("focus on event 6").seq, 6);
  assert.equal(parseIntent("explain seq 2").seq, 2);
});

test("voice: gibberish is UNKNOWN, never an improvised action", () => {
  assert.equal(parseIntent("please do a barrel roll").intent, "UNKNOWN");
});

test("verify: the pristine demo bundle verifies as SELF_SIGNED", async () => {
  const v = await verifyWorking(clonePristine(DEMO_BUNDLE));
  assert.equal(v.ok, true);
  assert.ok(v.trustLevel?.startsWith("SELF_SIGNED"));
});

test("tamper: the caption is verifier-sourced, not hardcoded", async () => {
  const working = clonePristine(DEMO_BUNDLE);
  const { tamperedSeq, verify, caption } = await runTamperCycle({ workingBundle: working, publicKeyPem: DEMO_PUBLIC_KEY_PEM });
  assert.equal(verify.ok, false);
  assert.equal(typeof caption.seq, "number");
  assert.equal(caption.reason, verify.error.reason); // reason comes from the verifier
  assert.equal(tamperedSeq, 6);                       // the Edit (file_write-class) event
  assert.equal(verify.error.seq, 7);                  // break detected one downstream
});

test("annotate: a signed review_annotation re-verifies clean (Phase 4.2)", async () => {
  const bundle = clonePristine(DEMO_BUNDLE);
  const ev = await annotate(bundle, 3, "reviewed — consistent with policy");
  assert.equal(ev.event_type, "review_annotation");
  const v = await verifyWorking(bundle);
  assert.equal(v.ok, true);
});

// ── study scoring harness (Method §3.6) ──
test("study score: perfect answer is localized with F1 = 1", () => {
  const truth = { altered_seq: 6, affected_set: [7, 8, 9, 10, 11] };
  const s = scoreTrial({ altered_seq: 6, affected_set: [7, 8, 9, 10, 11] }, truth);
  assert.equal(s.localized, true);
  assert.equal(s.scope.f1, 1);
});

test("study score: impact-scope F1 penalises misses and over-claims", () => {
  const truth = [7, 8, 9, 10, 11];
  const missed = setScores([7, 8, 9], truth);           // recall 3/5
  assert.ok(Math.abs(missed.recall - 0.6) < 1e-9);
  assert.ok(Math.abs(missed.f1 - 0.75) < 1e-9);
  const over = setScores([7, 8, 9, 10, 11, 12], truth); // precision 5/6
  assert.ok(Math.abs(over.precision - 5 / 6) < 1e-9);
  assert.equal(over.recall, 1);
});

test("study score: wrong localization is not counted correct even if scope is good", () => {
  const truth = { altered_seq: 6, affected_set: [7, 8, 9, 10, 11] };
  const s = scoreTrial({ altered_seq: 5, affected_set: [7, 8, 9, 10, 11] }, truth);
  assert.equal(s.localized, false);
  assert.equal(s.scope.f1, 1); // scope reported independently of localization
});
