// Deterministic prosody: a semantic role → a prosody profile → per-segment rate/pitch/pause.
// No randomness — the same role always yields the same prosody. Ranges are UX HYPOTHESES (tune with
// a listening study), not device-validated facts. No fake breaths/laughs/emotion.
export const PROSODY = Object.freeze({
  SYSTEM_NEUTRAL:       { rate: 0.98, pitch: 0, clausePauseMs: 160, transitionPauseMs: 320, emphasis: "none" },
  EVIDENCE_READER:      { rate: 0.92, pitch: 0, clausePauseMs: 200, transitionPauseMs: 380, emphasis: "none" },
  VERIFICATION_SUCCESS: { rate: 0.98, pitch: 0, clausePauseMs: 140, transitionPauseMs: 300, emphasis: "none" },
  VERIFICATION_FAILURE: { rate: 0.94, pitch: 0, clausePauseMs: 180, transitionPauseMs: 420, emphasis: "mild" },
  LIMITATION:           { rate: 0.95, pitch: 0, clausePauseMs: 180, transitionPauseMs: 360, emphasis: "none" },
  PERSPECTIVE:          { rate: 0.97, pitch: 0, clausePauseMs: 160, transitionPauseMs: 320, emphasis: "mild" },
  ACCESSIBILITY_CLEAR:  { rate: 0.88, pitch: 0, clausePauseMs: 260, transitionPauseMs: 480, emphasis: "none" },
});

// Map a story situation → the profile to use.
export function profileForSituation({ hasFailure, isQuote, isLimitation, isPerspective, accessibility }) {
  if (accessibility) return "ACCESSIBILITY_CLEAR";
  if (isQuote) return "EVIDENCE_READER";
  if (isLimitation) return "LIMITATION";
  if (isPerspective) return "PERSPECTIVE";
  if (hasFailure) return "VERIFICATION_FAILURE";
  return "SYSTEM_NEUTRAL";
}

// Apply a profile to a segment's semantic_role, producing deterministic prosody fields. The failure
// segment (result under a failure profile) gets the slower rate + longer pre-pause + mild emphasis;
// a quote segment always uses the evidence rate and is never emphasized (no interpretation in tone).
export function prosodyForSegment(profileName, semanticRole, { isFirstFailure = false } = {}) {
  const p = PROSODY[profileName] || PROSODY.SYSTEM_NEUTRAL;
  const seg = {
    rate_multiplier: round(p.rate),
    pitch_offset: 0,
    volume_multiplier: 1.0,
    pause_before_ms: semanticRole === "result" ? p.transitionPauseMs : p.clausePauseMs,
    pause_after_ms: p.clausePauseMs,
    emphasis: "none",
    can_interrupt_after: true,
  };
  if (semanticRole === "quote") { seg.rate_multiplier = round(PROSODY.EVIDENCE_READER.rate); seg.emphasis = "none"; seg.can_interrupt_after = false; }
  if (semanticRole === "warning") { seg.pause_before_ms = p.transitionPauseMs; seg.emphasis = "mild"; }
  if (isFirstFailure) { seg.rate_multiplier = round(Math.min(seg.rate_multiplier, 0.94)); seg.pause_before_ms = Math.max(seg.pause_before_ms, 380); seg.emphasis = "mild"; }
  if (semanticRole === "label") { seg.pause_after_ms = 120; }
  return seg;
}

function round(x) { return Math.round(x * 100) / 100; }
