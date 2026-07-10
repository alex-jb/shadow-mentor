// MCP Enterprise Managed Authentication (EMA) scaffold — Tier 2 #10.
//
// Per MCP spec stable as of June 2026, MCP servers MAY require Bearer
// tokens issued by an enterprise Authorization Server (typically the
// bank's Okta / Azure AD / Google Workspace IdP) and MUST map OAuth
// scopes to specific tool surfaces.
//
// Shadow does not run its own Authorization Server — that is the
// deploying bank's responsibility. Shadow provides:
//   1. A frozen scope-to-tool catalog so procurement can grep the
//      surface in one file (not 6 endpoints).
//   2. A validator function the MCP server calls before dispatching a
//      tool. The validator takes a parsed-token claims object and the
//      requested tool name; it returns ok | denied with a reason that
//      the MCP host can surface to the user.
//   3. A stub IdP-discovery URL pattern (.well-known/oauth-authorization-
//      server) so a deploying bank can wire their IdP without code edits.
//
// The validator is intentionally synchronous and stateless. Live token
// signature + issuer validation runs *before* this function (typically
// at the Vercel / edge tier); this layer enforces the *authorization*
// contract — what scope buys what tool.
//
// Procurement review path:
//   - SCOPE_TO_TOOLS in this file
//   - test/oauth-scaffold.test.js (contract pin)
//   - mcp/server.js handler (call site)

// Stable scope catalog. Pinned by test/oauth-scaffold.test.js. Any
// change here without updating the test fails CI.
export const SCOPE_TO_TOOLS = Object.freeze({
  // Read-only surface for analyst seats (Tier 1 procurement: most users).
  // shadow_verify_attestation is read-only crypto verification — bank
  // auditors on a read seat must be able to check integrity of any
  // persisted decision without a council seat.
  "shadow:read": Object.freeze([
    "shadow_recall",
    "shadow_calibration",
    "shadow_scenarios",
    "shadow_traceability",
    "shadow_verify_attestation",
  ]),
  // Compute surface for credit officer seats (Tier 2: signing reviewers).
  // shadow_size_position (v1.5.15) is deterministic pure-computation
  // trading-vertical sizing — gated behind the council scope because it
  // touches capital-allocation math (Kelly + volatility), not read-only
  // audit surface.
  "shadow:council": Object.freeze([
    "shadow_loan_council",
    "shadow_loan_council_typed",
    "shadow_risk_tools",
    "shadow_size_position",
  ]),
  // Admin: union — for ops / on-call only
  "shadow:admin": Object.freeze([
    "shadow_loan_council",
    "shadow_loan_council_typed",
    "shadow_risk_tools",
    "shadow_recall",
    "shadow_calibration",
    "shadow_scenarios",
    "shadow_traceability",
    "shadow_verify_attestation",
    "shadow_size_position",
  ]),
});

// Every tool must be covered by at least one scope. Asserted in the test
// suite — a future new tool added without scope assignment fails CI.
export const ALL_TOOLS = Object.freeze([
  "shadow_loan_council",
  "shadow_loan_council_typed",
  "shadow_risk_tools",
  "shadow_recall",
  "shadow_calibration",
  "shadow_scenarios",
  "shadow_traceability",
  "shadow_verify_attestation",
  "shadow_size_position",
]);

export class UnauthorizedError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "UnauthorizedError";
    this.code = code; // "missing_scope" | "no_token" | "tool_unknown"
  }
}

/**
 * Validate that a parsed token's scopes grant access to a requested tool.
 *
 * @param {object} claims  Parsed JWT claims, expected shape:
 *                         { scope: "shadow:read shadow:council", ... }
 *                         or { scp: ["shadow:read", ...] } (Azure AD shape).
 * @param {string} toolName  Tool the caller wants to invoke.
 * @returns {{ ok: boolean, scope: string|null, reason: string|null }}
 */
export function validateToolScope(claims, toolName) {
  if (!ALL_TOOLS.includes(toolName)) {
    return { ok: false, scope: null, reason: "unknown tool: " + toolName };
  }
  const scopes = extractScopes(claims);
  if (scopes.length === 0) {
    return { ok: false, scope: null, reason: "no scopes in token" };
  }
  for (const scope of scopes) {
    const grants = SCOPE_TO_TOOLS[scope];
    if (grants && grants.includes(toolName)) {
      return { ok: true, scope, reason: null };
    }
  }
  return {
    ok: false,
    scope: null,
    reason: `none of [${scopes.join(", ")}] grants ${toolName}`,
  };
}

/**
 * Pull scopes out of a JWT claims object, tolerating the two common shapes:
 * - OAuth2 RFC 6749 / RFC 9068:  scope: "a b c"
 * - Azure AD (and some Okta deployments): scp: ["a", "b", "c"]
 */
export function extractScopes(claims) {
  if (!claims || typeof claims !== "object") return [];
  if (typeof claims.scope === "string") {
    return claims.scope.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(claims.scp)) {
    return claims.scp.filter((s) => typeof s === "string");
  }
  if (Array.isArray(claims.scopes)) {
    return claims.scopes.filter((s) => typeof s === "string");
  }
  return [];
}

/**
 * Parse a `Authorization: Bearer <token>` header. Does NOT validate the
 * signature — that is the responsibility of the upstream edge layer
 * (Vercel middleware or the bank's API gateway). Returns the raw token
 * string or null.
 */
export function parseBearer(authorizationHeader) {
  if (typeof authorizationHeader !== "string") return null;
  const m = authorizationHeader.match(/^Bearer\s+([A-Za-z0-9._\-+/=]+)$/);
  return m ? m[1] : null;
}

/**
 * The .well-known/oauth-authorization-server discovery URL Shadow would
 * point at if it ran its own AS. In practice the deploying bank's IdP
 * is the AS; this helper just constructs the URL for documentation /
 * discovery purposes.
 */
export function wellKnownAuthServerUrl(issuerUrl) {
  // RFC 8414 — Authorization Server Metadata
  if (!issuerUrl) return null;
  const trimmed = issuerUrl.replace(/\/+$/, "");
  return `${trimmed}/.well-known/oauth-authorization-server`;
}
