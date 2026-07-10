// mcp/response.js
// ──────────────────────────────────────────────────────────────────
// v1.5.45 (2026-07-09). Dual-envelope response primitive for the
// Shadow MCP server.
//
// Ports the pattern from ChromeDevTools/chrome-devtools-mcp
// (src/McpResponse.ts), Apache-2.0, Google LLC. The idea: every tool
// response emits TWO parallel views of the same result —
//
//   content[]           — human-readable markdown or plain-text
//                         lines. What the LLM caller reads to
//                         reason about the result. Ideal for Cursor
//                         / Claude Desktop UX.
//
//   structuredContent   — typed JSON. What downstream tooling (bank
//                         SIEM, procurement audit dashboard, another
//                         MCP tool) parses. Ideal for automation +
//                         audit trail. Never lossy.
//
// Prior to v1.5.45 Shadow's MCP dispatch stringified the whole result
// object into content[0].text. LLM callers had to JSON.parse the
// text field before reasoning; downstream automation had to
// re-parse the same string. This envelope splits those concerns.
//
// Errors are set via .setError() on the response — never thrown to
// the SDK. This keeps the attestation-hash-chain hook deterministic
// across transports (stdio today, HTTP tomorrow) — a thrown error
// can bypass the hook.
//
// Back-compat: `handleToolCall(name, args)` in mcp/server.js is
// unchanged. This primitive is opt-in: a tool that wants the dual
// envelope wraps its result with `createResponse()` before returning.
// Existing tools continue to return plain objects and are wrapped by
// the dispatch handler exactly as before.
//
// ──────────────────────────────────────────────────────────────────

/**
 * Envelope marker. When present on a `handleToolCall` return value,
 * the dispatch handler treats it as a pre-built dual envelope and
 * emits `{ content, structuredContent, isError }` directly instead
 * of re-wrapping.
 *
 * Kept as a Symbol so plain-object tools cannot accidentally set it.
 */
export const ENVELOPE_MARKER = Symbol.for("shadow.mcp.response.v1");


/**
 * createResponse() — fluent builder for the dual envelope.
 *
 * Usage:
 *   return createResponse()
 *     .appendLine("BLOCK — FICO 640 below 700 hard floor")
 *     .appendLine("Reason codes: AA01, AA02 (CFPB Circular 2022-03)")
 *     .setStructured({ verdict: "block", codes: ["AA01","AA02"], ... })
 *     .build();
 *
 * Errors:
 *   return createResponse()
 *     .setError("invalid loan", { validation_errors: v.errors })
 *     .build();
 *
 * Order of calls does not matter; .build() renders the final envelope.
 *
 * @returns {object} builder with fluent methods + terminal .build()
 */
export function createResponse() {
  const lines = [];
  let structured = null;
  let error = null;

  const builder = {
    /**
     * Append one human-readable line to `content[0].text`. Lines are
     * joined with "\n" at build time. Empty strings are preserved
     * (they render as blank lines).
     *
     * @param {string} line
     */
    appendLine(line) {
      if (typeof line !== "string") {
        throw new TypeError("appendLine: line must be a string");
      }
      lines.push(line);
      return builder;
    },

    /**
     * Set the structured JSON body. Can be called multiple times;
     * the last call wins.
     *
     * @param {object} obj
     */
    setStructured(obj) {
      if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        throw new TypeError("setStructured: obj must be a non-array object");
      }
      structured = obj;
      return builder;
    },

    /**
     * Mark the response as an error. The message goes into
     * content[0].text; details (if any) into structuredContent.error.
     * Never throws to the caller — always returns a builder that
     * .build() will render with isError=true.
     *
     * @param {string} message
     * @param {object} [details]
     */
    setError(message, details = null) {
      const msg = typeof message === "string" && message
        ? message
        : "unspecified error";
      error = { message: msg, details: details && typeof details === "object" ? details : null };
      return builder;
    },

    /**
     * Terminal — produce the envelope object consumed by the MCP
     * dispatch handler. Includes ENVELOPE_MARKER so the handler can
     * distinguish this from legacy plain-object returns.
     *
     * @returns {object}
     */
    build() {
      const text = error
        ? `ERROR: ${error.message}`
        : (lines.length > 0 ? lines.join("\n") : "");

      const envelope = {
        [ENVELOPE_MARKER]: true,
        content: [{ type: "text", text }],
      };

      if (error) {
        envelope.isError = true;
        envelope.structuredContent = {
          error: {
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        };
      } else if (structured) {
        envelope.structuredContent = structured;
      }

      return envelope;
    },
  };

  return builder;
}


/**
 * Test whether a value is a pre-built envelope from createResponse().
 * The MCP dispatch handler uses this to skip re-wrapping.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isEnvelope(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value[ENVELOPE_MARKER] === true &&
    Array.isArray(value.content)
  );
}
