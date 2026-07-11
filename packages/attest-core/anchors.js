// packages/attest-core/anchors.js
// ─────────────────────────────────────────────────────────────────
// v3 M3 sprint 1 — external anchoring.
//
// RFC 3161 Time-Stamp Protocol (TSA) client + verifier. Given a Shadow
// evidence-bundle batch_root, requestTimestamp() posts a TimeStampReq to
// a TSA and returns an anchor object embeddable in bundle.external_anchors.
// verifyRfc3161Anchor() parses the returned TimeStampToken, checks that
// the messageImprint matches the expected batch_root, extracts genTime.
//
// Design constraints:
//   - Zero external dependencies. All ASN.1 DER encoding + decoding is
//     implemented inline against the specific structures RFC 3161 uses
//     (TimeStampReq / TimeStampResp / TSTInfo). This keeps the attest-core
//     zero-LLM-dep contract clean and makes bank-side security review
//     simpler (no third-party crypto library to audit).
//   - The verifier checks structural integrity (messageImprint match +
//     genTime extraction). Sprint 1 does NOT verify the TSA's signature
//     on the token — that requires full CMS SignedData parsing +
//     certificate chain validation. Sprint 2 lands that. Until then, the
//     trust level for a bundle with an anchor is reported as
//     TIME_ANCHORED_STRUCTURAL, not TIME_ANCHORED. This is honest posture,
//     not marketing.
//   - No default TSA URL hard-coded to a specific vendor. The caller
//     picks; documented free-tier options live in the module docstring.
//     Freetsa.org (freetsa.org/tsr) is the widely-tested community
//     default; DigiCert and Sectigo publish TSAs at published URLs. Any
//     RFC 3161-compliant TSA works.
//
// References:
//   - RFC 3161 (Time-Stamp Protocol / TSP)
//   - RFC 5652 (Cryptographic Message Syntax)
//   - RFC 5280 (X.509 certificate profile) — for sprint 2 signature check

import { createHash } from "node:crypto";

// ── Trust-level enum ──────────────────────────────────────────

// The verifier reports one of these on every bundle it inspects. Never
// present SELF_SIGNED as more than it is; the language discipline in
// docs/AUTONOMOUS_SESSION_RULES.md rule 3 applies here transitively.
export const TRUST_LEVELS = Object.freeze({
  SELF_SIGNED: "SELF_SIGNED",
  // Sprint 1 exits: chain intact + at least one RFC 3161 anchor whose
  // messageImprint matches the bundle's batch_root. Structural check
  // only; TSA signature not yet verified.
  TIME_ANCHORED_STRUCTURAL: "TIME_ANCHORED_STRUCTURAL",
  // Sprint 2 target: chain intact + RFC 3161 anchor whose CMS SignedData
  // signature verifies against a trusted CA chain. Not exposed until
  // sprint 2 ships; declared here so callers can pattern-match on the
  // full enum today.
  TIME_ANCHORED: "TIME_ANCHORED",
  // Sprint 2 target: chain intact + Sigstore Rekor inclusion proof.
  LOG_ANCHORED: "LOG_ANCHORED",
});

// ── ASN.1 DER helpers ─────────────────────────────────────────

// DER tag constants for the subset RFC 3161 requires.
const TAG_INTEGER = 0x02;
const TAG_BIT_STRING = 0x03;
const TAG_OCTET_STRING = 0x04;
const TAG_NULL = 0x05;
const TAG_OID = 0x06;
const TAG_GENERALIZED_TIME = 0x18;
const TAG_SEQUENCE = 0x30;
const TAG_SET = 0x31;

// OIDs used in RFC 3161 + related CMS structures.
const OID_SHA256 = "2.16.840.1.101.3.4.2.1";
const OID_SHA1   = "1.3.14.3.2.26";
const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_TSTINFO = "1.2.840.113549.1.9.16.1.4";

const HASH_ALG_BY_OID = new Map([
  [OID_SHA256, { name: "sha256", digestLen: 32 }],
  [OID_SHA1, { name: "sha1", digestLen: 20 }],
]);
const OID_BY_HASH_ALG = new Map([
  ["sha256", OID_SHA256],
  ["sha1", OID_SHA1],
]);

/**
 * Encode a non-negative integer as a DER-encoded length prefix.
 * Short form (0-127) is one byte; long form is 0x80 | N followed by N
 * big-endian bytes.
 */
function derEncodeLength(n) {
  if (n < 0) throw new Error("derEncodeLength: negative");
  if (n < 128) return Buffer.from([n]);
  const bytes = [];
  let x = n;
  while (x > 0) { bytes.unshift(x & 0xff); x >>>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/**
 * Encode a single DER TLV given tag + payload bytes.
 */
function derEncodeTLV(tag, payload) {
  return Buffer.concat([Buffer.from([tag]), derEncodeLength(payload.length), payload]);
}

/**
 * Encode a positive integer as INTEGER (two's-complement, minimal, with
 * a leading 0x00 pad if the high bit would otherwise be set).
 */
function derEncodeInteger(n) {
  if (n < 0) throw new Error("derEncodeInteger: negative not supported");
  const bytes = [];
  if (n === 0) bytes.push(0);
  else {
    let x = n;
    while (x > 0) { bytes.unshift(x & 0xff); x = Math.floor(x / 256); }
    if (bytes[0] & 0x80) bytes.unshift(0);
  }
  return derEncodeTLV(TAG_INTEGER, Buffer.from(bytes));
}

/**
 * Encode a dotted OID string as OBJECT IDENTIFIER TLV.
 */
function derEncodeOid(oid) {
  const parts = oid.split(".").map(Number);
  if (parts.length < 2) throw new Error(`derEncodeOid: malformed "${oid}"`);
  const bytes = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const chunk = [];
    do { chunk.unshift(v & 0x7f); v >>>= 7; } while (v > 0);
    for (let j = 0; j < chunk.length - 1; j++) chunk[j] |= 0x80;
    bytes.push(...chunk);
  }
  return derEncodeTLV(TAG_OID, Buffer.from(bytes));
}

function derEncodeOctetString(bytes) {
  return derEncodeTLV(TAG_OCTET_STRING, Buffer.from(bytes));
}

function derEncodeNull() {
  return Buffer.from([TAG_NULL, 0x00]);
}

function derEncodeSequence(...children) {
  return derEncodeTLV(TAG_SEQUENCE, Buffer.concat(children));
}

/**
 * Encode an AlgorithmIdentifier (SEQUENCE { OID, NULL parameters }).
 */
function derEncodeAlgorithmIdentifier(oid) {
  return derEncodeSequence(derEncodeOid(oid), derEncodeNull());
}

// ── DER parser (walk-oriented) ────────────────────────────────

/**
 * Read a length prefix at `pos`. Returns { length, bytesRead }.
 */
function derReadLength(buf, pos) {
  const b0 = buf[pos];
  if (b0 < 128) return { length: b0, bytesRead: 1 };
  const n = b0 & 0x7f;
  if (n === 0) throw new Error("derReadLength: indefinite form not supported");
  if (n > 4) throw new Error("derReadLength: length too big");
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | buf[pos + 1 + i];
  return { length: len, bytesRead: 1 + n };
}

/**
 * Read a TLV at `pos`. Returns { tag, length, contentStart, next }.
 */
function derReadTLV(buf, pos) {
  const tag = buf[pos];
  const { length, bytesRead } = derReadLength(buf, pos + 1);
  const contentStart = pos + 1 + bytesRead;
  return { tag, length, contentStart, next: contentStart + length };
}

/**
 * Parse an INTEGER at `pos` as a Number (throws if it doesn't fit).
 */
function derReadInteger(buf, pos) {
  const tlv = derReadTLV(buf, pos);
  if (tlv.tag !== TAG_INTEGER) throw new Error(`derReadInteger: expected INTEGER, got 0x${tlv.tag.toString(16)}`);
  const content = buf.slice(tlv.contentStart, tlv.next);
  if (content.length > 6) throw new Error("derReadInteger: value too big to fit in Number safely");
  let n = 0;
  for (const b of content) n = n * 256 + b;
  return { value: n, next: tlv.next };
}

/**
 * Parse an OID at `pos` as a dotted string.
 */
function derReadOid(buf, pos) {
  const tlv = derReadTLV(buf, pos);
  if (tlv.tag !== TAG_OID) throw new Error(`derReadOid: expected OID, got 0x${tlv.tag.toString(16)}`);
  const content = buf.slice(tlv.contentStart, tlv.next);
  if (content.length === 0) throw new Error("derReadOid: empty");
  const parts = [Math.floor(content[0] / 40), content[0] % 40];
  let v = 0;
  for (let i = 1; i < content.length; i++) {
    v = (v << 7) | (content[i] & 0x7f);
    if ((content[i] & 0x80) === 0) { parts.push(v); v = 0; }
  }
  return { value: parts.join("."), next: tlv.next };
}

function derReadOctetString(buf, pos) {
  const tlv = derReadTLV(buf, pos);
  if (tlv.tag !== TAG_OCTET_STRING) throw new Error(`derReadOctetString: expected OCTET STRING, got 0x${tlv.tag.toString(16)}`);
  return { value: buf.slice(tlv.contentStart, tlv.next), next: tlv.next };
}

/**
 * Parse a GeneralizedTime at `pos`. Returns ISO 8601 UTC string.
 * Formats accepted: YYYYMMDDHHMMSS[.fff]Z (RFC 5280 §4.1.2.5.2 profile).
 */
function derReadGeneralizedTime(buf, pos) {
  const tlv = derReadTLV(buf, pos);
  if (tlv.tag !== TAG_GENERALIZED_TIME) throw new Error(`derReadGeneralizedTime: expected GeneralizedTime, got 0x${tlv.tag.toString(16)}`);
  const s = buf.slice(tlv.contentStart, tlv.next).toString("utf8");
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/);
  if (!m) throw new Error(`derReadGeneralizedTime: malformed "${s}"`);
  const [, y, mo, d, h, mi, se, frac] = m;
  return { value: `${y}-${mo}-${d}T${h}:${mi}:${se}${frac ?? ""}Z`, next: tlv.next };
}

// ── RFC 3161 message construction ─────────────────────────────

/**
 * Build a DER-encoded TimeStampReq for a given hex-encoded digest.
 * @param {object} params
 * @param {string} params.digestHex — hex-encoded hash of the batch root
 * @param {string} [params.hashAlgorithm] — "sha256" (default) or "sha1"
 * @param {boolean} [params.certReq] — request the TSA include its cert; default true
 * @returns {Buffer} DER-encoded TimeStampReq
 */
export function buildTimestampRequest(params) {
  const {
    digestHex,
    hashAlgorithm = "sha256",
    certReq = true,
  } = params ?? {};
  if (!digestHex || typeof digestHex !== "string") {
    throw new Error("buildTimestampRequest: digestHex required (hex string)");
  }
  const oid = OID_BY_HASH_ALG.get(hashAlgorithm);
  if (!oid) throw new Error(`buildTimestampRequest: unsupported hashAlgorithm "${hashAlgorithm}"`);
  const digest = Buffer.from(digestHex, "hex");
  const expectedLen = HASH_ALG_BY_OID.get(oid).digestLen;
  if (digest.length !== expectedLen) {
    throw new Error(`buildTimestampRequest: digest is ${digest.length}B, expected ${expectedLen}B for ${hashAlgorithm}`);
  }

  const messageImprint = derEncodeSequence(
    derEncodeAlgorithmIdentifier(oid),
    derEncodeOctetString(digest),
  );

  // Nonce ≥ 0. We use a small deterministic-ish value; TSAs replay the
  // nonce back so the caller can pair request↔response. If a caller
  // wants unpredictability they can pass their own DER-crafted request.
  const nonce = derEncodeInteger(Math.floor(Math.random() * 0xffff) + 1);
  const certReqTLV = Buffer.from([0x01, 0x01, certReq ? 0xff : 0x00]);

  return derEncodeSequence(
    derEncodeInteger(1), // version
    messageImprint,
    nonce,
    certReqTLV,
  );
}

// ── RFC 3161 response parsing ─────────────────────────────────

/**
 * Parse a DER-encoded TimeStampResp. Extracts the top-level status and,
 * if the token is present, the embedded TSTInfo fields relevant to
 * verification (messageImprint + genTime + serialNumber).
 *
 * @param {Buffer|Uint8Array} bytes — DER-encoded TimeStampResp
 * @returns {{status: {statusCode: number, statusString?: string}, tstInfo?: {messageImprintAlgorithm: string, messageImprintHash: Buffer, genTimeIso: string, serialNumber: number, tokenBytes: Buffer}}}
 */
export function parseTimestampResponse(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const outer = derReadTLV(buf, 0);
  if (outer.tag !== TAG_SEQUENCE) {
    throw new Error(`parseTimestampResponse: expected SEQUENCE, got 0x${outer.tag.toString(16)}`);
  }
  let pos = outer.contentStart;

  // PKIStatusInfo ::= SEQUENCE { status INTEGER, ... }
  const statusInfo = derReadTLV(buf, pos);
  if (statusInfo.tag !== TAG_SEQUENCE) throw new Error("parseTimestampResponse: PKIStatusInfo not SEQUENCE");
  const statusInt = derReadInteger(buf, statusInfo.contentStart);
  const status = { statusCode: statusInt.value };
  pos = statusInfo.next;

  if (pos >= outer.next) return { status };

  // TimeStampToken is a ContentInfo (SEQUENCE) with contentType = signedData.
  const contentInfo = derReadTLV(buf, pos);
  if (contentInfo.tag !== TAG_SEQUENCE) {
    throw new Error("parseTimestampResponse: TimeStampToken not SEQUENCE");
  }

  // Walk contentInfo → signedData → encapContentInfo → eContent → TSTInfo.
  // Structure:
  //   ContentInfo ::= SEQUENCE {
  //     contentType OBJECT IDENTIFIER (signedData 1.2.840.113549.1.7.2),
  //     content [0] EXPLICIT ANY
  //   }
  //   SignedData ::= SEQUENCE {
  //     version INTEGER, digestAlgorithms SET, encapContentInfo SEQUENCE, ...
  //   }
  //   EncapsulatedContentInfo ::= SEQUENCE {
  //     eContentType OBJECT IDENTIFIER (id-ct-TSTInfo 1.2.840.113549.1.9.16.1.4),
  //     eContent [0] EXPLICIT OCTET STRING (TSTInfo DER-encoded)
  //   }
  const contentTypeOid = derReadOid(buf, contentInfo.contentStart);
  if (contentTypeOid.value !== OID_SIGNED_DATA) {
    throw new Error(`parseTimestampResponse: expected signedData OID, got ${contentTypeOid.value}`);
  }
  // content [0] EXPLICIT — tag 0xa0, contains the SignedData SEQUENCE.
  const contentExplicit = derReadTLV(buf, contentTypeOid.next);
  if (contentExplicit.tag !== 0xa0) {
    throw new Error(`parseTimestampResponse: expected [0] EXPLICIT tag, got 0x${contentExplicit.tag.toString(16)}`);
  }
  const signedData = derReadTLV(buf, contentExplicit.contentStart);
  if (signedData.tag !== TAG_SEQUENCE) {
    throw new Error("parseTimestampResponse: SignedData not SEQUENCE");
  }

  // Walk into SignedData: version, digestAlgorithms, encapContentInfo, ...
  let sdPos = signedData.contentStart;
  // Skip version (INTEGER).
  const sdVersion = derReadTLV(buf, sdPos);
  sdPos = sdVersion.next;
  // Skip digestAlgorithms (SET).
  const sdDigestAlgs = derReadTLV(buf, sdPos);
  sdPos = sdDigestAlgs.next;

  // encapContentInfo — SEQUENCE { eContentType OID, eContent [0] EXPLICIT OCTET STRING }
  const encap = derReadTLV(buf, sdPos);
  if (encap.tag !== TAG_SEQUENCE) throw new Error("parseTimestampResponse: encapContentInfo not SEQUENCE");
  const eContentType = derReadOid(buf, encap.contentStart);
  if (eContentType.value !== OID_TSTINFO) {
    throw new Error(`parseTimestampResponse: expected TSTInfo OID, got ${eContentType.value}`);
  }
  const eContentExplicit = derReadTLV(buf, eContentType.next);
  if (eContentExplicit.tag !== 0xa0) {
    throw new Error("parseTimestampResponse: expected [0] EXPLICIT for eContent");
  }
  const tstInfoOctet = derReadTLV(buf, eContentExplicit.contentStart);
  if (tstInfoOctet.tag !== TAG_OCTET_STRING) {
    throw new Error("parseTimestampResponse: expected OCTET STRING wrapping TSTInfo");
  }
  const tstInfoBytes = buf.slice(tstInfoOctet.contentStart, tstInfoOctet.next);
  const tokenBytes = buf.slice(contentInfo.contentStart - (contentInfo.contentStart - pos), contentInfo.next);

  // Parse TSTInfo.
  const tstInfoSeq = derReadTLV(tstInfoBytes, 0);
  if (tstInfoSeq.tag !== TAG_SEQUENCE) throw new Error("parseTimestampResponse: TSTInfo not SEQUENCE");

  let tpos = tstInfoSeq.contentStart;
  const tVersion = derReadTLV(tstInfoBytes, tpos); tpos = tVersion.next;
  const tPolicyOid = derReadOid(tstInfoBytes, tpos); tpos = tPolicyOid.next;

  // messageImprint SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING }
  const mi = derReadTLV(tstInfoBytes, tpos); tpos = mi.next;
  if (mi.tag !== TAG_SEQUENCE) throw new Error("parseTimestampResponse: messageImprint not SEQUENCE");
  const miAlgSeq = derReadTLV(tstInfoBytes, mi.contentStart);
  const miAlgOid = derReadOid(tstInfoBytes, miAlgSeq.contentStart);
  const miHashInfo = HASH_ALG_BY_OID.get(miAlgOid.value);
  if (!miHashInfo) throw new Error(`parseTimestampResponse: unsupported messageImprint algorithm ${miAlgOid.value}`);
  const miHashOctet = derReadOctetString(tstInfoBytes, miAlgSeq.next);

  // serialNumber INTEGER
  const serial = derReadInteger(tstInfoBytes, tpos); tpos = serial.next;

  // genTime GeneralizedTime
  const genTime = derReadGeneralizedTime(tstInfoBytes, tpos); tpos = genTime.next;

  return {
    status,
    tstInfo: {
      messageImprintAlgorithm: miHashInfo.name,
      messageImprintHash: miHashOctet.value,
      genTimeIso: genTime.value,
      serialNumber: serial.value,
      tokenBytes,
    },
  };
}

// ── HTTP client (Node built-in fetch) ─────────────────────────

/**
 * Post a TimeStampReq to a TSA and return a Shadow anchor object suitable
 * for embedding in bundle.external_anchors[].
 *
 * @param {object} params
 * @param {string} params.batchRootHex — the bundle.batch_root (hex sha256)
 * @param {string} params.tsaUrl — TSA endpoint URL (must accept application/timestamp-query)
 * @param {string} [params.hashAlgorithm] — "sha256" default
 * @param {number} [params.timeoutMs] — default 15000
 * @returns {Promise<{kind: "rfc3161-tsa", batch_root: string, anchor_ref: string, anchored_at_utc: string}>}
 */
export async function requestTimestamp(params) {
  const {
    batchRootHex,
    tsaUrl,
    hashAlgorithm = "sha256",
    timeoutMs = 15000,
  } = params ?? {};
  if (!batchRootHex) throw new Error("requestTimestamp: batchRootHex required");
  if (!tsaUrl) throw new Error("requestTimestamp: tsaUrl required");

  // The messageImprint is a hash of the bundle's own batch_root (which is
  // already a sha256). This produces sha256(sha256(batch)), which is what
  // the TSA signs. On verify we re-hash the batch_root the same way and
  // compare against the token's messageImprint.
  const digest = createHash(hashAlgorithm).update(Buffer.from(batchRootHex, "hex")).digest();
  const req = buildTimestampRequest({ digestHex: digest.toString("hex"), hashAlgorithm });

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(tsaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query" },
      body: req,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(to);
  }

  if (!res.ok) {
    throw new Error(`requestTimestamp: TSA returned HTTP ${res.status} from ${tsaUrl}`);
  }
  const respBytes = Buffer.from(await res.arrayBuffer());
  const parsed = parseTimestampResponse(respBytes);
  if (parsed.status.statusCode !== 0 && parsed.status.statusCode !== 1) {
    // 0 = granted, 1 = grantedWithMods (both are success per RFC 3161).
    throw new Error(`requestTimestamp: TSA statusCode ${parsed.status.statusCode}`);
  }
  if (!parsed.tstInfo) {
    throw new Error("requestTimestamp: response missing timeStampToken");
  }

  return {
    kind: "rfc3161-tsa",
    batch_root: batchRootHex,
    anchor_ref: respBytes.toString("base64url"),
    anchored_at_utc: parsed.tstInfo.genTimeIso,
  };
}

// ── Anchor verification ───────────────────────────────────────

/**
 * Verify an RFC 3161 anchor against an expected bundle batch_root.
 *
 * Sprint 1: structural verification only — checks that the messageImprint
 * in the parsed TSTInfo equals sha256(batch_root_bytes) (or sha1, per the
 * anchor's algorithm), and extracts genTime. Does NOT verify the CMS
 * SignedData signature on the token. That is sprint 2.
 *
 * @param {object} params
 * @param {object} params.anchor — one entry from bundle.external_anchors
 * @param {string} params.expectedBatchRootHex — bundle.batch_root
 * @returns {{ok: true, genTimeIso: string, trustLevel: "TIME_ANCHORED_STRUCTURAL"} | {ok: false, reason: string}}
 */
export function verifyRfc3161Anchor(params) {
  const { anchor, expectedBatchRootHex } = params ?? {};
  if (!anchor) return { ok: false, reason: "anchor required" };
  if (anchor.kind !== "rfc3161-tsa") return { ok: false, reason: `wrong kind "${anchor.kind}"` };
  if (!expectedBatchRootHex) return { ok: false, reason: "expectedBatchRootHex required" };
  if (anchor.batch_root && anchor.batch_root !== expectedBatchRootHex) {
    return { ok: false, reason: "anchor.batch_root does not match bundle.batch_root" };
  }
  if (!anchor.anchor_ref) return { ok: false, reason: "anchor.anchor_ref missing" };

  let respBytes;
  try {
    respBytes = Buffer.from(anchor.anchor_ref, "base64url");
  } catch (err) {
    return { ok: false, reason: `anchor_ref base64url decode failed: ${err.message}` };
  }

  let parsed;
  try {
    parsed = parseTimestampResponse(respBytes);
  } catch (err) {
    return { ok: false, reason: `TimeStampResp parse failed: ${err.message}` };
  }
  if (parsed.status.statusCode !== 0 && parsed.status.statusCode !== 1) {
    return { ok: false, reason: `TSA statusCode ${parsed.status.statusCode}` };
  }
  if (!parsed.tstInfo) return { ok: false, reason: "response missing timeStampToken" };

  const expectedDigest = createHash(parsed.tstInfo.messageImprintAlgorithm)
    .update(Buffer.from(expectedBatchRootHex, "hex"))
    .digest();
  if (!expectedDigest.equals(parsed.tstInfo.messageImprintHash)) {
    return { ok: false, reason: "messageImprint does not match sha256(batch_root)" };
  }

  return {
    ok: true,
    genTimeIso: parsed.tstInfo.genTimeIso,
    trustLevel: TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL,
  };
}
