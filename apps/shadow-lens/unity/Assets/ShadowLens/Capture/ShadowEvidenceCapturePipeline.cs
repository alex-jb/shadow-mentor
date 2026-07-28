// apps/shadow-lens/unity/Assets/ShadowLens/Capture/ShadowEvidenceCapturePipeline.cs
// The product-critical evidence loop, as pure + fixture-testable logic:
//   frame → validate (zero-byte / all-black / duplicate / monotonic ts / dimensions) → SHA-256 →
//   OCR result → source-coordinate map → user confirmation → evidence event → seal → independent verify.
// It runs today against FIXTURE frames (synthetic bytes); on device a real IStillCaptureProvider +
// IOcrProvider fill the same shapes. No raw frames are retained by default. The seal is a content hash
// labelled DEVICE VALIDATION FIXTURE — it is NOT a production signature. Pure C#. SOURCE AUTHORED.
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using ShadowLens.Core; // CapturedFrame, SourceEntry

namespace ShadowLens.Capture
{
    public enum FrameRejectReason { None, ZeroBytes, AllBlack, BadDimensions, BufferLayout, DuplicateHash, NonMonotonicTimestamp }

    public struct FrameValidation { public bool Ok; public FrameRejectReason Reason; }

    public sealed class EvidenceEvent
    {
        public string FrameSha256;
        public int Width, Height, RotationDeg;
        public string Mime;
        public long FrameTimestampMs;
        public string OcrEngineId;
        public List<SourceEntry> Sources = new List<SourceEntry>();   // OCR text + boxes + confidence
        public bool UserConfirmed;
        public string CorrectionOfEventSha;                            // set when this event corrects a prior one
        public string ProvenanceMode = "FIXTURE";                     // never LIVE until device
    }

    public sealed class SealedEvidence { public EvidenceEvent Event; public string SealSha256; public string Label = "DEVICE VALIDATION FIXTURE"; }

    public static class ShadowEvidenceCapturePipeline
    {
        public const int BlackThreshold = 10;   // per-byte luma proxy; below → treated as black

        public static string Sha256(byte[] bytes)
        {
            using (var h = SHA256.Create()) return ToHex(h.ComputeHash(bytes ?? Array.Empty<byte>()));
        }

        public static bool IsAllBlack(byte[] bytes)
        {
            if (bytes == null || bytes.Length == 0) return true;
            for (int i = 0; i < bytes.Length; i++) if (bytes[i] > BlackThreshold) return false;
            return true;
        }

        // Validate a frame against every gate. recentHashes = hashes seen this session (duplicate guard);
        // lastTimestampMs = the previous accepted frame timestamp (monotonic guard, -1 if none).
        public static FrameValidation ValidateFrame(CapturedFrame frame, ICollection<string> recentHashes, long lastTimestampMs, long frameTimestampMs)
        {
            if (frame.Bytes == null || frame.Bytes.Length == 0) return Reject(FrameRejectReason.ZeroBytes);
            if (frame.Width <= 0 || frame.Height <= 0) return Reject(FrameRejectReason.BadDimensions);
            // expected byte count sanity for an 8-bit RGBA-ish buffer; reject obviously wrong layouts
            long minExpected = (long)frame.Width * frame.Height;   // at least one byte per pixel
            if (frame.Bytes.Length < minExpected) return Reject(FrameRejectReason.BufferLayout);
            if (IsAllBlack(frame.Bytes)) return Reject(FrameRejectReason.AllBlack);
            var hash = Sha256(frame.Bytes);
            if (recentHashes != null && recentHashes.Contains(hash)) return Reject(FrameRejectReason.DuplicateHash);
            if (lastTimestampMs >= 0 && frameTimestampMs <= lastTimestampMs) return Reject(FrameRejectReason.NonMonotonicTimestamp);
            return new FrameValidation { Ok = true, Reason = FrameRejectReason.None };
        }

        // Build an evidence event from a validated frame + OCR result. OCR confidence is carried as an
        // engine score, never as truth. Sources are copied (source geometry authority).
        public static EvidenceEvent BuildEvent(CapturedFrame frame, long frameTimestampMs, string ocrEngineId, IReadOnlyList<SourceEntry> ocr, bool userConfirmed)
        {
            var ev = new EvidenceEvent
            {
                FrameSha256 = Sha256(frame.Bytes),
                Width = frame.Width, Height = frame.Height, RotationDeg = frame.RotationDeg, Mime = frame.Mime,
                FrameTimestampMs = frameTimestampMs, OcrEngineId = ocrEngineId, UserConfirmed = userConfirmed,
            };
            if (ocr != null) ev.Sources.AddRange(ocr);
            return ev;
        }

        // A correction creates a NEW event referencing the prior one — the original OCR output stays
        // auditable (never overwritten in place).
        public static EvidenceEvent Correct(EvidenceEvent prior, IReadOnlyList<SourceEntry> correctedSources, bool userConfirmed)
        {
            var ev = new EvidenceEvent
            {
                FrameSha256 = prior.FrameSha256, Width = prior.Width, Height = prior.Height, RotationDeg = prior.RotationDeg,
                Mime = prior.Mime, FrameTimestampMs = prior.FrameTimestampMs, OcrEngineId = prior.OcrEngineId,
                UserConfirmed = userConfirmed, CorrectionOfEventSha = SealCanonical(prior),
            };
            if (correctedSources != null) ev.Sources.AddRange(correctedSources);
            return ev;
        }

        // Canonical byte-stable serialization of an event (sorted, deterministic) → the seal input.
        public static string SealCanonical(EvidenceEvent ev)
        {
            var sb = new StringBuilder();
            sb.Append(ev.FrameSha256).Append('|').Append(ev.Width).Append('x').Append(ev.Height).Append('|')
              .Append(ev.RotationDeg).Append('|').Append(ev.Mime ?? "").Append('|').Append(ev.FrameTimestampMs).Append('|')
              .Append(ev.OcrEngineId ?? "").Append('|').Append(ev.UserConfirmed ? "1" : "0").Append('|')
              .Append(ev.CorrectionOfEventSha ?? "").Append('|').Append(ev.ProvenanceMode);
            var rows = new List<string>();
            foreach (var s in ev.Sources) rows.Add($"{s.SourceId}:{s.Text}:{s.X},{s.Y},{s.W},{s.H}:{s.Confidence}:{s.Language}");
            rows.Sort(StringComparer.Ordinal);
            foreach (var r in rows) sb.Append('|').Append(r);
            using (var h = SHA256.Create()) return ToHex(h.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString())));
        }

        // Seal (only after the user-confirmed state). Fail-closed: an unconfirmed event is not sealed.
        public static SealedEvidence Seal(EvidenceEvent ev)
        {
            if (!ev.UserConfirmed) throw new InvalidOperationException("cannot seal evidence before user confirmation");
            return new SealedEvidence { Event = ev, SealSha256 = SealCanonical(ev) };
        }

        // Independent verification: recompute the seal and confirm it matches (a post-hoc edit breaks it).
        public static bool Verify(SealedEvidence sealed_)
        {
            if (sealed_?.Event == null || string.IsNullOrEmpty(sealed_.SealSha256)) return false;
            return SealCanonical(sealed_.Event) == sealed_.SealSha256;
        }

        static FrameValidation Reject(FrameRejectReason r) => new FrameValidation { Ok = false, Reason = r };
        static string ToHex(byte[] b) { var sb = new StringBuilder(b.Length * 2); foreach (var x in b) sb.Append(x.ToString("x2")); return sb.ToString(); }
    }
}
