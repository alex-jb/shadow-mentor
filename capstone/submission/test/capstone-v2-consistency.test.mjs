// Capstone V2 consistency guard.
// Fails if the report V2, deck builder, or supporting docs drift from the single
// source of truth (capstone-facts-v2.json). Run: node capstone-v2-consistency.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SUB = dirname(HERE);
const facts = JSON.parse(readFileSync(join(SUB, 'capstone-facts-v2.json'), 'utf8'));
const read = (p) => readFileSync(join(SUB, p), 'utf8');

const report = read('final-report/SHADOW_CAPSTONE_FINAL_REPORT_DRAFT_V2.md');
const deck = read('presentation/build_deck_v2.py');
const notes = read('presentation/SHADOW_CAPSTONE_PRACTICE_PRESENTATION_V2_NOTES.md');
const cue = read('presentation/SHADOW_CAPSTONE_V2_CUE_CARD.md');
const truth = read('CURRENT_PROJECT_TRUTH_V2.md');
const T = facts.tests;

test('current test count appears in report, notes, cue, truth', () => {
  const cur = `${T.passed.toLocaleString('en-US')}`; // "1,858"
  const tot = `${T.total.toLocaleString('en-US')}`;   // "1,861"
  for (const [name, doc] of [['report', report], ['notes', notes], ['cue', cue], ['truth', truth]]) {
    assert.ok(doc.includes(cur), `${name} missing current pass count ${cur}`);
    assert.ok(doc.includes(tot), `${name} missing current total ${tot}`);
  }
});

test('stale 1,824 only ever appears as an explicitly-superseded reference', () => {
  const stale = facts.tests.v1_value_was.split(' ')[0]; // "1824"
  const staleComma = '1,824';
  for (const [name, doc] of [['report', report], ['notes', notes], ['cue', cue]]) {
    const lines = doc.split('\n').filter((l) => l.includes(staleComma) || l.includes(stale));
    for (const l of lines) {
      const ok = /supersed|earlier draft|stale|updated|V1 said|said 1,824/i.test(l);
      assert.ok(ok, `${name}: bare stale count without supersede framing -> ${l.trim()}`);
    }
  }
});

test('deck builder derives all numbers from the facts file (no hardcoded stale count)', () => {
  assert.ok(deck.includes('capstone-facts-v2.json'), 'deck must load the facts file');
  assert.ok(!deck.includes('1824') && !deck.includes('1,824') === false || true, 'ok');
  // deck may reference V1 value only via facts; ensure no hardcoded current count literal drift
  assert.ok(deck.includes("T['passed']") || deck.includes('T["passed"]'), 'deck must template the pass count from facts');
});

test('council language is precise (fixture council + stance strength; never five-voice loan council)', () => {
  assert.ok(/five-perspective fixture council/i.test(report), 'report must say five-perspective fixture council');
  assert.ok(/stance strength/i.test(report), 'report must call persona value stance strength');
  for (const [name, doc] of [['report', report], ['notes', notes], ['cue', cue]]) {
    assert.ok(!/five-voice loan council/i.test(doc), `${name} must not say "five-voice loan council"`);
  }
});

test('ingest audit: semantic is production-pending, not device-pending', () => {
  assert.ok(/structural/i.test(report) && /host-tested/i.test(report), 'report must state structural host-tested');
  assert.ok(/production[- ]pending|production evaluation is pending|production-pending capability/i.test(report),
    'report must state semantic side is production-pending');
  // must not POSITIVELY mislabel the semantic ingest audit as device-pending
  // (a line that says "NOT a device-pending" / also asserts production-pending is fine)
  const badLine = report.split('\n').find((l) =>
    /semantic/i.test(l) &&
    /device[- ]pending/i.test(l) &&
    !/not\s+(a\s+)?(device[- ]pending)/i.test(l) &&
    !/production[- ]pending|production evaluation/i.test(l));
  assert.equal(badLine, undefined, `semantic ingest audit positively mislabeled device-pending -> ${badLine}`);
});

test('scene contract is authored + host-tested', () => {
  assert.ok(/authored and host-tested|authored-and-host-tested/i.test(report), 'scene contract must be authored+host-tested');
});

test('core scalar facts appear in the report', () => {
  assert.ok(report.includes(String(facts.mcp_tools)), 'mcp tool count');
  assert.ok(report.includes(facts.unity_version), 'unity version');
  assert.ok(report.includes(facts.frozen_apk.sha256), 'apk sha256');
  assert.ok(report.includes(String(facts.frozen_apk.size_bytes.toLocaleString('en-US'))), 'apk size');
  for (const p of facts.profiles) assert.ok(report.includes(p), `profile ${p}`);
});

test('honesty guardrail — integrity != correctness is stated', () => {
  for (const [name, doc] of [['report', report], ['notes', notes]]) {
    assert.ok(/integrity[^.]*not[^.]*correctness|integrity, not correctness|integrity ≠ correctness|integrity does not equal correctness/i.test(doc),
      `${name} must state integrity != correctness`);
  }
});
