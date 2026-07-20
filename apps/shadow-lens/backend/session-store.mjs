// apps/shadow-lens/backend/session-store.mjs
// Stateful Shadow Lens session lifecycle backing store + ephemeral request token.
//
// The token here is REQUEST AUTH only (HMAC over session_id + expiry with a server-side
// secret). It is NOT the Ed25519 evidence key — no signing key ever leaves the server, and
// this token can never sign an Evidence Bundle. The store holds the in-progress session
// (a sidecar), never the frozen bundle's private material.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ── stores ──────────────────────────────────────────────────────────────────
export class InMemoryLensStore {
  #m = new Map();
  async create(session) { this.#m.set(session.session_id, structuredClone(session)); return session.session_id; }
  async get(id) { const s = this.#m.get(id); return s ? structuredClone(s) : null; }
  async update(id, patch) {
    const s = this.#m.get(id);
    if (!s) throw new Error(`no session ${id}`);
    const next = { ...s, ...patch, updated_at: patch.updated_at ?? s.updated_at };
    this.#m.set(id, next); return structuredClone(next);
  }
  async delete(id) { return this.#m.delete(id); }
}

// File store — one JSON file per session under `dir`. No private key material is ever
// written (the caller passes only the assembled sidecar session, not the signing key).
export class FileLensStore {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); }
  #p(id) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("invalid session id"); // no path traversal
    return path.join(this.dir, `${id}.json`);
  }
  async create(session) { fs.writeFileSync(this.#p(session.session_id), JSON.stringify(session)); return session.session_id; }
  async get(id) { try { return JSON.parse(fs.readFileSync(this.#p(id), "utf8")); } catch { return null; } }
  async update(id, patch) {
    const s = await this.get(id);
    if (!s) throw new Error(`no session ${id}`);
    const next = { ...s, ...patch };
    fs.writeFileSync(this.#p(id), JSON.stringify(next)); return next;
  }
  async delete(id) { try { fs.unlinkSync(this.#p(id)); return true; } catch { return false; } }
}

// ── ephemeral request token (HMAC, not the evidence key) ─────────────────────
function b64url(buf) { return Buffer.from(buf).toString("base64url"); }

export function issueSessionToken(sessionId, { secret, ttlSec = 900, now = Date.now() } = {}) {
  if (!secret) throw new Error("session token secret required");
  const payload = { sid: sessionId, exp: Math.floor(now / 1000) + ttlSec };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token, { secret, now = Date.now() } = {}) {
  if (!secret || typeof token !== "string" || !token.includes(".")) return { valid: false, reason: "malformed" };
  const [body, sig] = token.split(".");
  const expect = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  // constant-time compare
  const a = Buffer.from(sig || "", "utf8"), b = Buffer.from(expect, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: "bad_signature" };
  let payload;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return { valid: false, reason: "bad_payload" }; }
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(now / 1000)) return { valid: false, reason: "expired", session_id: payload.sid };
  return { valid: true, session_id: payload.sid, exp: payload.exp };
}

// A per-process ephemeral secret when the env one is absent. Sessions do not survive a
// restart in that mode — honest, and safe (no secret is persisted to disk).
let _ephemeralSecret = null;
export function resolveSessionSecret(env = process.env) {
  if (env.SHADOW_LENS_SESSION_SECRET) return { secret: env.SHADOW_LENS_SESSION_SECRET, ephemeral: false };
  if (!_ephemeralSecret) _ephemeralSecret = crypto.randomBytes(32).toString("hex");
  return { secret: _ephemeralSecret, ephemeral: true };
}

export function newSessionId() { return `sls_${crypto.randomBytes(9).toString("base64url")}`; }

// ── serverless store boundary ────────────────────────────────────────────────
// In-memory and single-host file stores are NOT durable across serverless instances.
// resolveLensStore() makes the boundary explicit so the staged API never pretends a
// cross-request session survives when it cannot.
//   - SHADOW_LENS_STORE_DIR set        → FileLensStore, durable on a single-instance host.
//   - non-production, no dir            → a process-scoped in-memory singleton (dev/test).
//   - production, no durable store      → { store: null } → callers MUST refuse staged ops
//                                          with PERSISTENT_SESSION_STORE_NOT_CONFIGURED.
export const NO_DURABLE_STORE = "PERSISTENT_SESSION_STORE_NOT_CONFIGURED";

let _memSingleton = null;
export function isProductionRuntime(env = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}
export function resolveLensStore(env = process.env) {
  if (env.SHADOW_LENS_STORE_DIR) {
    return { store: new FileLensStore(env.SHADOW_LENS_STORE_DIR), durable: true, backend: "file" };
  }
  if (isProductionRuntime(env)) {
    // No durable backend in a serverless prod runtime — staged lifecycle is not safe here.
    return { store: null, durable: false, backend: "none" };
  }
  if (!_memSingleton) _memSingleton = new InMemoryLensStore();
  return { store: _memSingleton, durable: false, backend: "memory" };
}
