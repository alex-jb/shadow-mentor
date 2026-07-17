// demos/replay/3d/study/generate-trials.mjs
// ─────────────────────────────────────────────────────────────────
// Study-trial generator (IEEE VR 2027 user study, Method §3.4).
//
// Produces matched-difficulty stimuli for "find the tampered event + state its
// downstream impact." Each trial is a REAL evidence bundle from attest-core
// (createSession → appendEvent → sealSession, Ed25519-signed), then tampered by
// flipping one payload hash so the chain breaks — exactly the tamper the 2D
// replay + 3D room + verify.html all detect. Difficulty is matched WITHIN a
// set: same chain length, same tamper depth, same downstream fan-out; only the
// surface content and the specific event differ, so a display comparison is
// not confounded with puzzle difficulty.
//
// Outputs (under ./trials/):
//   trial-NN.json       — the participant-facing TAMPERED bundle (no answers)
//   answer-key.json     — ground truth for scoring (kept from participants)
//   study-public-key.pem — the key the verifier uses for every trial
//
// Run: node demos/replay/3d/study/generate-trials.mjs [--count 8] [--len 12] [--depth 6]
// The trial STRUCTURE is deterministic (seeded per index): same args → same
// event content, same tamper location, same affected set — which is what makes
// the study pre-registrable. The signing key is generated fresh per run, so the
// signature bytes differ between runs; generate the study set ONCE and freeze
// it (commit or archive trials/ + the keys) before collecting data.
// ─────────────────────────────────────────────────────────────────
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createSession, appendEvent, sealSession } from "../../../../packages/attest-core/session.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "trials");
mkdirSync(OUT, { recursive: true });

// ── args ──
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const COUNT = parseInt(arg("count", "8"), 10);   // scored trials per condition
const LEN = parseInt(arg("len", "12"), 10);      // total events (incl. start/end)
const DEPTH = parseInt(arg("depth", "6"), 10);   // seq of the altered event

// ── deterministic PRNG (mulberry32) so trials are reproducible ──
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const TOOLS = ["Read", "Grep", "Edit", "Bash", "Write", "Glob"];
const PROMPTS = ["fix the failing test", "add a config flag", "refactor the parser",
  "patch the auth check", "update the migration", "wire the new endpoint"];

// Build one session of a fixed shape, seal it, return the pristine bundle.
// The shape is: session_start, prompt, then alternating tool_call/tool_result
// pairs, turn_end — sealSession appends session_end. Length is padded/truncated
// to LEN so every trial in a set has the same chain length.
function buildPristine(idx, privateKey) {
  const r = rng(1000 + idx);
  const startedAt = new Date(Date.UTC(2026, 6, 13, 14, 0, 0) + idx * 1000).toISOString();
  const session = createSession({
    agent: { name: "claude-code", version: "2.1.116" },
    models: [{ model_id: "claude-opus-4-7", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin-25.3.0", node_version: "v24.14.1" },
    keyId: "study-key-2027",
    privateKey,
    sessionId: `study-trial-${String(idx).padStart(2, "0")}`,
    startedAtUtc: startedAt,
  });

  let t = Date.parse(startedAt);
  const step = () => new Date((t += 250 + Math.floor(r() * 400))).toISOString();

  appendEvent(session, { event_type: "session_start", actor: "system", payload: { trial: idx }, ts_utc: step() });
  appendEvent(session, { event_type: "prompt", actor: "user", payload: { text: pick(r, PROMPTS) }, ts_utc: step() });

  // fill with tool_call/tool_result pairs until we're 1 short of LEN
  // (turn_end + auto session_end close it out to exactly LEN).
  while (session.events.length < LEN - 2) {
    const tool = pick(r, TOOLS);
    appendEvent(session, { event_type: "tool_call", actor: "agent", payload: { tool, args: { seed: r() } }, ts_utc: step() });
    if (session.events.length < LEN - 2) {
      appendEvent(session, { event_type: "tool_result", actor: "tool", payload: { tool, ok: true, out: r() }, ts_utc: step() });
    }
  }
  appendEvent(session, { event_type: "turn_end", actor: "agent", payload: {}, ts_utc: step() });

  return sealSession(session, { endedAtUtc: step() }); // appends session_end → exactly LEN
}

// Tamper: flip the last hex nibble of the altered event's payload_hash (same
// mutation the demo uses). The break is DETECTED at DEPTH+1 (prev_hash of the
// next event no longer matches), and every event from there on is unverifiable.
function tamper(bundle, depth) {
  const ev = bundle.events[depth];
  const last = ev.payload_hash.slice(-1);
  ev.payload_hash = ev.payload_hash.slice(0, -1) + ((parseInt(last, 16) ^ 0x1).toString(16));
  const brokenFromSeq = depth + 1;
  const affectedSet = bundle.events.filter((e) => e.seq >= brokenFromSeq).map((e) => e.seq);
  return { alteredSeq: depth, brokenFromSeq, affectedSet };
}

// ── generate ──
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" });
writeFileSync(resolve(OUT, "study-public-key.pem"), publicPem);

const answerKey = { generated_utc_note: "run with fixed args for reproducibility",
  params: { count: COUNT, length: LEN, depth: DEPTH }, trials: {} };

for (let i = 1; i <= COUNT; i++) {
  const pristine = buildPristine(i, privateKey);
  if (pristine.events.length !== LEN) {
    console.warn(`[warn] trial ${i} length ${pristine.events.length} != ${LEN}; adjust --len/--depth`);
  }
  const gt = tamper(pristine, DEPTH);
  const name = `trial-${String(i).padStart(2, "0")}`;
  writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(pristine, null, 2)); // participant-facing (tampered)
  answerKey.trials[name] = {
    length: pristine.events.length,
    tamper_depth: DEPTH,
    fan_out: gt.affectedSet.length,
    altered_seq: gt.alteredSeq,
    broken_from_seq: gt.brokenFromSeq,
    affected_set: gt.affectedSet,
  };
}

writeFileSync(resolve(OUT, "answer-key.json"), JSON.stringify(answerKey, null, 2));

console.log(`[study] wrote ${COUNT} trials to ${OUT}`);
console.log(`[study] matched difficulty: length=${LEN}, tamper_depth=${DEPTH}, fan_out=${LEN - DEPTH - 1}`);
console.log(`[study] answer-key.json + study-public-key.pem written (keep the answer key from participants)`);
