# Decision Privacy Model

Status: discovery only. Classifies decision-amendment fields for portability,
redaction, and browser persistence.

## Field classification

| Field | Portable package | Notes |
|---|---|---|
| Reviewer/approver display name | Safe **only as operator-declared fixture text** today; production personal names are a production-policy decision | In fixture mode names are synthetic. A production deployment must decide between real names, pseudonymous IDs, or role-only display before any real name enters a portable artifact. |
| Employee ID | **Not safe** for the portable package | If ever needed, carry as salted hash / opaque reference resolvable only inside the bank. |
| Email | **Not safe** | Same treatment as employee ID. |
| Organization / tenant | Safe as coarse label (e.g. tenant slug) | No org-internal unit paths. |
| Role | Safe (closed vocabulary) | `reviewer` / `approver`. |
| Reviewer comment / findings | Safe **after bounds + safe-text rules**; production deployments need a redaction gate before export | Signed, size-bounded, plain text. |
| Reason code | Safe | Closed set. |
| Reason text | Safe with same bounds as findings | Signed. |
| Referenced customer data | **Never inline.** Hash/reference only (`payload_ref` pattern from shadow-evidence/v1) | The decision references evidence by ID + hash; the customer payload stays wherever the evidence contract already keeps it. |
| Referenced evidence IDs + hashes | Safe | IDs and SHA-256 hashes only. |
| Policy citation | Safe | Citation strings (e.g. Reg B §1002.9) contain no personal data. |
| Approval conditions | Safe with bounds + safe-text | Signed. |
| Signature material (public key, signature, key ID, fingerprint) | Safe | Public by design. |
| Private key material | **Never in any package, repo, doc, or browser store.** | Absolute. |
| Authorization evidence | External reference only (`authorization_ref`) | Never embedded; production shape unknown until an authorization source exists. |

## Text handling rules

- **Size bounds**: every human-authored text field carries a contract-level
  maximum in bytes (UTF-8 encoded), enforced at signing time and re-checked at
  verification (`DECISION_SIZE_BOUND_EXCEEDED`). Bounds are part of the
  contract, so a verifier can reject oversized text without heuristics.
  Discovery-level candidate bounds: findings/reason/conditions ≤ 4 KiB each;
  display name ≤ 128 bytes; reason code ≤ 64 bytes.
- **Unicode**: NFC-normalized UTF-8 before signing so the signed bytes are
  canonical; disallow control characters other than `\n` and `\t`; no BOM.
- **Safe rendering**: text is data, never markup. Web renders as text nodes
  only — no HTML parsing, no Markdown execution, no links auto-materialized.
  This is already the Web posture for package-borne text and extends
  unchanged to decision text.
- **No HTML execution**: an amendment containing `<script>` is *valid text*
  (integrity-wise) and must render inert; contract-level `DECISION_TEXT_UNSAFE`
  covers only control-character/normalization violations, keeping the
  integrity layer free of rendering policy.

## Redaction

- Fixture mode: nothing to redact (all synthetic), but the export path must
  still run the classification table so the discipline exists before real
  data ever appears.
- Production posture (future): a redaction step between decision authoring and
  package export, with redactions represented as hash-preserving elisions
  (`redacted: true`, original hash retained) so signatures over manifests
  remain checkable. Full design deferred; flagged as a production-policy
  decision.

## Browser persistence (IndexedDB)

- Decision packages persist under the same IndexedDB regime Web already uses
  for imported packages — no new store class.
- Limitations to respect: IndexedDB is unencrypted at rest, per-origin,
  evictable under storage pressure. Therefore: no field classified above as
  "not safe" may reach the browser at all (enforced by the contract simply
  never containing those fields, not by Web filtering).
- Export/retention: exports are user-initiated; no auto-sync anywhere. Web may
  offer "forget this package," which deletes the local copy and must be
  labeled as local-only deletion (the package still exists wherever else it
  was shared — immutability means deletion is never global).
