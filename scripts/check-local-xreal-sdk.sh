#!/usr/bin/env bash
# Reports whether the official XREAL SDK 3.1.0 (com.xreal.xr) is available to the Unity project.
# Never commits the SDK. Exit 0 if present (manifest ref or PackageCache), 1 if absent.
set -euo pipefail
UNITY_PROJ="$(cd "$(dirname "$0")/../apps/shadow-lens/unity" && pwd)"
if grep -q '"com.xreal.xr"' "$UNITY_PROJ/Packages/manifest.json" 2>/dev/null; then
  echo "com.xreal.xr referenced in manifest.json:"; grep '"com.xreal.xr"' "$UNITY_PROJ/Packages/manifest.json"; exit 0
fi
if ls -d "$UNITY_PROJ"/Library/PackageCache/com.xreal.xr* >/dev/null 2>&1; then
  echo "com.xreal.xr present in Library/PackageCache"; exit 0
fi
echo "XREAL SDK NOT installed. Run: scripts/setup-local-xreal-sdk.sh <path-to-com.xreal.xr.tar.gz>"; exit 1
