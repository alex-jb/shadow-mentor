// examples/attest-for-paperclip/verify-audit-bundle.mjs
// Verify a sealed audit-log bundle with ONLY the public key — the check an
// outside auditor runs. Exits 0 on verified, 1 on any tamper/failure with the
// exact failing sequence number.
//
//   node verify-audit-bundle.mjs <bundle.json> <public.pem>

import { readFileSync } from "node:fs";
import { verifyBundle } from "../../packages/attest-core/session.js";

const [bundlePath, pubPath] = process.argv.slice(2);
if (!bundlePath || !pubPath) { console.error("usage: node verify-audit-bundle.mjs <bundle.json> <public.pem>"); process.exit(2); }

const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
const publicKey = readFileSync(pubPath, "utf8");
const result = verifyBundle(bundle, { publicKey });

if (result.ok) {
  console.log(`VERIFIED — ${bundle.events.length} events, chain intact, signature valid.`);
  process.exit(0);
}
console.error(`VERIFICATION FAILED: ${JSON.stringify(result, null, 2)}`);
process.exit(1);
