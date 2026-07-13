// demos/replay/tamper.js
// PRISTINE ↔ TAMPERED state machine. Design source:
// docs/spec/m5-replay-2d-design.md §4 + §5.
//
// The tamper flow shows an auditor what happens when someone rewrites
// history AFTER the bundle was signed: the chain break is caught, the
// verifier says exactly which event was mutated and what got detected
// downstream, and the visual dims everything past the break to make
// the cascade obvious.

import { verifyBundleInBrowser } from "./verify-browser.js";

/**
 * Deep-copy a bundle by round-tripping through JSON. Fine — the bundle
 * is pure data (no functions or symbols).
 */
export function clonePristine(bundle) {
  return JSON.parse(JSON.stringify(bundle));
}

/**
 * Pick the first event we want to mutate. Preference order:
 *   1. First event with tool_call payload where tool = Write / Edit
 *      (the clearest "someone edited a file" story for an auditor).
 *   2. First tool_call of any kind.
 *   3. First non-session_start / non-session_end event.
 *   4. Fallback: index 1 (event after session_start) if it exists,
 *      else index 0.
 *
 * @returns {number} seq index of the event to tamper with
 */
export function chooseTamperTarget(bundle) {
  const events = bundle.events;
  const isFileWriteTool = (ev) => {
    const t = ev.extensions?.tool ?? "";
    return t === "Write" || t === "Edit" || t === "MultiEdit";
  };

  const writeIdx = events.findIndex((ev) => ev.event_type === "tool_call" && isFileWriteTool(ev));
  if (writeIdx >= 0) return writeIdx;

  const anyToolCall = events.findIndex((ev) => ev.event_type === "tool_call");
  if (anyToolCall >= 0) return anyToolCall;

  const anyContentful = events.findIndex(
    (ev) => ev.event_type !== "session_start" && ev.event_type !== "session_end",
  );
  if (anyContentful >= 0) return anyContentful;

  return events.length > 1 ? 1 : 0;
}

/**
 * Mutate the working bundle in place at the chosen seq. Flips the last
 * hex nibble of `payload_hash` so `signedShape` yields a different
 * `own_hash` — the next event's `prev_hash` no longer matches, so
 * verifyBundle reports `prev_hash mismatch` at seq+1.
 *
 * Returns the seq the auditor should think of as "the mutated event"
 * (the one we edited), which is NOT the same as `verifier.failedSeq`
 * (the one downstream where the chain broke). Both go into the caption.
 */
export function tamperInPlace(workingBundle, seq) {
  const ev = workingBundle.events[seq];
  if (!ev || typeof ev.payload_hash !== "string" || ev.payload_hash.length === 0) {
    throw new Error(`tamperInPlace: event at seq ${seq} has no payload_hash`);
  }
  const last = ev.payload_hash.slice(-1);
  const flipped = (parseInt(last, 16) ^ 0x1).toString(16); // toggle low bit
  ev.payload_hash = ev.payload_hash.slice(0, -1) + flipped;
  return seq;
}

/**
 * The full PRISTINE → TAMPERED transition. Mutates workingBundle in
 * place, calls the verifier, reads the structured error the verifier
 * now returns natively, and hands the UI everything it needs.
 *
 * Note (2026-07-13): the earlier `adaptVerifierError` shim was deleted
 * once packages/attest-core/session.js verifyBundle started returning
 * `{ok:false, error:{seq, reason, impact}}` per the verifier-error-format
 * spec (docs/spec/verifier-error-format.md).
 */
export async function runTamperCycle({ workingBundle, publicKeyPem }) {
  const tamperedSeq = chooseTamperTarget(workingBundle);
  tamperInPlace(workingBundle, tamperedSeq);

  const verify = await verifyBundleInBrowser(workingBundle, publicKeyPem);
  if (verify.ok !== false) {
    // If the tamper somehow didn't break verify (e.g. we chose the
    // wrong target and the flip cancelled out), that's a demo bug, not
    // an auditor scenario. Surface it as an error to the UI.
    throw new Error("tamper did not break verify — demo bug, please report");
  }

  // The verifier reports the seq WHERE the break was DETECTED (typically
  // one past the tampered event, because prev_hash on event N+1 no longer
  // matches). The demo's caption shows both facts:
  //   - error.seq (detected here)
  //   - tamperedSeq (mutated here)
  // so the auditor sees the cascade with no ambiguity.
  const detected = verify.error;
  const caption = {
    seq: tamperedSeq,
    reason: detected.reason,
    impact: `Mutated event at seq ${tamperedSeq}; verifier detected the break at seq ${detected.seq ?? "—"}. ${detected.impact}`,
  };
  return { tamperedSeq, verify, caption };
}
