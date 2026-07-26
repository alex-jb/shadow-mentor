# Decision Signing and Package Boundary

Status: discovery only.

## Which exact bytes are signed

Two nested, already-proven layers — no new signing primitive:

1. **Decision member bytes** — `decision/decision-amendment.json` is written
   canonically (`shadow-canon/1` canonicalization, NFC UTF-8). Its SHA-256 is
   recorded in the manifest `assets[]` entry
   `{path, role: "decision", schema_version: "shadow-decision-amendment/1", byte_size, sha256}`.
2. **Manifest signature** — the existing Ed25519 signature over
   `canonicalize(manifest minus signature)` (`signedBytesOf`) covers the
   member hash, the `supersedes` block, `case_id`, bindings, capability
   tokens, producer, and signing metadata.

Therefore every decision field — actor, reason text, target hash, policy
flags, status tokens, `decided_at_utc` — is inside the tamper-evidence net,
and the decision member is a **signed package member**, hash-bound through
the manifest exactly like presentation/evidence/provenance. The member does
not carry an inner signature of its own in the first increment (one envelope,
one verifier); a future countersignature (maker/checker) would be a
`shadow-decision-amendment/2` addition and is out of scope.

## Identity and reference placement

- **Actor identity: inside the signed payload** (member bytes). Tampering →
  member hash mismatch → `DECISION_PACKAGE_TAMPERED`.
- **Authorization evidence: externally referenced only** — optional
  `authorization_ref` (opaque reference + expected hash) inside the signed
  bytes; the referenced record never embeds.

## Derivations and bindings

| Item | Rule |
|---|---|
| Decision ID | `sha256hex(member_sha256 + "\n" + predecessor_package_id + "\n" + predecessor_manifest_sha256)` — content-derived like `package_id`, so identical decision content against a different predecessor yields a different ID. No randomness, no wall clock. |
| Target object identity | `target.object_hash_sha256` over the exact target bytes in the predecessor; verifier re-hashes and compares (`TARGET_OBJECT_MISMATCH`). |
| Predecessor package | Unchanged `shadow-package-supersession/1` fields: `predecessor_package_id` + `predecessor_manifest_sha256` (file bytes incl. signature) — the strictest existing binding (whitespace-level). |
| Case / session | Existing manifest `case_id` + `bindings.evidence_session_id` + supersedes same-case rule (enforced at assembly, standalone verify, and chain level — three existing checkpoints, reused). |
| Decision type/version | `decision_schema: "shadow-decision-amendment/1"` + `decision_type` inside signed member bytes; the manifest `assets[]` entry pins the member `schema_version` — both signed. |
| Reason text/code | Inside signed member bytes; size bounds re-checked at verification. |

## Replay and substitution prevention

- **Cross-case substitution**: decision bytes are bound to
  `predecessor_manifest_sha256` (which commits to the predecessor's case) and
  the successor manifest's own `case_id`; the existing `CASE_MISMATCH` checks
  fire on any splice. Presenting the same decision member in another case's
  package changes the manifest → new signature required → fixture-key caveat
  below.
- **Decision replay**: identical decision content re-presented against the
  same predecessor re-derives the same `decision_id` → `DUPLICATE_DECISION`
  if bytes differ, idempotent duplicate if identical (same handling as the
  existing package `duplicate`/`conflict` distinction in Web).
- **Honest limit (carried from the supersession security boundary):** fixture
  keys are public by design; a key holder can forge coherent packages *and*
  coherent decisions. The boundary detects broken bindings, not dishonest
  signers. Package-level fixture signing is **sufficient for demo decisions
  precisely because** the signed bytes include `FIXTURE_DECISION_ONLY` and
  the identity/authority annotations — the artifact honestly states what it
  cannot prove.

## Role separation (never collapsed)

| Role | Definition | Identified by |
|---|---|---|
| Package signer | Holder of the package signing key; proves tamper-evidence | key fingerprint / `key_label` / `key_provenance` |
| Decision actor | The human whose decision the member asserts | `actor` block (operator-declared in fixture mode) |
| Decision authority | The (unverified) claim that the actor may decide | `authorization_ref` + authority annotations |
| Verifier | Whoever runs the verification tooling | not represented in artifacts |
| Importing operator | Whoever loads the package into Web/CLI | not represented in artifacts; local-only observations (`verifiedAtLocal`) stay out of evidence |

No inference is permitted from any row to any other.
