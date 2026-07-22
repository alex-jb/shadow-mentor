// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/IShadowStoryInput.cs
// Input is behind an interface so the guided-story player runs on a plain desktop today and a real
// headset controller later WITHOUT importing any device SDK into this slice. The only implementation
// here is a desktop keyboard mock. A Beam Pro / XREAL implementation would implement this same
// interface in the Providers assembly — this file never references an SDK.
// SOURCE AUTHORED.
namespace ShadowLens.GuidedStory
{
    public interface IShadowStoryInput
    {
        bool NextPressed();
        bool BackPressed();
        bool RestartPressed();
        bool ToggleLanguagePressed();
        bool Toggle2DPressed();
    }

    // Desktop keyboard mock. Kept null-safe so it can be unit-constructed; the MonoBehaviour player
    // supplies the real UnityEngine.Input reads via the delegate hooks to avoid a hard Input dependency
    // in EditMode tests.
    public sealed class DesktopMockStoryInput : IShadowStoryInput
    {
        public System.Func<string, bool> KeyDown = _ => false;   // player injects UnityEngine.Input.GetKeyDown

        public bool NextPressed() => KeyDown("right") || KeyDown("n");
        public bool BackPressed() => KeyDown("left") || KeyDown("b");
        public bool RestartPressed() => KeyDown("r");
        public bool ToggleLanguagePressed() => KeyDown("l");
        public bool Toggle2DPressed() => KeyDown("f");
    }
}
