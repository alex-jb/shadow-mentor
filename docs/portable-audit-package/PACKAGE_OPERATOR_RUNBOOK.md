# Operator runbook — fixture and operator portable audit packages

Both producer paths package an **existing sealed evidence bundle**. Neither captures hooks, starts
an Agent, calls a model or re-seals evidence. Packaging succeeds only after independent evidence
verification and package self-verification. It does not establish complete capture, provider
authenticity, analytical correctness or human/business approval.

## Produce the canonical fixture package

```bash
node bin/shadow-audit-package.mjs create --fixture banking --output-dir ./fixture-package
# or: npm run audit:package -- create --fixture banking --output-dir ./fixture-package
```

`create` retains the established fixture interface and `key_provenance=fixture`. Defaults use the
committed banking narrative and reference evidence/public key. Successful verification reports
`VERIFIED_FIXTURE_KEY`; this is a demo-key verdict, not operator or production signing. An existing
sealed bundle may be supplied with `--evidence` and `--evidence-public-key`, but this command still
produces a fixture-signed package. Never use it to relabel live evidence as a fixture.

## Produce a standalone operator package

Keep the input narrative, sealed bundle, evidence public key and operator package signing pair
outside the output directory. Supply all eight required values explicitly:

```bash
node bin/shadow-audit-package.mjs create-operator \
  --narrative ./inputs/narrative.json \
  --source 'operator:local-run-with-unverified-origin' \
  --evidence ./inputs/sealed-bundle.json \
  --evidence-public-key ./inputs/evidence-public.pem \
  --package-private-key ./keys/operator-private.pem \
  --package-public-key ./keys/operator-public.pem \
  --built-at '2026-10-02T00:00:00.000Z' \
  --output-dir ./operator-package \
  --build-commit unknown --json
```

Replace the source and timestamp with accurate operator declarations. `built_at` must be an
explicit ISO 8601 timestamp with a timezone; it is not an observed capture time. Source must be
non-empty, trimmed, at most 1,024 characters and contain no control characters. Neither field is
independently authenticated. Optional flags are `--attestation`, `--build-commit`,
`--allow-identity-ref`, `--force` and `--json`. There are no fixture, key or time defaults.

The operator entry point produces `shadow-portable-audit-package/1.0` only. It fixes provenance to
`operator` and uses `OPERATOR PROVIDED KEY — identity and authority unverified`; callers cannot
provide a production label or supersession link through this entry point. The signed provenance
member records signer identity/provider origin/capture completeness as `UNVERIFIED`, source as
`OPERATOR_DECLARED` and business approval as `NOT_INFERRED`.

API callers use `assembleOperatorPackage` in
[the package library](../../lib/portable-audit-package.mjs); `assemblePackage` remains fixture-only.
The API returns an in-memory member map and manifest. The CLI owns directory writing and the final
independent package self-verification before publishing the output directory.

### Supported narrative input

`--narrative` is a JSON narrative object read by the existing
[Flow producer](../../apps/shadow-lens/flow/flow-export-contract.mjs), not a hook transcript or an
already flattened `shadow-flow-export/1.0` file. It must provide the supported
[BANKING_NARRATIVE shape](../../apps/shadow-lens/fixtures/banking-narrative.mjs):

| Field                          | Supported presentation inputs                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `case_id`, `fixture_timestamp` | Case identity and existing deterministic presentation timestamp                                |
| `council[]`                    | `voice`, `stance`, `confidence`                                                                |
| `metrics[]`                    | `name`, `value`, `category`                                                                    |
| `evidence[]`                   | `evidence_id`, `label`                                                                         |
| `relationships[]`              | `from`, `to`, `type`; endpoints must resolve to a council voice or evidence ID                 |
| `decision`                     | `recommendation`, `compliance_status`, `signed_result_status`, `audit_reference`, `mode_label` |

The four arrays must exist; the exported row set must be non-empty, have unique row identities and
pass existing Flow validation. Narrative labels and values remain presentation declarations;
changing the outer signing key never promotes them to measured model output. The legacy field name
`fixture_timestamp` remains unchanged; the producer does not replace it with `built_at`.

For a controlled demonstration, serialize the committed narrative and keep its fixture label:

```bash
mkdir -p ./inputs
node --input-type=module -e 'import { BANKING_NARRATIVE } from "./apps/shadow-lens/fixtures/banking-narrative.mjs"; console.log(JSON.stringify(BANKING_NARRATIVE, null, 2));' > ./inputs/narrative.json
```

Its `decision.mode_label: "FIXTURE MODEL"` is preserved in the operator-signed presentation. An
operator key around synthetic presentation/evidence does not turn those inputs into a provider
session. Missing first-failure, downstream, approval or physical-validation claims are not invented.

### Two signing roles

The package private/public pair must be readable, matching **Ed25519** keys; the public input must
contain public-key material only. A mismatched/non-Ed25519 pair or the known fixture release key is
rejected. Use a separate operator package pair from the evidence signing pair. The package
fingerprint binds the outer manifest, while `--evidence-public-key` independently verifies the
original inner bundle. Passing one signature check cannot replace the other.
The evidence public input must also be public-only Ed25519 SPKI PEM. Evidence and optional
attestation inputs must be valid UTF-8 JSON; rejected content is not echoed in those parse diagnostics.

Only public key halves enter the package. The producer reads the supplied private file for signing;
it does not write, print or embed that private material. Keep private input files outside exported
package directories. Evidence bytes are preserved exactly, including original JSON formatting;
verification does not authorize rewriting, normalizing or re-sealing them.

## Verify independently

```bash
node bin/shadow-audit-package.mjs verify --package ./operator-package --json
node bin/shadow-audit-package.mjs verify --package ./fixture-package --json
```

Successful operator verification reports `ok: true`, `verdict: VERIFIED` and
`key_provenance: operator`; fixture success remains `VERIFIED_FIXTURE_KEY`. Exit `0` reports
integrity under the verifying keys, not signer identity or production readiness. Failure exits `1`
with named failure codes. Web maps supported operator 1.0 success to `VERIFIED_OPERATOR_KEY`;
production and operator 1.1/1.2 remain unsupported by its admission policy.

To pin a key obtained independently, use its public PEM and compare the full signed fingerprint:

```bash
node bin/shadow-audit-package.mjs verify --package ./operator-package \
  --public-key ./independent-copy/operator-public.pem --json
```

An embedded self-declared key only establishes integrity under that key. An out-of-band fingerprint
comparison supplies a separate key-pinning step; it still does not establish that every provider
hook was captured or that the declared source is authentic.

## Output and input guards

By default, an existing output directory is refused. `--force` explicitly replaces an existing
output only after input validation/assembly; operator creation refuses any output directory that
contains an input file, including a signing key or optional attestation. The containment check
resolves existing ancestors and path aliases so that a symlink alias cannot authorize deleting
original inputs. Choose a fresh sibling output directory rather than moving inputs inside it.

Assembly validates before writing; successful output uses a temporary directory and rename. Never
add files or edit package members afterward: verification checks both declared and supplied files.
Changed evidence, public keys or provenance require a new package, not an in-place repair.

## Common failures

| Symptom                                           | Meaning                                                                   | Action                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Create exit `2`                                   | Missing, duplicate or unsupported operator argument                       | Check `--help`; supply every required value once                              |
| Create exit `3`, existing output                  | Output already exists                                                     | Choose a new output, or explicitly use `--force` within the containment guard |
| Create exit `3`, output contains an input         | Replacement could erase original input/key material                       | Use an output directory outside all inputs                                    |
| Create exit `3`, key pair/source/time error       | Operator declaration or signing inputs violate the explicit contract      | Correct the supplied values; do not change provenance to bypass checks        |
| Create exit `3`, evidence verification failure    | Existing bundle or evidence key is invalid                                | Obtain the original bundle and its correct public key                         |
| Create exit `3`, `NOT_PORTABLE`                   | Evidence or attestation is outside the supported portable Ed25519 profile | Obtain a supported portable artifact from its producer                        |
| Create exit `4`                                   | Assembly failed self-verification                                         | Inspect the declared member contract; no package is accepted                  |
| Verify exit `1`, `TAMPERED` / `UNEXPECTED_MEMBER` | Member bytes changed or undeclared files were supplied                    | Obtain the original package; do not clean it up and accept it                 |
| Verify exit `1`, `VERIFIER_DISAGREEMENT`          | Shipped derived result differs from independent verification              | Trust independent re-derivation; the shipped result is a convenience view     |

Evidence carrying `header.agent.identity_ref` is refused unless `--allow-identity-ref` explicitly
opts into permanently including that disclosure in the portable artifact. The CLI remains offline;
it requires local signing files, no provider credentials and no network. Real capture, interruptions
and sealed-session resume need separate acceptance; see the [next increment](NEXT_IMPLEMENTATION_INCREMENT.md).
