# Actor and Authorization Model

Status: discovery only.

## Starting point (from inventory)

Core today has no actor model: `reviewer_id` is an optional unverified free
string (Lens defaults it to `"reviewer-1"`); `header.agent.identity_ref` is a
bare handle; the only "named human signer" precedent is a block of literal
`"PLACEHOLDER"` strings in `lib/schemas/reason-code-dictionary.json`; the
control plane's approver fields are free text. Everything below is therefore
designed, not extended.

## Field-by-field determination

| Field | Class | Notes |
|---|---|---|
| `actor_id` | **Signed operator assertion** | Required. Namespaced: `fixture:<slug>` in fixture mode; future `authenticated:<scheme>:<id>`. Never treated as factual identity in fixture mode. |
| `display_name` | **Display-only metadata, but carried inside signed bytes** | Signed so it cannot be swapped in transit; still an assertion, not a fact. Size-bounded (≤128 bytes). |
| `role` | **Signed operator assertion** | Closed set: `reviewer`, `approver`. Anything else is `ACTOR_ROLE_UNSUPPORTED`. |
| `organization` / tenant | **Signed operator assertion** | Coarse slug only (privacy model). Optional. |
| `authorization_profile` | **External authorization reference** | Optional `authorization_ref` (opaque string/URI + hash). Never embedded content. Absent in fixture mode. |
| `key_identity` (key_id, fingerprint) | **Signed factual identity of the *signer*** | The only factual identity in the system today — and it identifies a key, not a person. |
| `decision_authority_scope` | **Signed operator assertion** | Optional bounded statement of claimed scope (e.g. `case-2026-Q3-*`). Displayed as claimed, never enforced in fixture mode. |
| `authentication_method` | **Not supportable in the current prototype** | Field reserved (`identity_class` covers the distinction); no authentication exists. |
| `evidence_of_authorization` | **External authorization reference / not supportable now** | Placeholder `authorization_ref`; production shape unknown until an authorization source exists. |
| `separation_of_duties` | **Signed operator assertion (policy declaration)** | `enforced` / `not_enforced` declared per decision; fixture mode may only declare `not_enforced` truthfully unless validating declared policy internally. |
| `fixture_identity` | **Signed factual statement about identity *class*** | `identity_class: operator_declared` is a fact (it truthfully states the class), even though the identity content is an assertion. |
| `production_identity` | **Not supportable** | Requires authentication + authorization backends (workflow Option E). |
| `employee ID` / `email` | **Security-sensitive; excluded** | Not in portable packages (privacy model). |

## Required answers

**Does an Ed25519 key identify a reviewer, or only a signer?**
Only a signer. The fixture key is repo-committed — anyone can sign. Even a
production key identifies "holder of the key," which is an organization or
service, not necessarily the human named in the actor block. The contract
therefore separates `signing` (package integrity) from `actor` (decision
attribution) permanently, and no verifier may derive actor identity from key
identity.

**How is reviewer identity bound to the package?**
The actor block lives inside the signed decision member; the member's SHA-256
is bound in the signed manifest. Tampering with the actor block breaks member
hash → `DECISION_PACKAGE_TAMPERED`; re-signing requires the package key. So
identity *assertions* are tamper-evident even though they are not verified.

**How is decision authority proven?**
Today: it is not, and the contract must say so. `authorization_ref` reserves
the slot for a future external authorization record (workflow Option E). Until
then every decision carries `DECISION_AUTHORITY_UNVERIFIED`.

**Can fixture mode honestly support only operator-declared actors?**
Yes — and only that. `identity_class: operator_declared` is required on every
fixture actor; the value `authenticated` is defined but unreachable in fixture
mode (parallel to `KEY_PROVENANCES` where `operator`/`production` exist but
are unreachable).

**What should Web display when identity is declared but not externally verified?**
The verbatim tokens `DECISION_IDENTITY_DECLARED_NOT_VERIFIED` and
`DECISION_AUTHORITY_UNVERIFIED` as chips adjacent to the actor name, equal in
visual weight to the name itself; never checkmark iconography, never
collapsed into the package-integrity badge (DECISION_WEB_HANDOFF.md).

**What must remain unavailable until authentication/authorization exists?**
- `identity_class: authenticated`
- any non-`UNVERIFIED` authority status
- separation-of-duties *enforcement* claims
- production approval semantics (`FIXTURE_DECISION_ONLY` remains mandatory)
- any UI copy suggesting personnel verification

## Anti-patterns (forbidden)

- Labeling operator-declared fixture identity as verified personnel identity.
- Inferring role or authority from `display_name`, organization, or key label.
- Using reviewer names as tiebreakers in conflict resolution.
- Deriving "same actor" for separation-of-duties checks from display names —
  the check compares `actor_id` values only, and its result is qualified by
  the declared (unenforced) policy.
