// apps/shadow-lens/unity/Assets/ShadowLens/Input/ShadowInputDiagnostics.cs
// Evidence-free ring buffer of input routing decisions (dispatched / blocked / confirmation-gated),
// for post-hoc review of an interaction session. Pure C#. SOURCE AUTHORED.
using System.Collections.Generic;

namespace ShadowLens.InputV5
{
    public struct ShadowDiagnosticInputEvent { public long Seq; public string Kind, Detail; }

    public sealed class ShadowInputDiagnostics
    {
        readonly int _cap;
        readonly Queue<ShadowDiagnosticInputEvent> _q = new Queue<ShadowDiagnosticInputEvent>();
        long _seq;
        public ShadowInputDiagnostics(int capacity = 256) { _cap = capacity < 1 ? 1 : capacity; }

        public void Record(string kind, string detail)
        {
            _q.Enqueue(new ShadowDiagnosticInputEvent { Seq = _seq++, Kind = kind ?? "", Detail = detail ?? "" });
            while (_q.Count > _cap) _q.Dequeue();
        }
        public IReadOnlyList<ShadowDiagnosticInputEvent> Snapshot() => new List<ShadowDiagnosticInputEvent>(_q);
        public int Count => _q.Count;
    }
}
