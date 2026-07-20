// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialAgentConfig.cs
// Config for the Unity spatial agent. Screenshot is OFF by default (§6). No key is ever stored
// here (the server holds keys). SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.SpatialAgent
{
    public class ShadowSpatialAgentConfig
    {
        public string BaseUrl = "https://shadow-mentor-phi.vercel.app";
        public int TimeoutMs = 15000;
        public bool ScreenshotEnabled = false;   // §6 default off
        public bool UseFixtureTransport = true;   // deterministic until a live provider is configured
        public string Profile = "data-science-v1";
        public string[] ClientCapabilities = System.Array.Empty<string>();
    }
}
#endif
