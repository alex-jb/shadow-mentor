// apps/shadow-lens/web/lens-client.mjs
// Browser/Node client for the real Shadow Lens pipeline (A6). Posts an OCR source_map to
// /api/shadow-lens-analyze and classifies the outcome into an HONEST mode label so the UI
// never shows a mock as live analysis. fetch is injectable → unit-testable.

export const LensMode = Object.freeze({
  REAL_SOURCE_BOUND: "REAL SOURCE-BOUND PIPELINE",
  FIXTURE_FALLBACK: "FIXTURE FALLBACK",
  API_UNAVAILABLE: "API UNAVAILABLE",
  ANALYSIS_PROVIDER_UNAVAILABLE: "ANALYSIS PROVIDER UNAVAILABLE",
});

/**
 * Run the pipeline. Pass `findings` (or mode:"fixture") to force the offline fixture path.
 * @returns {Promise<{ ok:boolean, mode:string, session?:object, verification?:object, error?:string }>}
 */
export async function analyzeViaLens({ baseUrl = "", sourceMap, capture, findings, mode, device, build, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!f) return { ok: false, mode: LensMode.API_UNAVAILABLE, error: "no fetch available" };
  const isFixture = Array.isArray(findings) || mode === "fixture";
  const body = { source_map: sourceMap, capture, device, build, ...(isFixture ? { findings: findings || [], mode: "fixture" } : {}) };
  let resp;
  try {
    resp = await f(`${baseUrl}/api/shadow-lens-analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, mode: LensMode.API_UNAVAILABLE, error: String(e?.message ?? e) };
  }
  if (resp.status === 503) return { ok: false, mode: LensMode.ANALYSIS_PROVIDER_UNAVAILABLE, error: "live analysis needs a provider key; pass findings for the fixture path" };
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error ?? msg; } catch {}
    return { ok: false, mode: LensMode.API_UNAVAILABLE, error: msg };
  }
  const data = await resp.json();
  return {
    ok: true,
    mode: isFixture ? LensMode.FIXTURE_FALLBACK : LensMode.REAL_SOURCE_BOUND,
    session: data.session,
    verification: data.verification,
    analysis: data.analysis,
    public_key_pem: data.public_key_pem,
  };
}

/** UI badge classification for a completed session (separate statuses, never one badge). */
export function statusBadges(result) {
  const v = result?.verification ?? {};
  return {
    pipeline: result?.mode ?? LensMode.API_UNAVAILABLE,
    record: v.record_integrity === "verified" ? "SEALED · VERIFIED" : v.record_integrity === "failed" ? "TAMPERED" : "UNSIGNED",
    source_coverage: v.source_coverage_pct != null ? `${v.source_coverage_pct}% linked` : "—",
    human_review: (v.human_review ?? "pending").toUpperCase(),
  };
}
