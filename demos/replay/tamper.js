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
 * Shim adapting the {ok, reason, failedSeq} verifier return into the
 * {seq, reason, impact} contract the caption renders. Per design §4
 * step 4: DELETE this when docs/spec/verifier-error-format.md port
 * lands on 2026-07-17 (Thu) and verifyBundle returns {seq, reason,
 * impact} natively.
 *
 * @param {object} verifyResult — {ok:false, reason, failedSeq?}
 * @param {number} tamperedSeq  — the event the demo actually mutated
 * @returns {{ seq: number|string, reason: string, impact: string }}
 */
export function adaptVerifierError(verifyResult, tamperedSeq) {
  if (verifyResult.ok !== false) {
    throw new Error("adaptVerifierError: expected verifyResult.ok === false");
  }
  // `seq` per design §5: the mutated event's index. NOT verifier's
  // downstream failedSeq (see design test criterion (b)).
  const seq = tamperedSeq;
  const reason = verifyResult.reason;
  const detected = typeof verifyResult.failedSeq === "number"
    ? `chain break detected downstream at seq ${verifyResult.failedSeq}`
    : "chain break detected at bundle-level check";

  // Deterministic impact string — no hallucination, only fields we
  // know from the verifier's own return.
  const impact = `${detected}. Every event from seq ${tamperedSeq + 1} onward is now unverifiable against this signature. Auditor rejects the bundle.`;
  return { seq, reason, impact };
}

/**
 * The full PRISTINE → TAMPERED transition. Mutates workingBundle in
 * place, calls the verifier, adapts the error, returns everything the
 * UI needs.
 */
export async function runTamperCycle({ workingBundle, publicKeyPem }) {
  const seq = chooseTamperTarget(workingBundle);
  tamperInPlace(workingBundle, seq);

  const verify = await verifyBundleInBrowser(workingBundle, publicKeyPem);
  if (verify.ok !== false) {
    // If the tamper somehow didn't break verify (e.g. we chose the
    // wrong target and the flip cancelled out), that's a demo bug, not
    // an auditor scenario. Surface it as an error to the UI.
    throw new Error("tamper did not break verify — demo bug, please report");
  }

  const caption = adaptVerifierError(verify, seq);
  return { tamperedSeq: seq, verify, caption };
}
