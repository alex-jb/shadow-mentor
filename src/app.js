(function () {
  const $ = (id) => document.getElementById(id);

  let currentScenario = "lbo";
  let currentMode = "cloud";
  let wifiOn = true;
  let auditCount = 0;
  let auditHash = "0000000000000000";

  function renderScenario(key) {
    const s = window.SCENARIOS[key];
    if (!s) return;
    $("screen-title").textContent = s.title;
    $("screen-canvas").innerHTML = s.canvas;
    $("recognized-context").textContent = s.recognized;
    $("hud-question-text").textContent = s.question;
    $("voice-junior").textContent = s.voices.junior;
    $("voice-senior").textContent = s.voices.senior;
    $("voice-compliance").textContent = s.voices.compliance;
    $("followup-text").textContent = s.followup;
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
    $("mode-cloud").classList.add("active");
    $("mode-local").classList.remove("active");
    renderMode(currentMode);
    toast(window.MODES.cloud.description);
  });
  $("mode-local").addEventListener("click", () => {
    currentMode = "local";
    $("mode-local").classList.add("active");
    $("mode-cloud").classList.remove("active");
    renderMode(currentMode);
    toast(window.MODES.local.description);
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
})();
