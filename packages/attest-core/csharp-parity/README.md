# C# canonical-byte parity harness (aex-attestation/v2)

Standalone proof that a **C# runtime reproduces the exact `aex-attestation/v2` canonical signing bytes,
SHA-256, and HMAC** produced by Node (`packages/attest-core/attestation-v2.js`) and the browser verifier.

It reads the shared golden vector at `packages/attest-core/golden/v2-golden-vectors.json` and recomputes
`canonical_text`, `utf8_hex`, `sha256_hex`, and the HMAC signature, asserting byte-for-byte equality.

## Why it is here and not in Unity

This directory is **outside** `apps/shadow-lens/unity/Assets/` deliberately. It is a parity *harness*, not
part of the Unity app — keeping it out of the Assets tree means the frozen APK and the Unity build are
untouched by this security work.

## Run status

- **Authored + byte-pinned against the golden vector.** The C# canonicalizer mirrors `canonicalize()`'s
  sorted-key rule and RFC 8259 string escaping; the v2 envelope is deliberately a flat sorted object plus
  one sorted `bindings` object with only string / `null` values, so the hand-written serializer is exact
  without a JSON dependency.
- **Not executed in the CI environment that produced this branch** (no .NET SDK present there). Run it
  wherever a .NET SDK is available:

```bash
cd packages/attest-core/csharp-parity
dotnet run    # exit 0 = parity, prints "C# PARITY OK — reproduces Node golden vector byte-for-byte"
```

Minimal `csproj` (net8.0, no external packages — `System.Text.Json` + `System.Security.Cryptography` are
in the BCL):

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>
```

## Expected output (pinned)

For the committed golden vector the C# harness must print:

```
sha256_hex = 65963b695099b75607e35c555335c70a66adad3d1a5cb3d3a117644e0e113707
```

If the golden vector is regenerated (an intentional v2 format change → wire-version bump), rerun
`node scripts/gen-v2-golden.mjs` and update this pinned value.
