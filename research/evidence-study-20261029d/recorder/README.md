# Recorder native-module applicability controls

This executes the source-only control proposed by the [third-family screening](../../evidence-study-20261029c/README.md). It does not reverse that screening's result: no eligible documented repaired acceptance defect was found. There is no new vulnerability or repaired-defect discovery here.

## What ran

- Official repository: [devhelmhq/mcp-recorder](https://github.com/devhelmhq/mcp-recorder).
- Fixed Git revision: `44803e1cb47d7d4bb0b8dbd490550a3367eff674`; its `pyproject.toml` reports **0.5.0**. This is a source revision, not an installed published-package comparison.
- Byte-unchanged original `_types.py` and `verifier.py` are imported and their real `run_verify` is called. An authored namespace package bypasses original `__init__.py`, whose client imports and package-version lookup are outside this execution lane. There is no extraction, statement rewriting, or monkeypatch of checker logic.
- Cassette inputs are validated by the original Pydantic models. The optional transport argument receives an authored duck type, not a real `HttpTransport` or `StdioTransport`. All RPC responses, lifecycle statuses and transport errors are authored.
- **11 authored cases: 10 verifier invocations and 1 prior cassette-validation rejection. All 11 expected native outcomes matched.** These are nested controls, not 11 independent defects. Seven additional event/report predicates check that the intended paths ran; they do not add tasks or defects.
- No CLI, package entry point, real transport, subprocess server, HTTP service, MCP SDK or full conformance suite ran. No packages were installed, no model/provider calls were made, and no external runtime traffic was used.

The five pinned imported-lane runtime packages are Pydantic and its transitive dependencies, recorded in `requirements.lock.txt` and the output. This is only the imported-module lane, **not a complete mcp-recorder dependency lock or historical environment**. Original `transport.py` and `__init__.py` are retained for provenance/readability but not imported.

## Observations and boundaries

| Authored case | Native result | Captured local mechanism evidence |
| --- | --- | --- |
| Lifecycle returns 200 | 1 passed / 0 failed | One `send_lifecycle` call, returned 200 |
| Unsupported lifecycle | 1 passed / 0 failed | No lifecycle call; native log says `lifecycle, skipped` |
| Matching RPC + skipped lifecycle | 2 passed / 0 failed | RPC was called; lifecycle was not |
| Lifecycle returns 500 | 1 passed / 0 failed | One lifecycle call returned 500; native loop does not compare it to cassette `response_status` |
| Lifecycle raises | No `VerifyResult`; `ConnectionError` escapes | Attempt and error retained; context exits |
| Matching RPC | 1 passed / 0 failed | Response compared by original diff logic |
| RPC response mismatch | 0 passed / 1 failed | Original content diff retained |
| RPC or notification transport error | Each 0 passed / 1 failed | Native diff says `transport error`; this alone does not prove product failure |
| Empty cassette | 0 total / 0 failed | Context entered/exited, no operation |
| Incompatible cassette major version | Pydantic `ValidationError` | No verifier invocation or transport entry |

**Lifecycle 200, lifecycle skipped and lifecycle 500 produce identical full native `VerifyResult` objects** (including their per-interaction fields). The original log and authored transport receipts distinguish them. For these inputs, a consumer that sees only `VerifyResult` cannot infer whether lifecycle was exercised or which status was returned. This is a bounded information-loss observation, not a measured production error rate or a new algorithm result.

[PR9](https://github.com/devhelmhq/mcp-recorder/pull/9) explicitly introduced skipping HTTP lifecycle interactions for stdio targets. That is legitimate transport applicability. If the consumer only requires matching the recorded RPC response, the HTTP skip can remain outside its obligation. If it requires an HTTP lifecycle request to have run, the skipped report cannot establish that requirement. If it requires a particular response status, even the native lifecycle pass is insufficient without the returned status. No HTTP requirement is imposed on stdio as a protocol rule here.

The 500-status control follows the unchanged current source, not a historical repair pair. We have not established whether status comparison is promised by the native tool's contract. It is therefore not counted as a confirmed native defect. Likewise, an authored transport error is an execution problem, not evidence of a faulty live server. The empty cassette is a legitimate empty selection.

## Provenance and reproducibility

`upstream-manifest.json` records exact byte sizes, SHA-256, Git blob SHA-1 and immutable source URLs for all six retained upstream files. `probe.py` verifies them before imports. The complete upstream MIT license is retained as `sources/LICENSE`.

`results.json` binds its driver, source manifest and dependency-pin file by SHA-256 and preserves full cassette inputs, fake-transport settings, original native objects, exceptions, logs and transport events. The expectations used to check probe construction stay in the authored driver and are not passed into the native verifier. They are not independently blinded human gold labels. Results are development controls after reading source, with no holdout evaluation or authenticated capture claim.

Run from the repository root in a fresh Python process with the pinned imported-lane dependencies:

```sh
python3 research/evidence-study-20261029d/recorder/probe.py
```

Tested with Python 3.12.14. Socket connect/connect_ex/bind, DNS/create_connection and `subprocess.Popen` are patched to raise throughout import and execution. A DNS-block positive control is asserted. These patches support the no-I/O probe boundary; they are not a general sandbox or a promise against arbitrary hostile code. The probe imports the standard library and installed Pydantic as usual and writes only the requested JSON output.

This adds execution of a third tool family as an **applicability control**. The repaired-defect corpus remains three known historical defects across two tool families, with different execution levels analyzed separately.
