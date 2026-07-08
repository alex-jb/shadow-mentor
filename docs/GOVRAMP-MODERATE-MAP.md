# GovRAMP Moderate Baseline Mapping (Shadow v1.5.29+)

**References**:
- StateRAMP rebranded to **GovRAMP** in 2026 — covers state, local, tribal, and educational (SLTT) government
- [GovRAMP vs FedRAMP overview](https://betaquick.com/blog/stateramp-vs-fedramp-ai-compliance/)
- [FedRAMP 20x program](https://www.fedramp.gov/20x/) — Moderate baseline submission opens FY26 Q4 (July-Sept 2026)
- Complement to `docs/GSAR-552-239-7001-PROVENANCE.md` (federal contractor kit) and `docs/NIST-AI-600-1-MAP.md` (NIST GenAI Profile)

## Who this document is for

- State-owned community banks (Bank of North Dakota is the reference case)
- State housing finance agency (HFA) revenue-bond programs where AI-assisted underwriting is under GovRAMP-shaped procurement review
- Municipal + county government AI vendor pools now spinning up SLTT AI RFPs

Federal FedRAMP is a separate lane covered in `GSAR-552-239-7001-PROVENANCE.md`. GovRAMP shares the same NIST 800-53 control family taxonomy but the review body + procurement lane differs. FedRAMP 20x is the 2026 modernization program that opens Moderate baseline submissions Q4 FY26.

## Baseline control-family coverage

GovRAMP Moderate maps to a subset of NIST 800-53 Rev 5 control families. This section documents which controls Shadow answers today plus which are Shadow-adjacent (require ops+deploy work, not code).

### AC — Access Control

| Control | Shadow module | Notes |
|---|---|---|
| AC-2 Account Management | Vercel + Slack OAuth on Council-for-Slack, per-tenant key derivation in Shadow v1.5.27 (`lib/attestation-tenant.js`) | Answered code-side. Multi-tenant identity remains ops-side for GovRAMP audit |
| AC-3 Access Enforcement | Per-tenant HKDF-derived secrets prevent cross-tenant attestation verification | Documented in `docs/PER-TENANT-KEY-ISOLATION.md` |
| AC-6 Least Privilege | `mode: "hmac-sha256"` allows per-tenant secret without master exposure | v1.5.27 |
| AC-17 Remote Access | HTTPS-only via Vercel; MCP server uses stdio (local) | Ops layer |

### AU — Audit & Accountability

| Control | Shadow module | Notes |
|---|---|---|
| AU-2 Event Logging | Every attestation carries `completed_at_utc` + `previous_hash` (cross-vertical chain) | v1.5.16 hash-chain |
| AU-3 Content of Records | 13 fields per attestation (see `docs/GSAR-552-239-7001-PROVENANCE.md` §5) | Comprehensive |
| AU-9 Protection of Audit Info | Ed25519 signature covers full payload; per-tenant HMAC for tenant isolation | v1.5.27 |
| AU-10 Non-Repudiation | Ed25519 signature on every attestation | RFC 8032 |
| AU-14 Session Audit | Hash-chain across decisions | v1.5.10-v1.5.11 |

### IA — Identification & Authentication

| Control | Shadow module | Notes |
|---|---|---|
| IA-2 User Identification | Per-tenant key derivation (v1.5.27) proves the tenant identity end-to-end | Documented in `PER-TENANT-KEY-ISOLATION.md` |
| IA-5 Authenticator Management | Ed25519 keypair + HKDF-derived tenant secrets | RFC 8032 + RFC 5869 |
| IA-8 Non-Organizational Users | N/A for Shadow itself; downstream Slack/Vercel handle bank end users | Ops layer |

### SC — System & Communications Protection

| Control | Shadow module | Notes |
|---|---|---|
| SC-8 Transmission Confidentiality | HTTPS on Vercel; per-tenant HMAC on attestation | Ops + code |
| SC-13 Cryptographic Protection | Ed25519 (RFC 8032) + HKDF-SHA-256 (RFC 5869) + SHA-256 for commitments | Named algorithms |
| SC-28 Protection of Info at Rest | Shadow does not persist per-tenant PII; attestation records are hash-only | By design |

### SI — System & Information Integrity

| Control | Shadow module | Notes |
|---|---|---|
| SI-2 Flaw Remediation | 28 GitHub releases with CHANGELOG rationale for each | Public evidence |
| SI-4 System Monitoring | Verdict-invariance + Judge Card tests fire on every CI run | v1.5.21 + v1.5.23 |
| SI-7 Software Integrity | MCP-manifest SBOM at `/api/mcp-manifest` (v1.5.12) | Independent SBOM verify path |
| SI-10 Info Input Validation | `enforceReasonCodeDictionary` + adverse-action drafter refusal invariants | v1.5.8 + v1.5.24 |

## Overlap with NIST AI 600-1 GenAI Profile mapping

The 12 GAI risks in `docs/NIST-AI-600-1-MAP.md` are model-risk-specific. GovRAMP Moderate is generic-system-security. Overlap:

- **GAI 3.1 CBRN** → SI-10 input validation
- **GAI 3.2 confabulation** → SI-4 monitoring via Judge Card
- **GAI 3.4 data privacy** → SC-28 at rest + AC-3 access enforcement
- **GAI 3.5 environmental** → SC-13 (not directly, but named crypto reduces the "did they use FIPS 140-3 approved primitives" ambiguity)
- **GAI 3.11 obscene / abusive content** → downstream, ops layer

## What is NOT covered

- **Continuous Monitoring (ConMon)** — GovRAMP Moderate requires monthly vulnerability scans. Shadow ships CI + Dependabot but does not run a formal ConMon service.
- **Contingency Planning (CP)** — no active disaster-recovery site; Vercel handles hosting HA.
- **PE (Physical & Environmental Protection)** — N/A. Shadow is cloud-native.
- **PL (Planning)** — a bank's own Systems Security Plan is bank-side.

## Submission path FY26 Q4

The FedRAMP 20x Moderate baseline submission opens Q4 FY26 (July-Sept 2026). GovRAMP submissions follow a different queue but reuse the same control-family evidence. A state-owned community bank customer would:

1. Bank's SSO officer maps Shadow attestation evidence to the bank's own System Security Plan
2. Bank submits to GovRAMP review body
3. Shadow-side evidence: `docs/GSAR-552-239-7001-PROVENANCE.md` + `bin/gsar-provenance-report.mjs` output + `docs/NIST-AI-600-1-MAP.md`

## Not a real audit

This is a self-attestation mapping. It packages the evidence a GovRAMP reviewer can cross-check, but it does not substitute for a live 3PAO assessment. State + local government deployments requiring a Moderate authorization pair this document with an active 3PAO engagement.

## Related documents

- `docs/GSAR-552-239-7001-PROVENANCE.md` — federal contractor provenance kit
- `docs/NIST-AI-600-1-MAP.md` — NIST GenAI Profile 12-risk map
- `docs/PER-TENANT-KEY-ISOLATION.md` — v1.5.27 tenant isolation RFP answer
- `docs/GAICF-COMPATIBILITY.md` — GAICF three-layer matrix
- `docs/SAMPLING-CHANNEL-DEFENSE.md` — v1.5.28 sampling attestation
