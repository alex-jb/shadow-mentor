# Decision Contract Options

Status: discovery only. Five options assessed; exactly one recommended in
DECISION_CONTRACT_RECOMMENDATION.md.

## Option A — Extend shadow-portable-audit-package to 1.2 with signed decision fields in the manifest

Decision content (actor, reason, disposition) as new top-level manifest
fields.

| Criterion | Assessment |
|---|---|
| Backward compatibility | OK mechanically (new version behind the `manifest_version` gate). |
| Signed-byte clarity | Poor: business decision content mixed into the integrity artifact. The manifest is currently pure structure (bindings, assets, signing, capability tokens); the supersedes block is the one relational exception and is deliberately semantics-free. |
| Authority boundaries | Poor: manifest schema becomes the change-point for every future decision-vocabulary evolution — manifest churn for business reasons. |
| Schema duplication | None, but at the cost of conflation. |
| Immutable history / Web / CLI / fixture | Workable. |
| Review/Approval separation | Expressible but crowded. |
| Fork/conflict | Chain layer unchanged. |
| Migration/rollback | Manifest-schema rollback is the most expensive kind. |
| Testing | Every manifest test grows business cases. |

Verdict: rejected — violates the existing layering (manifest = integrity,
members = content).

## Option B — New signed decision-amendment member + new package version

A new member `decision/decision-amendment.json`, role `decision`, schema
`shadow-decision-amendment/1`, carried by successor packages on
`shadow-portable-audit-package/1.2`; hash-bound via `assets[]` exactly like
presentation/evidence/provenance; `supersedes.marker` gains the single
neutral value `DECISION_AMENDMENT`.

| Criterion | Assessment |
|---|---|
| Backward compatibility | Clean: 1.0/1.1 byte-identical and independently valid; 1.2 is additive behind the existing version gate; verifier already dispatches on `manifest_version`. |
| Signed-byte clarity | Best: decision bytes are one member with one schema; manifest signs its hash; the signing boundary is the existing, tested one. |
| Authority boundaries | Clean: decision vocabulary evolves in `shadow-decision-amendment/N` without touching the package or relation contracts; matches the control plane's one-contract-one-owner registry model. |
| Schema duplication | None: target binding reuses the supersedes block; only the object-layer reference is new. |
| Immutable history | Inherited from package immutability + atomic writes. |
| Web consumption | Natural: Web already reads members and renders per-member content; the decision member becomes a new node payload on the existing TimelineView model. |
| CLI implementation | Small: `assemblePackage` gains an optional member (precedent: optional attestation member); a `decide` subcommand mirrors `create --supersedes`. |
| Fixture support | Identical to today's fixture signing; deterministic bytes preserved. |
| Future production identity | The actor block lives in the member; `identity_class`/`authorization_ref` evolve inside `shadow-decision-amendment/N`. |
| Review/Approval separation | Four `decision_type` values in one member schema; state machine derives lifecycle. |
| Fork/conflict | Chain fork detection reused as-is; decision-level conflict adds vocabulary only. |
| Migration risk | Low; rollback = stop producing 1.2 (existing artifacts stay valid). |
| Testing | Additive member tests + chain tests; the existing pinned test rejecting marker `"APPROVED"` is *replaced deliberately* by one accepting only `DECISION_AMENDMENT`. |

Verdict: recommended.

## Option C — Separate decision-amendment contract referenced by an unchanged successor-package relation

Decision artifact lives outside the package (standalone signed file), with the
successor package pointing at it.

- Signed-byte clarity poor: needs its own signing envelope, key discovery, and
  verification path — duplicating exactly the machinery the package already
  provides. An artifact outside the package boundary is also outside the
  member-hash integrity net: the reference can dangle, and portability (one
  directory = whole truth) breaks.
- Verdict: rejected — reinvents the package for no boundary gain.

## Option D — Extend the supersession relation vocabulary only

New markers (`REVIEW_COMPLETED`, `APPROVED`, …) with no new content.

- Cannot carry actor, reason, target-object hash, or policy flags: the
  supersedes block's key set is closed and deliberately semantics-free, and
  the Core ADR treats the marker as a label, not a payload. Cramming decision
  content into markers either loses the required fields (violating "override
  requires reason") or reopens the closed key set (Option A's conflation in a
  worse place).
- Verdict: rejected as a standalone answer. Option B deliberately borrows its
  minimal form: one new neutral marker, semantics in the member.

## Option E — Reusable decision-event schema carried through shadow-evidence/v1

Decisions as new evidence event types (`HUMAN_REVIEW`, `OVERRIDE`, …).

- Fatal timing problem: bundles are sealed at session end; post-hoc decisions
  (the normal case — review happens after the package exists) cannot enter a
  sealed bundle without breaking the hash chain.
- Fatal versioning problem: the event enum is frozen (`bundle_version` bump
  required) and already drifted 13-vs-18 between schema and code — building on
  it inherits an unresolved defect.
- Reason text would live off-chain in redactable payloads — the opposite of
  "no unsigned prose changes the effective decision."
- Verdict: rejected as the contract. Retained as a *future optional
  companion*: a live session that includes a human decision may still record a
  `human_approval` event; the signed decision member remains the authority.
