// apps/shadow-lens/unity/Assets/ShadowLens/Input/Runtime/ShadowInputSources.cs
// Concrete input sources that map real devices to the canonical ShadowInputAction vocabulary via the
// Unity Input System (com.unity.inputsystem 1.7). They never touch business state directly — they only
// feed the pure ShadowInputRouter, which owns the safety rules. Isolated in its own assembly so the
// Input System dependency cannot break the core ShadowLens assembly. SOURCE AUTHORED · UNITY-COMPILED.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine.InputSystem;
using ShadowLens.InputV5;

namespace ShadowLens.InputV5.Runtime
{
    public interface IShadowInputSource
    {
        // Active, explicit actions produced this frame (key/button/tap).
        IEnumerable<ShadowInputAction> PollActive();
        // Passive focus signal (hover / gaze / head direction). Never Select/Confirm.
        bool PollPassiveFocus();
    }

    // Desktop keyboard: arrow keys step, N/B step, Space play/pause, R restart, Backspace/Esc back/cancel,
    // Enter confirm, C recenter, A/2 open audit, L language, M reduced motion, D diagnostics, Delete reset.
    public sealed class ShadowDesktopInputSource : IShadowInputSource
    {
        public IEnumerable<ShadowInputAction> PollActive()
        {
            var k = Keyboard.current;
            if (k == null) yield break;
            if (k.rightArrowKey.wasPressedThisFrame || k.nKey.wasPressedThisFrame) yield return ShadowInputAction.NextStep;
            if (k.leftArrowKey.wasPressedThisFrame || k.bKey.wasPressedThisFrame) yield return ShadowInputAction.PreviousStep;
            if (k.spaceKey.wasPressedThisFrame) yield return ShadowInputAction.PlayPause;
            if (k.rKey.wasPressedThisFrame) yield return ShadowInputAction.RestartStory;
            if (k.deleteKey.wasPressedThisFrame) yield return ShadowInputAction.ResetDemo;   // gated by router → needs Confirm
            if (k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame) yield return ShadowInputAction.Confirm;
            if (k.backspaceKey.wasPressedThisFrame) yield return ShadowInputAction.Back;
            if (k.escapeKey.wasPressedThisFrame) yield return ShadowInputAction.Cancel;
            if (k.cKey.wasPressedThisFrame) yield return ShadowInputAction.Recenter;
            if (k.aKey.wasPressedThisFrame || k.digit2Key.wasPressedThisFrame) yield return ShadowInputAction.Open2DAudit;
            if (k.lKey.wasPressedThisFrame) yield return ShadowInputAction.SwitchLanguage;
            if (k.mKey.wasPressedThisFrame) yield return ShadowInputAction.ToggleReducedMotion;
            if (k.dKey.wasPressedThisFrame) yield return ShadowInputAction.OpenDiagnostics;
        }
        public bool PollPassiveFocus()
        {
            var m = Mouse.current;
            return m != null && m.delta.ReadValue().sqrMagnitude > 0.01f; // mouse move = passive focus only
        }
    }

    // Touch: a tap in the right/left third steps; a two-finger tap opens the 2D audit. Explicit
    // on-screen buttons (wired in the scene) are the primary path; this is the bare-gesture fallback.
    public sealed class ShadowTouchInputSource : IShadowInputSource
    {
        public IEnumerable<ShadowInputAction> PollActive()
        {
            var ts = Touchscreen.current;
            if (ts == null) yield break;
            var primary = ts.primaryTouch;
            if (primary != null && primary.press.wasPressedThisFrame)
            {
                float x = primary.position.ReadValue().x;
                float w = UnityEngine.Screen.width;
                if (x > w * 0.66f) yield return ShadowInputAction.NextStep;
                else if (x < w * 0.34f) yield return ShadowInputAction.PreviousStep;
                // middle third: no destructive action from a bare tap
            }
        }
        public bool PollPassiveFocus() => false; // touch has no hover; no passive focus
    }

    // Beam Pro 3DoF controller — PLACEHOLDER. The controller is 3DoF (rotation) only; there is NO
    // positional (6DoF) controller input on this hardware. Real button mapping is wired only behind
    // the XREAL SDK (SHADOW_XREAL_SDK) in the Providers assembly; this base source produces nothing so
    // the candidate never claims controller input it hasn't got. SOURCE AUTHORED · DEVICE PATH PENDING.
    public sealed class ShadowBeamProInputSource : IShadowInputSource
    {
        public IEnumerable<ShadowInputAction> PollActive() { yield break; }
        public bool PollPassiveFocus() => false; // head direction is passive focus only, wired on device
    }
}
#endif
