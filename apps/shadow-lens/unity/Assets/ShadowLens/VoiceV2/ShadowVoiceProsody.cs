// apps/shadow-lens/unity/Assets/ShadowLens/VoiceV2/ShadowVoiceProsody.cs
// Deterministic prosody: role → rate/pitch/pause. No randomness, no fake breaths/emotion. Mirror of
// lib/voice/shadow-prosody-planner.mjs. Ranges are UX hypotheses, not device-validated. Pure C#.
namespace ShadowLens.VoiceV2
{
    public struct ProsodyResult { public float Rate, Pitch, Volume; public int PauseBeforeMs, PauseAfterMs; public string Emphasis; public bool CanInterruptAfter; }

    public static class ShadowVoiceProsody
    {
        struct Profile { public float Rate; public int Clause, Transition; public string Emphasis; }
        static Profile Get(string name)
        {
            switch (name)
            {
                case "EVIDENCE_READER": return new Profile { Rate = 0.92f, Clause = 200, Transition = 380, Emphasis = "none" };
                case "VERIFICATION_FAILURE": return new Profile { Rate = 0.94f, Clause = 180, Transition = 420, Emphasis = "mild" };
                case "LIMITATION": return new Profile { Rate = 0.95f, Clause = 180, Transition = 360, Emphasis = "none" };
                case "PERSPECTIVE": return new Profile { Rate = 0.97f, Clause = 160, Transition = 320, Emphasis = "mild" };
                case "ACCESSIBILITY_CLEAR": return new Profile { Rate = 0.88f, Clause = 260, Transition = 480, Emphasis = "none" };
                case "VERIFICATION_SUCCESS": return new Profile { Rate = 0.98f, Clause = 140, Transition = 300, Emphasis = "none" };
                default: return new Profile { Rate = 0.98f, Clause = 160, Transition = 320, Emphasis = "none" };
            }
        }

        public static ProsodyResult ForSegment(string profileName, string semanticRole, bool isFirstFailure = false)
        {
            var p = Get(profileName);
            var r = new ProsodyResult { Rate = Round(p.Rate), Pitch = 0f, Volume = 1f, PauseBeforeMs = semanticRole == "result" ? p.Transition : p.Clause, PauseAfterMs = p.Clause, Emphasis = "none", CanInterruptAfter = true };
            if (semanticRole == "quote") { r.Rate = Round(0.92f); r.Emphasis = "none"; r.CanInterruptAfter = false; }
            if (semanticRole == "warning") { r.PauseBeforeMs = p.Transition; r.Emphasis = "mild"; }
            if (isFirstFailure) { r.Rate = Round(System.Math.Min(r.Rate, 0.94f)); r.PauseBeforeMs = System.Math.Max(r.PauseBeforeMs, 380); r.Emphasis = "mild"; }
            if (semanticRole == "label") r.PauseAfterMs = 120;
            return r;
        }
        static float Round(float x) => (float)System.Math.Round(x * 100f) / 100f;
    }
}
