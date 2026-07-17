# Vendor viability & third-party risk

For a bank's third-party risk management (TPRM) review. This page answers the
continuity, incident-notification, and vendor-viability questions that a
procurement or vendor-risk reviewer must clear before a regulated institution can
adopt software — the questions the *Interagency Guidance on Third-Party
Relationships: Risk Management* (Fed/OCC/FDIC, June 2023) requires be answered for
any third party, including AI vendors.

It is written to be read directly by a reviewer, and it is honest about what
Shadow is: a single-maintainer, MIT-licensed open-source project. The reason that
is acceptable for a control of this kind — rather than a dealbreaker — is set out
below.

## 1. Vendor identity

| | |
|---|---|
| Software | Shadow (`shadow-mentor`) |
| License | MIT (see `LICENSE`) — permissive, no copyleft, fork rights included |
| Maintainer | Alex Xiaoyu Ji — `xji1@mail.yu.edu` |
| Source of record | `https://github.com/alex-jb/shadow-mentor` (public) |
| Published package | `shadow-attest-core` on npm (the verifier + signing core) |

## 2. Continuity / key-person risk — the central question

**Question a reviewer asks:** *"This is one person. What happens to our audit
records if the maintainer stops working on it, or disappears?"*

**Answer:** Shadow is structured so that the maintainer's continued involvement is
**not** required to keep using what you have already produced.

- **Your evidence is verifiable without the vendor.** A Shadow evidence bundle is
  an Ed25519-signed, SHA-256 hash-chained JSON file (RFC 8032). It is verified by
  a self-contained verifier (`bin/shadow-verify.mjs`, the published
  `shadow-attest-core`, the Python `shadow_verify` library, and a browser
  `verify.html`) using **only a public key** — no call to any Shadow-operated
  service, no network, no license server. Bundles you signed today remain
  independently verifiable indefinitely, by you or any third party, with tooling
  you already hold. There is no runtime dependency on the vendor.
- **MIT license = source continuity.** The complete source is public under MIT.
  If the maintainer stops, you (or any successor vendor, or your own engineers)
  can fork, build, and maintain it without permission. This is stronger than a
  traditional source-escrow arrangement: the escrow is unconditional and already
  in your hands, not held by a third party pending a release event.
- **Small, inspectable surface.** The signing/verification core is a small pure
  library with a minimal dependency footprint; there is no hidden proprietary
  component that a fork would be missing.

So the key-person risk that matters for a compliance control — *"can I still
trust and verify my records?"* — is mitigated structurally, independent of the
maintainer. The residual key-person risk is limited to future feature
development, which is the normal risk of any OSS dependency and is bounded by your
fork rights.

## 3. Incident notification

- **Channel:** private GitHub Security Advisory
  (`https://github.com/alex-jb/shadow-mentor/security/advisories/new`), or email
  `xji1@mail.yu.edu` with subject `SECURITY: Shadow`.
- **Acknowledgement SLA:** receipt acknowledged within **72 hours** (see
  `SECURITY.md`).
- **Disclosure process:** coordinated disclosure via GitHub Security Advisories;
  if a vulnerability affects consumers of the published npm package, an advisory
  is filed in the npm advisory database. If an issue is being actively exploited,
  an advisory may be published before a patch so operators can mitigate.
- **Scope that is in-scope for reporting:** anything that lets an attacker forge
  an attestation that verifies without the private key, or modify an attested
  record without detection (see `SECURITY.md` §"In scope").

## 4. Data handling & deployment

- **Where it runs:** Shadow runs in your environment. The verifier is offline. The
  signing core has no telemetry and does not phone home. For memory/recall, an
  in-VPC option (`LocalTieredMemory`, JSONL-backed, zero external dependencies) is
  available so no data need leave your tenant; the default demo backend is
  ephemeral in-memory (see `lib/memory-elastic.js`).
- **Key custody is yours.** You generate and hold the Ed25519 private key
  (production keys belong in your HSM/KMS). Shadow never holds your signing key.
  The demos use a self-signed key purely for demonstration; that is not the
  production posture.
- **Data processed:** the decision records you choose to attest. Shadow does not
  require exfiltration of underlying customer data to function — it signs the
  record you give it.

## 5. Regulatory posture (cross-references)

A reviewer assessing control coverage can trace obligations to tests:

- **Regulatory citation → persona → test map:** `docs/CITATION_MAP.md` (and the
  machine-readable `docs/citation-map.json`, queryable via
  `scripts/citation-map-query.mjs`). Covers SR 26-2, CFPB, Reg B / ECOA
  (12 CFR 1002 + AA01–AA06), AML/KYC/OFAC (BSA, USA PATRIOT §326, FinCEN CDD),
  GDPR Art. 22 + Schufa (C-634/21), Reg BI.
- **Threat model:** `docs/THREAT_MODEL.md` (seven-class attack table; states
  plainly what Shadow does *not* defend — e.g. a bank insider holding the private
  key — and what to layer on top, such as an RFC 3161 timestamp or a transparency
  log).
- **Standards mapping:** `docs/STANDARDS_MAP.md`.
- **Positioning:** a companion control for GenAI / agentic AI — which SR 26-2
  carves out of its model-risk scope by footnote 3, so Shadow fills the
  governance gap the guidance explicitly leaves open (not a claim of SR 26-2
  "compliance"). EU posture is GDPR Art. 22 + Schufa (C-634/21), with EU AI Act
  credit-scoring obligations deferred to 2027-12-02 (see
  `docs/eu-ai-act-self-attestation-shadow.md`).

## 6. Honest limitations

State these to the reviewer rather than have them discovered:

- **Single maintainer.** Feature development depends on one person. Mitigated for
  the control's purpose by §2 (MIT + independent verifier), not eliminated for
  roadmap purposes.
- **No formal SOC 2 Type 2 report yet.** A SOC 2 attestation is a vendor decision
  (Vanta/Drata/Secureframe) not yet undertaken. What exists today is the CI
  evidence binder (every regulatory-mapped test runs on every merge under branch
  protection) and this document.
- **Academic email contact** (`xji1@mail.yu.edu`); no 24/7 SOC. The 72-hour
  acknowledgement SLA above is what is committed.
- **PGP key** for encrypted vulnerability reports is published after `v2.0.0`
  final.

## 7. Reviewer checklist

- [ ] Continuity: records verifiable without the vendor (§2) — MIT fork rights (§1)
- [ ] Incident notification: channel + 72h ack SLA (§3)
- [ ] Data residency: runs in-tenant, no phone-home, customer-held keys (§4)
- [ ] Regulatory control coverage: citation → test map (§5)
- [ ] Residual risks documented and accepted (§6)
