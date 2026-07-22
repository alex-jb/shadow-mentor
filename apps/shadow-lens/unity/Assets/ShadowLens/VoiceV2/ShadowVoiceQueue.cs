// apps/shadow-lens/unity/Assets/ShadowLens/VoiceV2/ShadowVoiceQueue.cs
// Priority playback queue + barge-in (mirror of lib/voice/shadow-voice-queue.mjs). Higher priority
// interrupts lower; an ordinary status never interrupts an in-progress verbatim quote; duplicates are
// suppressed; reset/language-switch clear stale utterances; queue length is bounded. Pure C#.
using System.Collections.Generic;

namespace ShadowLens.VoiceV2
{
    public sealed class ShadowVoiceQueue
    {
        readonly List<SpokenUtterance> _queue = new List<SpokenUtterance>();
        public SpokenUtterance Current { get; private set; }
        public int Dropped { get; private set; }
        public int Suppressed { get; private set; }
        // set true by the player while a verbatim-quote segment of Current is speaking
        public bool CurrentActiveIsVerbatimQuote;
        const int MaxQueue = 64;

        public struct EnqueueResult { public bool Accepted; public SpokenUtterance Interrupted; }

        public EnqueueResult Enqueue(SpokenUtterance u)
        {
            if ((Current != null && Current.UtteranceId == u.UtteranceId) || _queue.Exists(q => q.UtteranceId == u.UtteranceId))
            { Suppressed++; return new EnqueueResult { Accepted = false, Interrupted = null }; }
            SpokenUtterance interrupted = null;
            if (Current != null && ShouldInterrupt(u, Current)) { interrupted = Current; Current = null; }
            _queue.Add(u);
            _queue.Sort((a, b) => Rank(a.Priority).CompareTo(Rank(b.Priority)));
            while (_queue.Count > MaxQueue) { _queue.RemoveAt(_queue.Count - 1); Dropped++; }
            return new EnqueueResult { Accepted = true, Interrupted = interrupted };
        }

        bool ShouldInterrupt(SpokenUtterance incoming, SpokenUtterance current)
        {
            if (current.Interruptibility == Interruptibility.NON_INTERRUPTIBLE) return false;
            if (CurrentActiveIsVerbatimQuote && Rank(incoming.Priority) > Rank(VoicePriority.P0)) return false; // only P0 interrupts a quote
            return Rank(incoming.Priority) < Rank(current.Priority);
        }

        public SpokenUtterance Next() { if (Current == null && _queue.Count > 0) { Current = _queue[0]; _queue.RemoveAt(0); } return Current; }
        public SpokenUtterance UserInterrupt() { var c = Current; Current = null; CurrentActiveIsVerbatimQuote = false; return c; }
        public bool StopAll() { bool had = Current != null || _queue.Count > 0; Current = null; _queue.Clear(); CurrentActiveIsVerbatimQuote = false; return had; }
        public void ClearLocaleExcept(string locale) { _queue.RemoveAll(u => u.Locale != locale); if (Current != null && Current.Locale != locale) Current = null; }
        public void OnPause() { Current = null; }
        public int Length => _queue.Count;

        static int Rank(VoicePriority p) => (int)p;
    }
}
