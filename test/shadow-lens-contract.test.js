// Contract tests for the Shadow Lens session (apps/shadow-lens/contracts). The one
// invariant that matters: coordinates come only from the OCR source_map, and a claim
// may only cite source_id values that exist there — resolveClaims() is the gate that
// makes coordinates un-hallucinable. Lives in test/ so it runs in `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT_VERSION, validateShadowLensSession, resolveClaims } from "../apps/shadow-lens/contracts/validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = () => JSON.parse(readFileSync(join(HERE, "..", "apps", "shadow-lens", "fixtures", "example-session.json"), "utf8"));

test("contract version is pinned", () => {
  assert.equal(CONTRACT_VERSION, "shadow-lens-session/1.0");
});

test("the example session is valid", () => {
  const r = validateShadowLensSession(fixture());
  assert.equal(r.valid, true, r.errors.join("; "));
});

test("resolveClaims: all fixture claims are source_bound", () => {
  const resolved = resolveClaims(fixture());
  assert.ok(resolved.every((c) => c.validation_status === "source_bound"));
  assert.ok(resolved.every((c) => c.unresolved_source_ids.length === 0));
});

test("THE GATE: a claim citing a nonexistent source_id is REJECTED, not shown", () => {
  const s = fixture();
  s.claims.push({ claim_id: "bad", text: "Revenue fell 40%.", source_ids: ["L99"], produced_by: "model", validation_status: "source_bound" });
  // resolveClaims re-classifies it honestly
  const resolved = resolveClaims(s);
  const bad = resolved.find((c) => c.claim_id === "bad");
  assert.equal(bad.validation_status, "rejected");
  assert.deepEqual(bad.unresolved_source_ids, ["L99"]);
  // and the validator flags the dishonest 'source_bound' label on an unresolvable cite
  const v = validateShadowLensSession(s);
  assert.equal(v.valid, false);
  assert.match(v.errors.join(), /NOT in source_map|L99/);
});

test("a claim with no source_ids is 'uncited', never silently 'source_bound'", () => {
  const s = fixture();
  s.claims.push({ claim_id: "u", text: "General market caution.", source_ids: [], produced_by: "model", validation_status: "uncited" });
  assert.equal(validateShadowLensSession(s).valid, true);
  const u = resolveClaims(s).find((c) => c.claim_id === "u");
  assert.equal(u.validation_status, "uncited");
});

test("validator rejects structural defects", () => {
  const bad = (mut) => { const s = fixture(); mut(s); return validateShadowLensSession(s); };
  assert.match(bad((s) => s.contract_version = "x").errors.join(), /contract_version/);
  assert.match(bad((s) => s.capture.capture_sha256 = "nope").errors.join(), /capture_sha256/);
  assert.match(bad((s) => s.device.runtime_mode = "AR!!").errors.join(), /runtime_mode/);
  assert.match(bad((s) => s.source_map[0].confidence = 2).errors.join(), /confidence/);
  assert.match(bad((s) => delete s.provenance.source_map_hash).errors.join(), /source_map_hash/);
});
