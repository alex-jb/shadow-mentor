// AttestationV2Canonical — C# reproduction of the aex-attestation/v2 canonical signing bytes.
//
// This is a STANDALONE parity harness. It lives OUTSIDE apps/shadow-lens/unity/Assets on purpose so it
// is NOT part of the Unity build / frozen APK. Its only job is to prove that a C# runtime reproduces the
// exact same canonical UTF-8 bytes + SHA-256 as Node and the browser verifier, against the committed
// golden vector at packages/attest-core/golden/v2-golden-vectors.json.
//
// The v2 canonical form is deliberately simple so it is portable without a JSON library dependency:
//   * a flat object with sorted string keys,
//   * plus one nested "bindings" object (also sorted string keys),
//   * string values (escaped per RFC 8259) and the single literal null for a chain head.
// No numbers, no arrays, no nested objects beyond bindings — so this hand-written serializer is exact.
//
// Run (when a .NET SDK is available):  see Program.cs / README.md in this directory.
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

namespace ShadowAttest.Parity
{
    public static class AttestationV2Canonical
    {
        public const string Domain = "shadow-attestation";
        public const string WireVersion = "aex-attestation/v2";

        // Serialize a value that is either a string, null, or the bindings dictionary, matching
        // JSON.stringify's output for these constrained types (v2 forbids control chars in idents and
        // uses lowercase-hex hashes + RFC3339 timestamps, so escaping is minimal but done correctly).
        private static string JsonString(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        // Build the canonical (sorted-key) JSON text of the v2 envelope. `previousHash` null => literal null.
        public static string CanonicalText(
            string algorithm, string requestCommitment, string outputCommitment,
            string modelId, string completedAtUtc, string previousHash, string keyId,
            IDictionary<string, string> bindings)
        {
            // top-level keys, sorted lexicographically (matches canonicalize()'s Object.keys().sort())
            var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
            {
                ["algorithm"] = JsonString(algorithm),
                ["completed_at_utc"] = JsonString(completedAtUtc),
                ["domain"] = JsonString(Domain),
                ["key_id"] = JsonString(keyId),
                ["model_id"] = JsonString(modelId),
                ["output_commitment"] = JsonString(outputCommitment),
                ["previous_hash"] = previousHash == null ? "null" : JsonString(previousHash),
                ["request_commitment"] = JsonString(requestCommitment),
                ["wire_version"] = JsonString(WireVersion),
            };
            // nested bindings object, sorted keys
            var b = new StringBuilder("{");
            var bkeys = new List<string>(bindings.Keys);
            bkeys.Sort(StringComparer.Ordinal);
            for (int i = 0; i < bkeys.Count; i++)
            {
                if (i > 0) b.Append(',');
                b.Append(JsonString(bkeys[i])).Append(':').Append(JsonString(bindings[bkeys[i]]));
            }
            b.Append('}');
            fields["bindings"] = b.ToString();

            var sb = new StringBuilder("{");
            bool first = true;
            foreach (var kv in fields)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append(JsonString(kv.Key)).Append(':').Append(kv.Value);
            }
            return sb.Append('}').ToString();
        }

        public static byte[] SigningBytes(string canonicalText) => Encoding.UTF8.GetBytes(canonicalText);

        public static string Sha256Hex(byte[] bytes)
        {
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(bytes);
            var sb = new StringBuilder(hash.Length * 2);
            foreach (var x in hash) sb.Append(x.ToString("x2"));
            return sb.ToString();
        }

        public static string HmacSha256Hex(byte[] bytes, string secret)
        {
            using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var sig = h.ComputeHash(bytes);
            var sb = new StringBuilder(sig.Length * 2);
            foreach (var x in sig) sb.Append(x.ToString("x2"));
            return sb.ToString();
        }
    }
}
