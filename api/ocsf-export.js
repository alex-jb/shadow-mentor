// POST /api/ocsf-export
// Project a SEALED Shadow evidence bundle onto OCSF 1.9.0 `record_integrity`
// events for native ingest by a bank SIEM (Splunk/AWS-backed OCSF consumers).
//
// Same primitive as the library (packages/adapter-ocsf/index.js bundleToOcsf)
// and the CLI (packages/adapter-ocsf/cli-ocsf.mjs). All three wrap the one
// projection so the OCSF output is identical across surfaces.
//
// This is a READ-ONLY projection of an already-signed bundle: it never signs,
// re-hashes, or mutates. No OAuth scope required — anyone holding the signed
// bundle can already read it; projecting it to OCSF grants no new access.
//
// Body shape:
//   {
//     bundle:  <a sealed Shadow evidence bundle: { header, events[], batch_root, signatures[] }>,
//     charter?: <string — the agent's governing system prompt / constitution, mapped to ai_agent.charter>
//   }
//
// Response shape:
//   {
//     ok: boolean,
//     schema_version: "1.9.0",
//     count: number,          // OCSF events emitted (= bundle.events.length)
//     warnings: string[],     // e.g. "bundle has no signatures[]"
//     events: object[]        // OCSF 1.9.0 record_integrity events
//   }
//
// Refs: OCSF 1.9.0 (ocsf/ocsf-schema, PRs #1661 record_integrity, #1641 ai_agent).
// See docs/STANDARDS_MAP.md §5.

import { bundleToOcsf, OCSF_SCHEMA_VERSION } from "../packages/adapter-ocsf/index.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only",
      example: {
        bundle: { header: { agent: { name: "loan-council", version: "1.0.0" } }, events: [], batch_root: "…", signatures: [] },
        charter: "You are a fair-lending compliance council.",
      },
    });
  }

  const { bundle, charter } = req.body ?? {};
  if (!bundle) {
    return res.status(400).json({
      error: "missing 'bundle' in request body",
      hint: "pass a sealed Shadow evidence bundle (output of sealSession())",
    });
  }

  let out;
  try {
    out = bundleToOcsf(bundle, charter ? { charter } : {});
  } catch (err) {
    // Malformed / unsealed bundle: fail closed with the reason, don't 500.
    return res.status(400).json({
      ok: false,
      error: err && err.message ? err.message : "invalid bundle",
    });
  }

  return res.status(200).json({
    ok: true,
    schema_version: OCSF_SCHEMA_VERSION,
    count: out.events.length,
    warnings: out.warnings,
    events: out.events,
    timestamp: new Date().toISOString(),
  });
}
