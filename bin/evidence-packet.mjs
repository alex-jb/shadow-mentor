#!/usr/bin/env node
// bin/evidence-packet.mjs
// Produce an examiner-ready evidence packet from a Shadow bundle: verify it,
// check Banking Evidence Profile v1 conformance, and print the human-readable
// packet a fair-lending examiner reads (or --json for a machine record).
//
//   evidence-packet <bundle.json> --public-key <public.pem> [--payloads <p.json>] [--json]
//
// Exit codes: 0 verified+conformant · 1 verification failed · 2 usage · 3 I/O ·
//             4 verified but non-conformant.
import { readFileSync } from "node:fs";
import { verifyBundle } from "shadow-attest-core/session";
import { buildExaminerPacket, renderPacketMarkdown } from "../lib/evidence-packet.js";

const argv = process.argv.slice(2);
const die = (code, msg) => { process.stderr.write(msg + "\n"); process.exit(code); };
if (argv.includes("-h") || argv.includes("--help")) {
  process.stdout.write("Usage: evidence-packet <bundle.json> --public-key <public.pem> [--payloads <p.json>] [--json]\n");
  process.exit(0);
}
let bundlePath = null, pubPath = null, payloadsPath = null, asJson = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--public-key") pubPath = argv[++i];
  else if (a === "--payloads") payloadsPath = argv[++i];
  else if (a === "--json") asJson = true;
  else if (!a.startsWith("-") && !bundlePath) bundlePath = a;
  else die(2, `unknown argument: ${a}`);
}
if (!bundlePath) die(2, "evidence-packet: <bundle.json> is required");
if (!pubPath) die(2, "evidence-packet: --public-key <public.pem> is required");

let bundle, pubPem, payloads = null;
try { bundle = JSON.parse(readFileSync(bundlePath, "utf8")); } catch (e) { die(3, `cannot read bundle: ${e.message}`); }
try { pubPem = readFileSync(pubPath, "utf8"); } catch (e) { die(3, `cannot read public key: ${e.message}`); }
if (payloadsPath) { try { payloads = JSON.parse(readFileSync(payloadsPath, "utf8")); } catch (e) { die(3, `cannot read payloads: ${e.message}`); } }

const verified = verifyBundle(bundle, { publicKey: pubPem });
const packet = buildExaminerPacket(bundle, { verified, payloads });

if (asJson) process.stdout.write(JSON.stringify(packet, null, 2) + "\n");
else process.stdout.write(renderPacketMarkdown(packet));

process.exit(!verified.ok ? 1 : (packet.conformance.result === "CONFORMS" ? 0 : 4));
