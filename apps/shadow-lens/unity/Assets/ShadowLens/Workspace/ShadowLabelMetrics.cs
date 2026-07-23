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
