// Contract: the attest_core version stamped into every new evidence bundle's header MUST equal
// packages/attest-core/package.json.version — one source of truth (P0 fix from the 2026-07 deep-audit;
// it was hardcoded "2.0.0" while the package was 2.3.0). attest_core is bundle METADATA (a String field
// in the schema, no fixed enum); this does not change V1/V2 signing SEMANTICS or any released fixture's
// bytes — it only makes newly-created bundles record the correct producing-software version.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSession, sealSession } from "../packages/attest-core/session.js";
import { generateKeyPairSync } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "packages", "attest-core", "package.json"), "utf8"));

test("ATTEST_METADATA_VERSION_MATCH: a new bundle's header.schema_versions.attest_core == package.json.version", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "metadata-version-test", version: "1.0.0" },
    models: [{ model_id: "m", provider: "p" }],
    environmentFingerprint: { os: "test", node_version: process.version },
    keyId: "k", privateKey,
  });
  const bundle = sealSession(s);
  assert.equal(bundle.header.schema_versions.attest_core, pkg.version,
    `bundle stamped attest_core=${bundle.header.schema_versions.attest_core} but package is ${pkg.version} — the metadata version drifted`);
  // and it must be the real current version, not the old hardcoded string
  assert.notEqual(bundle.header.schema_versions.attest_core, "2.0.0", "must not be the stale hardcoded 2.0.0");
});
