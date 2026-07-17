// POST /api/banking-profile
// Check a Shadow evidence bundle against Banking Evidence Profile v1 — the
// "is this credit decision auditable?" pass/fail gate — over HTTP, for a SIEM /
// GRC pipeline (the third dispatch surface alongside the CLI `shadow-verify
// --profile banking-v1` and the MCP tool `shadow_banking_profile`). Same
// checkBankingProfileV1() primitive under all three so conformance verdicts are
// comparable regardless of surface.
//
// Body: { bundle, public_key?, payloads?, packet? }
//   - bundle:     the evidence bundle (header, events, batch_root, signatures)
//   - public_key: Ed25519 PEM; if present integrity is verified (else "unknown")
//   - payloads:   { seq|payload_ref -> payload } for value-level checks
//   - packet:     if true, also return the examiner-ready markdown packet
//
// Returns { ok, conformance, interpretation, latency_ms, examiner_packet_markdown? }.
// HTTP is always 200 with the verdict in the body (a non-conformant bundle is a
// valid answer, not a request error); ok mirrors conformance.pass.
import { verifyBundle } from "../packages/attest-core/session.js";
import { checkBankingProfileV1 } from "../lib/enforce-banking-profile.js";
import { buildExaminerPacket, renderPacketMarkdown } from "../lib/evidence-packet.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only",
      example: { bundle: { header: {}, events: [], batch_root: "…", signatures: [] }, public_key: "-----BEGIN PUBLIC KEY-----\n…", packet: true },
    });
  }

  const { bundle, public_key, payloads, packet } = req.body ?? {};
  if (!bundle || typeof bundle !== "object") {
    return res.status(400).json({ error: "missing 'bundle' in request body", docs: "spec/evidence-bundle.schema.json" });
  }

  const t0 = Date.now();
  const verified = public_key ? verifyBundle(bundle, { publicKey: public_key }) : null;
  const conformance = checkBankingProfileV1(bundle, { verified, payloads: payloads ?? null });
  const latency_ms = Date.now() - t0;

  const body = {
    ok: conformance.pass,
    conformance,
    interpretation: conformance.pass
      ? `Conforms to ${conformance.profile} (${conformance.coverage_pct}% of evidence slots present): the examiner-required evidence is present and tamper-evident. This does NOT certify the decision was correct, fair, or compliant.`
      : `NON-CONFORMANT to ${conformance.profile}: missing required evidence — ${conformance.missing_required.join(", ") || "none"}.`,
    latency_ms,
  };
  if (packet) body.examiner_packet_markdown = renderPacketMarkdown(buildExaminerPacket(bundle, { verified, payloads: payloads ?? null }));

  return res.status(200).json(body);
}
