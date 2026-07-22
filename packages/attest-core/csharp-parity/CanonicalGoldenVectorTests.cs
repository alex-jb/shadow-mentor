// EditMode test: prove the C# canonicalizer reproduces the committed cross-runtime golden vectors
// byte-for-byte. Runs with NO XREAL SDK, NO XR runtime init, and NO external JSON library — it references
// only the test framework + the pure-C# canonicalizer, so it executes in Unity batch mode with just the
// BCL. For every vector it asserts EXACT equality of canonical JSON text, UTF-8 byte length, UTF-8 byte
// hex, and SHA-256 digest — never parsed-object-only or hash-only comparison.
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using ShadowAttest.Parity;
using UnityEngine;

namespace ShadowAttest.Parity.Tests
{
    public class CanonicalGoldenVectorTests
    {
        static Dictionary<string, object> LoadVectors()
        {
            string path = Path.Combine(Application.dataPath, "canonicalize-golden-vectors.json");
            Assert.IsTrue(File.Exists(path), "golden vectors not found at " + path);
            var root = (Dictionary<string, object>)CanonicalJson_ParseTree(File.ReadAllText(path));
            return (Dictionary<string, object>)root["vectors"];
        }

        static object CanonicalJson_ParseTree(string raw)
        {
            int i = 0;
            var v = Json.ParseValue(raw, ref i);
            return v;
        }

        [Test]
        public void CSharpCanonicalTextParity()
        {
            foreach (var kv in LoadVectors())
            {
                var vec = (Dictionary<string, object>)kv.Value;
                string got = CanonicalJson.Canonicalize(vec["input"]);
                Assert.AreEqual((string)vec["canonical_text"], got, "canonical_text mismatch for vector: " + kv.Key);
            }
        }

        [Test]
        public void CSharpUtf8ByteParity()
        {
            foreach (var kv in LoadVectors())
            {
                var vec = (Dictionary<string, object>)kv.Value;
                byte[] bytes = CanonicalJson.Utf8(CanonicalJson.Canonicalize(vec["input"]));
                Assert.AreEqual(((RawNumber)vec["utf8_len"]).Text, bytes.Length.ToString(), "utf8_len mismatch: " + kv.Key);
                Assert.AreEqual((string)vec["utf8_hex"], CanonicalJson.ToHex(bytes), "utf8_hex mismatch: " + kv.Key);
            }
        }

        [Test]
        public void CSharpDigestParity()
        {
            foreach (var kv in LoadVectors())
            {
                var vec = (Dictionary<string, object>)kv.Value;
                byte[] bytes = CanonicalJson.Utf8(CanonicalJson.Canonicalize(vec["input"]));
                Assert.AreEqual((string)vec["sha256_hex"], CanonicalJson.Sha256Hex(bytes), "sha256 mismatch: " + kv.Key);
            }
        }

        // Bonus: the v2 envelope golden vector's HMAC also reproduces in C# (bytes match => HMAC matches).
        [Test]
        public void CSharpV2HmacParity()
        {
            string path = Path.Combine(Application.dataPath, "v2-golden-vectors.json");
            if (!File.Exists(path)) { Assert.Ignore("v2-golden-vectors.json not present in harness"); return; }
            var root = (Dictionary<string, object>)CanonicalJson_ParseTree(File.ReadAllText(path));
            byte[] bytes = CanonicalJson.Utf8((string)root["canonical_text"]);
            Assert.AreEqual((string)root["sha256_hex"], CanonicalJson.Sha256Hex(bytes), "v2 sha mismatch");
            var hmac = (Dictionary<string, object>)root["hmac_sha256"];
            Assert.AreEqual((string)hmac["signature_hex"], AttestationV2Canonical.HmacSha256Hex(bytes, (string)hmac["secret"]), "v2 HMAC mismatch");
        }
    }
}
