// Voice UX V2 core: the spoken-language pipeline preserves canonical meaning, naturalizes bilingually,
// derives deterministic prosody, routes voice commands safely (voice never authorizes regulated
// actions), prioritizes/barge-ins the queue, and rejects untrusted markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "../tools/compile-shadow-guided-story.mjs";
import { validateUtterance, normalizeSpokenText, findForbiddenFiller } from "../lib/voice/shadow-spoken-utterance.mjs";
import { planUtterance, situation } from "../lib/voice/shadow-speech-planner.mjs";
import { prosodyForSegment, PROSODY } from "../lib/voice/shadow-prosody-planner.mjs";
import { ShadowVoiceRouter, VOICE_FORBIDDEN } from "../lib/voice/shadow-voice-router.mjs";
import { ShadowVoiceQueue } from "../lib/voice/shadow-voice-queue.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sem = (id) => compile(JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8")), { target: "snapshot" }).semantic;

// ── planner semantic preservation ──
test("audit-chain tamper: planner reports the exact first-failure sequence + downstream, never bends it", () => {
  const s = sem("audit-chain");
  const u = planUtterance(s, "tamper_seq_3", { level: 2, locale: "en-US" });
  validateUtterance(u);
  const text = u.spoken_segments.map((g) => g.text).join(" ");
  assert.match(text, /sequence three/i, "first failure sequence spoken");
  assert.match(text, /four through six/i, "downstream range spoken");
  assert.match(text, /integrity, not correctness/i, "integrity!=correctness limitation");
  // the canonical first_failure sequence is 3 and downstream are 4,5,6 — the situation must agree
  const sit = situation(s, s.scenarios.find((x) => x.id === "tamper_seq_3"));
  assert.equal(sit.firstFailureSeq, 3);
  assert.deepEqual(sit.downstreamSeqs, [4, 5, 6]);
});

test("pristine never claims a failure", () => {
  const u = planUtterance(sem("audit-chain"), "pristine", { level: 2, locale: "en-US" });
  const text = u.spoken_segments.map((g) => g.text).join(" ");
  assert.match(text, /all links verify/i);
  assert.equal(/failure|failed/i.test(text), false);
  assert.equal(u.intent, "REPORT_PRISTINE");
});

test("persona: abstention + contradiction + majority-weak are preserved, majority never becomes correctness", () => {
  const s = sem("persona-deliberation");
  const abstain = planUtterance(s, "abstain", { level: 2, locale: "en-US" });
  assert.match(abstain.spoken_segments.map((g) => g.text).join(" "), /abstained/i);
  const weak = planUtterance(s, "majority_weak_evidence", { level: 2, locale: "en-US" });
  const wtext = weak.spoken_segments.map((g) => g.text).join(" ");
  assert.match(wtext, /majority/i);
  assert.match(wtext, /does not set correctness|weak/i, "majority is not correctness");
});

test("evidence quote (level 3) is spoken verbatim, flagged is_verbatim_quote, never pronunciation-mangled", () => {
  const quote = "revolving utilization 78% (policy pref ≤ 30%)";
  const u = planUtterance(sem("audit-chain"), "tamper_seq_3", { level: 3, locale: "en-US", quote });
  const q = u.spoken_segments.find((g) => g.is_verbatim_quote);
  assert.ok(q, "a verbatim quote segment exists");
  assert.equal(q.text, quote, "quote is byte-exact (no naturalization)");
  assert.equal(q.can_interrupt_after, false, "a quote is not interrupted mid-way by ordinary status");
});

test("no forbidden filler is emitted; hashes/underscores/markdown are not read", () => {
  const s = sem("audit-chain");
  for (const sc of s.scenarios) for (const loc of ["en-US", "zh-CN"]) {
    const u = planUtterance(s, sc.id, { level: 2, locale: loc });
    const text = u.spoken_segments.map((g) => g.text).join(" ");
    assert.equal(findForbiddenFiller(text).length, 0, `${sc.id}/${loc} filler`);
  }
  assert.match(normalizeSpokenText("see `report.md` at https://x.io/a_b **bold**", "en-US"), /a link/);
  assert.equal(/https?:\/\//.test(normalizeSpokenText("go to https://x.io", "en-US")), false);
  assert.match(normalizeSpokenText("hash 93f2a81aa5f965ae is sealed", "en-US"), /shown in full on screen/);
});

test("bilingual: zh is not literal English; numbers read naturally; both preserve the same meaning", () => {
  const s = sem("audit-chain");
  const en = planUtterance(s, "tamper_seq_3", { level: 2, locale: "en-US" });
  const zh = planUtterance(s, "tamper_seq_3", { level: 2, locale: "zh-CN" });
  const ztext = zh.spoken_segments.map((g) => g.text).join(" ");
  assert.match(ztext, /序号三/, "zh reads sequence naturally");
  assert.match(ztext, /完整性,不代表结论正确/, "zh limitation preserved");
  assert.equal(/根据当前所提供的信息/.test(ztext), false, "no machine-translation filler");
  // both derive from the same canonical first failure
  assert.equal(situation(s, s.scenarios.find((x) => x.id === "tamper_seq_3")).firstFailureSeq, 3);
});

// ── prosody determinism ──
test("prosody is deterministic from role; quote uses the evidence rate; failure is slower not dramatic", () => {
  const a = prosodyForSegment("VERIFICATION_FAILURE", "result", { isFirstFailure: true });
  const b = prosodyForSegment("VERIFICATION_FAILURE", "result", { isFirstFailure: true });
  assert.deepEqual(a, b, "same input → same prosody");
  assert.ok(a.rate_multiplier <= 0.94, "failure headline is slower");
  assert.ok(a.emphasis === "mild", "modest emphasis, not dramatic");
  const q = prosodyForSegment("SYSTEM_NEUTRAL", "quote");
  assert.equal(q.rate_multiplier, Math.round(PROSODY.EVIDENCE_READER.rate * 100) / 100, "quote always uses evidence rate");
});

// ── security ──
test("untrusted markup / SSML / template injection is rejected in an utterance", () => {
  const base = planUtterance(sem("audit-chain"), "pristine", { level: 1, locale: "en-US" });
  for (const bad of ["<speak>x</speak>", "<break time='1s'/>", "hello <script>", "`rm -rf`", "${x}"]) {
    const u = JSON.parse(JSON.stringify(base));
    u.spoken_segments[0].text = bad;
    assert.throws(() => validateUtterance(u), /executable|markup|rejected/i, bad);
  }
});

test("caps + proto pollution + bad enums are rejected", () => {
  const base = planUtterance(sem("audit-chain"), "pristine", { level: 1, locale: "en-US" });
  const dup = JSON.parse(JSON.stringify(base)); dup.spoken_segments.push({ ...dup.spoken_segments[0] });
  assert.throws(() => validateUtterance(dup), /dup segment_id/);
  const badLoc = JSON.parse(JSON.stringify(base)); badLoc.locale = "fr-FR";
  assert.throws(() => validateUtterance(badLoc), /bad locale/);
  const polluted = JSON.parse('{"contract_version":"shadow-spoken-utterance-v1","__proto__":{"x":1},"utterance_id":"a","locale":"en-US","role":"SYSTEM_NARRATOR","intent":"X_Y","spoken_segments":[{"segment_id":"s","text":"hi","semantic_role":"result"}],"prosody_profile":"SYSTEM_NEUTRAL","interruptibility":"INTERRUPTIBLE","priority":"P3","confirmation_required":false,"fixture_live_device_status":"FIXTURE"}');
  assert.throws(() => validateUtterance(polluted), /proto key/);
});

// ── voice router safety ──
test("voice router: navigation dispatches; reset needs non-voice confirm; voice never authorizes", () => {
  const r = new ShadowVoiceRouter();
  assert.equal(r.route("next").action, "NEXT");
  assert.equal(r.route("next").dispatched, true);
  const reset = r.route("reset the demo");
  assert.equal(reset.action, "REQUEST_RESET");
  assert.equal(reset.dispatched, false, "reset is not dispatched by voice alone");
  assert.equal(reset.requiresConfirmation, true);
  assert.equal(r.confirmByNonVoice(), "REQUEST_RESET", "only a non-voice confirm resolves it");
  for (const forbidden of VOICE_FORBIDDEN) assert.equal(ShadowVoiceRouter.canVoiceAuthorize(forbidden), false);
  // a recognized phrase is not authorization: asking to "approve" routes to nothing
  assert.equal(r.route("approve the loan").action, null);
});

// ── queue priorities + barge-in ──
test("queue: higher priority interrupts; a quote is not interrupted by ordinary status; duplicates suppressed", () => {
  const q = new ShadowVoiceQueue();
  const narration = { utterance_id: "n1", priority: "P3", locale: "en-US", interruptibility: "INTERRUPTIBLE" };
  q.enqueue(narration); q.next();
  assert.equal(q.current.utterance_id, "n1");
  const trackingLost = { utterance_id: "t1", priority: "P0", locale: "en-US", interruptibility: "INTERRUPTIBLE" };
  const r = q.enqueue(trackingLost);
  assert.equal(r.interrupted.utterance_id, "n1", "P0 interrupts P3 narration");
  // a verbatim quote (marked) is not interrupted by an ordinary P2 status
  const q2 = new ShadowVoiceQueue();
  const quote = { utterance_id: "q1", priority: "P2", locale: "en-US", interruptibility: "INTERRUPTIBLE", _activeIsVerbatimQuote: true };
  q2.enqueue(quote); q2.next();
  const status = { utterance_id: "s1", priority: "P2", locale: "en-US", interruptibility: "INTERRUPTIBLE" };
  assert.equal(q2.enqueue(status).interrupted, null, "ordinary status does not interrupt a quote");
  // duplicate suppression
  assert.equal(q2.enqueue(quote).accepted, false);
});

test("queue: reset clears; language switch cancels old-locale utterances", () => {
  const q = new ShadowVoiceQueue();
  q.enqueue({ utterance_id: "a", priority: "P3", locale: "en-US", interruptibility: "INTERRUPTIBLE" });
  q.enqueue({ utterance_id: "b", priority: "P3", locale: "zh-CN", interruptibility: "INTERRUPTIBLE" });
  q.clearLocaleExcept("zh-CN");
  assert.equal(q.queue.every((u) => u.locale === "zh-CN"), true);
  assert.equal(q.stopAll(), true);
  assert.equal(q.length, 0);
});
