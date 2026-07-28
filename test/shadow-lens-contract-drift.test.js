// Contract drift protection: the schema, TS model, C# model, fixture, Flow adapter, and the
// HTTP API must all agree on contract_version, and the schema STRUCTURE is pinned by a
// fingerprint so a shape change can't land without a deliberate version bump + re-pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { contractFingerprint, collectVersions } from "../scripts/contract-fingerprint.mjs";
import { CONTRACT_VERSION, validateShadowLensSession } from "../apps/shadow-lens/contracts/validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// PINNED — if this fails, the contract shape changed. Bump contract_version everywhere, then
// update this pin intentionally (never blindly).
const PINNED_FINGERPRINT = "sha256:631a36a9bf1155ddd3edbd00cfd7c1741dfdb9aadf63166b4c9bb2b2500cad86";

test("all six artifacts agree on contract_version", () => {
  const versions = collectVersions();
  for (const v of versions) assert.equal(v.version, CONTRACT_VERSION, `${v.name} drifted to ${v.version}`);
});

test("schema structure matches the pinned fingerprint (no silent shape drift)", () => {
  const { hash, version } = contractFingerprint();
  assert.equal(version, CONTRACT_VERSION);
  assert.equal(hash, PINNED_FINGERPRINT,
    "schema shape changed — bump contract_version in ALL artifacts, then re-pin PINNED_FINGERPRINT deliberately");
});

test("the shipped fixture validates against the contract", () => {
  const fixture = JSON.parse(readFileSync(join(ROOT, "apps/shadow-lens/fixtures/example-session.json"), "utf8"));
  const v = validateShadowLensSession(fixture);
  assert.equal(v.valid, true, JSON.stringify(v.errors));
});
