// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealCameraAdapter.cs
// Typed RGB front-end for the SDK camera API (XREALRGBCamera.StartRGBCameraDataCapture /
// TryAcquireLatestImage / DisposeRGBCameraDataHandle). It WIRES the pipeline only: frame metadata →
// a CapturedFrame handed to ShadowEvidenceCapturePipeline, whose gates (zero-byte / black-frame /
// duplicate / monotonic-ts) reject an empty frame — so nothing is claimed captured without real bytes.
//
// XREALRGBCamera is only reachable when the SDK's target-platform support define is active (its own
// XREALPLUGIN_SUPPORTS_TARGET_PLATFORM), which does not hold in the standard candidate build. The live
// SDK calls are therefore behind a SECOND opt-in, SHADOW_XREAL_CAMERA, so the XREAL candidate builds
// with the core adapters; the camera path is enabled only for a device/Eye bring-up build. This means
// the camera adapter is AUTHORED against the real API but its live RGB calls are NOT compiled into the
// standard build and RGB capture is NOT validated. Gated by SHADOW_XREAL_SDK. SOURCE AUTHORED.
using UnityEngine;
#if SHADOW_XREAL_CAMERA
using Unity.XR.XREAL;
#endif
using ShadowLens.Core;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealCameraAdapter
    {
        ulong _session;
        public bool Capturing { get; private set; }
        public const string Status = "AUTHORED (real XREALRGBCamera API); live calls behind SHADOW_XREAL_CAMERA; NO RGB-CAPTURE VALIDATED";

        public bool StartCapture()
        {
#if SHADOW_XREAL_CAMERA
            _session = XREALRGBCamera.StartRGBCameraDataCapture();
            Capturing = _session != 0UL;
#else
            Capturing = false;   // live camera enabled only in a device/Eye bring-up build
#endif
            return Capturing;
        }

        public void StopCapture()
        {
#if SHADOW_XREAL_CAMERA
            if (Capturing) XREALRGBCamera.StopRGBCameraDataCapture();
#endif
            Capturing = false;
        }

        // Metadata only; the byte payload stays empty so the evidence pipeline's non-black-frame gate
        // rejects it — nothing is ever claimed captured without real bytes.
        public CapturedFrame? TryReadFrameMetadata()
        {
            if (!Capturing) return null;
#if SHADOW_XREAL_CAMERA
            int handle = 0; var res = new Vector2Int(); ulong ts = 0UL;
            if (!XREALRGBCamera.TryAcquireLatestImage(ref handle, ref res, ref ts)) return null;
            try { return new CapturedFrame { Bytes = System.Array.Empty<byte>(), Width = res.x, Height = res.y, RotationDeg = 0, Mime = "image/rgba" }; }
            finally { XREALRGBCamera.DisposeRGBCameraDataHandle(handle); }
#else
            return null;
#endif
        }
    }
}
