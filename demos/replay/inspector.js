// demos/replay/inspector.js
// Render the payload card for the currently-selected event.
// Everything shown here is a field of the event record itself — the
// bundle is intentionally light (hashes + extensions), so there's no
// need to fetch external payload data. Full payload text lives in the
// payload store the bundle references, not in the bundle.

function line(host, key, val) {
  const wrap = document.createElement("div");
  wrap.className = "insp-field";
  const k = document.createElement("div");
  k.className = "insp-field-key";
  k.textContent = key;
  const v = document.createElement("div");
  v.className = "insp-field-val";
  v.textContent = val;
  wrap.append(k, v);
  host.append(wrap);
}

function jsonBlock(host, key, obj) {
  const wrap = document.createElement("div");
  wrap.className = "insp-field";
  const k = document.createElement("div");
  k.className = "insp-field-key";
  k.textContent = key;
  const pre = document.createElement("pre");
  pre.className = "insp-json";
  pre.textContent = JSON.stringify(obj, null, 2);
  wrap.append(k, pre);
  host.append(wrap);
}

/**
 * @param {HTMLElement} host — <aside id="inspector">
 * @param {object} event — bundle.events[i]
 * @param {object} bundle — full bundle for header context on session_start/session_end
 */
export function renderInspector(host, event, bundle) {
  host.replaceChildren();

  const head = document.createElement("div");
  head.className = "insp-head";
  const type = document.createElement("div");
  type.className = "insp-type";
  type.textContent = event.event_type;
  const seq = document.createElement("div");
  seq.className = "insp-seq";
  seq.textContent = `seq #${event.seq}`;
  head.append(type, seq);
  host.append(head);

  const actor = document.createElement("div");
  actor.className = "insp-actor";
  actor.textContent = `actor: ${event.actor}  ·  ts: ${event.ts_utc}`;
  host.append(actor);

  line(host, "payload_hash", event.payload_hash ?? "—");
  line(host, "payload_ref",  event.payload_ref  ?? "—");
  line(host, "prev_hash",    event.prev_hash    ?? "—");

  if (event.extensions && Object.keys(event.extensions).length > 0) {
    jsonBlock(host, "extensions", event.extensions);
  }

  // For session_start/session_end also surface header context so an
  // auditor can see agent + model + timing without hunting outside the
  // event row they clicked.
  if (event.event_type === "session_start" && bundle?.header) {
    jsonBlock(host, "header (context)", {
      session_id: bundle.header.session_id,
      started_at: bundle.header.session_started_at_utc,
      agent: bundle.header.agent,
      models: bundle.header.models,
    });
  }
  if (event.event_type === "session_end" && bundle) {
    jsonBlock(host, "seal (context)", {
      ended_at: bundle.header?.session_ended_at_utc,
      batch_root: bundle.batch_root,
      key_id: bundle.signatures?.[0]?.key_id,
    });
  }
}

export function renderInspectorEmpty(host) {
  host.replaceChildren();
  const div = document.createElement("div");
  div.className = "inspector-empty";
  div.textContent = "Select an event on the left to inspect.";
  host.append(div);
}
