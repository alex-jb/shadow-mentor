#!/usr/bin/env bash
# scripts/check-unity-android.sh
# §5 — checks the OPERATOR's Unity install for the Android modules needed to build the mock APK.
# A desktop project compiling does NOT imply Android Build Support is installed — this checks it.
# Run on the machine with Unity: bash scripts/check-unity-android.sh [UNITY_EDITOR_PATH]
set -u
VER="6000.0.23f1"
# Guess the editor path (Unity Hub default on macOS) unless one is passed.
EDITOR="${1:-/Applications/Unity/Hub/Editor/$VER/Unity.app/Contents}"
AP="$EDITOR/PlaybackEngines/AndroidPlayer"

ok(){ printf "  OK   %s\n" "$1"; }
miss(){ printf "  MISS %s\n" "$1"; MISSING=1; }
MISSING=0

echo "[shadow-lens] Unity Android toolchain check (editor: $EDITOR)"
[ -d "$EDITOR" ] && ok "Unity editor $VER" || { miss "Unity editor at $EDITOR (pass the real path as arg 1)"; }

[ -d "$AP" ] && ok "Android Build Support (PlaybackEngines/AndroidPlayer)" || miss "Android Build Support module"
[ -d "$AP/SDK" ] || [ -n "${ANDROID_HOME:-}" ] && ok "Android SDK" || miss "Android SDK (Unity-managed or ANDROID_HOME)"
[ -d "$AP/NDK" ] || [ -n "${ANDROID_NDK_ROOT:-}" ] && ok "Android NDK" || miss "Android NDK (needed for IL2CPP)"
{ [ -d "$EDITOR/OpenJDK" ] || command -v java >/dev/null; } && ok "OpenJDK / java" || miss "OpenJDK (Unity module) or java on PATH"
{ [ -x "$AP/SDK/platform-tools/adb" ] || command -v adb >/dev/null; } && ok "adb" || miss "adb (SDK platform-tools)"
[ -d "$AP/Variations/il2cpp" ] && ok "IL2CPP Android support" || miss "IL2CPP Android support (Variations/il2cpp)"

echo
if [ "$MISSING" -eq 0 ]; then
  echo "ALL PRESENT — you can build the mock Android APK (ARM64 · IL2CPP)."
else
  cat <<'EOF'
MISSING MODULES — install them, then re-run:
  1. Open Unity Hub → Installs → the 6000.0.23f1 row → gear ⚙ → Add Modules.
  2. Check: Android Build Support → expand → also check "Android SDK & NDK Tools" and "OpenJDK".
  3. Install, reopen the project, and set Build Settings → Platform = Android (Switch Platform).
  4. Player Settings → Other → Scripting Backend = IL2CPP, Target Architectures = ARM64.
Do NOT assume the Mac Unity has Android support just because the desktop project compiles.
EOF
fi
exit $MISSING
