// Parity check: reproduce the committed golden vector from C# and assert byte-for-byte equality with
// Node's output. Exit 0 on parity, 1 on mismatch. See README.md for how to run.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using ShadowAttest.Parity;

class Program
{
    static int Main()
    {
        // golden vector lives two dirs up: packages/attest-core/golden/v2-golden-vectors.json
        string goldenPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "golden", "v2-golden-vectors.json"));
        if (!File.Exists(goldenPath)) goldenPath = "../golden/v2-golden-vectors.json"; // fallback for `dotnet run` cwd
        using var doc = JsonDocument.Parse(File.ReadAllText(goldenPath));
        var root = doc.RootElement;
        var input = root.GetProperty("envelope_input");

        var bindings = new Dictionary<string, string>();
        foreach (var b in input.GetProperty("bindings").EnumerateObject())
            bindings[b.Name] = b.Value.GetString();

        string prev = input.GetProperty("previousHash").ValueKind == JsonValueKind.Null
            ? null : input.GetProperty("previousHash").GetString();

        // The golden vector normalizes completed_at_utc to the ...Z millisecond form; C# must sign THAT
        // exact stored value (read it back from the envelope, not the raw input).
        string completedAt = root.GetProperty("envelope").GetProperty("completed_at_utc").GetString();

        string canonical = AttestationV2Canonical.CanonicalText(
            input.GetProperty("algorithm").GetString(),
            input.GetProperty("requestCommitment").GetString(),
            input.GetProperty("outputCommitment").GetString(),
            input.GetProperty("modelId").GetString(),
            completedAt, prev,
            input.GetProperty("keyId").GetString(),
            bindings);

        byte[] bytes = AttestationV2Canonical.SigningBytes(canonical);
        string sha = AttestationV2Canonical.Sha256Hex(bytes);
        string hmac = AttestationV2Canonical.HmacSha256Hex(bytes, root.GetProperty("hmac_sha256").GetProperty("secret").GetString());

        int fails = 0;
        fails += Check("canonical_text", canonical, root.GetProperty("canonical_text").GetString());
        fails += Check("utf8_hex", ToHex(bytes), root.GetProperty("utf8_hex").GetString());
        fails += Check("sha256_hex", sha, root.GetProperty("sha256_hex").GetString());
        fails += Check("hmac_sha256", hmac, root.GetProperty("hmac_sha256").GetProperty("signature_hex").GetString());

        Console.WriteLine(fails == 0 ? "C# PARITY OK — reproduces Node golden vector byte-for-byte" : $"C# PARITY FAILED ({fails} mismatches)");
        return fails == 0 ? 0 : 1;
    }

    static int Check(string label, string got, string want)
    {
        if (got == want) { Console.WriteLine($"  ok   {label}"); return 0; }
        Console.WriteLine($"  FAIL {label}\n    got : {got}\n    want: {want}");
        return 1;
    }

    static string ToHex(byte[] b)
    {
        var sb = new System.Text.StringBuilder(b.Length * 2);
        foreach (var x in b) sb.Append(x.ToString("x2"));
        return sb.ToString();
    }
}
