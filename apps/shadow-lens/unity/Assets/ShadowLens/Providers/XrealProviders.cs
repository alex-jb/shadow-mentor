// apps/shadow-lens/unity/Assets/ShadowLens/Providers/XrealProviders.cs
// XREAL-specific adapters, compiled ONLY when the proprietary XREAL SDK package is present
// AND the SHADOW_XREAL_SDK scripting-define symbol is set (Player Settings → Scripting Define
// Symbols, Android). Without both, this file compiles to nothing and the project still builds
// in mock/editor mode. The One Pro is 6DoF ONLY with the Eye add-on; the bare glasses are 3DoF.
//
// The concrete SDK calls (namespaces/class names) are from XREAL SDK 3.1 docs and are NOT
// verified against the installed package on this host — SOURCE AUTHORED · NOT COMPILED ·
// DEVICE VALIDATION PENDING. Compiling with the SDK is the first thing that can surface a
// class/namespace mismatch.
#if SHADOW_XREAL_SDK
using System;
using System.Collections.Generic;
using UnityEngine;
using ShadowLens.Core;
// using NRKernal;  // ← XREAL SDK namespace; enable when the package is installed

namespace ShadowLens.Providers
{
    public class XrealTrackingProvider : ITrackingProvider
    {
        Vector3 _origin; bool _haveOrigin, _translated;
        public TrackingMode Mode => TrackingMode.SixDof; // valid only with the Eye add-on
        public Pose6 GetHeadPose()
        {
            // var pose = NRFrame.HeadPose;  // SDK head pose
            var pose = new Pose(); // placeholder until the SDK package is present
            if (!_haveOrigin) { _origin = pose.position; _haveOrigin = true; }
            if ((pose.position - _origin).magnitude > 0.05f) _translated = true;
            return new Pose6 { px = pose.position.x, py = pose.position.y, pz = pose.position.z,
                qx = pose.rotation.x, qy = pose.rotation.y, qz = pose.rotation.z, qw = pose.rotation.w };
        }
        public bool IsTranslating() => _translated; // real 6DoF proof: positional translation observed
    }

    public class XrealRgbFrameProvider : IStillCaptureProvider
    {
        public string CapturePathUsed => "gpu-readback"; // Eye RGB is YUV; GPU-readback path (no GetBytes)
        public CapturedFrame? CaptureStill()
        {
            // var yuv = XREALRGBCameraTexture.GetYUVFormatTextures(); // [Y,U,V]
            // → convert to RGBA on the GPU, ReadPixels into a Texture2D, EncodeToPNG for hashing.
            return null; // NOT IMPLEMENTED against the SDK yet — device path pending
        }
    }
}
#endif
