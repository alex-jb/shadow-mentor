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

import { createHash, createPublicKey, verify as cryptoVerify, X509Certificate } from "node:crypto";

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
  // Sprint 3 exits: chain intact + Rekor entry body's payloadHash matches
  // the bundle's batch_root. Log-operator received the entry; inclusion
  // proof + SET signature not yet verified.
  LOG_ANCHORED_STRUCTURAL: "LOG_ANCHORED_STRUCTURAL",
  // Sprint 3 target: chain intact + Rekor inclusion proof against the
  // published tree head + SET signature verified with a caller-supplied
  // Rekor public key. Publicly witnessed — a bundle at this level cannot
  // be silently rewritten by a compromised operator alone.
  LOG_ANCHORED: "LOG_ANCHORED",
});

// Rekor trust rank: SELF < TIME_STRUCTURAL < LOG_STRUCTURAL < TIME_ANCHORED
// < LOG_ANCHORED. LOG_STRUCTURAL ranks above TIME_STRUCTURAL because a
// public log accepting an entry is a stronger claim than an unverified
// TSA response blob (which could be an operator-signed replay).
const TRUST_RANK = new Map([
  [TRUST_LEVELS.SELF_SIGNED, 0],
  [TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL, 1],
  [TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL, 2],
  [TRUST_LEVELS.TIME_ANCHORED, 3],
  [TRUST_LEVELS.LOG_ANCHORED, 4],
]);

export function trustLevelRank(level) {
  return TRUST_RANK.get(level) ?? 0;
}

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

// CMS signed-attribute OIDs (RFC 5652 §11).
const OID_CONTENT_TYPE_ATTR = "1.2.840.113549.1.9.3";
const OID_MESSAGE_DIGEST_ATTR = "1.2.840.113549.1.9.4";
const OID_SIGNING_TIME_ATTR = "1.2.840.113549.1.9.5";

// Signature algorithm OIDs the TSA might use to sign its token.
// Node's crypto.verify() infers the algorithm class from the key object;
// we pass the digest name it expects (e.g. "sha256"). Ed25519 is a special
// case — its verify call uses `null` as the digest name.
const SIG_ALG_HANDLERS = new Map([
  // RSA-SSA PKCS#1 v1.5
  ["1.2.840.113549.1.1.11", { digest: "sha256", kind: "rsa" }], // sha256WithRSAEncryption
  ["1.2.840.113549.1.1.12", { digest: "sha384", kind: "rsa" }], // sha384WithRSAEncryption
  ["1.2.840.113549.1.1.13", { digest: "sha512", kind: "rsa" }], // sha512WithRSAEncryption
  ["1.2.840.113549.1.1.5",  { digest: "sha1",   kind: "rsa" }], // sha1WithRSAEncryption (legacy)
  ["1.2.840.113549.1.1.1",  { digest: null,     kind: "rsa" }], // rsaEncryption — digest per signedAttrs
  // ECDSA
  ["1.2.840.10045.4.3.2",   { digest: "sha256", kind: "ecdsa" }], // ecdsa-with-SHA256
  ["1.2.840.10045.4.3.3",   { digest: "sha384", kind: "ecdsa" }], // ecdsa-with-SHA384
  ["1.2.840.10045.4.3.4",   { digest: "sha512", kind: "ecdsa" }], // ecdsa-with-SHA512
  // EdDSA
  ["1.3.101.112",           { digest: null,     kind: "ed25519" }],
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

  // Walk into SignedData: version, digestAlgorithms, encapContentInfo,
  // [0] IMPLICIT certificates (optional), [1] IMPLICIT crls (optional),
  // signerInfos SET.
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
  sdPos = encap.next;
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

  // Extract CMS pieces needed for signature verification. Certificates,
  // CRLs, and signerInfos live after encapContentInfo in SignedData.
  const certificatesDer = [];
  let signerInfoBytes = null;
  while (sdPos < signedData.next) {
    const tlv = derReadTLV(buf, sdPos);
    if (tlv.tag === 0xa0) {
      // [0] IMPLICIT certificates — SET/SEQUENCE OF CertificateChoices.
      // Sprint 4: extract ALL X.509 certificate SEQUENCEs so chain
      // validation can walk leaf → intermediates → root. The first cert
      // is treated as the signer's leaf (sprint 2 behavior preserved via
      // certificatesDer[0]).
      let cpos = tlv.contentStart;
      while (cpos < tlv.next) {
        const cert = derReadTLV(buf, cpos);
        if (cert.tag === TAG_SEQUENCE) {
          certificatesDer.push(buf.slice(cpos, cert.next));
        }
        cpos = cert.next;
      }
    } else if (tlv.tag === 0xa1) {
      // [1] IMPLICIT crls — skip; sprint 2 does not consult CRLs.
    } else if (tlv.tag === TAG_SET) {
      // signerInfos SET OF SignerInfo. We take the first for sprint 2.
      const firstSignerInfo = derReadTLV(buf, tlv.contentStart);
      if (firstSignerInfo.tag === TAG_SEQUENCE) {
        signerInfoBytes = buf.slice(tlv.contentStart, firstSignerInfo.next);
      }
    }
    sdPos = tlv.next;
  }

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
      // Sprint 2 pieces — may be null on synthetic TSRs used in tests.
      tstInfoBytes,
      certificateDer: certificatesDer[0] ?? null,
      certificatesDer,
      signerInfoBytes,
    },
  };
}

// ── CMS SignedData signature verification (sprint 2) ──────────

/**
 * Parse a SignerInfo TLV blob and return the fields needed to verify.
 * @param {Buffer} buf — DER SignerInfo SEQUENCE bytes (outer SEQUENCE included)
 * @returns {{digestAlgorithmOid: string, signedAttrsDerForSig: Buffer|null, messageDigestAttr: Buffer|null, signatureAlgorithmOid: string, signature: Buffer}}
 */
function parseSignerInfo(buf) {
  const outer = derReadTLV(buf, 0);
  if (outer.tag !== TAG_SEQUENCE) throw new Error("parseSignerInfo: outer not SEQUENCE");
  let p = outer.contentStart;

  // version INTEGER
  const version = derReadTLV(buf, p); p = version.next;
  // sid — either issuerAndSerialNumber SEQUENCE OR [0] IMPLICIT subjectKeyIdentifier.
  const sid = derReadTLV(buf, p); p = sid.next;
  // digestAlgorithm AlgorithmIdentifier
  const dAlg = derReadTLV(buf, p); p = dAlg.next;
  const dAlgOid = derReadOid(buf, dAlg.contentStart);

  // signedAttrs [0] IMPLICIT SET OF Attribute — OPTIONAL
  let signedAttrsDerForSig = null;
  let messageDigestAttr = null;
  const tlv1 = derReadTLV(buf, p);
  if (tlv1.tag === 0xa0) {
    // Re-encode as SET (0x31) with the same length + content per RFC 5652 §5.4
    // "The IMPLICIT [0] tag in the signedAttrs is not used for the DER encoding,
    //  rather an EXPLICIT SET OF tag is used."
    const setDer = Buffer.concat([
      Buffer.from([TAG_SET]),
      derEncodeLength(tlv1.length),
      buf.slice(tlv1.contentStart, tlv1.next),
    ]);
    signedAttrsDerForSig = setDer;

    // Walk attributes to find messageDigest.
    let apos = tlv1.contentStart;
    while (apos < tlv1.next) {
      const attr = derReadTLV(buf, apos);
      if (attr.tag !== TAG_SEQUENCE) { apos = attr.next; continue; }
      const attrOid = derReadOid(buf, attr.contentStart);
      const attrValues = derReadTLV(buf, attrOid.next);
      if (attrValues.tag !== TAG_SET) { apos = attr.next; continue; }
      if (attrOid.value === OID_MESSAGE_DIGEST_ATTR) {
        const digestOctet = derReadOctetString(buf, attrValues.contentStart);
        messageDigestAttr = digestOctet.value;
      }
      apos = attr.next;
    }
    p = tlv1.next;
  }

  // signatureAlgorithm AlgorithmIdentifier
  const sAlg = derReadTLV(buf, p); p = sAlg.next;
  const sAlgOid = derReadOid(buf, sAlg.contentStart);

  // signature OCTET STRING
  const sig = derReadOctetString(buf, p);

  return {
    digestAlgorithmOid: dAlgOid.value,
    signedAttrsDerForSig,
    messageDigestAttr,
    signatureAlgorithmOid: sAlgOid.value,
    signature: sig.value,
  };
}

/**
 * Verify the CMS SignedData signature over a parsed TSTInfo (eContent),
 * using the certificate embedded in the CMS structure. Returns { ok, reason? }.
 *
 * Scope note (sprint 2): the certificate is used AS-IS from the CMS; this
 * function does NOT walk a trust chain to a root CA. Real deployments
 * should pair this with an operator-managed trust store; see docs/THREAT_MODEL.md
 * §6.3 for the honest posture around what a valid CMS signature does and
 * does not imply.
 *
 * Sprint 4: caTrustStorePem[] enables real chain validation. When provided,
 * this function walks leaf → embedded intermediates → a caller-supplied root
 * CA and reports caChainValidated:true only if a full chain terminates at a
 * trust-store root. Without a trust store, caChainValidated is null (the
 * sprint 2 posture — signature verified against the embedded cert whose
 * ownership is unproven).
 *
 * @param {object} params
 * @param {Buffer} params.eContentBytes — the DER-encoded TSTInfo bytes
 * @param {Buffer} [params.certificateDer] — legacy: the signer's X.509 leaf DER (sprint 2)
 * @param {Buffer[]} [params.certificatesDer] — sprint 4: all embedded certs; [0] is the leaf
 * @param {Buffer} params.signerInfoBytes — the SignerInfo SEQUENCE bytes
 * @param {string[]} [params.caTrustStorePem] — sprint 4: PEM-encoded root CA certs
 * @returns {{ok: boolean, reason?: string, signerSubject?: string, caChainValidated?: boolean|null, chainFailReason?: string, chainAnchorSubject?: string}}
 */
export function verifyCmsSignature(params) {
  const {
    eContentBytes,
    certificateDer,
    certificatesDer,
    signerInfoBytes,
    caTrustStorePem,
  } = params ?? {};
  if (!eContentBytes) return { ok: false, reason: "eContentBytes required" };
  const allCerts = Array.isArray(certificatesDer) && certificatesDer.length > 0
    ? certificatesDer
    : (certificateDer ? [certificateDer] : []);
  if (allCerts.length === 0) return { ok: false, reason: "certificateDer or certificatesDer required" };
  if (!signerInfoBytes) return { ok: false, reason: "signerInfoBytes required" };

  let cert;
  try {
    cert = new X509Certificate(allCerts[0]);
  } catch (err) {
    return { ok: false, reason: `certificate parse failed: ${err.message}` };
  }
  const publicKey = cert.publicKey;

  let signerInfo;
  try {
    signerInfo = parseSignerInfo(signerInfoBytes);
  } catch (err) {
    return { ok: false, reason: `SignerInfo parse failed: ${err.message}` };
  }

  const sigAlg = SIG_ALG_HANDLERS.get(signerInfo.signatureAlgorithmOid);
  if (!sigAlg) return { ok: false, reason: `unsupported signatureAlgorithm ${signerInfo.signatureAlgorithmOid}` };
  const digestInfo = HASH_ALG_BY_OID.get(
    // Map the signer's digestAlgorithm OID.
    signerInfo.digestAlgorithmOid,
  );
  if (!digestInfo) return { ok: false, reason: `unsupported digestAlgorithm ${signerInfo.digestAlgorithmOid}` };

  // If signedAttrs is present, verify that the messageDigest attribute
  // equals the hash of eContent, then sign over the DER-encoded SET
  // (with tag 0x31, not the IMPLICIT [0] 0xa0).
  let dataToVerify;
  if (signerInfo.signedAttrsDerForSig) {
    if (!signerInfo.messageDigestAttr) {
      return { ok: false, reason: "signedAttrs present but messageDigest attribute missing" };
    }
    const expectedDigest = createHash(digestInfo.name).update(eContentBytes).digest();
    if (!expectedDigest.equals(signerInfo.messageDigestAttr)) {
      return { ok: false, reason: "signedAttrs.messageDigest does not match hash(eContent)" };
    }
    dataToVerify = signerInfo.signedAttrsDerForSig;
  } else {
    // No signedAttrs — sign eContent directly. This is rare for TSAs
    // but allowed by RFC 5652.
    dataToVerify = Buffer.from(eContentBytes);
  }

  const digestName = sigAlg.digest;
  let sigOk;
  try {
    sigOk = cryptoVerify(
      // Node picks the algorithm from the key type + this digest name.
      // Ed25519 requires the digest name to be null.
      digestName,
      dataToVerify,
      publicKey,
      signerInfo.signature,
    );
  } catch (err) {
    return { ok: false, reason: `cryptoVerify threw: ${err.message}` };
  }
  if (!sigOk) return { ok: false, reason: "CMS signature verification failed" };

  // Sprint 4: optional CA chain validation. If a trust store is not
  // supplied, caChainValidated is reported as null so callers can tell
  // "operator did not opt in" apart from "opted in and passed".
  let caChainValidated = null;
  let chainFailReason;
  let chainAnchorSubject;
  if (Array.isArray(caTrustStorePem) && caTrustStorePem.length > 0) {
    const chainResult = validateCmsCertChain({
      leafCert: cert,
      intermediateDers: allCerts.slice(1),
      trustStorePems: caTrustStorePem,
    });
    caChainValidated = chainResult.ok;
    if (chainResult.ok) {
      chainAnchorSubject = chainResult.anchorSubject;
    } else {
      chainFailReason = chainResult.reason;
    }
  }

  return {
    ok: true,
    signerSubject: cert.subject,
    caChainValidated,
    ...(chainAnchorSubject ? { chainAnchorSubject } : {}),
    ...(chainFailReason ? { chainFailReason } : {}),
  };
}

/**
 * Walk an X.509 certificate chain from a leaf, through embedded
 * intermediates, terminating at a caller-supplied trust-store root.
 *
 * Node's X509Certificate.checkIssued() confirms name-chaining (issuer of
 * the child equals subject of the parent); X509Certificate.verify(pub)
 * confirms the child's signature was produced with the parent's key.
 * Together those match the sub-check that RFC 5280 §6 formalizes.
 *
 * Sprint 4 scope: name-chain + signature-chain + validity-period check.
 * Out of scope for this sprint: CRL/OCSP revocation, name constraints,
 * policy processing, keyUsage/extKeyUsage enforcement. Callers who need
 * revocation should pair this with an OCSP responder query at the sealing
 * side.
 *
 * @param {object} params
 * @param {X509Certificate} params.leafCert
 * @param {Buffer[]} params.intermediateDers
 * @param {string[]} params.trustStorePems
 * @returns {{ok: true, anchorSubject: string, chainLength: number}|{ok: false, reason: string}}
 */
export function validateCmsCertChain(params) {
  const { leafCert, intermediateDers = [], trustStorePems } = params ?? {};
  if (!leafCert) return { ok: false, reason: "leafCert required" };
  if (!Array.isArray(trustStorePems) || trustStorePems.length === 0) {
    return { ok: false, reason: "trustStorePems must be a non-empty array" };
  }

  let intermediates;
  try {
    intermediates = intermediateDers.map((d) => new X509Certificate(d));
  } catch (err) {
    return { ok: false, reason: `intermediate parse failed: ${err.message}` };
  }
  let roots;
  try {
    roots = trustStorePems.map((pem) => new X509Certificate(pem));
  } catch (err) {
    return { ok: false, reason: `trust-store parse failed: ${err.message}` };
  }

  const now = Date.now();
  const seenFingerprints = new Set();
  let current = leafCert;
  let chainLength = 1;

  for (let step = 0; step < 16; step++) {
    const fp = current.fingerprint256;
    if (seenFingerprints.has(fp)) {
      return { ok: false, reason: "certificate loop detected" };
    }
    seenFingerprints.add(fp);

    // Validity window check on every cert in the chain.
    const notBefore = Date.parse(current.validFrom);
    const notAfter = Date.parse(current.validTo);
    if (Number.isFinite(notBefore) && now < notBefore) {
      return { ok: false, reason: `cert not yet valid: ${current.subject}` };
    }
    if (Number.isFinite(notAfter) && now > notAfter) {
      return { ok: false, reason: `cert expired: ${current.subject}` };
    }

    // Termination: current cert issued by a root in the trust store.
    for (const root of roots) {
      // Self-signed root case: current fingerprint matches a trusted root.
      if (root.fingerprint256 === current.fingerprint256) {
        return { ok: true, anchorSubject: root.subject, chainLength };
      }
      if (current.checkIssued(root)) {
        let signatureOk = false;
        try { signatureOk = current.verify(root.publicKey); } catch { /* fall through */ }
        if (signatureOk) {
          return { ok: true, anchorSubject: root.subject, chainLength: chainLength + 1 };
        }
      }
    }

    // Walk to an embedded intermediate. Skip the current cert itself in
    // case the leaf appears in the intermediates array too.
    let parent = null;
    for (const inter of intermediates) {
      if (inter.fingerprint256 === current.fingerprint256) continue;
      if (current.checkIssued(inter)) {
        let signatureOk = false;
        try { signatureOk = current.verify(inter.publicKey); } catch { /* fall through */ }
        if (signatureOk) { parent = inter; break; }
      }
    }
    if (!parent) {
      return { ok: false, reason: `no trusted issuer for "${current.subject}"` };
    }
    current = parent;
    chainLength++;
  }
  return { ok: false, reason: "chain exceeded 16 steps" };
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
 * Sprint 1 default (verifyCms: false): structural verification only —
 * checks that the messageImprint in the parsed TSTInfo equals
 * sha256(batch_root_bytes) (or sha1, per the anchor's algorithm), and
 * extracts genTime. Reports trustLevel TIME_ANCHORED_STRUCTURAL.
 *
 * Sprint 2 opt-in (verifyCms: true): additionally verifies the CMS
 * SignedData signature over the TSTInfo using the certificate embedded
 * in the token. Reports trustLevel TIME_ANCHORED on success; falls back
 * to TIME_ANCHORED_STRUCTURAL on CMS-verify failure with a diagnostic
 * reason. Does NOT walk a certificate trust chain to a root CA — the
 * caller's operator must pair this with a trust store; see
 * docs/THREAT_MODEL.md §6.3.
 *
 * @param {object} params
 * @param {object} params.anchor — one entry from bundle.external_anchors
 * @param {string} params.expectedBatchRootHex — bundle.batch_root
 * @param {boolean} [params.verifyCms] — attempt full CMS signature verify
 * @returns {{ok: true, genTimeIso: string, trustLevel: string, cmsSignerSubject?: string, cmsFailReason?: string} | {ok: false, reason: string}}
 */
export function verifyRfc3161Anchor(params) {
  const { anchor, expectedBatchRootHex, verifyCms = false, caTrustStorePem } = params ?? {};
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

  // Sprint 2: attempt CMS SignedData signature verification if requested
  // AND the token contains the pieces needed (certificate + SignerInfo).
  // Fall back to TIME_ANCHORED_STRUCTURAL on failure so the caller sees a
  // clear diagnostic without the top-level verify going false.
  if (verifyCms) {
    if (!parsed.tstInfo.certificateDer || !parsed.tstInfo.signerInfoBytes) {
      return {
        ok: true,
        genTimeIso: parsed.tstInfo.genTimeIso,
        trustLevel: TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL,
        cmsFailReason: "token missing embedded certificate or SignerInfo",
      };
    }
    const cmsResult = verifyCmsSignature({
      eContentBytes: parsed.tstInfo.tstInfoBytes,
      certificatesDer: parsed.tstInfo.certificatesDer,
      signerInfoBytes: parsed.tstInfo.signerInfoBytes,
      caTrustStorePem,
    });
    if (!cmsResult.ok) {
      return {
        ok: true,
        genTimeIso: parsed.tstInfo.genTimeIso,
        trustLevel: TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL,
        cmsFailReason: cmsResult.reason,
      };
    }
    // Sprint 4: if a trust store was provided AND chain failed, honestly
    // demote to STRUCTURAL with a chainFailReason. Sig verified against
    // an untrusted cert is not stronger than "TSA-shaped bytes matched".
    if (Array.isArray(caTrustStorePem) && caTrustStorePem.length > 0
        && cmsResult.caChainValidated !== true) {
      return {
        ok: true,
        genTimeIso: parsed.tstInfo.genTimeIso,
        trustLevel: TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL,
        cmsFailReason: cmsResult.chainFailReason ?? "CA chain validation failed",
      };
    }
    return {
      ok: true,
      genTimeIso: parsed.tstInfo.genTimeIso,
      trustLevel: TRUST_LEVELS.TIME_ANCHORED,
      cmsSignerSubject: cmsResult.signerSubject,
      caChainValidated: cmsResult.caChainValidated,
      ...(cmsResult.chainAnchorSubject ? { chainAnchorSubject: cmsResult.chainAnchorSubject } : {}),
    };
  }

  return {
    ok: true,
    genTimeIso: parsed.tstInfo.genTimeIso,
    trustLevel: TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL,
  };
}

// ─────────────────────────────────────────────────────────────────
// v3 M3 sprint 3 — Sigstore Rekor transparency-log adapter.
// ─────────────────────────────────────────────────────────────────
//
// Rekor is a public append-only transparency log for signed artifacts
// (sigstore.dev). Submitting a Shadow evidence bundle's batch_root + signature
// to Rekor yields an entry that is publicly witnessed: even a compromised
// Shadow operator cannot silently rewrite history without also compromising
// the Rekor log itself (which is monitored by third parties).
//
// Structural verification (LOG_ANCHORED_STRUCTURAL): parse the Rekor entry
// body and confirm its embedded payload hash matches the bundle's batch_root.
// This proves "the operator submitted a matching hash to a log endpoint";
// it does NOT prove inclusion in the actual tree or authenticity of the
// response.
//
// Full verification (LOG_ANCHORED): also verify (a) the RFC 9162 inclusion
// proof against the tree root hash returned in the response, and (b) the
// Signed Entry Timestamp (SET) — a Rekor-signed statement binding
// (body, logID, logIndex, integratedTime) — using a caller-supplied Rekor
// public key. Fresh Rekor pubkey: `curl https://rekor.sigstore.dev/api/v1/log/publicKey`.
//
// Design constraints (same discipline as sprint 1/2):
//   - Zero external dependencies. All Merkle math + JSON canonicalization
//     implemented inline.
//   - No hard-coded Rekor pubkey. Rotation is a real operational risk;
//     caller must supply the current pubkey PEM. verifyRekorAnchor with
//     mode:"full" throws a clear error if pubkey missing.
//   - The client function submitRekorEntry does network I/O; callers must
//     opt in. Tests use captured fixtures rather than live network calls
//     (parallel to the freetsa test policy).
//
// References:
//   - RFC 9162 Certificate Transparency 2.0 (tree hash format + inclusion proof)
//   - Sigstore Rekor API v1 (github.com/sigstore/rekor/blob/main/openapi.yaml)

/**
 * Build the canonicalized hashedrekord v0.0.1 entry body for a bundle.
 *
 * @param {object} params
 * @param {string} params.batchRootHex — bundle.batch_root (hex).
 * @param {string} params.signatureBase64 — bundle signature (base64).
 * @param {string} params.publicKeyPem — Ed25519 public key PEM used to sign.
 * @returns {{body: string, hashedrekord: object}} — body is base64 of canonical JSON.
 */
export function buildRekorHashedrekordEntry({ batchRootHex, signatureBase64, publicKeyPem }) {
  if (!batchRootHex || !signatureBase64 || !publicKeyPem) {
    throw new Error("buildRekorHashedrekordEntry: batchRootHex + signatureBase64 + publicKeyPem all required");
  }
  const hashedrekord = {
    apiVersion: "0.0.1",
    kind: "hashedrekord",
    spec: {
      data: {
        hash: { algorithm: "sha256", value: batchRootHex.toLowerCase() },
      },
      signature: {
        content: signatureBase64,
        publicKey: { content: Buffer.from(publicKeyPem, "utf8").toString("base64") },
      },
    },
  };
  const canonical = canonicalizeJson(hashedrekord);
  return { body: Buffer.from(canonical, "utf8").toString("base64"), hashedrekord };
}

/**
 * Submit a hashedrekord entry to a Rekor instance. Returns the anchor object
 * ready to embed in bundle.external_anchors.
 *
 * NETWORK — opt-in. Callers, not tests, invoke this.
 *
 * @param {object} params
 * @param {string} params.batchRootHex
 * @param {string} params.signatureBase64
 * @param {string} params.publicKeyPem — Ed25519 signer key (bundle signer).
 * @param {string} [params.rekorUrl] — default "https://rekor.sigstore.dev"
 * @param {number} [params.timeoutMs] — default 15000
 * @returns {Promise<object>} — anchor object with kind:"rekor"
 */
export async function submitRekorEntry({
  batchRootHex,
  signatureBase64,
  publicKeyPem,
  rekorUrl = "https://rekor.sigstore.dev",
  timeoutMs = 15000,
}) {
  const { hashedrekord } = buildRekorHashedrekordEntry({
    batchRootHex,
    signatureBase64,
    publicKeyPem,
  });
  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(`${rekorUrl.replace(/\/$/, "")}/api/v1/log/entries`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(hashedrekord),
      signal: abort.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(`Rekor POST failed: HTTP ${resp.status} ${bodyText.slice(0, 200)}`);
  }
  const respJson = await resp.json();
  const uuid = Object.keys(respJson)[0];
  if (!uuid) throw new Error("Rekor response missing entry uuid");
  const entry = respJson[uuid];
  return {
    kind: "rekor",
    logUrl: rekorUrl,
    uuid,
    logIndex: entry.logIndex,
    logID: entry.logID,
    integratedTime: entry.integratedTime,
    body: entry.body,
    inclusionProof: entry.verification?.inclusionProof ?? null,
    signedEntryTimestamp: entry.verification?.signedEntryTimestamp ?? null,
  };
}

/**
 * RFC 8785–ish canonical JSON stringify for the subset used here (objects
 * with string keys, strings, integers, arrays, booleans, null; no floats,
 * no Unicode surrogates). Keys sorted lexicographically at every level.
 */
export function canonicalizeJson(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("canonicalizeJson: non-finite number");
    if (!Number.isInteger(v)) throw new Error("canonicalizeJson: only integers supported");
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalizeJson).join(",") + "]";
  if (typeof v === "object") {
    const keys = Object.keys(v).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ":" + canonicalizeJson(v[k]));
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`canonicalizeJson: unsupported type ${typeof v}`);
}

/**
 * Extract the payload SHA-256 hash from a base64-encoded Rekor hashedrekord
 * body. Returns null if the body is malformed or not a hashedrekord.
 *
 * @param {string} bodyBase64
 * @returns {{algorithm: string, hex: string}|null}
 */
export function extractRekorPayloadHash(bodyBase64) {
  try {
    const raw = Buffer.from(bodyBase64, "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.kind !== "hashedrekord") return null;
    const h = parsed?.spec?.data?.hash;
    if (!h?.algorithm || !h?.value) return null;
    return { algorithm: String(h.algorithm), hex: String(h.value).toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * RFC 9162 §2.1.3 inner-node hash: SHA-256(0x01 || left || right).
 */
function hashChildren(left, right) {
  return createHash("sha256").update(Buffer.from([0x01])).update(left).update(right).digest();
}

/**
 * RFC 9162 §2.1.3 leaf hash: SHA-256(0x00 || raw_body_bytes).
 * Rekor's leaf-hash input is the base64-decoded body bytes.
 */
export function rekorLeafHash(bodyBase64) {
  const raw = Buffer.from(bodyBase64, "base64");
  return createHash("sha256").update(Buffer.from([0x00])).update(raw).digest();
}

/**
 * Verify an RFC 9162 inclusion proof.
 *
 * Ported from the widely-audited pattern used by sigstore-js and
 * transparency-dev/merkle (Go). Returns true only when the reconstructed
 * root matches expectedRootHex AND the proof was fully consumed with the
 * subtree-size counter reaching zero.
 *
 * @param {object} params
 * @param {number} params.leafIndex — 0-based
 * @param {number} params.treeSize — must be > leafIndex
 * @param {string[]} params.hashesHex — sibling hashes bottom-up (hex)
 * @param {string} params.expectedRootHex — hex-encoded expected root
 * @param {Buffer} params.leafHash — 32-byte SHA-256 leaf hash
 * @returns {boolean}
 */
export function verifyInclusionProof({ leafIndex, treeSize, hashesHex, expectedRootHex, leafHash }) {
  if (!Number.isInteger(leafIndex) || !Number.isInteger(treeSize)) return false;
  if (leafIndex < 0 || treeSize <= 0 || leafIndex >= treeSize) return false;
  if (leafHash.length !== 32) return false;
  // Single-leaf tree: no siblings expected, leaf IS root.
  if (treeSize === 1) {
    return hashesHex.length === 0 && leafHash.equals(Buffer.from(expectedRootHex, "hex"));
  }
  let fn = leafIndex;
  let sn = treeSize - 1;
  let r = leafHash;
  for (const hHex of hashesHex) {
    const h = Buffer.from(hHex, "hex");
    if (h.length !== 32) return false;
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      r = hashChildren(h, r);
      while ((fn & 1) === 0 && fn !== 0) {
        fn = Math.floor(fn / 2);
        sn = Math.floor(sn / 2);
      }
    } else {
      r = hashChildren(r, h);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && r.equals(Buffer.from(expectedRootHex, "hex"));
}

/**
 * Verify the Rekor Signed Entry Timestamp (SET). The SET is an ECDSA
 * signature by Rekor over the canonical JSON of {body, integratedTime,
 * logID, logIndex}.
 *
 * @param {object} params
 * @param {object} params.anchor — must contain body/integratedTime/logID/logIndex/signedEntryTimestamp
 * @param {string|Buffer|KeyObject} params.rekorPubKey — PEM/KeyObject
 * @returns {{ok: boolean, reason?: string}}
 */
export function verifyRekorSet({ anchor, rekorPubKey }) {
  if (!anchor?.signedEntryTimestamp) {
    return { ok: false, reason: "anchor missing signedEntryTimestamp" };
  }
  const canonical = canonicalizeJson({
    body: anchor.body,
    integratedTime: anchor.integratedTime,
    logID: anchor.logID,
    logIndex: anchor.logIndex,
  });
  const sig = Buffer.from(anchor.signedEntryTimestamp, "base64");
  let keyObj;
  try {
    keyObj = rekorPubKey && typeof rekorPubKey === "object" && rekorPubKey.type
      ? rekorPubKey
      : createPublicKey(rekorPubKey);
  } catch (err) {
    return { ok: false, reason: `Rekor pubkey parse failed: ${err.message}` };
  }
  const ok = cryptoVerify("sha256", Buffer.from(canonical, "utf8"), keyObj, sig);
  return ok ? { ok: true } : { ok: false, reason: "SET signature verification failed" };
}

/**
 * Verify a Rekor anchor object. Two modes:
 *   - Structural (default): confirm entry body payload-hash matches
 *     expectedBatchRootHex. Elevates to LOG_ANCHORED_STRUCTURAL.
 *   - Full: also verify inclusion proof + SET signature with rekorPubKey.
 *     Elevates to LOG_ANCHORED on success. On partial failure, falls back
 *     to LOG_ANCHORED_STRUCTURAL with a diagnostic.
 *
 * @param {object} params
 * @param {object} params.anchor
 * @param {string} params.expectedBatchRootHex
 * @param {boolean} [params.verifyFull]
 * @param {string|Buffer|KeyObject} [params.rekorPubKey] — required if verifyFull
 * @returns {{ok: boolean, reason?: string, trustLevel?: string, ...}}
 */
export function verifyRekorAnchor({ anchor, expectedBatchRootHex, verifyFull = false, rekorPubKey } = {}) {
  if (!anchor || anchor.kind !== "rekor") {
    return { ok: false, reason: "anchor.kind must be 'rekor'" };
  }
  if (!anchor.body) return { ok: false, reason: "anchor missing body" };
  const payload = extractRekorPayloadHash(anchor.body);
  if (!payload) return { ok: false, reason: "rekor body is not a parseable hashedrekord" };
  if (payload.algorithm !== "sha256") {
    return { ok: false, reason: `unsupported payload hash algorithm "${payload.algorithm}"` };
  }
  if (payload.hex !== expectedBatchRootHex.toLowerCase()) {
    return { ok: false, reason: "rekor payload hash does not match batch_root" };
  }

  if (!verifyFull) {
    return {
      ok: true,
      trustLevel: TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL,
      logIndex: anchor.logIndex,
      integratedTime: anchor.integratedTime,
    };
  }

  if (!rekorPubKey) {
    return {
      ok: true,
      trustLevel: TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL,
      logIndex: anchor.logIndex,
      integratedTime: anchor.integratedTime,
      fullFailReason: "rekorPubKey option required for full verification",
    };
  }

  // Inclusion proof
  const ip = anchor.inclusionProof;
  if (!ip?.rootHash || !Array.isArray(ip?.hashes) ||
      !Number.isInteger(ip?.logIndex) || !Number.isInteger(ip?.treeSize)) {
    return {
      ok: true,
      trustLevel: TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL,
      logIndex: anchor.logIndex,
      integratedTime: anchor.integratedTime,
      fullFailReason: "anchor missing or malformed inclusionProof",
    };
  }
  const leaf = rekorLeafHash(anchor.body);
  const inclOk = verifyInclusionProof({
    leafIndex: ip.logIndex,
    treeSize: ip.treeSize,
    hashesHex: ip.hashes,
    expectedRootHex: ip.rootHash,
    leafHash: leaf,
  });
  if (!inclOk) {
    return {
      ok: true,
      trustLevel: TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL,
      logIndex: anchor.logIndex,
      integratedTime: anchor.integratedTime,
      fullFailReason: "inclusion proof failed to reproduce rootHash",
    };
  }

  // SET
  const setResult = verifyRekorSet({ anchor, rekorPubKey });
  if (!setResult.ok) {
    return {
      ok: true,
      trustLevel: TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL,
      logIndex: anchor.logIndex,
      integratedTime: anchor.integratedTime,
      fullFailReason: setResult.reason,
    };
  }

  return {
    ok: true,
    trustLevel: TRUST_LEVELS.LOG_ANCHORED,
    logIndex: anchor.logIndex,
    integratedTime: anchor.integratedTime,
  };
}
