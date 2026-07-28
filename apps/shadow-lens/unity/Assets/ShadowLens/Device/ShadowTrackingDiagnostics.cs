// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowTrackingDiagnostics.cs
// A small ring buffer of tracking/capability diagnostic events, so a device session can be inspected
// after the fact without leaking any evidence content (it records STATE transitions, never story or
// camera data). Pure C#. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.Device
{
    public struct ShadowDiagnosticEvent
    {
        public long Sequence;
        public string Kind;      // "state" | "tracking" | "capability" | "recovery" | "error"
        public string Detail;    // short, evidence-free
    }

    public sealed class ShadowTrackingDiagnostics
    {
        readonly int _cap;
        readonly Queue<ShadowDiagnosticEvent> _events = new Queue<ShadowDiagnosticEvent>();
        long _seq;

        public ShadowTrackingDiagnostics(int capacity = 256) { _cap = capacity < 1 ? 1 : capacity; }

        public void Record(string kind, string detail)
        {
            _events.Enqueue(new ShadowDiagnosticEvent { Sequence = _seq++, Kind = kind ?? "", Detail = Sanitize(detail) });
            while (_events.Count > _cap) _events.Dequeue();
        }

        public IReadOnlyList<ShadowDiagnosticEvent> Snapshot() => new List<ShadowDiagnosticEvent>(_events);
        public int Count => _events.Count;
        public void Clear() { _events.Clear(); }

        // Never let evidence text into diagnostics. Cap length + strip anything that looks like a quote.
        static string Sanitize(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            if (s.Length > 120) s = s.Substring(0, 120);
            return s.Replace('\n', ' ').Replace('"', '\'');
        }
    }
}
