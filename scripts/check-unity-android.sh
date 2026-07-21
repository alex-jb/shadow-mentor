#!/usr/bin/env bash
# scripts/check-unity-android.sh
# §5 — checks the OPERATOR's Unity install for the Android modules needed to build the mock APK.
# A desktop project compiling does NOT imply Android Build Support is installed. Unity Hub on macOS
# stores the modules at <install-root>/PlaybackEngines/AndroidPlayer (BESIDE Unity.app), not under
# Unity.app/Contents — this script checks BOTH candidates. Run on the Unity machine:
#   bash scripts/check-unity-android.sh [UNITY_INSTALL_ROOT]
set -u
VER="6000.0.23f1"

# Arg 1 may be the install root OR the .app/Contents path; normalize to the install root.
IN="${1:-/Applications/Unity/Hub/Editor/$VER}"
case "$IN" in
  */Unity.app/Contents) UNITY_INSTALL_ROOT="${IN%/Unity.app/Contents}" ;;
  */Unity.app)          UNITY_INSTALL_ROOT="${IN%/Unity.app}" ;;
  *)                    UNITY_INSTALL_ROOT="$IN" ;;
esac
UNITY_APP_CONTENTS="$UNITY_INSTALL_ROOT/Unity.app/Contents"

# AndroidPlayer: prefer the install-root location, then the .app/Contents location.
ANDROID_PLAYER=""
for cand in "$UNITY_INSTALL_ROOT/PlaybackEngines/AndroidPlayer" "$UNITY_APP_CONTENTS/PlaybackEngines/AndroidPlayer"; do
  if [ -d "$cand" ]; then ANDROID_PLAYER="$cand"; break; fi
done

MISSING=0
ok(){ printf "  OK   %s\n      %s\n" "$1" "$2"; }
miss(){ printf "  MISS %s\n" "$1"; MISSING=1; }

echo "[shadow-lens] Unity Android toolchain check"
echo "  install root: $UNITY_INSTALL_ROOT"

if [ -n "$ANDROID_PLAYER" ]; then
  ok "Android Build Support:" "$ANDROID_PLAYER"
else
  miss "Android Build Support (looked in <root>/PlaybackEngines and <root>/Unity.app/Contents/PlaybackEngines)"
fi

if [ -n "$ANDROID_PLAYER" ]; then
  [ -d "$ANDROID_PLAYER/SDK" ]    && ok "Android SDK:"  "$ANDROID_PLAYER/SDK"  || { [ -n "${ANDROID_HOME:-}" ] && ok "Android SDK (ANDROID_HOME):" "$ANDROID_HOME" || miss "Android SDK"; }
  [ -d "$ANDROID_PLAYER/NDK" ]    && ok "Android NDK:"  "$ANDROID_PLAYER/NDK"  || { [ -n "${ANDROID_NDK_ROOT:-}" ] && ok "Android NDK (env):" "$ANDROID_NDK_ROOT" || miss "Android NDK (needed for IL2CPP)"; }
  [ -d "$ANDROID_PLAYER/OpenJDK" ] && ok "OpenJDK:"     "$ANDROID_PLAYER/OpenJDK" || { command -v java >/dev/null && ok "OpenJDK (java on PATH):" "$(command -v java)" || miss "OpenJDK"; }
  ADB="$ANDROID_PLAYER/SDK/platform-tools/adb"
  [ -x "$ADB" ] && ok "adb:" "$ADB" || { command -v adb >/dev/null && ok "adb (PATH):" "$(command -v adb)" || miss "adb (SDK platform-tools)"; }
  # IL2CPP: the exact Variations subdir name varies by Unity version → detect robustly.
  IL2=$(ls -d "$ANDROID_PLAYER"/Variations/*il2cpp* 2>/dev/null | head -1)
  [ -n "$IL2" ] && ok "IL2CPP Android support:" "$IL2" || miss "IL2CPP Android support (no *il2cpp* under Variations/)"
fi

echo
if [ "$MISSING" -eq 0 ] && [ -n "$ANDROID_PLAYER" ]; then
  echo "ALL PRESENT — you can build the mock Android APK (ARM64 · IL2CPP)."
else
  cat <<'EOF'
MISSING MODULES — install, then re-run:
  1. Unity Hub → Installs → 6000.0.23f1 → gear ⚙ → Add Modules.
  2. Check Android Build Support → expand → also "Android SDK & NDK Tools" and "OpenJDK".
  3. Reopen the project, Build Settings → Platform = Android (Switch Platform).
  4. Player Settings → Scripting Backend = IL2CPP, Target Architectures = ARM64.
A compiling desktop project does NOT imply Android support is installed.
EOF
fi
exit "$MISSING"
