// demos/replay/3d/gamepad.js
// ─────────────────────────────────────────────────────────────────
// Optional presenter gamepad (Phase 7.1 "number keys ... on gamepad";
// Phase 4.1 "push-to-talk on a held key / gamepad trigger"). Polled from
// the main loop; edge-detected so a held button fires once. The KEYBOARD
// stays authoritative — this is a convenience layer for presenting hands-free,
// and every binding here maps to an existing keyboard action.
//
// Standard Gamepad mapping (https://w3c.github.io/gamepad/#remapping):
//   0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT
//   12 dpad-up · 13 dpad-down · 14 dpad-left · 15 dpad-right
// ─────────────────────────────────────────────────────────────────
export function createGamepad({ dispatch, nextBeat, prevBeat, gotoBeat, voice }) {
  const prev = {};
  let talking = false;

  function edge(i, pressed, onDown) {
    const was = !!prev[i];
    if (pressed && !was) onDown?.();
    prev[i] = pressed;
  }

  function poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(Boolean);
    if (!gp) { if (talking) { voice?.stop?.(); talking = false; } return; }
    const b = gp.buttons;
    const down = (i) => !!(b[i] && b[i].pressed);

    // right trigger = push-to-talk (held)
    const ptt = down(7);
    if (ptt && !talking) { voice?.start?.(); talking = true; }
    else if (!ptt && talking) { voice?.stop?.(); talking = false; }

    // face buttons → the common demo verbs
    edge(0, down(0), () => nextBeat?.());                         // A → next beat
    edge(1, down(1), () => gotoBeat?.(0));                        // B → reset
    edge(2, down(2), () => dispatch({ intent: "TRIGGER_TAMPER" })); // X → tamper
    edge(3, down(3), () => dispatch({ intent: "SHOW_TRUST_LEVELS" })); // Y → trust
    edge(4, down(4), () => prevBeat?.());                         // LB → prev beat
    edge(5, down(5), () => nextBeat?.());                         // RB → next beat
    edge(14, down(14), () => dispatch({ intent: "FOCUS_EVENT", seq: selMove(-1) }));
    edge(15, down(15), () => dispatch({ intent: "FOCUS_EVENT", seq: selMove(1) }));
  }

  // selection move is provided by app via a setter (keeps card ordering there)
  let selMove = () => null;
  function setSelectionMover(fn) { selMove = fn; }

  return { poll, setSelectionMover, get connected() { return !!(navigator.getGamepads && [...navigator.getGamepads()].find(Boolean)); } };
}
