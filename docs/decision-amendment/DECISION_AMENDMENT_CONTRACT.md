# shadow-decision-amendment/1 — Signed Decision Member Contract

Status: IMPLEMENTED (fixture mode) on `feat/shadow-decision-amendment-cli`.
Implements the committed discovery decision
`NEW_DECISION_MEMBER_IN_PACKAGE_VERSION_RECOMMENDED`
(DECISION_CONTRACT_RECOMMENDATION.md, same directory).

Source: `lib/decision-amendment.mjs` (contract), `lib/decision-package.mjs`
(assembly + chain), `lib/portable-audit-package.mjs` (1.2 verification).

## Package layout — shadow-portable-audit-package/1.2

A decision successor is a normal portable package plus **exactly one** decision
member:

```
manifest.json                            (signed, manifest_version …/1.2)
presentation/shadow-flow-export.json     carried BYTE-FOR-BYTE from the predecessor
evidence/evidence-bundle.json            carried BYTE-FOR-BYTE
attestation/attestation.json             carried BYTE-FOR-BYTE (when present)
verification/verification-result.json    carried BYTE-FOR-BYTE
provenance/runtime-manifest.json         NEW — shadow-audit-package-provenance/1.2
decision/decision-amendment.json         NEW — shadow-decision-amendment/1 (role: decision)
keys/evidence-public-key.pem             carried
keys/package-public-key.pem              embedded
```

- `supersedes.marker` is the single neutral value `DECISION_AMENDMENT`.
  Decision semantics exist ONLY in the decision member — never in the marker.
- Standalone packages remain 1.0; neutral non-decision successors remain 1.1
  (`FIXTURE_SUCCESSOR`); decision successors use 1.2. All previous versions
  remain byte-identical in place and independently valid.
- `shadow-audit-package-provenance/1.2` = 1.1 + `member_contracts.decision`
  (narrowest additive provenance change; 1.0/1.1 provenance untouched).

## Decision member fields (closed key set)

| Field | Content |
|---|---|
| `decision_schema` | `"shadow-decision-amendment/1"` |
| `decision_id` | 64-hex, content-derived (see Decision ID below) |
| `decision_type` | closed: `HUMAN_REVIEW_COMPLETED` · `DECISION_OVERRIDDEN` · `APPROVAL_GRANTED` · `DECISION_REJECTED` |
| `predecessor` | `{package_id, manifest_sha256, manifest_version}` — must mirror the manifest's signed `supersedes` block |
| `case_id`, `evidence_session_id` | must equal the manifest bindings (cross-case/session splice → `CASE_MISMATCH` / `SESSION_MISMATCH`) |
| `target` | `{type, object_id, object_sha256, object_schema_version, prior_effective_decision_id}` — see DECISION_TARGET below |
| `actor` | `{actor_id, display_name, role, identity_class}`; roles closed to `reviewer`/`approver`; `identity_class` closed to `operator_declared`; `actor_id` must match `fixture:<slug>` |
| `authorization` | `{status: "DECISION_AUTHORITY_UNVERIFIED", authorization_ref: null}` — the ONLY legal values in fixture mode |
| `content` | type-specific (below); always `reason_code` (closed fixture set) + `reason_text` (signed) |
| `referenced_evidence` | `[{session_id, seq, payload_hash}]` — hash/reference semantics; entries must resolve inside this package's evidence bundle |
| `policy` | `{review_required, approval_required, separation_of_duties}` — explicit signed flags, no hidden defaults |
| `status_tokens` | mandatory exact set: `FIXTURE_DECISION_ONLY`, `DECISION_IDENTITY_DECLARED_NOT_VERIFIED`, `DECISION_AUTHORITY_UNVERIFIED`, `SEPARATION_OF_DUTIES_NOT_ENFORCED` — signed honesty, not display-optional |
| `decided_at_utc` | deterministic ISO-8601 UTC from the operator intent — never wall clock |
| `effective_scope` | `"this_case_only"` |
| `boundary` | the exact DECISION_BOUNDARY_STATEMENT string |

### Type-specific content

- **HUMAN_REVIEW_COMPLETED** — `review_outcome` (`NO_CHANGE` \| `OVERRIDE_PROPOSED`) + `reviewer_findings` (signed, required). Records a review; never replaces the effective decision. Review is not Approval.
- **DECISION_OVERRIDDEN** — `previous_disposition` + `new_disposition` (closed set `APPROVE`/`APPROVE_WITH_CONDITIONS`/`DECLINE`/`REVIEW`, must differ; `previous_disposition` must equal the predecessor's effective disposition). Preserves the original decision; may require later approval per its signed `policy.approval_required`.
- **APPROVAL_GRANTED** — optional signed `approval_conditions`. Approves one specific target by ID + hash; activates a pending override when targeting it. Approval is not signature verification and not regulatory sign-off.
- **DECISION_REJECTED** — `rejection_basis` (signed, required). Closes one specific prior-decision branch; the package stays valid; the rejected proposal stays in history.

No escalation type and no custom decision types exist.

## Decision ID

```
content_hash = sha256(canonicalize(member minus decision_id))
decision_id  = sha256( content_hash \n predecessor_package_id \n
                       predecessor_manifest_sha256 \n case_id \n target.object_id )
```

Any change to a signed material field changes the id; a stale id fails
re-derivation (`DECISION_MALFORMED`). Replays against another case or
predecessor cannot keep a valid id. Duplicate ids across a supplied set →
`DECISION_DUPLICATE` (different bytes) / `DECISION_REPLAYED` (identical bytes).

## Text rules

All human-authored text (`reason_text`, `reviewer_findings`,
`approval_conditions`, `rejection_basis`, `display_name`) is: signed; Unicode
NFC; plain text only (no HTML interpretation — markup is inert data); control
characters outside `\n`/`\t` rejected; ≤ 4 KiB per field (display name ≤ 128
bytes), UTF-8 byte-measured; deterministic serialization. No employee IDs,
emails, customer data, credentials, private paths, or environment data.

## Boundary

> A valid decision signature proves tamper-evidence of the recorded decision
> only — never actor authentication, decision authority,
> separation-of-duties enforcement, regulatory sign-off, or
> analytical/business correctness.

The Ed25519 package signer is never the decision actor
(DECISION_SECURITY_BOUNDARY.md).
