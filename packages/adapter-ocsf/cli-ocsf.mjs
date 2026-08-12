#!/usr/bin/env node
// packages/adapter-ocsf/cli-ocsf.mjs
//
// Project a SEALED Shadow evidence bundle onto OCSF 1.9.0 `record_integrity`
// events, from a terminal — for piping into a SIEM ingest or an offline export.
//
//   npx shadow-ocsf <bundle.json> [--charter <charter.txt>] [--out <file.json>] [--pretty]
//
// Prints the OCSF events (JSON array) to stdout, or to --out. Same projection
// as the library (bundleToOcsf) and the endpoint (POST /api/ocsf-export).
//
// Exit codes: 0 ok · 2 usage error · 3 I/O or parse error.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundleToOcsf, OCSF_SCHEMA_VERSION } from "./index.js";

const USAGE = `Usage: shadow-ocsf <bundle.json> [--charter <charter.txt>] [--out <file.json>] [--pretty]

Project a sealed Shadow evidence bundle onto OCSF ${OCSF_SCHEMA_VERSION} record_integrity events.

Options:
  --charter <path>   File whose contents map to ai_agent.charter (the agent's governing prompt).
  --out <path>       Write the OCSF events to this file instead of stdout.
  --pretty           Indent the JSON output.
  -h, --help         Print this message.

Exit codes: 0 ok · 2 usage error · 3 I/O or parse error.`;

function parseArgs(argv) {
  const out = { bundle: null, charter: null, outFile: null, pretty: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { ...out, help: true };
    else if (a === "--pretty") out.pretty = true;
    else if (a === "--charter") out.charter = rest[++i];
    else if (a === "--out") out.outFile = rest[++i];
    else if (a.startsWith("--")) return { ...out, error: `unknown flag ${a}` };
    else if (!out.bundle) out.bundle = a;
    else return { ...out, error: `unexpected extra argument ${a}` };
  }
  return out;
}

function die(code, message) {
  process.stderr.write(message + "\n");
  process.exit(code);
}

const args = parseArgs(process.argv);
if (args.help) { process.stdout.write(USAGE + "\n"); process.exit(0); }
if (args.error) die(2, args.error + "\n\n" + USAGE);
if (!args.bundle) die(2, "missing <bundle.json>\n\n" + USAGE);

let bundle;
try { bundle = JSON.parse(readFileSync(resolve(args.bundle), "utf8")); }
catch (err) { die(3, `failed to read/parse bundle: ${err.message}`); }

let charter;
if (args.charter) {
  try { charter = readFileSync(resolve(args.charter), "utf8"); }
  catch (err) { die(3, `failed to read charter: ${err.message}`); }
}

let out;
try { out = bundleToOcsf(bundle, charter ? { charter } : {}); }
catch (err) { die(3, `invalid bundle: ${err.message}`); }

for (const w of out.warnings) process.stderr.write(`warning: ${w}\n`);

const json = JSON.stringify(out.events, null, args.pretty ? 2 : 0);
if (args.outFile) {
  try { writeFileSync(resolve(args.outFile), json + "\n"); }
  catch (err) { die(3, `failed to write --out: ${err.message}`); }
  process.stderr.write(`✓ wrote ${out.events.length} OCSF ${OCSF_SCHEMA_VERSION} events → ${args.outFile}\n`);
} else {
  process.stdout.write(json + "\n");
}
process.exit(0);
