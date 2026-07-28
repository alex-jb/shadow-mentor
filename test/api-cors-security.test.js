// CORS security invariants (from the 2026-07 deep-audit P1-3: several API endpoints send
// `Access-Control-Allow-Origin: *`). Wildcard CORS is acceptable for the read-only demo/verification
// endpoints, but it becomes dangerous the moment it is combined with credentials. This test PINS the
// currently-safe state so a future edit cannot silently introduce the vulnerable combination, and requires
// the production origin-allowlist requirement to stay documented. It does NOT change runtime behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, "..", "api");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = walk(API_DIR);

test("no API endpoint combines wildcard CORS origin with credentials (the dangerous combo)", () => {
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const wildcard = /Access-Control-Allow-Origin["'\s,]+\*/.test(src);
    const credentials = /Access-Control-Allow-Credentials["'\s,]+true/i.test(src);
    if (wildcard && credentials) offenders.push(f.replace(API_DIR, "api"));
  }
  assert.deepEqual(offenders, [],
    "endpoints must NEVER send Access-Control-Allow-Origin:* together with Access-Control-Allow-Credentials:true — " +
    "browsers reject it, and it is a credential-exfiltration foot-gun. Use an explicit origin allowlist if credentials are needed.");
});

test("no API endpoint sends Access-Control-Allow-Credentials at all today (documented safe posture)", () => {
  const withCreds = files.filter(f => /Access-Control-Allow-Credentials/i.test(readFileSync(f, "utf8")))
    .map(f => f.replace(API_DIR, "api"));
  // If this ever becomes non-empty, that endpoint MUST also use an explicit (non-wildcard) origin allowlist.
  assert.deepEqual(withCreds, [], "no endpoint uses credentialed CORS yet — if one is added it must pair with an origin allowlist (see docs/security/API_CORS_POSTURE.md)");
});

test("the production CORS origin-allowlist requirement stays documented", () => {
  const doc = join(__dirname, "..", "docs", "security", "API_CORS_POSTURE.md");
  assert.ok(existsSync(doc), "docs/security/API_CORS_POSTURE.md must exist");
  const text = readFileSync(doc, "utf8");
  assert.match(text, /allowlist/i, "the doc must state the production origin-allowlist requirement");
  assert.match(text, /credential/i, "the doc must state the no-credentials-with-wildcard rule");
});
