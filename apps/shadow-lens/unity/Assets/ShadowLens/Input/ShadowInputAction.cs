// apps/shadow-lens/unity/Assets/ShadowLens/Input/ShadowInputAction.cs
// The canonical, device-independent input actions. Business-state classes react to THESE, never to
// raw keys/buttons — so desktop, touch, the XR simulator, and a Beam Pro controller all map onto one
// vocabulary. Pure C#. SOURCE AUTHORED.
namespace ShadowLens.InputV5
{
    public enum ShadowInputAction
    {
        Focus, Select, Back, Cancel, Confirm,
        NextStep, PreviousStep, PlayPause, RestartStory, ResetDemo, Recenter,
        Open2DAudit, Close2DAudit, SwitchLanguage, ToggleReducedMotion, OpenDiagnostics,
    }

    public static class ShadowInputSafety
    {
        // Destructive / regulated actions that must NOT fire from a single hover/dwell/select — they
        // require a separate explicit Confirm. Tamper is treated as destructive (it mutates the story).
        public static bool RequiresConfirmation(ShadowInputAction a)
        {
            switch (a)
            {
                case ShadowInputAction.ResetDemo:
                    return true;
                default:
                    return false;
            }
        }

        // Actions that must ALWAYS be reachable regardless of state (escape hatches + reorientation).
        public static bool AlwaysReachable(ShadowInputAction a)
        {
            switch (a)
            {
                case ShadowInputAction.Back:
                case ShadowInputAction.Cancel:
                case ShadowInputAction.Recenter:
                    return true;
                default:
                    return false;
            }
        }

        // Hover / head-direction / dwell may only ever produce Focus — never Select/Confirm/approve.
        // This is asserted so a future contributor can't wire a dwell straight to a regulated action.
        public static bool IsPassiveFocusOnly(ShadowInputAction produced) => produced == ShadowInputAction.Focus;
    }
}
