// test/mcp-response.test.js
// v1.5.45 contract tests for the dual-envelope MCP response primitive.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createResponse,
  isEnvelope,
  ENVELOPE_MARKER,
} from "../mcp/response.js";


test("createResponse: empty envelope has empty text + no structured", () => {
  const env = createResponse().build();
  assert.equal(isEnvelope(env), true);
  assert.deepEqual(env.content, [{ type: "text", text: "" }]);
  assert.equal(env.structuredContent, undefined);
  assert.equal(env.isError, undefined);
});


test("appendLine: joins lines with newlines", () => {
  const env = createResponse()
    .appendLine("BLOCK — FICO 640 below floor")
    .appendLine("Reason codes: AA01, AA02")
    .build();
  assert.equal(env.content[0].text, "BLOCK — FICO 640 below floor\nReason codes: AA01, AA02");
});


test("appendLine: preserves blank lines", () => {
  const env = createResponse()
    .appendLine("line 1")
    .appendLine("")
    .appendLine("line 3")
    .build();
  assert.equal(env.content[0].text, "line 1\n\nline 3");
});


test("appendLine: rejects non-string input", () => {
  const b = createResponse();
  assert.throws(() => b.appendLine(42), TypeError);
  assert.throws(() => b.appendLine(null), TypeError);
  assert.throws(() => b.appendLine({}), TypeError);
});


test("setStructured: attaches typed JSON body", () => {
  const structured = { verdict: "approve", voices: [] };
  const env = createResponse().setStructured(structured).build();
  assert.deepEqual(env.structuredContent, structured);
});


test("setStructured: last call wins", () => {
  const env = createResponse()
    .setStructured({ a: 1 })
    .setStructured({ b: 2 })
    .build();
  assert.deepEqual(env.structuredContent, { b: 2 });
});


test("setStructured: rejects non-object input", () => {
  const b = createResponse();
  assert.throws(() => b.setStructured(null), TypeError);
  assert.throws(() => b.setStructured([]), TypeError);
  assert.throws(() => b.setStructured("string"), TypeError);
});


test("setError: sets isError + error text + details", () => {
  const env = createResponse()
    .setError("invalid loan", { validation_errors: ["FICO out of range"] })
    .build();
  assert.equal(env.isError, true);
  assert.equal(env.content[0].text, "ERROR: invalid loan");
  assert.deepEqual(env.structuredContent, {
    error: {
      message: "invalid loan",
      details: { validation_errors: ["FICO out of range"] },
    },
  });
});


test("setError: null/empty message coerced to 'unspecified error'", () => {
  const env = createResponse().setError("").build();
  assert.equal(env.structuredContent.error.message, "unspecified error");
});


test("setError: never throws — always returns a builder", () => {
  const b = createResponse();
  const out = b.setError("x", null);
  assert.equal(typeof out.build, "function");
});


test("setError takes precedence over prior appendLine content", () => {
  // If a tool started building content then hit an error mid-way, the
  // error message replaces the partial text so LLM callers don't get
  // ambiguous mixed output.
  const env = createResponse()
    .appendLine("partial progress...")
    .setError("timeout after 30s")
    .build();
  assert.equal(env.content[0].text, "ERROR: timeout after 30s");
});


test("fluent chaining: appendLine + setStructured combines correctly", () => {
  const env = createResponse()
    .appendLine("APPROVE — all 5 personas unanimous")
    .appendLine("aggregated_score: 0.92")
    .setStructured({
      final_verdict: "approve",
      voices: [
        { voice: "Credit Fundamentals", verdict: "approve" },
        { voice: "Risk Officer", verdict: "approve" },
      ],
    })
    .build();
  assert.match(env.content[0].text, /APPROVE.*aggregated/s);
  assert.equal(env.structuredContent.final_verdict, "approve");
  assert.equal(env.structuredContent.voices.length, 2);
});


test("isEnvelope: true only for marker-carrying builder output", () => {
  const env = createResponse().build();
  assert.equal(isEnvelope(env), true);

  // Plain-object tools returning legacy shape must NOT be
  // mis-identified as envelopes.
  assert.equal(isEnvelope({ verdict: "approve" }), false);
  assert.equal(isEnvelope({ content: [] }), false);
  assert.equal(isEnvelope(null), false);
  assert.equal(isEnvelope(undefined), false);
  assert.equal(isEnvelope("string"), false);
});


test("ENVELOPE_MARKER: is a Symbol.for so cross-module references match", () => {
  assert.equal(typeof ENVELOPE_MARKER, "symbol");
  assert.equal(ENVELOPE_MARKER, Symbol.for("shadow.mcp.response.v1"));
});


test("integration: envelope shape matches MCP SDK expectations", () => {
  // The MCP SDK CallToolRequest response expects at minimum:
  //   { content: [{ type: "text", text: string }] }
  // With optional structuredContent + isError. This test locks that
  // shape so a future SDK bump surfaces immediately.
  const env = createResponse()
    .appendLine("verdict: approve")
    .setStructured({ verdict: "approve" })
    .build();

  assert.ok(Array.isArray(env.content));
  assert.equal(env.content[0].type, "text");
  assert.equal(typeof env.content[0].text, "string");
  assert.equal(typeof env.structuredContent, "object");
  assert.equal(env[ENVELOPE_MARKER], true);
});
