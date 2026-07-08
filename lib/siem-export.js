// lib/siem-export.js
// ──────────────────────────────────────────────────────────────────
// v1.5.22 (2026-07-08): SIEM export formats — Splunk CIM Alerts data
// model + ArcSight Common Event Format (CEF v0).
//
// Why this exists
// ---------------
// Every mid-tier bank runs a SIEM (Splunk, ArcSight, QRadar, Sentinel,
// Chronicle). Shadow's `/api/deliberate` currently returns bespoke
// JSON. For a bank to ingest Shadow verdicts into their existing
// audit-trail pipeline, they had to write a custom parser + field
// mapping. That's a 2-4 week integration for every buyer.
//
// This module lets Shadow emit verdicts in two SIEM-native formats:
//
//   * **CEF (ArcSight Common Event Format)** — plain-text syslog line
//     compatible with ArcSight / QRadar / most Sentinel + Chronicle
//     ingestion pipelines. RFC 5424-adjacent syntax.
//     Reference: https://community.microfocus.com/cyberres/productdocs/w/downloads/16221/arcsight-common-event-format-cef-implementation-standard
//
//   * **Splunk CIM Alerts** — JSON payload matching Splunk's Common
//     Information Model Alerts data model. Direct HEC (HTTP Event
//     Collector) drop-in. Notable-event fields (action / severity /
//     signature / src / user / vendor / product) exposed at top level
//     for CIM-compliant dashboards + alert routing.
//     Reference: https://docs.splunk.com/Documentation/CIM/latest/User/Alerts
//
// Neither format includes PII. Both include the Ed25519 attestation
// hash so SIEM operators can pivot from a verdict alert back to the
// source-of-truth attestation record and verify independently.
//
// Design invariants
// -----------------
// 1. Formats must be verifiable INDEPENDENTLY of Shadow. A bank
//    running only their SIEM should be able to reconstruct the
//    attestation-hash chain from Shadow logs alone.
// 2. No lossy conversion. If a field is dropped for CEF/CIM, it MUST
//    be reachable via the attestation hash (which stays in a custom
//    extension field).
// 3. Severity mapping must be consistent across formats. `block` →
//    high, `escalate` → medium, `approve` → informational.
// 4. Format functions are pure. Given the same input, they emit the
//    same string / object. No date-time drift.

const CEF_VERSION = 0;
const CEF_DEVICE_VENDOR = "shadow-mentor";
const CEF_DEVICE_PRODUCT = "compliance-council";
const CEF_DEVICE_VERSION = "1.5.22";

// Signature IDs for CEF/CIM. Stable across versions so SIEM
// correlation rules pinned to these values don't break on Shadow
// upgrades. If you change these, bump the SIEM_SIGNATURE_VERSION.
export const SIEM_SIGNATURES = Object.freeze({
  approve: "shadow.council.approve",
  escalate: "shadow.council.escalate",
  block: "shadow.council.block",
  proxy_block: "shadow.council.proxy.block",
  aml_flag: "shadow.council.aml.flag",
  unknown: "shadow.council.unknown",
});

// CEF severity is 0-10 (0=lowest, 10=highest). Splunk CIM uses
// {informational, low, medium, high, critical}. Both map from the
// effective signature id (not the raw verdict), so proxy_block and
// aml_flag are rated above a plain block.
export const SEVERITY_BY_VERDICT = Object.freeze({
  approve: { cef: 3, cim: "informational" },
  escalate: { cef: 6, cim: "medium" },
  block: { cef: 8, cim: "high" },
  proxy_block: { cef: 9, cim: "critical" },
  aml_flag: { cef: 7, cim: "medium" },
  unknown: { cef: 5, cim: "medium" },
});

/**
 * Map an effective signature id back to a severity key. This mirrors
 * the signature-escalation logic in signatureFor() so that
 * severity({verdict:"block", AA05}) === severity("proxy_block").
 */
function severityKeyForSignature(sigId) {
  if (sigId === SIEM_SIGNATURES.proxy_block) return "proxy_block";
  if (sigId === SIEM_SIGNATURES.aml_flag) return "aml_flag";
  if (sigId === SIEM_SIGNATURES.block) return "block";
  if (sigId === SIEM_SIGNATURES.escalate) return "escalate";
  if (sigId === SIEM_SIGNATURES.approve) return "approve";
  return "unknown";
}

/**
 * Extract the CIM/CEF signature id for a given verdict, taking
 * adverse_action_codes into account. A proxy-detector block (e.g.
 * AA05 ECOA proxy) is a higher severity than a policy-threshold
 * block, so it gets its own signature id.
 */
function signatureFor(verdict, adverseActionCodes = []) {
  const codes = Array.isArray(adverseActionCodes)
    ? adverseActionCodes.map((c) => (typeof c === "string" ? c : c?.code)).filter(Boolean)
    : [];
  if (codes.includes("AA05")) return SIEM_SIGNATURES.proxy_block;
  if (codes.includes("AA06")) return SIEM_SIGNATURES.aml_flag;
  if (SIEM_SIGNATURES[verdict]) return SIEM_SIGNATURES[verdict];
  return SIEM_SIGNATURES.unknown;
}

/**
 * CEF field values must escape the delimiters `|` (pipe), `\`
 * (backslash), and `=` (equals in extension key=value pairs).
 * ArcSight docs are explicit about this. Newlines must be
 * escaped as `\n`.
 */
function escapeCefValue(v, { extension = false } = {}) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
  if (extension) return escaped.replace(/=/g, "\\=");
  return escaped;
}

/**
 * Build the CEF prefix `CEF:0|Vendor|Product|Version|SigID|Name|Severity|`
 * then append extension key=value pairs separated by spaces.
 */
function joinCef({ signatureId, name, severity, extensions }) {
  const prefix = [
    `CEF:${CEF_VERSION}`,
    escapeCefValue(CEF_DEVICE_VENDOR),
    escapeCefValue(CEF_DEVICE_PRODUCT),
    escapeCefValue(CEF_DEVICE_VERSION),
    escapeCefValue(signatureId),
    escapeCefValue(name),
    String(severity),
  ].join("|");

  const extPairs = Object.entries(extensions)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${escapeCefValue(v, { extension: true })}`)
    .join(" ");

  return extensions && Object.keys(extensions).length > 0
    ? `${prefix}|${extPairs}`
    : `${prefix}|`;
}

/**
 * Format a Shadow deliberation response as a single CEF line.
 * Suitable for direct emission to a syslog forwarder or an ArcSight
 * connector. One decision = one line, no newlines within the payload
 * (all embedded newlines escaped to \n).
 *
 * @param {object} response — the Shadow /api/deliberate JSON body.
 *   Must include `final_verdict` and `attestation`. Optional:
 *   `adverse_action_codes`, `voices[]`.
 * @returns {string} CEF-formatted line.
 */
export function formatCEF(response) {
  if (!response || typeof response !== "object") {
    throw new Error("formatCEF: response object required");
  }
  const verdict = response.final_verdict || "unknown";
  const codes = response.adverse_action_codes || [];
  const attestation = response.attestation || {};
  const signatureId = signatureFor(verdict, codes);
  const sevKey = severityKeyForSignature(signatureId);
  const severity = (SEVERITY_BY_VERDICT[sevKey] || SEVERITY_BY_VERDICT.unknown).cef;

  // Extension field mapping. CEF has a fixed list of "predefined"
  // extension keys plus custom `csN` slots. We use only predefined
  // keys where they fit, and csN for Shadow-specific fields.
  const codesFlat = Array.isArray(codes)
    ? codes.map((c) => (typeof c === "string" ? c : c?.code)).filter(Boolean).join(",")
    : "";

  const extensions = {
    // Predefined CEF keys where a natural match exists.
    outcome: verdict,
    act: `council.${verdict}`,
    rt: attestation.completed_at_utc || new Date().toISOString(),
    // Custom-string slots for Shadow-specific fields. Labels are
    // supplied so SIEM parsers know what each cs* actually means.
    cs1Label: "attestation_request_commitment",
    cs1: attestation.request_commitment || "",
    cs2Label: "attestation_output_commitment",
    cs2: attestation.output_commitment || "",
    cs3Label: "attestation_model_id",
    cs3: attestation.model_id || "",
    cs4Label: "attestation_previous_hash",
    cs4: attestation.previous_hash || "",
    cs5Label: "attestation_key_id",
    cs5: attestation.key_id || "",
    cs6Label: "adverse_action_codes",
    cs6: codesFlat,
    // Custom-number slot for voice count so SIEM can alert on
    // "councils that came back with < 5 voices" as a data-integrity
    // signal.
    cn1Label: "voice_count",
    cn1: Array.isArray(response.voices) ? response.voices.length : 0,
  };

  return joinCef({
    signatureId,
    name: `Shadow council verdict: ${verdict}`,
    severity,
    extensions,
  });
}

/**
 * Format a Shadow deliberation response as a Splunk CIM Alerts
 * event. Compatible with the Splunk HTTP Event Collector (HEC).
 * Direct drop-in to Splunk indexes tagged `cim_Alerts`.
 *
 * Splunk CIM Alerts required fields per
 * https://docs.splunk.com/Documentation/CIM/latest/User/Alerts :
 *   action, severity, signature, src, vendor, product, user, app
 *
 * We treat the source (`src`) as the Shadow deployment hostname, and
 * `user` as "system" (Shadow decisions are not attributable to a
 * human at the API boundary). Attestation-specific fields are
 * exposed at the top level as `attestation_*` so Splunk correlation
 * rules can pivot on them without a JSON-flatten step.
 *
 * @param {object} response — the Shadow /api/deliberate JSON body.
 * @param {object} [opts] — optional { src, user, app }.
 * @returns {object} CIM Alerts event, ready to POST to Splunk HEC as
 *   `{ event: <this object>, sourcetype: "shadow:council:cim" }`.
 */
export function formatCIMAlerts(response, opts = {}) {
  if (!response || typeof response !== "object") {
    throw new Error("formatCIMAlerts: response object required");
  }
  const verdict = response.final_verdict || "unknown";
  const codes = response.adverse_action_codes || [];
  const attestation = response.attestation || {};
  const signatureId = signatureFor(verdict, codes);
  const sevKey = severityKeyForSignature(signatureId);

  const codesFlat = Array.isArray(codes)
    ? codes.map((c) => (typeof c === "string" ? c : c?.code)).filter(Boolean)
    : [];

  return {
    // ── CIM Alerts required fields ────────────────────────────────
    action: `council_${verdict}`,
    severity: (SEVERITY_BY_VERDICT[sevKey] || SEVERITY_BY_VERDICT.unknown).cim,
    signature: signatureFor(verdict, codes),
    src: opts.src || "shadow-mentor",
    user: opts.user || "system",
    vendor: CEF_DEVICE_VENDOR,
    product: CEF_DEVICE_PRODUCT,
    app: opts.app || "shadow-mentor",

    // ── CIM Alerts optional-but-recommended fields ────────────────
    signature_id: signatureId,
    description: `Shadow council verdict: ${verdict}`,
    type: "alert",

    // ── Shadow-specific attestation fields (attestation_*) ────────
    // Exposed at top level for direct SPL pivot. Every field here is
    // present in the source-of-truth attestation object; SIEM alerts
    // can still reconstruct the full attestation hash chain.
    attestation_version: attestation.version || null,
    attestation_mode: attestation.mode || null,
    attestation_request_commitment: attestation.request_commitment || null,
    attestation_output_commitment: attestation.output_commitment || null,
    attestation_model_id: attestation.model_id || null,
    attestation_previous_hash: attestation.previous_hash || null,
    attestation_key_id: attestation.key_id || null,
    attestation_signature: attestation.signature || null,
    attestation_completed_at_utc: attestation.completed_at_utc || null,

    // Optional v1.5.8+/1.5.18+/1.5.19+/1.5.20+ append-only bindings.
    // Present only when the source attestation included them.
    ...(attestation.dictionary_hash
      ? { attestation_dictionary_hash: attestation.dictionary_hash }
      : {}),
    ...(attestation.citation_registry_sha256
      ? { attestation_citation_registry_sha256: attestation.citation_registry_sha256 }
      : {}),
    ...(attestation.proxy_schema_sha256
      ? { attestation_proxy_schema_sha256: attestation.proxy_schema_sha256 }
      : {}),

    // ── Shadow-specific decision fields ───────────────────────────
    verdict,
    adverse_action_codes: codesFlat,
    voice_count: Array.isArray(response.voices) ? response.voices.length : 0,
  };
}

/**
 * Convenience export for downstream API handlers. Takes the response
 * and a `format` string ("cef" | "cim" | "json") and returns the
 * body + content-type. Anything unrecognized defaults to json.
 */
export function formatForSiem(response, format) {
  const f = String(format || "json").toLowerCase();
  if (f === "cef") {
    return { body: formatCEF(response), contentType: "text/plain; charset=utf-8" };
  }
  if (f === "cim" || f === "splunk") {
    return {
      body: JSON.stringify(formatCIMAlerts(response)),
      contentType: "application/json",
    };
  }
  return {
    body: JSON.stringify(response),
    contentType: "application/json",
  };
}
