// CanonicalJson — a DEPENDENCY-FREE C# reproduction of the shared canonicalize() used by attestation
// signing (packages/attest-core/attestation.js). Byte-for-byte identical output to the JS function is the
// cross-runtime contract; parity is proven by the golden-vector EditMode test against
// packages/attest-core/golden/canonicalize-golden-vectors.json.
//
// It uses NO external JSON library (Unity's default .NET Standard 2.1 profile ships neither
// System.Text.Json nor Newtonsoft), so it runs in Unity batch mode with only the BCL. It hand-rolls both
// a tiny JSON reader AND the JS-JSON.stringify string escaper — the escaper matching JavaScript exactly is
// the whole point: System.Text.Json / Newtonsoft escape non-ASCII + U+2028/U+2029 and would DRIFT.
//
// JS canonicalize():
//   null/primitive -> JSON.stringify(value)
//   array          -> "[" + items.map(canonicalize).join(",") + "]"
//   object         -> sorted keys; "{" + keys.map(k => JSON.stringify(k)+":"+canonicalize(v[k])).join(",") + "}"
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace ShadowAttest.Parity
{
    // A number kept as its original JSON token text, so we emit it verbatim (matches JSON.stringify for the
    // integer/simple values used in v2 envelopes + golden vectors; no float reformatting drift).
    public struct RawNumber { public string Text; public RawNumber(string t) { Text = t; } }

    public static class CanonicalJson
    {
        // ── JS JSON.stringify string escaping ──
        public static string JsEscape(string s)
        {
            var sb = new StringBuilder(s.Length + 2);
            sb.Append('"');
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
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);   // literal: non-ASCII, U+2028/U+2029, surrogate halves all pass through
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }

        // ── canonicalize an already-parsed tree (null / bool / string / RawNumber / List / Dictionary) ──
        public static string Canonicalize(object v)
        {
            if (v == null) return "null";
            if (v is bool b) return b ? "true" : "false";
            if (v is string s) return JsEscape(s);
            if (v is RawNumber n) return n.Text;
            if (v is List<object> arr)
            {
                var parts = new List<string>(arr.Count);
                foreach (var item in arr) parts.Add(Canonicalize(item));
                return "[" + string.Join(",", parts) + "]";
            }
            if (v is Dictionary<string, object> obj)
            {
                var keys = new List<string>(obj.Keys);
                keys.Sort(StringComparer.Ordinal);   // UTF-16 code-unit order == JS Object.keys().sort()
                var parts = new List<string>(keys.Count);
                foreach (var k in keys) parts.Add(JsEscape(k) + ":" + Canonicalize(obj[k]));
                return "{" + string.Join(",", parts) + "}";
            }
            throw new InvalidOperationException("unsupported node type: " + v.GetType());
        }

        public static string Canonicalize(string rawJson)
        {
            int i = 0;
            object tree = Json.ParseValue(rawJson, ref i);
            Json.SkipWs(rawJson, ref i);
            if (i != rawJson.Length) throw new FormatException("trailing content at " + i);
            return Canonicalize(tree);
        }

        public static byte[] Utf8(string canonicalText) => Encoding.UTF8.GetBytes(canonicalText);

        public static string ToHex(byte[] b)
        {
            var sb = new StringBuilder(b.Length * 2);
            foreach (var x in b) sb.Append(x.ToString("x2", CultureInfo.InvariantCulture));
            return sb.ToString();
        }

        public static string Sha256Hex(byte[] bytes)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            return ToHex(sha.ComputeHash(bytes));
        }
    }

    // Minimal recursive-descent JSON reader → null / bool / string / RawNumber / List<object> /
    // Dictionary<string,object>. Standard JSON only (the golden file is produced by JSON.stringify).
    public static class Json
    {
        public static void SkipWs(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
        }

        public static object ParseValue(string s, ref int i)
        {
            SkipWs(s, ref i);
            char c = s[i];
            switch (c)
            {
                case '{': return ParseObject(s, ref i);
                case '[': return ParseArray(s, ref i);
                case '"': return ParseString(s, ref i);
                case 't': i += 4; return true;                 // true
                case 'f': i += 5; return false;                // false
                case 'n': i += 4; return null;                 // null
                default: return ParseNumber(s, ref i);
            }
        }

        static Dictionary<string, object> ParseObject(string s, ref int i)
        {
            var d = new Dictionary<string, object>();
            i++; // {
            SkipWs(s, ref i);
            if (s[i] == '}') { i++; return d; }
            while (true)
            {
                SkipWs(s, ref i);
                string key = ParseString(s, ref i);
                SkipWs(s, ref i);
                i++; // :
                d[key] = ParseValue(s, ref i);
                SkipWs(s, ref i);
                char c = s[i++];
                if (c == '}') break;
                // c == ','
            }
            return d;
        }

        static List<object> ParseArray(string s, ref int i)
        {
            var a = new List<object>();
            i++; // [
            SkipWs(s, ref i);
            if (s[i] == ']') { i++; return a; }
            while (true)
            {
                a.Add(ParseValue(s, ref i));
                SkipWs(s, ref i);
                char c = s[i++];
                if (c == ']') break;
                // c == ','
            }
            return a;
        }

        static string ParseString(string s, ref int i)
        {
            var sb = new StringBuilder();
            i++; // opening quote
            while (true)
            {
                char c = s[i++];
                if (c == '"') break;
                if (c == '\\')
                {
                    char e = s[i++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            int code = int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                            i += 4;
                            sb.Append((char)code);   // may be a surrogate half; reassembled on UTF-8 encode
                            break;
                        default: throw new FormatException("bad escape \\" + e);
                    }
                }
                else sb.Append(c);   // literal char incl. non-ASCII, U+2028/U+2029
            }
            return sb.ToString();
        }

        static RawNumber ParseNumber(string s, ref int i)
        {
            int start = i;
            while (i < s.Length && "0123456789+-.eE".IndexOf(s[i]) >= 0) i++;
            return new RawNumber(s.Substring(start, i - start));
        }
    }
}
