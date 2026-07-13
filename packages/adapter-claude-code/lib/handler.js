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
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { mapEvent, actorFor, extractPayload } from "./mapping.js";
import { enrichFromTranscript } from "./transcript.js";

const KEY_ID_DEFAULT = "claude-code-local";
// Safety cap: if we've buffered this many hooks and still don't have a
// model from the transcript, give up and materialize the session with
// "unknown" so we never leak unbounded memory or lose events forever.
const PENDING_HOOK_CAP = 40;

function sessionsDir(shadowDir) {
  return join(shadowDir, "sessions");
}
function storePath(shadowDir, sessionId) {
  return join(sessionsDir(shadowDir), `${sessionId}.jsonl`);
}
function pendingPath(shadowDir, sessionId) {
  return join(sessionsDir(shadowDir), `${sessionId}.pending.jsonl`);
}
function bundleDir(shadowDir, sessionId) {
  return join(sessionsDir(shadowDir), sessionId);
}
function bundlePath(shadowDir, sessionId) {
  return join(bundleDir(shadowDir, sessionId), "bundle.json");
}

function readPending(shadowDir, sessionId) {
  const path = pendingPath(shadowDir, sessionId);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function appendPending(shadowDir, sessionId, record) {
  mkdirSync(sessionsDir(shadowDir), { recursive: true });
  appendFileSync(pendingPath(shadowDir, sessionId), JSON.stringify(record) + "\n", "utf8");
}

function clearPending(shadowDir, sessionId) {
  const path = pendingPath(shadowDir, sessionId);
  if (existsSync(path)) unlinkSync(path);
}

function materializeSession({ shadowDir, sessionId, stdin, privateKey, keyId, agentVersion, modelId }) {
  const storeFilePath = storePath(shadowDir, sessionId);
  const store = createFileStore({ path: storeFilePath });
  const session = createSession({
    agent: {
      name: "claude-code",
      version: agentVersion
        ?? process.env.CLAUDE_CODE_VERSION
        ?? stdin?.claude_code_version
        ?? "unknown",
    },
    models: [
      {
        model_id: modelId ?? stdin?.model ?? "unknown",
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
  return session;
}

/**
 * Look up or resolve a session for this hook event. Three outcomes:
 *
 *   { session, isNew: false }               — recovered from existing store
 *   { session, isNew: true, replay: [] }    — freshly created; replay list
 *                                             contains any buffered events
 *   { session: null, deferred: true }       — no model info yet, hook was
 *                                             buffered to the pending file
 *                                             (unless forceMaterialize was set)
 *
 * M2.2 Phase 2 (2026-07-13): a fresh session with an empty transcript no
 * longer materializes immediately with model_id="unknown". Instead the
 * hook is buffered to `sessions/{id}.pending.jsonl`. Later hooks retry
 * enrichFromTranscript; the FIRST one that finds a model triggers
 * materializeSession + replay of the buffered hooks in original order.
 *
 * `forceMaterialize` is set on SessionEnd so a truly-empty transcript
 * still produces a bundle (with fallback "unknown") instead of stranding
 * the pending queue on disk forever.
 */
function ensureSession({ shadowDir, sessionId, stdin, privateKey, keyId, forceMaterialize }) {
  mkdirSync(sessionsDir(shadowDir), { recursive: true });
  const storeFilePath = storePath(shadowDir, sessionId);

  if (existsSync(storeFilePath) && readFileSync(storeFilePath, "utf8").trim().length > 0) {
    const store = createFileStore({ path: storeFilePath });
    const session = recoverSession({ store, privateKey });
    return { session, isNew: false, replay: [] };
  }

  const { agentVersion, modelId } = enrichFromTranscript(stdin.transcript_path);
  const pending = readPending(shadowDir, sessionId);
  const overCap = pending.length >= PENDING_HOOK_CAP;

  if (!modelId && !forceMaterialize && !overCap) {
    return { session: null, deferred: true, isNew: false, replay: [] };
  }

  const session = materializeSession({
    shadowDir, sessionId, stdin, privateKey, keyId, agentVersion, modelId,
  });
  return { session, isNew: true, replay: pending };
}

/**
 * Route one hook event. Non-blocking: unmapped events return silently.
 * Throws only on programmer errors (missing key, invalid stdin, storage
 * corruption). Callers should log-and-swallow to keep the parent Claude
 * Code session unblocked.
 */
function appendMappedEvent(session, eventName, stdin) {
  const { agentVersion: discoveredVersion, modelId: discoveredModelId } =
    enrichFromTranscript(stdin?.transcript_path);
  const extensions = {};
  if (discoveredVersion) extensions.discovered_agent_version = discoveredVersion;
  if (discoveredModelId) extensions.discovered_model_id = discoveredModelId;

  const basePayload = extractPayload(eventName, stdin);
  const payload = eventName === "SessionEnd"
    ? { ...basePayload, discovered_model_id: discoveredModelId, discovered_agent_version: discoveredVersion }
    : basePayload;

  appendEvent(session, {
    event_type: mapEvent(eventName),
    actor: actorFor(eventName),
    payload,
    extensions: Object.keys(extensions).length > 0 ? extensions : undefined,
  });
}

export function handleHookEvent({ eventName, stdin, shadowDir, privateKey, keyId = KEY_ID_DEFAULT }) {
  if (!eventName) throw new Error("handleHookEvent: eventName required");
  if (!shadowDir) throw new Error("handleHookEvent: shadowDir required");
  if (!privateKey) throw new Error("handleHookEvent: privateKey required");
  const s = stdin ?? {};

  const shadowEventType = mapEvent(eventName);
  if (!shadowEventType) return { skipped: true, reason: `unmapped ${eventName}` };

  const sessionId = s.session_id ?? "unknown-session";

  // On SessionEnd, always materialize — the pending queue must not
  // strand on disk. Fallback header will be "unknown" only if we truly
  // never found a model.
  const forceMaterialize = eventName === "SessionEnd";
  const { session, deferred, replay } = ensureSession({
    shadowDir, sessionId, stdin: s, privateKey, keyId, forceMaterialize,
  });

  if (deferred) {
    // No model info yet; buffer this hook for a later retry.
    appendPending(shadowDir, sessionId, { eventName, stdin: s });
    return { skipped: true, reason: "buffered — model not yet known", sessionId };
  }

  // If SessionEnd arrives on a session that's already been sealed via
  // manual `shadow-record seal`, recoverSession returns _sealed: true.
  // Don't double-seal — just return early.
  if (session._sealed) {
    return { skipped: true, reason: "session already sealed", sessionId };
  }

  // Replay any buffered hooks first, then the current one.
  if (replay && replay.length > 0) {
    for (const rec of replay) {
      if (mapEvent(rec.eventName)) appendMappedEvent(session, rec.eventName, rec.stdin);
    }
    clearPending(shadowDir, sessionId);
  }

  appendMappedEvent(session, eventName, s);

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
export function sealSessionById({ sessionId, shadowDir, privateKey, partial = false, keyId = KEY_ID_DEFAULT }) {
  if (!sessionId) throw new Error("sealSessionById: sessionId required");
  const path = storePath(shadowDir, sessionId);

  // M2.2 Phase 2 (2026-07-13): if the store doesn't exist but a pending
  // queue does, the session was deferred waiting for transcript_path
  // model discovery. Force materialize now (unknown fallback) + replay
  // + seal so we never strand pending events.
  if (!existsSync(path) || readFileSync(path, "utf8").trim().length === 0) {
    const pending = readPending(shadowDir, sessionId);
    if (pending.length === 0) {
      throw new Error(`sealSessionById: no store at ${path}`);
    }
    // Try to enrich from the last pending event's transcript_path in
    // case one is available now (long-lived Claude Code process).
    const lastStdin = pending[pending.length - 1].stdin ?? {};
    const { agentVersion, modelId } = enrichFromTranscript(lastStdin.transcript_path);
    const session = materializeSession({
      shadowDir, sessionId, stdin: lastStdin, privateKey, keyId, agentVersion, modelId,
    });
    for (const rec of pending) {
      if (mapEvent(rec.eventName)) appendMappedEvent(session, rec.eventName, rec.stdin);
    }
    clearPending(shadowDir, sessionId);
    const bundle = partial ? sealPartialBundle(session) : sealSession(session);
    return writeBundleForSession({ shadowDir, sessionId, bundle });
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
  // If a pending queue still exists on a recovered session, replay it.
  const stillPending = readPending(shadowDir, sessionId);
  for (const rec of stillPending) {
    if (mapEvent(rec.eventName)) appendMappedEvent(session, rec.eventName, rec.stdin);
  }
  if (stillPending.length > 0) clearPending(shadowDir, sessionId);
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
