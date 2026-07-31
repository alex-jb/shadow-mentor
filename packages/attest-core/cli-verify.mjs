#!/usr/bin/env node
// packages/attest-core/cli-verify.mjs
//
// The shippable, self-contained verifier CLI — imports ./session.js RELATIVELY so it
// works from a plain `npm install shadow-attest-core` (or `npx shadow-verify`) with no
// monorepo clone. This is what makes "re-verify outside the vendor" true in practice:
// a regulator handed a bundle + public key runs one command, offline, no account.
//
//   npx shadow-verify <bundle.json> --public-key <public.pem> [--json] [--check-anchors <mode>]
//
// Exit codes (CI-friendly): 0 verified · 1 verification failed · 2 usage · 3 I/O.
// (The repo's bin/shadow-verify.mjs adds --profile banking-v1; that lives in the app,
// not the library. This CLI covers the core trustless path: signature + hash-chain +
// payload rebind, reporting source_resolution.)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyBundle } from "./session.js";

const USAGE = `Usage: shadow-verify <bundle.json> --public-key <public.pem> [--json] [--check-anchors <mode>]

Options:
  --public-key <path>      Ed25519 public key in PEM format (required).
  --json                   Emit a single-line JSON report instead of prose.
  --check-anchors <mode>   Verify bundle.external_anchors[]: "structural" | "full" | "off" (default off).
  -h, --help               Print this message.

Exit codes: 0 verified · 1 verification failed · 2 usage error · 3 I/O or parse error.`;

function parseArgs(argv) {
  const out = { bundle: null, publicKey: null, json: false, checkAnchors: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { ...out, help: true };
    else if (a === "--json") out.json = true;
    else if (a === "--public-key") out.publicKey = rest[++i];
    else if (a === "--check-anchors") {
      const mode = rest[++i];
      if (mode === "off" || mode === undefined) out.checkAnchors = false;
      else if (mode === "structural" || mode === "full") out.checkAnchors = mode;
      else return { ...out, error: `unknown --check-anchors mode "${mode}" (want off/structural/full)` };
    }
    else if (a.startsWith("--")) return { ...out, error: `unknown flag ${a}` };
    else if (!out.bundle) out.bundle = a;
    else return { ...out, error: `unexpected extra argument ${a}` };
  }
  return out;
}

function die(code, message, jsonMode) {
  if (jsonMode) process.stdout.write(JSON.stringify({ ok: false, reason: message }) + "\n");
  else process.stderr.write(message + "\n");
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help) { process.stdout.write(USAGE + "\n"); process.exit(0); }
if (args.error) die(2, args.error + "\n\n" + USAGE, false);
if (!args.bundle) die(2, "missing <bundle.json>\n\n" + USAGE, false);
if (!args.publicKey) die(2, "missing --public-key <public.pem>\n\n" + USAGE, false);

let bundle;
try { bundle = JSON.parse(readFileSync(resolve(args.bundle), "utf8")); }
catch (err) { die(3, `failed to read/parse bundle: ${err.message}`, args.json); }

let pubPem;
try { pubPem = readFileSync(resolve(args.publicKey), "utf8"); }
catch (err) { die(3, `failed to read public key: ${err.message}`, args.json); }

const result = verifyBundle(bundle, { publicKey: pubPem, checkAnchors: args.checkAnchors });

if (args.json) {
  process.stdout.write(JSON.stringify({
    ok: result.ok,
    error: result.error ?? null,
    reason: result.reason ?? null,
    failedSeq: result.failedSeq ?? null,
    session_id: bundle?.header?.session_id ?? null,
    event_count: Array.isArray(bundle?.events) ? bundle.events.length : null,
    batch_root: bundle?.batch_root ?? null,
    key_id: bundle?.signatures?.[0]?.key_id ?? null,
    trust_level: result.trustLevel ?? null,
    source_resolution: result.sourceResolution ?? null,
  }) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (result.ok) {
  const src = result.sourceResolution ?? "NOT_PRESENT";
  const srcNote = src === "VERIFIED"
    ? "the recorded decision rebinds to its signed hash — you are verifying the content you can read"
    : src === "PARTIAL"
    ? "some events carry inline content (rebound); others are hash-only"
    : "content is hash-only (lives elsewhere or was erased); signature + chain still verify";
  process.stdout.write(
    `✓ Bundle verified\n` +
    `  session_id      : ${bundle.header?.session_id ?? "(none)"}\n` +
    `  events          : ${bundle.events?.length ?? 0}\n` +
    `  key_id          : ${bundle.signatures?.[0]?.key_id ?? "(none)"}\n` +
    `  batch_root      : ${bundle.batch_root}\n` +
    `  trust           : ${result.trustLevel ?? "SELF_SIGNED"}\n` +
    `  source_resolution: ${src} — ${srcNote}\n`,
  );
  process.exit(0);
}

const err = result.error ?? {
  seq: typeof result.failedSeq === "number" ? result.failedSeq : null,
  reason: result.reason ?? "unknown_failure",
  impact: "(no structured impact — legacy verifier return)",
};
process.stderr.write(
  `✗ Verification failed\n` +
  `  seq    : ${err.seq === null || err.seq === undefined ? "—" : String(err.seq)}\n` +
  `  reason : ${err.reason}\n` +
  `  impact : ${err.impact}\n`,
);
process.exit(1);
