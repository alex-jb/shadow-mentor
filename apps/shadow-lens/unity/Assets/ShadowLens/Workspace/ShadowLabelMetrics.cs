// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowLabelMetrics.cs
// Deterministic preferred-size for Audit Workspace cards. Replaces the character-count heuristic
// (maxLen * 0.55) with a per-script advance-width estimate that treats CJK as full-width, Latin as
// proportional, and emoji/surrogate pairs as one wide glyph. Returns preferred width in EM (the
// renderer multiplies by font size), the line count, and an overflow flag when content exceeds the
// card's max width — overflow routes to an explicit Inspect/2D-audit path, it never silently clips a
// status label. Pure C# → EditMode-testable. Uses code points so surrogate pairs are one glyph.
#if UNITY_2020_1_OR_NEWER
using System.Globalization;

namespace ShadowLens.Workspace
{
    public struct ShadowTextSize
    {
        public float PreferredWidthEm; // max line advance (capped at MaxWidthEm)
        public int Lines;
        public bool Overflow;          // a line exceeded MaxWidthEm → needs Inspect
        public float NaturalWidthEm;   // widest line BEFORE the cap (for overflow detection)
    }

    public static class ShadowLabelMetrics
    {
        // per-glyph advance in EM by script class (approximate, deterministic)
        const float LatinEm = 0.52f;
        const float CjkEm = 1.02f;
        const float EmojiEm = 1.20f;
        const float NarrowEm = 0.30f; // space, thin punctuation

        static bool IsCjk(int cp) =>
            (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
            (cp >= 0x3000 && cp <= 0x303F) || (cp >= 0xFF00 && cp <= 0xFFEF) ||
            (cp >= 0x3040 && cp <= 0x30FF); // include kana/full-width punctuation

        static bool IsEmoji(int cp) =>
            cp >= 0x1F000 || (cp >= 0x2600 && cp <= 0x27BF) || (cp >= 0x2190 && cp <= 0x21FF && cp != 0x2192);

        static bool IsNarrow(int cp) => cp == ' ' || cp == '.' || cp == ',' || cp == '\'' || cp == '|' || cp == ':';

        static float LineWidthEm(string line)
        {
            float w = 0f;
            var e = StringInfo.GetTextElementEnumerator(line);
            while (e.MoveNext())
            {
                string el = (string)e.Current;
                int cp = char.ConvertToUtf32(el, 0);
                if (IsEmoji(cp)) w += EmojiEm;
                else if (IsCjk(cp)) w += CjkEm;
                else if (IsNarrow(cp)) w += NarrowEm;
                else w += LatinEm;
            }
            return w;
        }

        public static ShadowTextSize Measure(string text, float maxWidthEm = 22f)
        {
            if (string.IsNullOrEmpty(text))
                return new ShadowTextSize { PreferredWidthEm = 0, Lines = 0, Overflow = false, NaturalWidthEm = 0 };
            string[] lines = text.Replace("\r\n", "\n").Split('\n');
            float natural = 0f;
            foreach (var ln in lines) { float w = LineWidthEm(ln); if (w > natural) natural = w; }
            bool overflow = natural > maxWidthEm;
            return new ShadowTextSize {
                PreferredWidthEm = overflow ? maxWidthEm : natural,
                Lines = lines.Length,
                Overflow = overflow,
                NaturalWidthEm = natural,
            };
        }

        // Truncate with an explicit affordance when a single-line label overflows. Full text stays
        // reachable via Inspect/2D audit; the ellipsis marks that truncation happened.
        /// <summary>
        /// Deterministic wrap to a width budget. Breaks on spaces for Latin and between glyphs for CJK
        /// (which has no spaces), never inside a run of non-space Latin, and never more than maxLines —
        /// the final line is truncated with the usual affordance so a wrap can never silently grow a
        /// column. Used where a long line would otherwise cross a column boundary (UX-02).
        /// </summary>
        public static string WrapToWidth(string text, float maxWidthEm, int maxLines = 2)
        {
            if (string.IsNullOrEmpty(text)) return text ?? "";
            if (!Measure(text, maxWidthEm).Overflow) return text;

            var lines = new System.Collections.Generic.List<string>();
            var cur = new System.Text.StringBuilder();
            float w = 0f;
            var tokens = Tokenize(text);
            foreach (var tk in tokens)
            {
                float tw = LineWidthEm(tk);
                bool empty = cur.Length == 0;
                // a leading space on a fresh line is dropped rather than carried
                if (empty && tk == " ") continue;
                if (!empty && w + tw > maxWidthEm)
                {
                    lines.Add(cur.ToString()); cur.Clear(); w = 0f;
                    if (lines.Count >= maxLines) break;
                    if (tk == " ") continue;
                }
                cur.Append(tk); w += tw;
            }
            if (cur.Length > 0 && lines.Count < maxLines) lines.Add(cur.ToString());
            for (int i = 0; i < lines.Count; i++) lines[i] = TruncateWithAffordance(lines[i], maxWidthEm);
            return string.Join("\n", lines);
        }

        // Latin words stay whole; CJK breaks per glyph; spaces are their own token so a break can
        // consume one instead of leaving it dangling at a line start.
        static System.Collections.Generic.List<string> Tokenize(string text)
        {
            var outp = new System.Collections.Generic.List<string>();
            var word = new System.Text.StringBuilder();
            for (int i = 0; i < text.Length; i++)
            {
                int cp = char.ConvertToUtf32(text, i);
                if (char.IsSurrogatePair(text, i)) i++;
                string g = char.ConvertFromUtf32(cp);
                bool cjk = IsCjk(cp);
                if (g == " " || cjk)
                {
                    if (word.Length > 0) { outp.Add(word.ToString()); word.Clear(); }
                    outp.Add(g);
                }
                else word.Append(g);
            }
            if (word.Length > 0) outp.Add(word.ToString());
            return outp;
        }

        public static string TruncateWithAffordance(string text, float maxWidthEm = 22f)
        {
            if (Measure(text, maxWidthEm).Overflow == false) return text;
            // binary-ish shrink by text elements until it fits, then append the affordance
            var si = new StringInfo(text);
            int n = si.LengthInTextElements;
            for (int keep = n; keep > 0; keep--)
            {
                string candidate = si.SubstringByTextElements(0, keep) + "…";
                if (!Measure(candidate, maxWidthEm).Overflow) return candidate;
            }
            return "…";
        }
    }
}
#endif
