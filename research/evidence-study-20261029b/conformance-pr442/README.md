# Official conformance PR442 — source-mechanism replay

Run date: 2026-10-29. This is a **known, merged upstream defect**, independent
of the mcp-contracts discovery-error case. It is a second tool family, not a new
bug discovery or a production failure-rate measurement.

## Upstream anchors

- Repository: `modelcontextprotocol/conformance`.
- [Issue439, item3](https://github.com/modelcontextprotocol/conformance/issues/439):
  capability check accepts `input_required` with absent/empty `inputRequests`.
- [PR442](https://github.com/modelcontextprotocol/conformance/pull/442), merged
  2026-09-06T18:29:22Z.
- Before: `c321dd32035556e6769d3724a8ee97d87c3faaac`.
- Fixed: `48561a1aeccd943f84da545d2cd29e940835f6b2`.
- Both source revisions declare package version `0.2.0-alpha.11`; this is a
  pinned **Git revision pair**, not two distinct npm package versions and not
  the published `0.1.16` empty-suite control used in another study.

The check is `InputRequiredResultCapabilityCheckScenario`, emitting the stable
ID `sep-2322-respect-client-capabilities`. It declares only `sampling` capability
and checks that the fixture does not request undeclared elicitation.

## Mechanism and result

Before the fix, absent `inputRequests` bypasses the scan; an empty map enters a
zero-iteration scan. Both produce no errors and native SUCCESS despite the
target restriction never being exercised.

The upstream fix deliberately does **not** label this a protocol violation.
Its `notTestable()` convention emits native FAILURE plus `details.untestable`
and a `Not testable:` message. A consumer must preserve the distinction between
an unverified requirement and an actually violated requirement.

| Authored response | Before | Fixed | Interpretation |
| --- | --- | --- | --- |
| Nonempty allowed sampling request | SUCCESS | SUCCESS | Healthy exercised control |
| Forbidden elicitation request | FAILURE | FAILURE | Capability violation control |
| Request state, no inputRequests | SUCCESS | FAILURE + untestable | Requirement not exercised; withhold |
| Request state and empty inputRequests | SUCCESS | FAILURE + untestable | Same failure mechanism, another input |
| Complete instead of requested fixture behavior | FAILURE | FAILURE | Fixture contract mismatch |
| JSON-RPC error | FAILURE | FAILURE | Execution-error control |
| Missing result | FAILURE | FAILURE | Missing-evidence control |

All **14 checker invocations** (7 inputs × 2 source revisions) matched the
predeclared native-status and untestable expectations. This is **one historical
defect**, not fourteen independent bugs or seven independent tasks. The two
non-exercised inputs are variants of the same defect. The requestState-only
envelope's protocol validity is the upstream fix's stated rationale; this
probe does not independently perform full protocol/schema conformance.

## Execution boundary

`probe.mjs` extracts the original scenario class and the actual
`isInputRequiredResult` / `isCompleteResult` guard functions from the pinned
source files. The fixed revision also uses its original `notTestable` function.
It removes only TypeScript/module syntax using Node's `stripTypeScriptTypes`;
the executable checker statements are not rewritten.

`sendRpc` is a controlled response stub. The protocol-version constant and
spec-reference array used for reporting are injected (`2026-07-28` and `[]`).
These substitutions do not alter the target predicates; they do mean that the
result is **not an upstream CLI run, HTTP transport test, real SDK execution,
full harness reproduction, or proof that a broken server passes the suite**.
The raw checks in `results.json` are outputs of this extracted-class execution.

Each invocation checks that the unchanged class actually calls the intended
fixture tool once and declares `{sampling:{}}`. Expected labels and support
categories stay outside the VM and are not provided to the checker. All cases
were authored after reading the fix, so they are development replays.

## Re-run

```sh
node probe.mjs
```

Tested on Node v24.22.1. There are no package installs, SDK dependencies,
provider credentials, external service calls or model calls. Node currently
warns that its TypeScript-stripping API is experimental.

`upstream-manifest.json` records the exact upstream Git blob SHA, byte size and
SHA256 for all retained source files. The driver verifies all of those before
execution; `results.json` binds the driver and manifest. A hash establishes
the source bytes used, not the truth of the source's claims or completeness of
an arbitrary execution capture.

## Source attribution and license

Files under `sources/` are unchanged source bytes from the upstream repository.
The complete upstream `LICENSE` is retained. It describes an ongoing transition
from MIT to Apache-2.0 and includes both license texts; no blanket all-MIT
claim is made. The pinned root lists no NOTICE file. The research driver is a
new wrapper and its transformations/substitutions are described above.

## Direct prior work relevant to the paper

[Conformance issue451](https://github.com/modelcontextprotocol/conformance/issues/451)
already requests expected-versus-emitted coverage per scenario and is open as
of this research retrieval. It is a direct upstream precedent for the broader
coverage problem, not a new contribution claimed here. This replay validates
a particular historical prerequisite case; it does not establish a new
general coverage method.
