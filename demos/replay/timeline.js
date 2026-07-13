// demos/replay/timeline.js
// Renders the list of Shadow events. Selection state lives here.
// Icon vocabulary matches docs/spec/m5-replay-2d-design.md §3.

const ICONS = {
  session_start:  "▶",
  user_message:   "💬",
  prompt:         "💬",
  model_call:     "◉",
  model_output:   "◉",
  tool_call:      "🔧",
  tool_result:    "✓",
  tool_error:     "⚠",
  file_read:      "📄",
  file_write:     "✎",
  shell_exec:     "$",
  network_request: "◈",
  human_approval:  "👤",
  error:           "⚠",
  subagent_stop:   "⇢",
  turn_end:        "↩",
  pre_compact:     "⇲",
  session_end:     "■",
};

const LABELS = {
  session_start:  "session start",
  prompt:         "user prompt",
  user_message:   "user message",
  model_call:     "model call",
  model_output:   "model output",
  tool_call:      "tool call",
  tool_result:    "tool result",
  tool_error:     "tool error",
  file_read:      "file read",
  file_write:     "file write",
  shell_exec:     "shell exec",
  network_request: "net request",
  human_approval:  "approval",
  error:           "error",
  subagent_stop:   "subagent stop",
  turn_end:        "turn end",
  pre_compact:     "pre-compact",
  session_end:     "session end",
};

function summarize(ev) {
  const t = ev.event_type;
  // Payload lives at the payload store (referenced by payload_ref), not
  // in the bundle — the bundle only has hashes. So summaries are all
  // hash-prefix + counts. This is on purpose: the bundle stays small +
  // privacy-safe. Full payload lives in `extensions` when we set them.
  const ext = ev.extensions ?? {};
  if (t === "session_start") {
    return `hash ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
  }
  if (t === "prompt" || t === "user_message") {
    return `payload sha256 ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
  }
  if (t === "tool_call") {
    const tool = ext.tool ?? ext.discovered_tool ?? "?";
    return `${tool}  ·  ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
  }
  if (t === "tool_result") {
    return `result sha256 ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
  }
  if (t === "tool_error") {
    return `error ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
  }
  if (t === "session_end") {
    return `end ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
  }
  return `hash ${ev.payload_hash?.slice(0, 12) ?? "?"}`;
}

/**
 * Render events into <ol id="timeline">.
 *
 * @param {HTMLElement} host
 * @param {object[]} events
 * @param {(event, index) => void} onSelect
 */
export function renderTimeline(host, events, onSelect) {
  host.replaceChildren();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const row = document.createElement("li");
    row.className = "tl-row";
    row.dataset.seq = String(i);
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");

    const icon = document.createElement("span");
    icon.className = "tl-icon";
    icon.textContent = ICONS[ev.event_type] ?? "•";

    const label = document.createElement("span");
    label.className = "tl-label";
    label.textContent = LABELS[ev.event_type] ?? ev.event_type;

    const summary = document.createElement("span");
    summary.className = "tl-summary";
    summary.textContent = summarize(ev);

    const seq = document.createElement("span");
    seq.className = "tl-seq";
    seq.textContent = `#${i}`;

    row.append(icon, label, summary, seq);
    row.addEventListener("click", () => onSelect(ev, i));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(ev, i);
      }
    });
    host.append(row);
  }
}

/**
 * Mark one row as selected; clears any prior selection.
 */
export function selectRow(host, index) {
  for (const r of host.querySelectorAll(".tl-row")) {
    r.classList.toggle("selected", Number(r.dataset.seq) === index);
  }
}

/**
 * Apply tamper visual state — flashes tampered row red, dims downstream.
 *
 * @param {HTMLElement} host
 * @param {number} tamperedSeq — index of the mutated event
 * @param {number|null} detectedSeq — index the verifier said failed
 */
export function applyTamperVisual(host, tamperedSeq, detectedSeq) {
  const rows = host.querySelectorAll(".tl-row");
  for (const r of rows) {
    const seq = Number(r.dataset.seq);
    r.classList.remove("tampered", "downstream", "flash");
    if (seq === tamperedSeq) {
      r.classList.add("tampered", "flash");
    } else if (seq > tamperedSeq) {
      r.classList.add("downstream");
    }
  }
  // If verifier detected somewhere else (e.g. batch_root mismatch reported
  // by verifier at seq that isn't the tampered one), also mark that row.
  if (typeof detectedSeq === "number" && detectedSeq !== tamperedSeq) {
    const detected = host.querySelector(`.tl-row[data-seq="${detectedSeq}"]`);
    if (detected) detected.classList.add("tampered");
  }
}

/**
 * Reset all rows to pristine visual state.
 */
export function clearTamperVisual(host) {
  for (const r of host.querySelectorAll(".tl-row")) {
    r.classList.remove("tampered", "downstream", "flash");
  }
}
