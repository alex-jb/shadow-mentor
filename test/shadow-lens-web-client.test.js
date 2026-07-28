// Tests for the Shadow Lens web client (apps/shadow-lens/web). fetch is injected, so the
// honest mode classification (real / fixture / provider-unavailable / api-unavailable) is
// verified without a server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeViaLens, statusBadges, LensMode } from "../apps/shadow-lens/web/lens-client.mjs";

const SM = [{ source_id: "L1", text: "DTI: 0.41", bounding_box_normalized: { x: 0, y: 0, w: 1, h: 1 }, confidence: 0.9 }];
const CAP = { capture_id: "c", capture_sha256: "sha256:" + "a".repeat(64), capture_method: "fixture" };
const okResp = (session) => ({ status: 200, ok: true, json: async () => ({ session, verification: session.verification, analysis: {}, public_key_pem: "PK" }) });

test("fixture path → FIXTURE FALLBACK mode, real session returned", async () => {
  const session = { verification: { record_integrity: "verified", source_coverage_pct: 100, human_review: "approved" }, claims: [] };
  const fetchImpl = async (url, opts) => {
    assert.match(url, /\/api\/shadow-lens-analyze$/);
    assert.match(opts.body, /"mode":"fixture"/);
    return okResp(session);
  };
  const r = await analyzeViaLens({ sourceMap: SM, capture: CAP, findings: [], fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.mode, LensMode.FIXTURE_FALLBACK);
  assert.equal(r.verification.record_integrity, "verified");
});

test("live path (no findings) → REAL SOURCE-BOUND PIPELINE", async () => {
  const session = { verification: { record_integrity: "verified" } };
  const r = await analyzeViaLens({ sourceMap: SM, capture: CAP, fetchImpl: async () => okResp(session) });
  assert.equal(r.mode, LensMode.REAL_SOURCE_BOUND);
});

test("503 → ANALYSIS PROVIDER UNAVAILABLE (honest, not a fake success)", async () => {
  const r = await analyzeViaLens({ sourceMap: SM, capture: CAP, fetchImpl: async () => ({ status: 503, ok: false, json: async () => ({ error: "needs key" }) }) });
  assert.equal(r.ok, false);
  assert.equal(r.mode, LensMode.ANALYSIS_PROVIDER_UNAVAILABLE);
});

test("network error → API UNAVAILABLE", async () => {
  const r = await analyzeViaLens({ sourceMap: SM, capture: CAP, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(r.mode, LensMode.API_UNAVAILABLE);
});

test("statusBadges keeps statuses separate (never one green VERIFIED)", () => {
  const b = statusBadges({ mode: LensMode.FIXTURE_FALLBACK, verification: { record_integrity: "failed", source_coverage_pct: 50, human_review: "pending" } });
  assert.equal(b.record, "TAMPERED");
  assert.equal(b.source_coverage, "50% linked");
  assert.equal(b.human_review, "PENDING");
  assert.equal(b.pipeline, LensMode.FIXTURE_FALLBACK);
});
