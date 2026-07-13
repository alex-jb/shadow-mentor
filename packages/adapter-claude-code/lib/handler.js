// packages/adapter-claude-code/lib/handler.js
// ─────────────────────────────────────────────────────────────────
// Pure(ish) handler routines for the shadow-record CLI. Extracted from
// bin/shadow-record.mjs so we can drive them from an integration test
// without spawning Claude Code. Everything that touches disk takes
// `shadowDir` as an argument, so tests can point at a tmp dir.
//
// Contract:
//   handleHookEvent({ eventName, stdin, shadowDir, privateKey }) → void
//     Reads or creates a per-session JSONL store at
//     `${shadowDir}/sessions/${sessionId}.jsonl`, appends the mapped
//     event, and on `SessionEnd` seals the bundle into
//     `${shadowDir}/sessions/${sessionId}/bundle.json`.
//
//   sealSessionById({ sessionId, shadowDir, privateKey, partial }) → { bundlePath, bundle }
//     Fallback for when the Claude Code `SessionEnd` hook never fires
//     (crash, `/exit` variant, network kill). Rehydrates from JSONL,
//     seals, writes bundle.json. If `partial: true`, calls
//     sealPartialBundle instead of sealSession — the resulting bundle
//     signals `session_ended_at_utc: null` to the auditor.
//
// Design notes:
//   - Store path is a SINGLE FILE per session id, not a directory. This
//     matches the createFileStore contract in shadow-attest-core@^2.0.0.
//   - The bundle.json output lives in a sibling directory named after
//     the session id so shadow-verify has one canonical location.

import {
  createSession,
  appendEvent,
  sealSession,
  sealPartialBundle,
  recoverSession,
  createFileStore,
} from "shadow-attest-core";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { mapEvent, actorFor, extractPayload } from "./mapping.js";

const KEY_ID_DEFAULT = "claude-code-local";

function sessionsDir(shadowDir) {
  return join(shadowDir, "sessions");
}
function storePath(shadowDir, sessionId) {
  return join(sessionsDir(shadowDir), `${sessionId}.jsonl`);
}
function bundleDir(shadowDir, sessionId) {
  return join(sessionsDir(shadowDir), sessionId);
}
function bundlePath(shadowDir, sessionId) {
  return join(bundleDir(shadowDir, sessionId), "bundle.json");
}

/**
 * Look up or lazily create a session for this hook event. Returns
 * { session, isNew } — isNew=true means the JSONL was empty, so we just
 * wrote the header line.
 */
function ensureSession({ shadowDir, sessionId, stdin, privateKey, keyId }) {
  mkdirSync(sessionsDir(shadowDir), { recursive: true });
  const path = storePath(shadowDir, sessionId);
  const store = createFileStore({ path });

  if (existsSync(path) && readFileSync(path, "utf8").trim().length > 0) {
    const session = recoverSession({ store, privateKey });
    return { session, isNew: false };
  }

  const session = createSession({
    agent: {
      name: "claude-code",
      version: process.env.CLAUDE_CODE_VERSION ?? stdin.claude_code_version ?? "unknown",
    },
    models: [
      {
        model_id: stdin.model ?? "unknown",
        provider: "anthropic",
      },
    ],
    environmentFingerprint: {
      os: `${process.platform}-${process.arch}`,
      node_version: process.version,
    },
    keyId,
    privateKey,
    sessionId, // pin to the Claude Code session_id so recovery matches
    store,
  });
  return { session, isNew: true };
}

/**
 * Route one hook event. Non-blocking: unmapped events return silently.
 * Throws only on programmer errors (missing key, invalid stdin, storage
 * corruption). Callers should log-and-swallow to keep the parent Claude
 * Code session unblocked.
 */
export function handleHookEvent({ eventName, stdin, shadowDir, privateKey, keyId = KEY_ID_DEFAULT }) {
  if (!eventName) throw new Error("handleHookEvent: eventName required");
  if (!shadowDir) throw new Error("handleHookEvent: shadowDir required");
  if (!privateKey) throw new Error("handleHookEvent: privateKey required");
  const s = stdin ?? {};

  const shadowEventType = mapEvent(eventName);
  if (!shadowEventType) return { skipped: true, reason: `unmapped ${eventName}` };

  const sessionId = s.session_id ?? "unknown-session";
  const { session } = ensureSession({ shadowDir, sessionId, stdin: s, privateKey, keyId });

  // If SessionEnd arrives on a session that's already been sealed via
  // manual `shadow-record seal`, recoverSession returns _sealed: true.
  // Don't double-seal — just return early.
  if (session._sealed) {
    return { skipped: true, reason: "session already sealed", sessionId };
  }

  appendEvent(session, {
    event_type: shadowEventType,
    actor: actorFor(eventName),
    payload: extractPayload(eventName, s),
  });

  if (eventName === "SessionEnd") {
    const bundle = sealSession(session);
    return writeBundleForSession({ shadowDir, sessionId, bundle });
  }

  return { skipped: false, sessionId };
}

/**
 * Fallback seal for sessions whose SessionEnd hook never fired. Reads
 * the JSONL store, rehydrates, seals, writes bundle.json.
 *
 * @returns { bundlePath, bundle }
 */
export function sealSessionById({ sessionId, shadowDir, privateKey, partial = false }) {
  if (!sessionId) throw new Error("sealSessionById: sessionId required");
  const path = storePath(shadowDir, sessionId);
  if (!existsSync(path) || readFileSync(path, "utf8").trim().length === 0) {
    throw new Error(`sealSessionById: no store at ${path}`);
  }
  const store = createFileStore({ path });
  const session = recoverSession({ store, privateKey });
  if (session._sealed) {
    // Store already has a seal line. Reconstruct the bundle from what's
    // there and re-write bundle.json so callers idempotently succeed.
    const bundle = {
      bundle_version: session.header.schema_versions?.bundle ?? 1,
      header: session.header,
      events: session.events,
      batch_root: session._recoveredSeal.batch_root,
      signatures: session._recoveredSeal.signatures,
    };
    return writeBundleForSession({ shadowDir, sessionId, bundle });
  }
  const bundle = partial ? sealPartialBundle(session) : sealSession(session);
  return writeBundleForSession({ shadowDir, sessionId, bundle });
}

function writeBundleForSession({ shadowDir, sessionId, bundle }) {
  mkdirSync(bundleDir(shadowDir, sessionId), { recursive: true });
  const outPath = bundlePath(shadowDir, sessionId);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  return { bundlePath: outPath, bundle, sessionId };
}

export const _internal = { sessionsDir, storePath, bundleDir, bundlePath };
