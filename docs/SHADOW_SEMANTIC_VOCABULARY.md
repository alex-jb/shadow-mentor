# Shadow semantic vocabulary

One vocabulary, imported by every story adapter. Source of truth:
`lib/shadow-semantic-vocabulary.mjs`. The JSON mirror used by fixtures is
`schemas/shadow-semantic-status-v1.schema.json`. If the two disagree, the `.mjs`
module wins and the schema is a bug.

The point: the HTML/SVG explainer, the Three.js spatial player, and the Unity
native adapter all read meaning from this single file. An engine chooses shapes
and positions; it does not get to invent a status the others don't share.

## Semantic statuses

13 statuses, each with `text_en` / `text_zh`, an accessible description in both
languages, a `severity` bucket, and a redundant `shape`/`icon`. Status is never
carried by colour alone — the shape and the label always accompany it.

| Status | Severity | Means |
|---|---|---|
| `VERIFIED` | pass | The record matches the sealed evidence. Not a statement that the decision was right. |
| `FAILED` | fail | This check did not pass. |
| `PRESENT` | neutral | The element exists in the bundle (existence only). |
| `NOT_PRESENT` | neutral | The element is absent. |
| `NOT_CHECKED` | neutral | Not evaluated in this pass. |
| `NOT_EVALUATED` | info | Outside what the verifier judges (e.g. analytical correctness). |
| `WARNING` | warn | A weak/notable condition that does not by itself fail verification. |
| `UNSUPPORTED` | warn | A claim with no supporting evidence, or a capability not supported. |
| `MALFORMED` | fail | Input could not be parsed and was rejected (not crashed). |
| `ABSTAINED` | abstain | Insufficient verified evidence, so no claim was asserted. |
| `REQUIRES_HUMAN_REVIEW` | warn | A regulated outcome a person must sign off. |
| `AFFECTED_DOWNSTREAM` | fail | Frozen because an earlier link failed; not independently re-judged. |
| `FIRST_FAILURE` | fail | The earliest link where verification broke. |

## Trust dimensions

15 independent things a Shadow verifier can check. They are never collapsed into
one green. Kinds: `cryptographic`, `structural`, `human`, and `not_judged`.

- Cryptographic: `RECORD_INTEGRITY`, `DIGITAL_SIGNATURE`, `HASH_CHAIN`, `DICTIONARY_HASH`
- Structural: `PROFILE`, `SOURCE_RESOLUTION`, `EXTERNAL_ANCHOR`, `CLAIM_EVIDENCE_BINDING`, `DICTIONARY_VERSION`, `PERSONA_OUTPUT_INTEGRITY`, `SYNTHESIS_PROVENANCE`
- Not judged by the verifier: `ANALYTICAL_CORRECTNESS`, `POLICY_ADEQUACY`
- Human: `LEGAL_FAIRNESS_REVIEW`, `HUMAN_APPROVAL`

A story declares the subset it exercises in `trust_dimensions`; each scenario then
assigns a status per dimension.

## Forbidden mappings

Encoded as data (`FORBIDDEN_MAPPINGS`) so the compiler and the parity test can
assert none of them are implied:

| From | To | Why it is forbidden |
|---|---|---|
| `VERIFIED` | `TRUSTED` | Verifying a record is not a judgement that it deserves trust. |
| `VERIFIED` | `COMPLIANT` | An intact signed record is not a finding of compliance. |
| `MAJORITY` | `CORRECT` | How many perspectives agree is descriptive; it does not set correctness. |
| `COMPLIANCE_PERSONA` | `LEGAL_REVIEW_COMPLETE` | A compliance perspective running is not a completed human legal/fairness review. |

`FORBIDDEN_EQUIVALENCE_PHRASES` lists the concrete EN/zh phrases these collapses
would produce; `findForbiddenEquivalence(text)` scans rendered copy for them.

## Relations and entity kinds

`RELATION_TYPES` is a superset compatible with `shadow-3d-scene-v1` edges plus the
attestation/persona relations (`BINDS`, `ATTESTS`, `SYNTHESIZES_INTO`).
`ENTITY_KINDS` spans the three story domains (audit chain, reason-code
attestation, persona deliberation). The adapter maps `kind` → shape via
`design/shadow-spatial-tokens.json`; `kind` never sets colour.

## Helpers

`isStatus` / `isTrustDimension` / `isRelationType` / `isEntityKind`, plus
`statusMeta`, `trustDimensionMeta`, `assertNoForbiddenMapping(from, to)`, and
`findForbiddenEquivalence(text)`.
