(function () {
  const $ = (id) => document.getElementById(id);

  let currentScenario = "lbo";
  let currentMode = "cloud";
  let currentDevice = "desktop";
  let currentPersona = "compliance";
  let liveMode = false;
  let wifiOn = true;
  let auditCount = 0;
  let auditHash = "0000000000000000";

  async function fetchLiveDeliberation() {
    const s = window.SCENARIOS[currentScenario];
    const personaOverride =
      window.PERSONAS[currentPersona] &&
      window.PERSONAS[currentPersona].scenarios &&
      window.PERSONAS[currentPersona].scenarios[currentScenario];
    const question = personaOverride ? personaOverride.question : s.question;

    try {
      const response = await fetch("/api/deliberate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: currentPersona,
          scenario: currentScenario,
          question
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status} ${errText.slice(0, 200)}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("live deliberation failed", err);
      return { error: err.message };
    }
  }

  const DEVICE_INFO = {
    desktop: {
      label: "🖥 Desktop overlay · ScreenCaptureKit + on-device Phi-4-mini",
      describe: "Desktop client — native macOS overlay reads any window via ScreenCaptureKit. Full 3-voice panel. Zero glasses required. Universal fallback for all scenarios."
    },
    g2: {
      label: "👓 Even G2 · monocular green HUD · bone conduction · no camera",
      describe: "Even G2 mode — 25° monocular HUD, single contrarian voice only (junior + compliance hidden by design constraint). No camera = customer-facing safe. Bone-conduction audio for council whisper."
    },
    frame: {
      label: "🕶 Brilliant Frame · color mini HUD · camera + local-only · open SDK",
      describe: "Brilliant Frame mode — color mini HUD shows 2 voices (junior + compliance). Camera scans screen + real-world; processed locally and discarded. Best for internal scenarios where no customer is present."
    },
    xreal: {
      label: "✨ XReal Air 2 Ultra · 6DoF spatial AR · bone conduction · camera + local-only",
      describe: "XReal Air 2 Ultra mode — JARVIS-style. 3 floating panels anchored in your real workspace at depth (Risk Surface, Bias Constellation, Counterparty Network). Full 3-voice council. Only you can see the panels through the AR glasses. Bone-conduction council whisper. Power-user / trader / analyst at own desk."
    }
  };

  function renderScenario(key) {
    const s = window.SCENARIOS[key];
    if (!s) return;
    $("screen-title").textContent = s.title;
    $("screen-canvas").innerHTML = s.canvas;
    $("recognized-context").textContent = s.recognized;

    // Persona override path: if the current persona has voice content for this
    // scenario, use that. Otherwise fall back to the scenario's default voices.
    const personaOverride =
      window.PERSONAS[currentPersona] &&
      window.PERSONAS[currentPersona].scenarios &&
      window.PERSONAS[currentPersona].scenarios[key];

    const voices = personaOverride ? personaOverride.voices : s.voices;
    const question = personaOverride ? personaOverride.question : s.question;
    const followup = personaOverride ? personaOverride.followup : s.followup;
    const tags = window.PERSONAS[currentPersona] && window.PERSONAS[currentPersona].tags;

    $("hud-question-text").textContent = question;
    $("voice-junior").textContent = voices.junior;
    $("voice-senior").textContent = voices.senior;
    $("voice-compliance").textContent = voices.compliance || voices.third || "";
    $("followup-text").textContent = followup;

    // update voice tag labels to match persona vocabulary
    if (tags) {
      document.querySelector(".voice-junior .voice-tag").textContent = tags.junior;
      document.querySelector(".voice-senior .voice-tag").textContent = tags.senior;
      document.querySelector(".voice-compliance .voice-tag").textContent = tags.third;
    }
  }

  function renderMode(mode) {
    const m = window.MODES[mode];
    if (!m) return;
    $("latency-tag").textContent = m.latency;
    if (mode === "cloud" && !wifiOn) {
      // Cloud mode without WiFi = visually broken
      ["voice-junior", "voice-senior", "voice-compliance"].forEach((id) => {
        $(id).textContent = "(cloud unreachable — analyst left without their mentor)";
      });
      $("followup-text").textContent = "— cloud cannot answer offline —";
    } else {
      renderScenario(currentScenario);
    }
  }

  function bumpAudit() {
    auditCount += 1;
    // simple deterministic faux-hash so the demo looks real
    let seed = currentScenario.charCodeAt(0) * (auditCount + 31);
    auditHash = Array.from({ length: 16 }, (_, i) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 16).toString(16);
    }).join("");
    $("audit-count").textContent = `${auditCount} Q&A pair${auditCount > 1 ? "s" : ""} recorded`;
    $("audit-hash").textContent = `SHA-256: ${auditHash}...`;
  }

  function toast(message) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = message;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => t.classList.remove("show"), 4200);
  }

  function renderDevice(device) {
    const info = DEVICE_INFO[device];
    if (!info) return;
    const hud = document.getElementById("shadow-hud");
    hud.classList.remove("device-desktop", "device-g2", "device-frame", "device-xreal");
    hud.classList.add(`device-${device}`);
    document.body.classList.toggle("device-xreal-active", device === "xreal");
    $("device-badge").textContent = info.label;
  }

  // wire persona picker
  document.querySelectorAll(".persona-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".persona-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPersona = btn.dataset.persona;
      renderScenario(currentScenario);
      renderMode(currentMode);
      const p = window.PERSONAS[currentPersona];
      toast(`Persona pack switched: ${p.label}. Same engine, different voices, different recommended device.`);
    });
  });

  // wire device picker
  document.querySelectorAll(".dev-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".dev-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentDevice = btn.dataset.device;
      renderDevice(currentDevice);
      toast(DEVICE_INFO[currentDevice].describe);
    });
  });

  // wire scenario picker
  document.querySelectorAll(".scenario-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".scenario-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentScenario = btn.dataset.scenario;
      renderScenario(currentScenario);
      renderMode(currentMode);
    });
  });

  // wire mode toggle
  $("mode-cloud").addEventListener("click", () => {
    currentMode = "cloud";
    liveMode = false;
    $("mode-cloud").classList.add("active");
    $("mode-local").classList.remove("active");
    $("mode-live").classList.remove("active");
    renderMode(currentMode);
    toast(window.MODES.cloud.description);
  });
  $("mode-local").addEventListener("click", () => {
    currentMode = "local";
    liveMode = false;
    $("mode-local").classList.add("active");
    $("mode-cloud").classList.remove("active");
    $("mode-live").classList.remove("active");
    renderMode(currentMode);
    toast(window.MODES.local.description);
  });
  $("mode-live").addEventListener("click", async () => {
    if ($("mode-live").classList.contains("thinking")) return;
    liveMode = true;
    $("mode-live").classList.add("active", "thinking");
    $("mode-cloud").classList.remove("active");
    $("mode-local").classList.remove("active");
    toast("Live mode — calling Anthropic Claude Sonnet 4.6 with the 3 persona voice prompts...");
    $("latency-tag").textContent = "live · calling Sonnet 4.6…";
    const data = await fetchLiveDeliberation();
    $("mode-live").classList.remove("thinking");
    if (data.error) {
      toast(`Live mode error: ${data.error}`);
      $("latency-tag").textContent = "live · error · falling back to mock";
      liveMode = false;
      $("mode-live").classList.remove("active");
      $("mode-cloud").classList.add("active");
      renderMode("cloud");
      return;
    }
    $("voice-junior").textContent = data.junior;
    $("voice-senior").textContent = data.senior;
    $("voice-compliance").textContent = data.third;
    $("followup-text").textContent = data.followup;
    $("latency-tag").textContent = `live · ${data.model} · ${data.latency_ms}ms`;
    toast(`Live deliberation in ${data.latency_ms}ms via ${data.model}`);
  });

  // wire WiFi toggle — proves local mode is the moat
  $("wifi-off").addEventListener("click", () => {
    wifiOn = !wifiOn;
    const btn = $("wifi-off");
    btn.textContent = wifiOn ? "📡 WiFi: on" : "📡 WiFi: off";
    btn.classList.toggle("off", !wifiOn);
    renderMode(currentMode);
    if (!wifiOn) {
      toast(currentMode === "local" ? window.WIFI_TOAST_LOCAL : window.WIFI_TOAST_CLOUD);
    } else {
      toast("WiFi back on.");
    }
  });

  // wire Ask + Logged buttons
  $("ask-btn").addEventListener("click", () => {
    bumpAudit();
    toast("Q&A pair appended to audit chain.");
  });
  $("logged-btn").addEventListener("click", () => {
    bumpAudit();
    toast("Logged as 'reviewed by Maya' — examiner audit trail updated.");
  });

  // first render
  renderScenario(currentScenario);
  renderMode(currentMode);
  renderDevice(currentDevice);
})();
