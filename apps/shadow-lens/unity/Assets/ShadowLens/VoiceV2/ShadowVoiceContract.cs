// apps/shadow-lens/unity/Assets/ShadowLens/VoiceV2/ShadowVoiceContract.cs
// Unity mirror of shadow-spoken-utterance-v1: the spoken-language plan types + a fail-closed validator
// that treats every string as untrusted (closed enums, caps, no executable/SSML markup, no proto
// keys). Mirrors lib/voice/shadow-spoken-utterance.mjs — a parity test cross-checks the enums.
// Pure C#. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.VoiceV2
{
    public enum VoicePriority { P0, P1, P2, P3, P4 }
    public enum Interruptibility { INTERRUPTIBLE, INTERRUPTIBLE_AFTER_SEGMENT, NON_INTERRUPTIBLE }

    public sealed class SpokenSegment
    {
        public string SegmentId, Text, SemanticRole, SourceReference, AccessibilityText, Emphasis = "none";
        public int PauseBeforeMs, PauseAfterMs;
        public float RateMultiplier = 1f, PitchOffset = 0f, VolumeMultiplier = 1f;
        public bool CanInterruptAfter = true, IsVerbatimQuote = false;
        public List<string> PronunciationTokens = new List<string>();
    }

    public sealed class SpokenUtterance
    {
        public string ContractVersion = "shadow-spoken-utterance-v1";
        public string UtteranceId, Locale, Role, Intent, ProsodyProfile, FixtureLiveDeviceStatus = "FIXTURE";
        public Interruptibility Interruptibility = Interruptibility.INTERRUPTIBLE;
        public VoicePriority Priority = VoicePriority.P3;
        public bool ConfirmationRequired;
        public List<string> SemanticSourceIds = new List<string>();
        public List<string> Limitations = new List<string>();
        public List<SpokenSegment> Segments = new List<SpokenSegment>();
    }

    public sealed class ShadowVoiceValidationException : System.Exception
    {
        public ShadowVoiceValidationException(string m) : base(m) {}
    }

    public static class ShadowVoiceContract
    {
        public static readonly string[] Locales = { "en-US", "zh-CN" };
        public static readonly string[] Roles = { "SYSTEM_NARRATOR", "EVIDENCE_READER", "PERSPECTIVE", "SAFETY", "HELP" };
        public static readonly string[] SegmentRoles = { "result", "source", "limitation", "detail", "label", "quote", "prompt", "warning" };
        public static readonly string[] ProsodyProfiles = { "SYSTEM_NEUTRAL", "EVIDENCE_READER", "VERIFICATION_SUCCESS", "VERIFICATION_FAILURE", "LIMITATION", "PERSPECTIVE", "ACCESSIBILITY_CLEAR" };

        // Forbidden default filler (EN + zh) — mirror of FORBIDDEN_FILLER in the .mjs.
        public static readonly string[] ForbiddenFiller = {
            "certainly", "absolutely", "based on the information provided", "based on my comprehensive analysis",
            "as an ai", "i am pleased to inform you", "it is important to note that", "in conclusion",
            "according to my expertise", "i strongly believe",
            "根据当前所提供的信息", "综合分析", "根据我的专业", "值得注意的是", "综上所述",
        };

        const int MaxSegments = 24, MaxTextLen = 400;
        static readonly string[] ExecMarkers = { "<speak", "<break", "<script", "javascript:", "${", "`" };

        public static void AssertPlainSpeech(string text)
        {
            var s = text ?? "";
            foreach (var m in ExecMarkers) if (s.ToLowerInvariant().Contains(m)) throw new ShadowVoiceValidationException("executable/markup rejected: " + m);
            // any angle-bracket tag is rejected
            if (System.Text.RegularExpressions.Regex.IsMatch(s, "<\\s*/?\\s*[a-zA-Z]")) throw new ShadowVoiceValidationException("markup tag rejected");
        }

        public static List<string> FindForbiddenFiller(string text)
        {
            var hits = new List<string>();
            var low = (text ?? "").ToLowerInvariant();
            foreach (var f in ForbiddenFiller) if (low.Contains(f.ToLowerInvariant())) hits.Add(f);
            return hits;
        }

        public static void Validate(SpokenUtterance u)
        {
            if (u == null) throw new ShadowVoiceValidationException("null utterance");
            if (u.ContractVersion != "shadow-spoken-utterance-v1") throw new ShadowVoiceValidationException("bad contract_version");
            if (System.Array.IndexOf(Locales, u.Locale) < 0) throw new ShadowVoiceValidationException("bad locale");
            if (System.Array.IndexOf(Roles, u.Role) < 0) throw new ShadowVoiceValidationException("bad role");
            if (System.Array.IndexOf(ProsodyProfiles, u.ProsodyProfile) < 0) throw new ShadowVoiceValidationException("bad prosody_profile");
            if (u.Segments == null || u.Segments.Count < 1) throw new ShadowVoiceValidationException("segments required");
            if (u.Segments.Count > MaxSegments) throw new ShadowVoiceValidationException("too many segments");
            var seen = new HashSet<string>();
            foreach (var s in u.Segments)
            {
                if (string.IsNullOrEmpty(s.SegmentId) || !seen.Add(s.SegmentId)) throw new ShadowVoiceValidationException("bad/duplicate segment_id");
                if (string.IsNullOrEmpty(s.Text) || s.Text.Length > MaxTextLen) throw new ShadowVoiceValidationException("bad segment text");
                if (System.Array.IndexOf(SegmentRoles, s.SemanticRole) < 0) throw new ShadowVoiceValidationException("bad semantic_role");
                AssertPlainSpeech(s.Text);
            }
        }
    }
}
