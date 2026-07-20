// EditMode tests for the closed-enum voice router — free/document text can only map to a fixed
// action set (an LLM is never in the routing path); grounded questions fall through to None (the
// analysis path). Mirrors the Kotlin VoiceBridge.normalizeCommand + web router. Runs headless.
using NUnit.Framework;
using ShadowLens.Core;

namespace ShadowLens.Tests
{
    public class VoiceRouterTests
    {
        [Test] public void Scan() => Assert.AreEqual(VoiceCommand.ScanDocument, VoiceCommandRouter.Route("scan this"));
        [Test] public void Analyze() => Assert.AreEqual(VoiceCommand.Analyze, VoiceCommandRouter.Route("please analyze it"));
        [Test] public void CouncilMapsToReview() => Assert.AreEqual(VoiceCommand.ShowReview, VoiceCommandRouter.Route("show the council"));
        [Test] public void Verify() => Assert.AreEqual(VoiceCommand.Verify, VoiceCommandRouter.Route("verify the record"));
        [Test] public void GroundedQuestionFallsThrough() => Assert.AreEqual(VoiceCommand.None, VoiceCommandRouter.Route("what is the debt to income ratio"));
        [Test] public void UnknownIsNone() => Assert.AreEqual(VoiceCommand.None, VoiceCommandRouter.Route("xyzzy"));
    }
}
