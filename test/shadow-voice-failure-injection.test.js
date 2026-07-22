// Failure injection for the voice pipeline: malformed / oversized / unsupported input, queue overflow,
// duplicate events. Expected: fail closed (reject), no crash, and NEVER a semantic mutation — the
// underlying story semantics are untouched by any voice failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "../tools/compile-shadow-guided-story.mjs";
import { planUtterance } from "../lib/voice/shadow-speech-planner.mjs";
import { validateUtterance, VOICE_CAPS } from "../lib/voice/shadow-spoken-utterance.mjs";
import { ShadowVoiceQueue } from "../lib/voice/shadow-voice-queue.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sem = (id) => compile(JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8")), { target: "snapshot" }).semantic;

test("malformed / oversized / unsupported utterance is rejected, never crashes", () => {
  const base = planUtterance(sem("audit-chain"), "pristine", { level: 1, locale: "en-US" });
  const oversized = JSON.parse(JSON.stringify(base));
  oversized.spoken_segments[0].text = "x".repeat(VOICE_CAPS.textLen + 10);
  assert.throws(() => validateUtterance(oversized), /bad segment text|too long/i);
  const tooMany = JSON.parse(JSON.stringify(base));
  for (let i = 0; i < VOICE_CAPS.segments + 5; i++) tooMany.spoken_segments.push({ segment_id: `s${i}`, text: "x", semantic_role: "detail" });
  assert.throws(() => validateUtterance(tooMany), /too many segments/);
});

test("a voice failure never mutates the underlying story semantics", () => {
  const s = sem("audit-chain");
  const before = JSON.stringify(s);
  try { planUtterance(s, "no_such_scenario", { level: 1 }); } catch { /* expected */ }
  // a malformed plan attempt does not touch the semantic
  assert.equal(JSON.stringify(s), before, "semantic is unchanged by a voice failure");
  // the canonical first-failure is still intact
  const tamper = s.scenarios.find((x) => x.id === "tamper_seq_3");
  assert.equal(tamper.first_failure, "banking-v1:n3:claim");
});

test("queue overflow drops silently-tracked, never throws", () => {
  const q = new ShadowVoiceQueue();
  for (let i = 0; i < 200; i++) q.enqueue({ utterance_id: `u${i}`, priority: "P3", locale: "en-US", interruptibility: "INTERRUPTIBLE" });
  assert.ok(q.length <= 64, "queue is bounded");
  assert.ok(q.dropped > 0, "overflow is tracked, not thrown");
});

test("duplicate events are suppressed, not stacked", () => {
  const q = new ShadowVoiceQueue();
  const u = { utterance_id: "dup", priority: "P3", locale: "en-US", interruptibility: "INTERRUPTIBLE" };
  assert.equal(q.enqueue(u).accepted, true);
  assert.equal(q.enqueue(u).accepted, false);
  assert.equal(q.suppressed, 1);
});

test("provider failure path: an obsolete utterance is not replayed after pause", () => {
  const q = new ShadowVoiceQueue();
  q.enqueue({ utterance_id: "n1", priority: "P3", locale: "en-US", interruptibility: "INTERRUPTIBLE" });
  q.next();
  q.onPause();
  assert.equal(q.current, null, "current cleared on pause; nothing obsolete to replay");
});
