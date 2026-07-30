// lib/api-guard.js
// Lightweight guard for the paid / LLM-spending endpoints (/api/deliberate,
// /api/scan-analyze, /api/loan-council-from-pdf, /api/shadow-lens-analyze).
//
// Closes the "anonymous, unlimited, unbudgeted spend" (denial-of-wallet) surface:
//   1. Auth — FAIL CLOSED when SHADOW_API_KEY is set (require Authorization:
//      Bearer <key> or x-api-key). When it is NOT set, the endpoint stays open
//      for the public demo but is clearly running in demo mode.
//   2. Size cap — reject oversized bodies before they hit the model / hashing.
//   3. Per-IP rate limit — in-memory token bucket. On horizontally-scaled
//      serverless this is a speed bump, not a hard control (each instance has
//      its own map), but combined with auth + size caps it removes the trivial
//      abuse path. For a hard limit, front with a gateway / KV-backed limiter.
//
// Returns true if the request may proceed; false if it has already been answered
// (401 / 413 / 429). Callers: `if (!apiGuard(req, res, opts)) return;`

const WINDOW_MS = 60_000;
const buckets = new Map(); // ip -> { count, resetAt }

function clientIp(req) {
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export function apiGuard(req, res, opts = {}) {
  const { maxBytes = 256 * 1024, rpm = 20 } = opts;

  // 1 — auth (fail closed when configured)
  const required = process.env.SHADOW_API_KEY;
  if (required) {
    const auth = req.headers?.["authorization"] || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    const provided = bearer || req.headers?.["x-api-key"];
    if (provided !== required) {
      res.status(401).json({ error: "unauthorized — send Authorization: Bearer <SHADOW_API_KEY>" });
      return false;
    }
  }

  // 2 — size cap (header + parsed-body belt-and-suspenders)
  const len = Number(req.headers?.["content-length"] || 0);
  if (len && len > maxBytes) {
    res.status(413).json({ error: `request too large (> ${maxBytes} bytes)` });
    return false;
  }
  try {
    if (req.body && JSON.stringify(req.body).length > maxBytes) {
      res.status(413).json({ error: `request body too large (> ${maxBytes} bytes)` });
      return false;
    }
  } catch { /* unstringifiable body — let the handler validate */ }

  // 3 — per-IP rate limit
  const ip = clientIp(req);
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + WINDOW_MS }; buckets.set(ip, b); }
  b.count++;
  if (b.count > rpm) {
    res.setHeader("Retry-After", Math.ceil((b.resetAt - now) / 1000));
    res.status(429).json({ error: `rate limit exceeded (${rpm}/min) — slow down or authenticate` });
    return false;
  }
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  return true;
}
