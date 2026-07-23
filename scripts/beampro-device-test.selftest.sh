#!/usr/bin/env bash
# scripts/beampro-device-test.selftest.sh
# Self-test for the Beam Pro harness's pure logic. Runs WITHOUT a connected device: it sources the
# harness with SELFTEST=1 (so main() does not run) and feeds fixtures to the parsers/classifier.
# The decisive case is #8: XREAL success lines emitted by NEBULA's pid must never be credited to Shadow.
set -uo pipefail
SELFTEST=1
# shellcheck source=./beampro-device-test.sh
. "$(dirname "${BASH_SOURCE[0]}")/beampro-device-test.sh"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL %s\n     expected: %s\n     actual:   %s\n' "$1" "$2" "$3"; }
eq()   { [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2" "$3"; }

echo "== 1. mDNS parser (standard output) =="
MDNS_1='List of discovered mdns services
adb-X4200-abcdef	_adb-tls-connect._tcp	192.168.1.42:37123'
eq "picks IP:port of _adb-tls-connect._tcp" "192.168.1.42:37123" "$(mdns_pick_ipport "$MDNS_1")"

echo "== 2. changing wireless-debugging port =="
MDNS_2='List of discovered mdns services
adb-X4200-abcdef	_adb-tls-connect._tcp	192.168.1.42:45999'
eq "picks the NEW port without user input" "192.168.1.42:45999" "$(mdns_pick_ipport "$MDNS_2")"

echo "== 3. missing device / no service =="
eq "empty mdns → empty result" "" "$(mdns_pick_ipport 'List of discovered mdns services')"
eq "only pairing service (not tls-connect) → empty" "" "$(mdns_pick_ipport 'adb-X4200	_adb-tls-pairing._tcp	192.168.1.42:5555')"

echo "== 4. multiple devices → hint selects =="
MDNS_4='List of discovered mdns services
adb-PIXEL-111	_adb-tls-connect._tcp	192.168.1.10:11111
adb-X4200-abcdef	_adb-tls-connect._tcp	192.168.1.42:37123'
eq "hint X4200 picks the Beam Pro" "192.168.1.42:37123" "$(mdns_pick_ipport "$MDNS_4" "X4200")"
eq "no hint picks the first" "192.168.1.10:11111" "$(mdns_pick_ipport "$MDNS_4")"

echo "== 5. stale connection (old entry gone, new port advertised) =="
MDNS_5='List of discovered mdns services
adb-X4200-abcdef	_adb-tls-connect._tcp	192.168.1.42:52001'
eq "re-resolves to the current port" "192.168.1.42:52001" "$(mdns_pick_ipport "$MDNS_5" "X4200")"

echo "== 6. PID attribution from ps =="
PS='USER PID PPID NAME
u0_a1 31505 1 com.shadowlens.xrealvoice
u0_a2 31828 1 com.xreal.evapro.nebula:space
u0_a3 24440 1 com.xreal.evapro.nebula'
eq "shadow pid" "31505" "$(resolve_pid_from_ps "$PS" com.shadowlens.xrealvoice)"
eq "nebula:space pid" "31828" "$(resolve_pid_from_ps "$PS" com.xreal.evapro.nebula:space)"
eq "unknown package → empty" "" "$(resolve_pid_from_ps "$PS" com.does.not.exist)"

echo "== 7. empty logs =="
eq "no lines → INSUFFICIENT_EVIDENCE" "INSUFFICIENT_EVIDENCE" "$(classify_run "" "31505")"

echo "== 8. Nebula-vs-Shadow separation (the candidate-04 mis-attribution) =="
LOG_8='07-23 13:22:31.481 31505 31505 I NRXRApp : onCreate: pacakge=com.shadowlens.xrealvoice, isEntryApp=false, multiResumeMode=false
07-23 13:22:44.252 24440 24440 I LaunchManager: onDisplayAdded: component not found on display:19
07-23 13:22:46.413 24440 24440 D myGlasses: mrPkgName is empty,display remove , go launcher.
07-23 13:22:50.586 31828 31858 I Unity   : [XREALXRLoader] Init End
07-23 13:22:51.085 31828 31858 I Unity   : [XREALXRLoader] Start End'
R8="$(classify_run "$LOG_8" "31505")"
[ "$R8" != "PHYSICAL_PASS" ] && ok "Nebula's XREALXRLoader success is NOT credited to Shadow (got $R8)" \
  || bad "Nebula success must not become PHYSICAL_PASS" "not PHYSICAL_PASS" "$R8"
eq "classified as Nebula fallback" "NEBULA_FALLBACK_LAUNCHER" "$R8"

echo "== 9. classifier — other states =="
eq "shadow XR settings failure" "SHADOW_XR_LOADER_NOT_STARTED" \
  "$(classify_run '07-23 12:40:31 31505 31515 I NRXRApp : isEntryApp=true
07-23 12:40:37.287 31505 31515 E Unity : Unable to start XREAL XR Plugin. Failed to get XREAL Settings.' "31505")"
eq "shadow crash" "SHADOW_PROCESS_CRASHED" \
  "$(classify_run '07-23 12:40:37 31505 31515 F AndroidRuntime: FATAL EXCEPTION' "31505")"
eq "grid not visible (user-confirmed)" "MR_GRID_DISCOVERY_FAILED" \
  "$(classify_run 'anything' "31505" "no")"
eq "handoff ok + loader ok + display running → PASS" "PHYSICAL_PASS" \
  "$(classify_run '07-23 1 31505 31515 I NRXRApp : isEntryApp=true
07-23 1 31505 31515 I Unity : [XREALXRLoader] Init End
07-23 1 31505 31515 I Unity : [XREALXRLoader] Start End
07-23 1 31505 31515 I Unity : SHADOW_DEVICE_DIAG [change] pkg=com.shadowlens.xrealvoice pid=31505 | disp=1/1 in=1/1' "31505" "yes")"
eq "handoff ok + loader ok but display not running" "SHADOW_XR_DISPLAY_NOT_RUNNING" \
  "$(classify_run '07-23 1 31505 31515 I NRXRApp : isEntryApp=true
07-23 1 31505 31515 I Unity : [XREALXRLoader] Init End
07-23 1 31505 31515 I Unity : SHADOW_DEVICE_DIAG [start] pkg=com.shadowlens.xrealvoice pid=31505 | disp=0/0 in=0/0' "31505" "yes")"

eq "shadow running but operator saw no workspace" "SHADOW_RUNNING_NO_VISIBLE_WORKSPACE" \
  "$(WORKSPACE_SEEN=no classify_run '07-23 1 31505 31515 I NRXRApp : isEntryApp=true
07-23 1 31505 31515 I Unity : [XREALXRLoader] Init End
07-23 1 31505 31515 I Unity : SHADOW_DEVICE_DIAG [change] pid=31505 | disp=1/1 in=1/1' "31505" "yes")"
eq "no handoff evidence at all" "MR_PACKAGE_HANDOFF_MISSING" \
  "$(classify_run '07-23 1 24440 24440 I LaunchManager: onDisplayAdded: component not found on display:19' "31505")"

echo "== 10. signal extraction (§5 report fields) =="
sig() { extract_signals "$1" "${2:-}" | grep "^$3=" | cut -d= -f2-; }
eq "mr_pkg_name=empty"          "empty" "$(sig "$LOG_8" 31505 mr_pkg_name)"
eq "is_entry_app=false"         "false" "$(sig "$LOG_8" 31505 is_entry_app)"
eq "multi_resume_mode=false"    "false" "$(sig "$LOG_8" 31505 multi_resume_mode)"
eq "shadow_xr_loader=no (it was Nebula's)"  "no"  "$(sig "$LOG_8" 31505 shadow_xr_loader)"
eq "nebula_xr_loader=yes"                   "yes" "$(sig "$LOG_8" 31505 nebula_xr_loader)"
eq "nebula_fallback_launcher=yes"           "yes" "$(sig "$LOG_8" 31505 nebula_fallback_launcher)"
eq "shadow_fatal=no"                        "no"  "$(sig "$LOG_8" 31505 shadow_fatal)"
LOG_10='07-23 1 31505 31515 I NRXRApp : isEntryApp=true, multiResumeMode=true
07-23 1 31505 31515 I myGlasses: mrPkgName = com.shadowlens.xrealvoice
07-23 1 31505 31515 I Unity : [XREALXRLoader] Start End
07-23 1 31505 31515 I Unity : SHADOW_DEVICE_DIAG [change] pid=31505 | disp=1/1 in=1/1'
eq "mr_pkg_name=shadow"           "shadow" "$(sig "$LOG_10" 31505 mr_pkg_name)"
eq "shadow_xr_loader=yes"         "yes"    "$(sig "$LOG_10" 31505 shadow_xr_loader)"
eq "shadow_xr_display_running=yes" "yes"   "$(sig "$LOG_10" 31505 shadow_xr_display_running)"
eq "shadow_xr_input_running=yes"   "yes"   "$(sig "$LOG_10" 31505 shadow_xr_input_running)"
eq "nebula_xr_loader=no"           "no"    "$(sig "$LOG_10" 31505 nebula_xr_loader)"
eq "empty log → unknown handoff"   "unknown" "$(sig "" 31505 mr_pkg_name)"
eq "no shadow pid → alive=no"      "no"      "$(sig "$LOG_8" "" shadow_pid_alive)"

echo
echo "selftest: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
