#!/usr/bin/env bash
# Installs the official XREAL SDK 3.1.0 as a LOCAL package for the Unity project WITHOUT committing the
# licensed binary. Takes the tarball path as an argument (no hard-coded username/path). It validates the
# package name+version from the tarball's package.json, then adds a local file: reference to a
# Git-IGNORED manifest overlay note + prints the exact line to add. It does NOT silently rewrite the
# committed manifest with an absolute path. Usage:
#   scripts/setup-local-xreal-sdk.sh ~/Downloads/com.xreal.xr.tar.gz
set -euo pipefail
TB="${1:-}"
[ -n "$TB" ] && [ -f "$TB" ] || { echo "usage: $0 <path-to-com.xreal.xr.tar.gz>"; exit 1; }
UNITY_PROJ="$(cd "$(dirname "$0")/../apps/shadow-lens/unity" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
tar -xzf "$TB" -C "$TMP" package/package.json 2>/dev/null || { echo "not a valid com.xreal.xr tarball (no package/package.json)"; exit 1; }
NAME=$(grep -oE '"name"[^,]*' "$TMP/package/package.json" | head -1)
VER=$(grep -oE '"version"[^,]*' "$TMP/package/package.json" | head -1)
echo "tarball: $TB"
echo "sha256:  $(shasum -a 256 "$TB" | cut -d' ' -f1)"
echo "package: $NAME  $VER"
case "$NAME" in *com.xreal.xr*) ;; *) echo "unexpected package name; aborting"; exit 1;; esac
case "$VER" in *3.1.0*) ;; *) echo "WARNING: expected version 3.1.0"; ;; esac
echo ""
echo "To install locally (NOT committed), add this line to $UNITY_PROJ/Packages/manifest.json dependencies:"
echo "  \"com.xreal.xr\": \"file:$TB\","
echo "Then open Unity to import + compile, and set the SHADOW_XREAL_SDK define for Android + Editor."
echo "Do NOT commit that absolute-path line (it is Alex-local). The XREAL candidate build requires it."
