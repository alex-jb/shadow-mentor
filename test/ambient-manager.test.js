// test/ambient-manager.test.js
// v1.5.47 contract tests for the Ambient Council Manager primitive.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PERSONA_CATALOG,
  computeSemicircleLayout,
  runAmbientTurn,
  ambientToolCatalog,
  buildAmbientSystemPrompt,
} from "../lib/ambient-manager.js";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { getSiveLoan } from "../lib/sive-fixtures.js";


// PERSONA_CATALOG contract

test("PERSONA_CATALOG: has exactly 6 personas", () => {
  assert.equal(Object.keys(PERSONA_CATALOG).length, 6);
});

test("PERSONA_CATALOG: is frozen (defensive against runtime mutation)", () => {
  assert.throws(() => { PERSONA_CATALOG.credit_fundamentals = {}; });
});

test("PERSONA_CATALOG: every persona has id + display_name + accent_color", () => {
  for (const [key, persona] of Object.entries(PERSONA_CATALOG)) {
    assert.equal(persona.id, key, `${key}: id mismatch`);
    assert.equal(typeof persona.display_name, "string");
    assert.match(persona.accent_color, /^#[0-9A-Fa-f]{6}$/);
  }
});


// Layout geometry

test("computeSemicircleLayout: n=1 places persona straight ahead", () => {
  const p = computeSemicircleLayout(1);
  assert.equal(p.length, 1);
  assert.equal(p[0].x, 0);
  assert.equal(p[0].rotation_y, 0);
});

test("computeSemicircleLayout: n=5 produces 5 positions with x range span", () => {
  const p = computeSemicircleLayout(5);
  assert.equal(p.length, 5);
  const xs = p.map(({ x }) => x);
  assert.ok(Math.max(...xs) > 0);
  assert.ok(Math.min(...xs) < 0);
});

test("computeSemicircleLayout: n=6 arc wider than n=3", () => {
  const p3 = computeSemicircleLayout(3);
  const p6 = computeSemicircleLayout(6);
  const span3 = Math.max(...p3.map(({ x }) => x)) - Math.min(...p3.map(({ x }) => x));
  const span6 = Math.max(...p6.map(({ x }) => x)) - Math.min(...p6.map(({ x }) => x));
  assert.ok(span6 >= span3, `n=6 span ${span6} < n=3 span ${span3}`);
});

test("computeSemicircleLayout: rejects out-of-range n", () => {
  assert.throws(() => computeSemicircleLayout(0), RangeError);
  assert.throws(() => computeSemicircleLayout(7), RangeError);
  assert.throws(() => computeSemicircleLayout(2.5), RangeError);
});


// runAmbientTurn — deterministic contract

test("runAmbientTurn: throws on missing question", () => {
  assert.throws(() => runAmbientTurn({ persona_ids: ["risk_officer"] }), TypeError);
});

test("runAmbientTurn: throws on unknown persona_id", () => {
  assert.throws(
    () => runAmbientTurn({
      question: "Should we approve?",
      persona_ids: ["nonexistent_persona"],
    }),
    /unknown persona_id/,
  );
});

test("runAmbientTurn: throws on >6 personas", () => {
  assert.throws(
    () => runAmbientTurn({
      question: "test",
      persona_ids: Object.keys(PERSONA_CATALOG).concat(["credit_fundamentals"]),
    }),
    RangeError,
  );
});

test("runAmbientTurn: minimum inputs produce a valid descriptor", () => {
  const d = runAmbientTurn({
    question: "Should we approve this loan?",
    persona_ids: ["credit_fundamentals", "risk_officer", "fair_lending"],
  });
  assert.equal(d.descriptor_version, "1.0");
  assert.equal(d.response_mode, "ambient");
  assert.equal(d.question, "Should we approve this loan?");
  assert.equal(d.personas.length, 3);
  assert.equal(d.context_nodes.length, 0);
  assert.equal(d.verdict, null);
});

test("runAmbientTurn: each persona has position + display_name + accent_color", () => {
  const d = runAmbientTurn({
    question: "?",
    persona_ids: ["risk_officer", "aml_kyc"],
  });
  for (const p of d.personas) {
    assert.equal(typeof p.position.x, "number");
    assert.equal(typeof p.position.y, "number");
    assert.equal(typeof p.position.z, "number");
    assert.equal(typeof p.display_name, "string");
    assert.match(p.accent_color, /^#[0-9A-Fa-f]{6}$/);
  }
});

test("runAmbientTurn: builds context_nodes from loan_context fields", () => {
  const d = runAmbientTurn({
    question: "?",
    persona_ids: ["credit_fundamentals"],
    loan_context: {
      credit_score: 780,
      debt_to_income: 0.28,
      loan_to_value: 0.65,
      amount: 1_500_000,
      sector: "consumer_discretionary",
      borrower_rating: "AA",
    },
  });
  const ids = d.context_nodes.map((n) => n.id).sort();
  assert.deepEqual(ids, ["amount", "dti", "fico", "ltv", "rating", "sector"]);
});

test("runAmbientTurn: skips context_nodes for fields not supplied", () => {
  const d = runAmbientTurn({
    question: "?",
    persona_ids: ["credit_fundamentals"],
    loan_context: { credit_score: 720 },
  });
  assert.equal(d.context_nodes.length, 1);
  assert.equal(d.context_nodes[0].id, "fico");
});


// Integration: runLoanCouncil output → ambient descriptor

test("runAmbientTurn: merges runLoanCouncil voices into personas", () => {
  const loan = getSiveLoan("obvious_approve");
  const council = runLoanCouncil(loan);
  const d = runAmbientTurn({
    question: "Should we approve this consumer loan?",
    persona_ids: [
      "credit_fundamentals",
      "risk_officer",
      "fair_lending",
      "customer_advocate",
      "macro_contrarian",
    ],
    loan_context: loan,
    council_output: council,
  });
  assert.equal(d.verdict, "approve");
  for (const p of d.personas) {
    assert.ok(p.verdict, `${p.id}: verdict missing`);
    assert.equal(typeof p.confidence, "number");
  }
});

test("runAmbientTurn: OFAC refuse_to_serve verdict propagates", () => {
  const d = runAmbientTurn({
    question: "?",
    persona_ids: ["aml_kyc"],
    council_output: {
      final_verdict: "refuse_to_serve",
      voices: [],
    },
  });
  assert.equal(d.verdict, "refuse_to_serve");
});


// chat vs ambient mode

test("runAmbientTurn: response_mode chat is allowed", () => {
  const d = runAmbientTurn({
    question: "?",
    persona_ids: ["credit_fundamentals"],
    response_mode: "chat",
  });
  assert.equal(d.response_mode, "chat");
});

test("runAmbientTurn: rejects unknown response_mode", () => {
  assert.throws(
    () => runAmbientTurn({
      question: "?",
      persona_ids: ["credit_fundamentals"],
      response_mode: "vr",
    }),
    /response_mode/,
  );
});


// Tool catalog contract (v0.2+ LLM tool-use surface)

test("ambientToolCatalog: exposes exactly 5 tools", () => {
  const tools = ambientToolCatalog();
  assert.equal(tools.length, 5);
});

test("ambientToolCatalog: tool names are the documented set", () => {
  const names = ambientToolCatalog().map((t) => t.name).sort();
  assert.deepEqual(names, [
    "finalize_layout",
    "finish",
    "place_context_node",
    "select_personas",
    "stage_loan_question",
  ]);
});

test("ambientToolCatalog: select_personas persona_ids enum matches PERSONA_CATALOG", () => {
  const t = ambientToolCatalog().find((x) => x.name === "select_personas");
  const enums = t.input_schema.properties.persona_ids.items.enum;
  assert.deepEqual(enums.sort(), Object.keys(PERSONA_CATALOG).sort());
});

test("ambientToolCatalog: finish tool caps spoken_text at 80 chars", () => {
  const t = ambientToolCatalog().find((x) => x.name === "finish");
  assert.equal(t.input_schema.properties.spoken_text.maxLength, 80);
});


// System prompt builder

test("buildAmbientSystemPrompt: returns non-empty string with the 3 hard rules", () => {
  const s = buildAmbientSystemPrompt();
  assert.match(s, /Never render 3D UI for chat/);
  assert.match(s, /Never claim a council verdict/);
  assert.match(s, /Never invent an AA code/);
});

test("buildAmbientSystemPrompt: response_mode is surfaced in prompt", () => {
  assert.match(buildAmbientSystemPrompt({ response_mode: "chat" }), /Response mode: chat/);
  assert.match(buildAmbientSystemPrompt({ response_mode: "ambient" }), /Response mode: ambient/);
});

test("buildAmbientSystemPrompt: loan_context, if provided, appears in prompt", () => {
  const s = buildAmbientSystemPrompt({ loan_context: { credit_score: 780 } });
  assert.match(s, /credit_score/);
  assert.match(s, /780/);
});
