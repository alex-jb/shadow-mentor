// apps/shadow-lens/unity/Assets/ShadowLens/Core/MockTrackingProvider.cs
// Editor/desktop tracking mock so 6DoF-relative placement logic runs with no headset.
// Reports ThreeDof + no translation, matching XREAL One Pro WITHOUT the Eye (honest: the
// bare One Pro is 3DoF; 6DoF needs the Eye add-on). SOURCE AUTHORED · NOT COMPILED.
namespace ShadowLens.Core
{
    public class MockTrackingProvider : ITrackingProvider
    {
        public TrackingMode Mode => TrackingMode.ThreeDof;   // bare One Pro is 3DoF
        public Pose6 GetHeadPose() => new Pose6 { qw = 1f };  // identity pose at origin
        public bool IsTranslating() => false;                // no positional translation without the Eye
    }
}
