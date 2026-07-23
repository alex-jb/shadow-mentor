#!/usr/bin/env bash
# scripts/beampro-device-test.sh
# One-command deterministic Beam Pro (XREAL) device-test harness. Replaces the manual workflow:
# no hand-copied Wi-Fi-debugging IP/port, no two terminals, no manual logcat start/stop/grep.
#
#   bash scripts/beampro-device-test.sh \
#     --package com.shadowlens.xrealvoice \
#     --expected-version 0.11-beampro-candidate.4 \
#     --mode myglasses-grid [--apk <path>] [--device-hint X4200] [--seconds 30] [--kill-server]
#
#   --mode myglasses-grid  the MR launch route under test: the user opens it from the MyGlasses grid.
#   --mode direct          CONTROL run only: harness launches it via adb (known to leave mrPkgName
#                          empty). Never a physical-pass route; recorded as such in the summary.
#
# Pure helpers (mdns_pick_ipport, resolve_pid_from_ps, extract_signals, classify_run) are exposed for
# the self-test (scripts/beampro-device-test.selftest.sh sources this file with SELFTEST=1 so main()
# does NOT run). Device serial + LAN IP are redacted from every file written under reports/.
set -uo pipefail

ADB_DEFAULT="/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"
OUTDIR_DEFAULT="reports/device-validation-v11/latest-device-run"
SECONDS_CAPTURE=30
DEVICE_HINT=""
KILL_SERVER=0
APK=""
PACKAGE=""
EXPECTED_VERSION=""
MODE="myglasses-grid"

# ── pure helpers (testable without a device) ────────────────────────────────────────────────────
# From `adb mdns services` text, pick the IP:port of an _adb-tls-connect._tcp service. Optional hint
# filters by instance name (e.g. X4200). Prints the FIRST match's IP:port, or nothing.
mdns_pick_ipport() {
  local text="$1" hint="${2:-}"
  printf '%s\n' "$text" \
    | grep -F '_adb-tls-connect._tcp' \
    | { if [ -n "$hint" ]; then grep -F "$hint" || true; else cat; fi; } \
    | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}' \
    | head -1
}

# Resolve a package's PID from `adb shell ps -A` text. Prints the PID or "".
resolve_pid_from_ps() {
  local text="$1" pkg="$2"
  printf '%s\n' "$text" | awk -v p="$pkg" '$NF==p {print $2; exit}'
}

# Extract the §5 signal set from PID-tagged log lines. Prints `key=value` lines (stable order).
# Every XR/loader signal is attributed: it counts for Shadow ONLY when the log line's PID is
# shadow_pid — this is the guard against the candidate-04 "Nebula's Unity = Shadow" mis-read.
extract_signals() {
  local L="$1" shadow_pid="${2:-}"
  _any() { printf '%s\n' "$L" | grep -qiE "$1"; }
  _mine() { [ -n "$shadow_pid" ] && printf '%s\n' "$L" | grep -E " $shadow_pid " | grep -qiE "$1"; }

  local mrpkg="unknown"
  if _any 'mrPkgName ?[=:] ?com\.shadowlens'; then mrpkg="shadow"
  elif _any 'mrPkgName is empty'; then mrpkg="empty"
  elif _any 'mrPkgName'; then mrpkg="other"; fi

  local entry="unknown"
  if _any 'isEntryApp=true'; then entry="true"; elif _any 'isEntryApp=false'; then entry="false"; fi
  local multi="unknown"
  if _any 'multiResumeMode=true'; then multi="true"; elif _any 'multiResumeMode=false'; then multi="false"; fi

  local dispid="unknown"
  dispid="$(printf '%s\n' "$L" | grep -oiE 'display(Id)?[ =:]+[0-9]+' | head -1 | grep -oE '[0-9]+$')"
  [ -z "$dispid" ] && dispid="unknown"

  printf 'shadow_pid=%s\n' "${shadow_pid:-none}"
  printf 'shadow_pid_alive=%s\n' "$([ -n "$shadow_pid" ] && echo yes || echo no)"
  printf 'mr_pkg_name=%s\n' "$mrpkg"
  printf 'is_entry_app=%s\n' "$entry"
  printf 'multi_resume_mode=%s\n' "$multi"
  printf 'shadow_display_id=%s\n' "$dispid"
  printf 'shadow_xr_loader=%s\n' "$(_mine 'XREALXRLoader.*(Init End|Start End)' && echo yes || echo no)"
  printf 'shadow_xr_display_running=%s\n' "$(_mine 'disp=[1-9]/[1-9]' && echo yes || { _mine 'disp=[0-9]+/0' && echo no || echo unknown; })"
  printf 'shadow_xr_input_running=%s\n' "$(_mine 'in=[1-9]/[1-9]' && echo yes || { _mine 'in=[0-9]+/0' && echo no || echo unknown; })"
  printf 'xreal_settings_failure=%s\n' "$(_mine 'Failed to get XREAL Settings|Unable to start XREAL XR Plugin' && echo yes || echo no)"
  printf 'nebula_fallback_launcher=%s\n' "$( { _any 'mrPkgName is empty' && _any 'go launcher|goLauncher'; } && echo yes || echo no)"
  printf 'shadow_fatal=%s\n' "$(_mine 'FATAL|SIGSEGV' && echo yes || echo no)"
  printf 'nebula_xr_loader=%s\n' "$( { printf '%s\n' "$L" | grep -viE " ${shadow_pid:-__none__} " | grep -qiE 'XREALXRLoader.*(Init End|Start End)'; } && echo yes || echo no)"
}

# Classify a run from PID-tagged important lines + the resolved Shadow PID. Prints ONE enum token.
# Attribution rule: XREAL/XR lines only count for Shadow when the line's PID == shadow_pid.
classify_run() {
  local lines="$1" shadow_pid="${2:-}" grid_visible="${3:-unknown}"
  local L; L="$lines"
  _has() { printf '%s\n' "$L" | grep -qiE "$1"; }
  _has_pid() { [ -n "$shadow_pid" ] && printf '%s\n' "$L" | grep -E " $shadow_pid " | grep -qiE "$1"; }

  if _has_pid 'FATAL|SIGSEGV|AndroidRuntime.*FATAL'; then echo "SHADOW_PROCESS_CRASHED"; return; fi
  if [ "$grid_visible" = "no" ]; then echo "MR_GRID_DISCOVERY_FAILED"; return; fi
  if _has 'mrPkgName is empty' && _has 'go launcher|goLauncher'; then echo "NEBULA_FALLBACK_LAUNCHER"; return; fi
  if _has 'LaunchSpaceAcrivity|NRFakeActivity' && ! _has 'isEntryApp=true'; then echo "NEBULA_FALLBACK_LAUNCHER"; return; fi
  if _has_pid 'Failed to get XREAL Settings|Unable to start XREAL XR Plugin'; then echo "SHADOW_XR_LOADER_NOT_STARTED"; return; fi
  if _has 'mrPkgName ?= ?com.shadowlens|isEntryApp=true'; then
    if _has_pid 'XREALXRLoader.*(Init End|Start End)'; then
      if _has_pid 'disp=[1-9]/[1-9]|XRDisplaySubsystem.*running'; then
        # process alive + XR display running, but the operator saw no workspace → distinct enum
        if [ "${WORKSPACE_SEEN:-unknown}" = "no" ]; then echo "SHADOW_RUNNING_NO_VISIBLE_WORKSPACE"; return; fi
        echo "PHYSICAL_PASS"; return
      fi
      echo "SHADOW_XR_DISPLAY_NOT_RUNNING"; return
    fi
    echo "SHADOW_XR_LOADER_NOT_STARTED"; return
  fi
  if _has 'mrPkgName is empty|component not found'; then echo "MR_PACKAGE_HANDOFF_MISSING"; return; fi
  echo "INSUFFICIENT_EVIDENCE"
}

# ── device-touching functions (need adb) ────────────────────────────────────────────────────────
find_adb() { if [ -x "$ADB_DEFAULT" ]; then echo "$ADB_DEFAULT"; elif command -v adb >/dev/null 2>&1; then command -v adb; else echo ""; fi; }
find_aapt() { local d; d="$(dirname "$(find_adb)")/../build-tools"; ls "$d"/*/aapt 2>/dev/null | sort | tail -1; }

# Resolve the current wireless-debugging IP:port and connect. Bounded retries; prints only IP:port.
connect_wireless() {
  local adb="$1" hint="$2" tries="${3:-8}" ipport="" i=0 mdns=""
  while [ "$i" -lt "$tries" ]; do
    mdns="$("$adb" mdns services 2>/dev/null)"
    ipport="$(mdns_pick_ipport "$mdns" "$hint")"
    [ -n "$ipport" ] && break
    i=$((i+1)); sleep 2
  done
  [ -z "$ipport" ] && return 1
  "$adb" connect "$ipport" >/dev/null 2>&1
  "$adb" -s "$ipport" shell true >/dev/null 2>&1 && { echo "$ipport"; return 0; }
  return 1
}

# Replace the device serial + LAN IP with placeholders in every file we commit.
redact_dir() {
  local dir="$1" serial="$2" ip="$3" f
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    case "$f" in *.apk) continue;; esac
    [ -n "$serial" ] && LC_ALL=C sed -i '' "s/$serial/<REDACTED_SERIAL>/g" "$f" 2>/dev/null
    [ -n "$ip" ] && LC_ALL=C sed -i '' "s/${ip//./\\.}/<REDACTED_IP>/g" "$f" 2>/dev/null
  done
}

main() {
  while [ $# -gt 0 ]; do case "$1" in
    --package) PACKAGE="$2"; shift 2;;
    --expected-version) EXPECTED_VERSION="$2"; shift 2;;
    --mode) MODE="$2"; shift 2;;
    --apk) APK="$2"; shift 2;;
    --device-hint) DEVICE_HINT="$2"; shift 2;;
    --seconds) SECONDS_CAPTURE="$2"; shift 2;;
    --kill-server) KILL_SERVER=1; shift;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0;;
    *) echo "unknown arg: $1"; exit 2;;
  esac; done
  [ -z "$PACKAGE" ] && { echo "--package required"; exit 2; }

  local ROOT; ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  local OUT="$ROOT/$OUTDIR_DEFAULT"; mkdir -p "$OUT"
  local ADB; ADB="$(find_adb)"
  [ -z "$ADB" ] && { echo "ACTION: adb not found. Install the Unity Android module or Android platform-tools."; exit 1; }
  [ "$KILL_SERVER" = "1" ] && { "$ADB" kill-server >/dev/null 2>&1; "$ADB" start-server >/dev/null 2>&1; }

  # ── 1. discover + connect ──────────────────────────────────────────────────────────────────
  echo "== discovering Beam Pro over Wi-Fi ADB (adb mdns services) =="
  local ipport
  if ! ipport="$(connect_wireless "$ADB" "$DEVICE_HINT" 8)"; then
    echo "BEAM_PRO_FOUND false"
    echo "ACTION: no _adb-tls-connect._tcp service resolved. Put the Beam Pro AND this Mac on the SAME"
    echo "        Wi-Fi, turn Wireless debugging ON (Settings > Developer options), then re-run."
    exit 1
  fi
  echo "BEAM_PRO_FOUND true"
  echo "ADB_WIRELESS_CONNECTED true"
  echo "DEVICE_IP_PORT $ipport"
  local A=("$ADB" -s "$ipport")
  local MODEL SERIAL IP
  MODEL="$("${A[@]}" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
  SERIAL="$("${A[@]}" shell getprop ro.serialno 2>/dev/null | tr -d '\r')"
  IP="${ipport%%:*}"
  echo "DEVICE_MODEL $MODEL"

  # ── 2. verify the installed candidate ──────────────────────────────────────────────────────
  if [ -n "$APK" ]; then echo "== installing $APK =="; "${A[@]}" install -r "$APK" 2>&1 | tail -2; fi
  echo "== installed candidate =="
  local PKGDUMP; PKGDUMP="$("${A[@]}" shell dumpsys package "$PACKAGE" 2>/dev/null | tr -d '\r')"
  if [ -z "$PKGDUMP" ]; then echo "ACTION: $PACKAGE is not installed. Re-run with --apk <path>."; exit 1; fi
  local VN VC LAUNCHER MRACT
  VN="$(printf '%s\n' "$PKGDUMP" | grep -oE 'versionName=[^ ]+' | head -1 | cut -d= -f2)"
  VC="$(printf '%s\n' "$PKGDUMP" | grep -oE 'versionCode=[0-9]+' | head -1 | cut -d= -f2)"
  LAUNCHER="$("${A[@]}" shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER "$PACKAGE" 2>/dev/null | tail -1 | tr -d '\r')"
  MRACT="$(printf '%s\n' "$PKGDUMP" | grep -c 'ai.nreal.activitylife.NRXRActivity')"
  # nreal_sdk / supportDevices live in the manifest meta-data → read them off the APK with aapt.
  local AAPT BADGE="" APKPATH="$APK" TMPAPK=""
  AAPT="$(find_aapt)"
  if [ -n "$AAPT" ] && [ -z "$APKPATH" ]; then
    TMPAPK="${TMPDIR:-/tmp}/beampro-installed.apk"
    "${A[@]}" pull "$("${A[@]}" shell pm path "$PACKAGE" | head -1 | tr -d '\r' | cut -d: -f2)" "$TMPAPK" >/dev/null 2>&1 && APKPATH="$TMPAPK"
  fi
  [ -n "$AAPT" ] && [ -f "$APKPATH" ] && BADGE="$("$AAPT" dump badging "$APKPATH" 2>/dev/null)"
  local HAS_SDK="unknown" HAS_DEVICES="unknown"
  if [ -n "$BADGE" ]; then
    printf '%s\n' "$BADGE" | grep -q "nreal_sdk" && HAS_SDK=yes || HAS_SDK=no
    printf '%s\n' "$BADGE" | grep -q "com.nreal.supportDevices" && HAS_DEVICES=yes || HAS_DEVICES=no
  fi
  {
    echo "versionName=$VN"; echo "versionCode=$VC"
    echo "launcher_activity=$LAUNCHER"
    echo "mr_activity_NRXRActivity=$([ "$MRACT" -gt 0 ] && echo present || echo MISSING)"
    echo "meta_nreal_sdk=$HAS_SDK"
    echo "meta_com.nreal.supportDevices=$HAS_DEVICES"
  } | tee "$OUT/package-state.txt"
  [ -n "$TMPAPK" ] && rm -f "$TMPAPK"
  local VERSION_MATCH=true
  if [ -n "$EXPECTED_VERSION" ] && [ "$VN" != "$EXPECTED_VERSION" ]; then
    VERSION_MATCH=false; echo "VERSION_MATCH false (installed $VN, expected $EXPECTED_VERSION)"
  else echo "VERSION_MATCH true"; fi

  # ── 3. single user action ──────────────────────────────────────────────────────────────────
  "${A[@]}" logcat -c >/dev/null 2>&1
  if [ "$MODE" = "direct" ]; then
    echo "== CONTROL RUN (--mode direct): launching via adb; this route cannot produce PHYSICAL_PASS =="
    "${A[@]}" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  else
    cat <<'PROMPT'

CONNECT THE XREAL GLASSES.
OPEN MYGLASSES.
LOOK FOR "SHADOW LENS" IN THE MR APP GRID.
DO NOT USE THE BEAM PRO ANDROID APP ICON.
DO NOT USE ADB TO LAUNCH IT.
PRESS ENTER AFTER YOU ATTEMPT TO OPEN IT.
PROMPT
    read -r _ || true
  fi

  # ── 4. PID-aware capture (one terminal) ────────────────────────────────────────────────────
  echo "== capturing ${SECONDS_CAPTURE}s =="
  ( "${A[@]}" logcat -v threadtime > "$OUT/full-logcat.txt" 2>&1 ) & local LPID=$!
  sleep "$SECONDS_CAPTURE"; kill "$LPID" >/dev/null 2>&1

  local PS; PS="$("${A[@]}" shell ps -A 2>/dev/null | tr -d '\r')"
  local SPID NPID NSPID
  SPID="$(resolve_pid_from_ps "$PS" "$PACKAGE")"
  NPID="$(resolve_pid_from_ps "$PS" "com.xreal.evapro.nebula")"
  NSPID="$(resolve_pid_from_ps "$PS" "com.xreal.evapro.nebula:space")"
  printf '{\n  "package": "%s",\n  "shadow_pid": "%s",\n  "nebula_pid": "%s",\n  "nebula_space_pid": "%s"\n}\n' \
    "$PACKAGE" "$SPID" "$NPID" "$NSPID" > "$OUT/process-map.json"

  grep -iE 'mrPkgName|isEntryApp|multiResumeMode|NRXRApp|component not found|goLauncher|go launcher|XREALXRLoader|Failed to get XREAL|SHADOW_DEVICE_DIAG|LaunchSpaceAcrivity|NRFakeActivity|FATAL|SIGSEGV|displayId' \
    "$OUT/full-logcat.txt" 2>/dev/null > "$OUT/important-lines.txt"
  "${A[@]}" shell dumpsys activity activities 2>/dev/null | grep -iE 'ResumedActivity|topResumed|mFocusedApp|shadowlens' | tr -d '\r' > "$OUT/activity-state.txt"
  "${A[@]}" shell dumpsys display 2>/dev/null | grep -iE 'mDisplayId|uniqueId|XREAL|One Pro' | tr -d '\r' > "$OUT/display-state.txt"

  # ── 5. signals + classification ────────────────────────────────────────────────────────────
  local LINES SIGNALS; LINES="$(cat "$OUT/important-lines.txt")"
  SIGNALS="$(extract_signals "$LINES" "$SPID")"
  printf '%s\n' "$SIGNALS"

  # ── 6. seven-question observation ──────────────────────────────────────────────────────────
  echo "== observation (y/n) =="
  local q1 q2 q3 q4 q5 q6 q7
  read -rp "1. Was Shadow Lens visible in the MyGlasses MR grid? " q1
  read -rp "2. Did the glasses leave Nebula OS? " q2
  read -rp "3. Did the Audit Workspace appear? " q3
  read -rp "4. Did head rotation change the view? " q4
  read -rp "5. Did the controller select anything? " q5
  read -rp "6. Was the text readable? " q6
  read -rp "7. Did the app return to Nebula or black-screen? " q7
  printf '{\n  "grid_visible":"%s",\n  "left_nebula":"%s",\n  "workspace_appeared":"%s",\n  "head_rotation":"%s",\n  "controller_select":"%s",\n  "text_readable":"%s",\n  "returned_nebula_or_black":"%s"\n}\n' \
    "$q1" "$q2" "$q3" "$q4" "$q5" "$q6" "$q7" > "$OUT/physical-observation.json"

  GRID_ANSWER="$([ "$(printf '%s' "${q1:0:1}" | tr 'A-Z' 'a-z')" = "n" ] && echo no || echo yes)"
  WORKSPACE_SEEN="$([ "$(printf '%s' "${q3:0:1}" | tr 'A-Z' 'a-z')" = "n" ] && echo no || echo yes)"
  local CLASS; CLASS="$(classify_run "$LINES" "$SPID" "$GRID_ANSWER")"
  echo "CLASSIFICATION $CLASS"

  # ── 7. summary (physical flags stay false unless this run proves them) ─────────────────────
  local PASS=false; [ "$CLASS" = "PHYSICAL_PASS" ] && PASS=true
  {
    printf '{\n  "classification": "%s",\n  "mode": "%s",\n  "expected_version": "%s",\n  "installed_version": "%s",\n  "version_match": %s,\n  "device_model": "%s",\n  "physical_device_validated": %s,\n  "signals": {\n' \
      "$CLASS" "$MODE" "$EXPECTED_VERSION" "$VN" "$VERSION_MATCH" "$MODEL" "$PASS"
    printf '%s\n' "$SIGNALS" | awk -F= 'NR>1{printf ",\n"} {printf "    \"%s\": \"%s\"", $1, $2}'
    printf '\n  }\n}\n'
  } > "$OUT/device-run-summary.json"
  {
    echo "# Device run summary"
    echo
    echo "- classification: **$CLASS**"
    echo "- mode: \`$MODE\`  ·  installed: \`$VN\` (expected \`$EXPECTED_VERSION\`, match=$VERSION_MATCH)"
    echo "- physical_device_validated: **$PASS**"
    echo
    echo '## Signals (PID-attributed)'
    echo '```'
    printf '%s\n' "$SIGNALS"
    echo '```'
    echo
    echo "shadow_pid=$SPID  nebula_pid=$NPID  nebula_space_pid=$NSPID"
    echo
    echo "XR/loader signals are credited to Shadow ONLY when the log line's PID == shadow_pid."
    echo "Nebula's own Unity process can therefore never be read as a Shadow success."
    echo
    echo "Artifacts: full-logcat.txt · important-lines.txt · process-map.json · activity-state.txt ·"
    echo "display-state.txt · package-state.txt · physical-observation.json · device-run-summary.json"
  } > "$OUT/DEVICE_RUN_SUMMARY.md"

  redact_dir "$OUT" "$SERIAL" "$IP"
  echo "== wrote $OUTDIR_DEFAULT/ (serial + LAN IP redacted) =="
}

GRID_ANSWER="unknown"
WORKSPACE_SEEN="unknown"
if [ "${SELFTEST:-0}" != "1" ] && [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
