#!/usr/bin/env bash
# Restore the pristine demonstration state. The demo surfaces are STATIC frozen pages + read-only fixtures,
# so there is nothing destructive to reset — this only clears any browser localStorage note and re-checks
# that the fixtures are unmodified. Safe to run repeatedly. Never deletes source files.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FX="$REPO/demo/today-class/fixtures"
echo "reset: verifying demo fixtures are present + unmodified…"
if [ -f "$FX/SHA256SUMS.txt" ]; then
  ( cd "$FX" && shasum -a 256 -c SHA256SUMS.txt ) && echo "  ✅ fixtures match recorded hashes"
else
  echo "  ⚠️ SHA256SUMS.txt missing — run preflight."
fi
echo "reset: to reset the OPTIONAL Audit Room, press 0 (or R) in that browser tab."
echo "reset: verify.html + guided-shadow-demo hold no persistent state; just reload the tab."
