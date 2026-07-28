// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryJson.cs
// A minimal, defensive JSON reader so Unity can consume the EXACT bytes of the cross-engine parity
// anchor (fixtures/guided-stories/snapshots/<id>/semantic.json) — JsonUtility cannot parse the
// arbitrary-key status maps (entity_status / dimension_status), and shipping a reshaped copy would
// weaken the "same bytes, same meaning" parity story. Untrusted-input posture: hard depth + length
// caps, no reflection, no code paths that touch arbitrary types. Pure C# (no UnityEngine).
// SOURCE AUTHORED — compiled/executed under Unity is verified separately; do not assume UNITY-COMPILED.
using System;
using System.Collections.Generic;
using System.Globalization;

namespace ShadowLens.GuidedStory
{
    public enum JsonKind { Object, Array, String, Number, Bool, Null }

    public sealed class JsonValue
    {
        public JsonKind Kind;
        public Dictionary<string, JsonValue> Obj;
        public List<JsonValue> Arr;
        public string Str;
        public double Num;
        public bool Bool;

        public bool IsNull => Kind == JsonKind.Null;
        public JsonValue Get(string key) => (Obj != null && Obj.TryGetValue(key, out var v)) ? v : null;
        public string AsString => Kind == JsonKind.String ? Str : null;
        public int AsInt => Kind == JsonKind.Number ? (int)Math.Round(Num) : 0;
        public List<JsonValue> AsArray => Arr ?? new List<JsonValue>();
    }

    // Recursive-descent parser with caps. Throws ShadowJsonException on anything malformed or oversized.
    public sealed class ShadowJsonException : Exception { public ShadowJsonException(string m) : base(m) {} }

    public static class ShadowGuidedStoryJson
    {
        public const int MaxDepth = 24;
        public const int MaxBytes = 262144;   // 256 KiB, matches the compiler's CAPS.bytes

        public static JsonValue Parse(string text)
        {
            if (text == null) throw new ShadowJsonException("null input");
            if (text.Length > MaxBytes) throw new ShadowJsonException("input exceeds byte cap");
            int i = 0;
            var v = ParseValue(text, ref i, 0);
            SkipWs(text, ref i);
            if (i != text.Length) throw new ShadowJsonException("trailing content after JSON");
            return v;
        }

        static JsonValue ParseValue(string s, ref int i, int depth)
        {
            if (depth > MaxDepth) throw new ShadowJsonException("nesting exceeds depth cap");
            SkipWs(s, ref i);
            if (i >= s.Length) throw new ShadowJsonException("unexpected end");
            char c = s[i];
            switch (c)
            {
                case '{': return ParseObject(s, ref i, depth);
                case '[': return ParseArray(s, ref i, depth);
                case '"': return new JsonValue { Kind = JsonKind.String, Str = ParseString(s, ref i) };
                case 't': Expect(s, ref i, "true"); return new JsonValue { Kind = JsonKind.Bool, Bool = true };
                case 'f': Expect(s, ref i, "false"); return new JsonValue { Kind = JsonKind.Bool, Bool = false };
                case 'n': Expect(s, ref i, "null"); return new JsonValue { Kind = JsonKind.Null };
                default: return ParseNumber(s, ref i);
            }
        }

        static JsonValue ParseObject(string s, ref int i, int depth)
        {
            var obj = new Dictionary<string, JsonValue>();
            i++; // {
            SkipWs(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return new JsonValue { Kind = JsonKind.Object, Obj = obj }; }
            while (true)
            {
                SkipWs(s, ref i);
                if (i >= s.Length || s[i] != '"') throw new ShadowJsonException("expected object key");
                string key = ParseString(s, ref i);
                if (key == "__proto__" || key == "prototype" || key == "constructor")
                    throw new ShadowJsonException("prototype-pollution key rejected: " + key);
                SkipWs(s, ref i);
                if (i >= s.Length || s[i] != ':') throw new ShadowJsonException("expected ':'");
                i++;
                obj[key] = ParseValue(s, ref i, depth + 1);
                SkipWs(s, ref i);
                if (i >= s.Length) throw new ShadowJsonException("unterminated object");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == '}') { i++; break; }
                throw new ShadowJsonException("expected ',' or '}'");
            }
            return new JsonValue { Kind = JsonKind.Object, Obj = obj };
        }

        static JsonValue ParseArray(string s, ref int i, int depth)
        {
            var arr = new List<JsonValue>();
            i++; // [
            SkipWs(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return new JsonValue { Kind = JsonKind.Array, Arr = arr }; }
            while (true)
            {
                arr.Add(ParseValue(s, ref i, depth + 1));
                SkipWs(s, ref i);
                if (i >= s.Length) throw new ShadowJsonException("unterminated array");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == ']') { i++; break; }
                throw new ShadowJsonException("expected ',' or ']'");
            }
            return new JsonValue { Kind = JsonKind.Array, Arr = arr };
        }

        static string ParseString(string s, ref int i)
        {
            i++; // opening quote
            var sb = new System.Text.StringBuilder();
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c == '\\')
                {
                    if (i >= s.Length) break;
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
                            if (i + 4 > s.Length) throw new ShadowJsonException("bad \\u escape");
                            sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                            i += 4; break;
                        default: throw new ShadowJsonException("bad escape \\" + e);
                    }
                }
                else sb.Append(c);
            }
            throw new ShadowJsonException("unterminated string");
        }

        static JsonValue ParseNumber(string s, ref int i)
        {
            int start = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            if (i == start) throw new ShadowJsonException("invalid token");
            double d = double.Parse(s.Substring(start, i - start), CultureInfo.InvariantCulture);
            return new JsonValue { Kind = JsonKind.Number, Num = d };
        }

        static void Expect(string s, ref int i, string word)
        {
            if (i + word.Length > s.Length || s.Substring(i, word.Length) != word) throw new ShadowJsonException("expected " + word);
            i += word.Length;
        }

        static void SkipWs(string s, ref int i)
        {
            while (i < s.Length) { char c = s[i]; if (c == ' ' || c == '\t' || c == '\n' || c == '\r') i++; else break; }
        }
    }
}
