// Contract tests for the MCP Enterprise Managed Authentication (EMA)
// scaffold. The point of pinning these in CI: a procurement reviewer
// can grep lib/auth/oauth-scaffold.js + this file and verify in five
// minutes that:
//   - Shadow's scope catalog is frozen (no implicit privilege creep).
//   - Every tool is covered by at least one scope (no orphan surface).
//   - Validator denies unknown scopes / unknown tools / missing scope.
//   - Bearer-token parsing rejects malformed headers.
// All deterministic, no network, no real IdP needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SCOPE_TO_TOOLS,
  ALL_TOOLS,
  validateToolScope,
  extractScopes,
  parseBearer,
  wellKnownAuthServerUrl,
  UnauthorizedError,
} from "../lib/auth/oauth-scaffold.js";
import { TOOLS } from "../mcp/server.js";

describe("EMA scope catalog (frozen surface)", () => {
  test("SCOPE_TO_TOOLS is frozen at the top level", () => {
    assert.equal(Object.isFrozen(SCOPE_TO_TOOLS), true);
    for (const grants of Object.values(SCOPE_TO_TOOLS)) {
      assert.equal(Object.isFrozen(grants), true,
        "each scope's tool list must be frozen so a runtime push() can't widen privilege");
    }
  });

  test("ALL_TOOLS lists exactly the MCP tools — no orphan surface", () => {
    const declared = new Set(TOOLS.map((t) => t.name));
    const guarded = new Set(ALL_TOOLS);
    assert.equal(declared.size, guarded.size,
      `mismatch: MCP server has ${declared.size} tools, EMA guards ${guarded.size}`);
    for (const name of declared) {
      assert.ok(guarded.has(name), `tool ${name} declared but not in ALL_TOOLS`);
    }
  });

  test("every tool is covered by at least one scope", () => {
    const covered = new Set();
    for (const grants of Object.values(SCOPE_TO_TOOLS)) {
      for (const t of grants) covered.add(t);
    }
    for (const t of ALL_TOOLS) {
      assert.ok(covered.has(t), `tool ${t} has no scope — orphan privilege surface`);
    }
  });

  test("shadow:read is read-only (no council / no risk-tools)", () => {
    const reads = SCOPE_TO_TOOLS["shadow:read"];
    assert.ok(!reads.includes("shadow_loan_council"),
      "shadow:read MUST NOT grant council write — Tier-1 procurement contract");
    assert.ok(!reads.includes("shadow_risk_tools"),
      "shadow:read MUST NOT grant risk-tools — Tier-1 procurement contract");
  });

  test("shadow:admin is the union of read + council", () => {
    const admin = new Set(SCOPE_TO_TOOLS["shadow:admin"]);
    for (const t of SCOPE_TO_TOOLS["shadow:read"]) assert.ok(admin.has(t));
    for (const t of SCOPE_TO_TOOLS["shadow:council"]) assert.ok(admin.has(t));
  });
});

describe("validateToolScope", () => {
  test("grants when scope covers the tool", () => {
    const result = validateToolScope(
      { scope: "shadow:read" },
      "shadow_calibration"
    );
    assert.equal(result.ok, true);
    assert.equal(result.scope, "shadow:read");
  });

  test("denies when scope does not cover the tool", () => {
    const result = validateToolScope(
      { scope: "shadow:read" },
      "shadow_loan_council"
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /none of \[shadow:read\] grants shadow_loan_council/);
  });

  test("denies on missing scope claim", () => {
    const result = validateToolScope({}, "shadow_recall");
    assert.equal(result.ok, false);
    assert.match(result.reason, /no scopes/);
  });

  test("denies on unknown tool name", () => {
    const result = validateToolScope(
      { scope: "shadow:admin" },
      "shadow_evil_tool"
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /unknown tool/);
  });

  test("accepts Azure AD scp[] claim shape", () => {
    const result = validateToolScope(
      { scp: ["shadow:council"] },
      "shadow_loan_council"
    );
    assert.equal(result.ok, true);
    assert.equal(result.scope, "shadow:council");
  });

  test("accepts space-separated scope string (OAuth2 RFC 6749)", () => {
    const result = validateToolScope(
      { scope: "shadow:read shadow:council openid profile" },
      "shadow_loan_council"
    );
    assert.equal(result.ok, true);
    assert.equal(result.scope, "shadow:council");
  });

  test("denies cleanly when claims is null / undefined / non-object", () => {
    for (const claims of [null, undefined, "raw-token-string", 42]) {
      const result = validateToolScope(claims, "shadow_calibration");
      assert.equal(result.ok, false);
    }
  });

  test("an unknown scope in claims does NOT grant any tool", () => {
    // Defense against scope-confusion: a token issued for some other
    // service with scope="admin" must not match Shadow's "shadow:admin".
    const result = validateToolScope(
      { scope: "admin shadow:nonexistent" },
      "shadow_loan_council"
    );
    assert.equal(result.ok, false);
  });
});

describe("extractScopes — multi-IdP shape tolerance", () => {
  test("OAuth2 RFC 6749 space-separated string", () => {
    assert.deepEqual(extractScopes({ scope: "a b c" }), ["a", "b", "c"]);
  });
  test("Azure AD scp array", () => {
    assert.deepEqual(extractScopes({ scp: ["a", "b"] }), ["a", "b"]);
  });
  test("scopes[] array fallback", () => {
    assert.deepEqual(extractScopes({ scopes: ["a", "b"] }), ["a", "b"]);
  });
  test("non-string entries in scp[] are dropped", () => {
    assert.deepEqual(extractScopes({ scp: ["a", 42, null, "b"] }), ["a", "b"]);
  });
  test("empty / missing returns []", () => {
    assert.deepEqual(extractScopes({}), []);
    assert.deepEqual(extractScopes(null), []);
    assert.deepEqual(extractScopes(undefined), []);
  });
});

describe("parseBearer", () => {
  test("parses standard 'Bearer <token>' header", () => {
    assert.equal(parseBearer("Bearer abc.def-ghi_jkl"), "abc.def-ghi_jkl");
  });
  test("returns null on missing Bearer prefix", () => {
    assert.equal(parseBearer("abc.def"), null);
    assert.equal(parseBearer("Basic abc"), null);
  });
  test("returns null on non-string input (defense in depth)", () => {
    assert.equal(parseBearer(null), null);
    assert.equal(parseBearer(undefined), null);
    assert.equal(parseBearer({}), null);
  });
  test("rejects shell-injection / URL bytes in token", () => {
    // Tokens are always RFC 6750 alphanumeric + `.-_+/=`. Anything
    // else gets rejected at this layer so a poisoned MCP host config
    // can't sneak shell metacharacters into log lines.
    assert.equal(parseBearer("Bearer abc;rm -rf /"), null);
    assert.equal(parseBearer("Bearer abc`whoami`"), null);
    assert.equal(parseBearer("Bearer abc\n"), null);
  });
});

describe("wellKnownAuthServerUrl", () => {
  test("constructs RFC 8414 discovery URL", () => {
    assert.equal(
      wellKnownAuthServerUrl("https://login.bank.example.com"),
      "https://login.bank.example.com/.well-known/oauth-authorization-server"
    );
  });
  test("strips trailing slashes", () => {
    assert.equal(
      wellKnownAuthServerUrl("https://login.bank.example.com/"),
      "https://login.bank.example.com/.well-known/oauth-authorization-server"
    );
  });
  test("returns null on empty input", () => {
    assert.equal(wellKnownAuthServerUrl(null), null);
    assert.equal(wellKnownAuthServerUrl(""), null);
  });
});

describe("UnauthorizedError class", () => {
  test("exposes a code for the MCP host to surface in 401-style responses", () => {
    const err = new UnauthorizedError("missing scope shadow:council", "missing_scope");
    assert.equal(err.name, "UnauthorizedError");
    assert.equal(err.code, "missing_scope");
    assert.match(err.message, /missing scope/);
  });
});
