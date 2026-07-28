// Untrusted-input hardening for the verifier. Every dropped bundle + all evidence text is
// treated as hostile: safe parse with size / depth / node limits + prototype-pollution
// rejection, HTML escaping for anything rendered, and a citation-link allowlist so evidence
// can never inject a javascript: URL or an arbitrary external origin. The same logic is
// inlined into verify.html; this module makes it host-testable.

export const DEFAULT_LIMITS = Object.freeze({ maxBytes: 8_000_000, maxDepth: 64, maxNodes: 200_000 });
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function safeParse(text, limits = {}) {
  const { maxBytes, maxDepth, maxNodes } = { ...DEFAULT_LIMITS, ...limits };
  if (typeof text !== "string") return { ok: false, reason: "NOT_A_STRING" };
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { ok: false, reason: "TOO_LARGE" };

  let parsed;
  try {
    // No reviver drop: JSON.parse creates "__proto__" etc. as OWN properties (it does not
    // pollute Object.prototype), and the walk below FAILS CLOSED on any dangerous key rather
    // than silently dropping it — an auditor wants a pollution attempt reported, not hidden.
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: "MALFORMED_JSON" };
  }

  let nodes = 0;
  const walk = (v, depth) => {
    if (depth > maxDepth) throw new Error("TOO_DEEP");
    if (++nodes > maxNodes) throw new Error("TOO_MANY_NODES");
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (DANGEROUS_KEYS.has(k)) throw new Error("PROTOTYPE_POLLUTION");
        walk(v[k], depth + 1);
      }
    }
  };
  try {
    walk(parsed, 0);
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  return { ok: true, value: parsed };
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Only allow http(s) links to an allowlisted host (official citation sources). Everything else
// — javascript:, data:, file:, unknown origins — returns null so it renders as inert text.
export const DEFAULT_CITATION_HOSTS = Object.freeze([
  "federalreserve.gov", "consumerfinance.gov", "eur-lex.europa.eu", "curia.europa.eu",
  "gpo.gov", "ecfr.gov", "fdic.gov", "occ.gov", "github.com",
]);

export function safeUrl(url, allowHosts = DEFAULT_CITATION_HOSTS) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  const ok = allowHosts.some((h) => host === h || host.endsWith("." + h));
  return ok ? u.href : null;
}
