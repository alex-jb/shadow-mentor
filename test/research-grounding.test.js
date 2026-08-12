// test/research-grounding.test.js
// The deterministic gate behind shadow-deep-research: label every citation in a
// research memo IN_FORCE / WITHDRAWN / EVIDENCE_INSUFFICIENT against the registry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { groundResearchMemo } from "../lib/research-grounding.js";

const MEMO = `The denial must state specific principal reasons per 12 CFR 1002.9(b)(2)
and ECOA 15 U.S.C. 1691(a). Historically CFPB Circular 2022-03 was cited for
"complexity is not a defense". Some analysts invoke 12 CFR 9999.1 and
CFPB Circular 2099-01 for this.`;

test("in-force citations are labeled IN_FORCE", () => {
  const r = groundResearchMemo(MEMO);
  const ids = r.in_force.map((x) => x.id);
  assert.ok(ids.includes("12CFR1002.9(b)(2)"));
  assert.ok(ids.includes("15USC1691(a)"));
});

test("a withdrawn citation is labeled WITHDRAWN with its sunset date", () => {
  const r = groundResearchMemo(MEMO);
  const c = r.withdrawn.find((x) => x.id === "CFPB-Circular-2022-03");
  assert.ok(c, "Circular 2022-03 must be flagged withdrawn");
  assert.equal(c.sunset, "2025-05-12");
  // and it must NOT appear as in-force
  assert.ok(!r.in_force.some((x) => x.id === "CFPB-Circular-2022-03"));
});

test("invented citations are EVIDENCE_INSUFFICIENT; scanner splinters are not", () => {
  const r = groundResearchMemo(MEMO);
  assert.ok(r.ungrounded.includes("12 CFR 9999.1"), "fake CFR section must be ungrounded");
  assert.ok(r.ungrounded.some((u) => /Circular 2099-01/.test(u)), "fake circular must be ungrounded");
  // "ECOA 15" (a word+number splinter with no citation marker) must NOT be flagged.
  assert.ok(!r.ungrounded.some((u) => /ECOA 15/.test(u)), "non-citation splinter must be dropped");
  // The withdrawn citation's bare fragment ("Circular 2022-03") must not double-count.
  assert.ok(!r.ungrounded.some((u) => u === "Circular 2022-03"), "fragment of a resolved citation must be dropped");
});

test("ok is false when any ungrounded citation is present, true otherwise", () => {
  assert.equal(groundResearchMemo(MEMO).ok, false);
  const clean = groundResearchMemo("Denial reasons anchor on 12 CFR 1002.9(b)(2) and 15 U.S.C. 1691(a).");
  assert.equal(clean.ok, true);
  assert.equal(clean.summary.ungrounded, 0);
  assert.equal(clean.summary.in_force, 2);
});

test("asOfDate before a sunset keeps that citation IN_FORCE (currency is time-aware)", () => {
  const memo = "Per CFPB Circular 2022-03 the creditor must give specific reasons.";
  const before = groundResearchMemo(memo, { asOfDate: new Date("2025-01-01") });
  assert.ok(before.in_force.some((x) => x.id === "CFPB-Circular-2022-03"), "before sunset → in force");
  const after = groundResearchMemo(memo, { asOfDate: new Date("2026-01-01") });
  assert.ok(after.withdrawn.some((x) => x.id === "CFPB-Circular-2022-03"), "after sunset → withdrawn");
});

test("empty / non-string input is handled without throwing", () => {
  assert.equal(groundResearchMemo("").ok, true);
  assert.equal(groundResearchMemo(null).summary.in_force, 0);
});
