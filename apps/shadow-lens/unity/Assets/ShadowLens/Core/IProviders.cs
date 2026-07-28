// apps/shadow-lens/unity/Assets/ShadowLens/Core/IProviders.cs
// The provider seams the whole app is written against, so the Editor can run a full
// mock path (mock frame + mock OCR + mock voice) and the XREAL build swaps in native
// adapters WITHOUT touching app logic. Real code, not TODO stubs. SOFTWARE IMPLEMENTED ·
// LOCAL UNITY COMPILE NOT EXECUTED (no Unity/dotnet on the build host).
using System;
using System.Collections.Generic;

namespace ShadowLens.Core
{
    public enum TrackingMode { Unknown, None, ThreeDof, SixDof }

    // 6DoF pose (position in meters). The XREAL adapter fills this from the SDK; the mock
    // supplies a fixed pose so Editor placement works.
    public struct Pose6 { public float px, py, pz; public float qx, qy, qz, qw; }

    public interface ITrackingProvider
    {
        TrackingMode Mode { get; }
        Pose6 GetHeadPose();
        bool IsTranslating();   // true once real positional translation is observed (6DoF proof)
    }

    // A single still frame + its provenance (bytes for hashing, dimensions, rotation).
    public struct CapturedFrame { public byte[] Bytes; public int Width, Height; public int RotationDeg; public string Mime; }

    public interface IFramePreviewProvider { bool PreviewAvailable { get; } }

    public interface IStillCaptureProvider
    {
        // Returns null if the current frame fails the quality gate (caller re-prompts).
        CapturedFrame? CaptureStill();
        string CapturePathUsed { get; } // "gpu-readback" | "official-still" | "mock"
    }

    // OCR result — the ONLY authority on source geometry.
    public struct SourceEntry { public string SourceId, Text, Language; public float X, Y, W, H, Confidence; }

    public interface IOcrProvider
    {
        void Recognize(CapturedFrame frame, Action<IReadOnlyList<SourceEntry>> onResult, Action<string> onError);
        string EngineId { get; } // "mlkit-text-recognition" | "mock"
    }

    public interface IVoiceRecognitionProvider
    {
        bool OnDeviceAvailable { get; }
        void StartPushToTalk(Action<string, float> onFinal); // recognizedText, confidence
        void Stop();
        void Dispose();
    }

    public interface ITextToSpeechProvider { void Speak(string text); void Stop(); }

    public interface ISpatialPlacementProvider
    {
        // Session-relative placement (One Pro has no persistent anchors): place at a
        // gazed/confirmed spot; stable for the session only.
        void PlaceAtGaze();
        bool Placed { get; }
    }
}
