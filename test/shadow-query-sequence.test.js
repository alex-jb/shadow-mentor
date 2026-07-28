// §1 durable session-scoped query identity <session_id>:q<sequence>, recovered from existing
// execution events — never a process-global counter, never reuses q1 after rehydration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeq, nextQueryId, QuerySequenceStore } from "../apps/shadow-lens/web/spatial-agent/query-sequence.mjs";

test("same session continues q1, q2, q3", () => {
  const s = new QuerySequenceStore();
  assert.equal(s.issue("sess-A"), "sess-A:q1");
  assert.equal(s.issue("sess-A"), "sess-A:q2");
  assert.equal(s.issue("sess-A"), "sess-A:q3");
});

test("a reconstructed session continues at q4 (recovered from execution events)", () => {
  // simulate rehydration: the persisted execution events for this session had q1..q3
  const s = new QuerySequenceStore();
  s.hydrate("sess-A", ["sess-A:q1", "sess-A:q2", "sess-A:q3"]);
  assert.equal(s.issue("sess-A"), "sess-A:q4", "must not reuse q1 after reconstruction");
});

test("recovery survives a serialize/restore round-trip (restart)", () => {
  const s1 = new QuerySequenceStore();
  s1.issue("sess-A"); s1.issue("sess-A");
  const persisted = JSON.parse(JSON.stringify(s1.toJSON())); // storage round-trip
  const s2 = new QuerySequenceStore(persisted);
  assert.equal(s2.issue("sess-A"), "sess-A:q3");
});

test("different sessions independently start at q1", () => {
  const s = new QuerySequenceStore();
  assert.equal(s.issue("banking-v1-demo"), "banking-v1-demo:q1");
  assert.equal(s.issue("data-science-v1-demo"), "data-science-v1-demo:q1");
  assert.notEqual(s.issue("banking-v1-demo"), s.issue("data-science-v1-demo")); // q2 vs q2, different prefix
});

test("parseSeq only counts ids belonging to the session", () => {
  assert.equal(parseSeq("sess-A", "sess-A:q7"), 7);
  assert.equal(parseSeq("sess-A", "sess-B:q7"), 0); // different session ignored
  assert.equal(parseSeq("sess-A", "garbage"), 0);
  assert.equal(nextQueryId("sess-A", ["sess-A:q2", "sess-B:q9"]), "sess-A:q3"); // sess-B ignored
});

test("hydrate is additive and never lowers the sequence (tamper/reset can't reuse ids)", () => {
  const s = new QuerySequenceStore();
  s.issue("sess-A"); // q1
  s.hydrate("sess-A", ["sess-A:q5"]); // a later recovered id
  assert.equal(s.issue("sess-A"), "sess-A:q6", "sequence follows the max seen, never reused");
});
