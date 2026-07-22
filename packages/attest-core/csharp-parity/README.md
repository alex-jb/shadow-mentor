# C# canonical-byte parity harness (aex-attestation/v2)

Proof that a **C# runtime reproduces the shared `canonicalize()` signing bytes, SHA-256, and HMAC**
produced by Node and the browser verifier — byte-for-byte, across the full Unicode/escaping/ordering
matrix. This is the cross-runtime contract for attestation signing.

## Run status — EXECUTED in Unity (not just authored)

Ran as an isolated **EditMode** test assembly (`ShadowAttest.Parity.Tests`) against the installed **Unity
6000.0.23f1** editor in batch mode. The assembly references only the Unity test framework — **no XREAL SDK,
no XR runtime init** — so it compiles and runs without the licensed SDK.

- **Result: 4/4 tests passed, 0 failed** over **19 edge vectors** each.
- Evidence: [`evidence/editmode-results.xml`](evidence/editmode-results.xml) (NUnit result XML) +
  [`evidence/run-log-excerpt.txt`](evidence/run-log-excerpt.txt).

Test methods (each iterates all 19 vectors): `CSharpCanonicalTextParity`, `CSharpUtf8ByteParity`,
`CSharpDigestParity`, `CSharpV2HmacParity`. Edge vectors cover ASCII, Simplified Chinese, emoji/surrogate
pairs, `null`, absent optional binding, nested key ordering, escaped quote, backslash, newline, tab,
U+2028, U+2029, control chars, arrays, booleans, integers, top-level primitives, and a full v2 envelope.
Each asserts exact equality of **canonical text · UTF-8 byte length · UTF-8 byte hex · SHA-256**.

Reproduce:
```bash
UNITY=/Applications/Unity/Hub/Editor/6000.0.23f1/Unity.app/Contents/MacOS/Unity
# minimal project: Assets/ = CanonicalJson.cs + AttestationV2Canonical.cs + CanonicalGoldenVectorTests.cs
#   + ShadowAttest.Parity.Tests.asmdef + canonicalize-golden-vectors.json + v2-golden-vectors.json
#   Packages/manifest.json = { "com.unity.test-framework": "1.4.5", "testables": ["ShadowAttest.Parity.Tests"] }
"$UNITY" -batchmode -projectPath <proj> -runTests -testPlatform EditMode -testResults results.xml -logFile unity.log
```

## Files

| File | Role |
|---|---|
| `CanonicalJson.cs` | **dependency-free** canonicalize mirror + minimal JSON reader (Unity harness) |
| `AttestationV2Canonical.cs` | v2-envelope + HMAC/SHA helpers (Unity harness) |
| `CanonicalGoldenVectorTests.cs` | NUnit EditMode tests (Unity harness) |
| `ShadowAttest.Parity.Tests.asmdef` | isolated Editor test assembly, no XREAL refs |
| `Program.cs` | OPTIONAL `dotnet run` harness (uses `System.Text.Json`; **not** part of the Unity harness — do not compile it inside Unity) |

## Why hand-rolled escaping

`CanonicalJson.cs` reproduces JavaScript `JSON.stringify` string escaping exactly: U+2028/U+2029 pass
through literally and non-ASCII is not escaped. `System.Text.Json` / Newtonsoft escape those and would
**drift** — which is precisely why parity had to be executed, not argued.
