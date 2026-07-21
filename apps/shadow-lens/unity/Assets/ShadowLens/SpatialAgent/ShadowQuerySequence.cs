// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowQuerySequence.cs
// §1 — durable, session-scoped query identity <session_id>:q<sequence>. The authority is a STORE
// that recovers the last sequence from persisted session state (PlayerPrefs), NOT a process-global
// static counter — so after profile reconstruction, domain reload, app restart, or a session
// reload, the sequence continues (never reuses q1). SOURCE AUTHORED · compiled in Unity 6.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;

namespace ShadowLens.SpatialAgent
{
    public static class ShadowQuerySequence
    {
        public static int ParseSeq(string sessionId, string id)
        {
            if (string.IsNullOrEmpty(sessionId) || string.IsNullOrEmpty(id)) return 0;
            string prefix = sessionId + ":q";
            if (!id.StartsWith(prefix)) return 0;
            return int.TryParse(id.Substring(prefix.Length), out int n) && n > 0 ? n : 0;
        }
        public static string NextId(string sessionId, IEnumerable<string> existing)
        {
            int max = 0;
            if (existing != null) foreach (var id in existing) { int s = ParseSeq(sessionId, id); if (s > max) max = s; }
            return sessionId + ":q" + (max + 1);
        }
    }

    // The recovery authority. Issue() always continues from the max seen for the session.
    public interface IShadowQuerySequenceStore { string Issue(string sessionId); int Peek(string sessionId); void Hydrate(string sessionId, int lastSeq); }

    // In-memory (tests / transient). Persists only for the process lifetime.
    public class ShadowInMemoryQuerySequenceStore : IShadowQuerySequenceStore
    {
        readonly Dictionary<string, int> _max = new Dictionary<string, int>();
        public int Peek(string sessionId) { _max.TryGetValue(sessionId, out int n); return n; }
        public void Hydrate(string sessionId, int lastSeq) { if (lastSeq > Peek(sessionId)) _max[sessionId] = lastSeq; }
        public string Issue(string sessionId) { int n = Peek(sessionId) + 1; _max[sessionId] = n; return sessionId + ":q" + n; }
    }

    // PlayerPrefs-backed — recovers across domain reload / app restart / session reload (the
    // durable session state), so it is NOT a mere process-local counter.
    public class ShadowPlayerPrefsQuerySequenceStore : IShadowQuerySequenceStore
    {
        const string Prefix = "shadow.qseq.";
        public int Peek(string sessionId) => UnityEngine.PlayerPrefs.GetInt(Prefix + sessionId, 0);
        public void Hydrate(string sessionId, int lastSeq) { if (lastSeq > Peek(sessionId)) { UnityEngine.PlayerPrefs.SetInt(Prefix + sessionId, lastSeq); UnityEngine.PlayerPrefs.Save(); } }
        public string Issue(string sessionId) { int n = Peek(sessionId) + 1; UnityEngine.PlayerPrefs.SetInt(Prefix + sessionId, n); UnityEngine.PlayerPrefs.Save(); return sessionId + ":q" + n; }
    }
}
#endif
