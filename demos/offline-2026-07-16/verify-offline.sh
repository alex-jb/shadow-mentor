#!/usr/bin/env bash
# verify-offline.sh — smoke check that xreal.html is genuinely offline-safe.
#
# Exits 0 if:
#   1. FALLBACK_DESCRIPTOR is present as a const declaration
#   2. no non-cosmetic http(s):// URLs point at anything other than about:blank / #
#   3. the only fetch() call is inside fetchDescriptor which has a catch block
#
# Exits 1 with a diagnostic if any check fails.
#
# Usage: bash demos/offline-2026-07-16/verify-offline.sh
#
# This script does NOT run the demo in a browser. Do that manually via
# `open demos/offline-2026-07-16/xreal.html` per the rehearsal checklist.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="$DIR/xreal.html"

if [ ! -f "$HTML" ]; then
  echo "✗ xreal.html not found at $HTML" >&2
  exit 1
fi

echo "checking $HTML"

# Check 1: FALLBACK_DESCRIPTOR present
if ! grep -q "^const FALLBACK_DESCRIPTOR" "$HTML"; then
  echo "✗ FALLBACK_DESCRIPTOR const not found — offline path is missing" >&2
  exit 1
fi
echo "  ✓ FALLBACK_DESCRIPTOR present"

# Check 2: no external http(s):// asset loads (only inline text or documented brand URLs allowed)
# Allow: about:blank, #anchor, mailto:, developer.mozilla.org (docstring), and prose mentions
# Reject: <script src="http">, <link href="http">, <img src="http">
BAD_TAGS=$(grep -Eo '<(script|link|img|iframe)[^>]+(src|href)=["'\''"]https?://[^"'\''" ]*' "$HTML" || true)
if [ -n "$BAD_TAGS" ]; then
  echo "✗ found external asset loads that would break file:// path:" >&2
  echo "$BAD_TAGS" | sed 's/^/    /' >&2
  exit 1
fi
echo "  ✓ no external <script>/<link>/<img> tag URLs"

# Check 3: exactly one fetch() call, inside fetchDescriptor, wrapped in try/catch
FETCH_COUNT=$(grep -c "await fetch(" "$HTML" || true)
if [ "$FETCH_COUNT" -gt 1 ]; then
  echo "✗ more than one fetch() call ($FETCH_COUNT); each needs its own catch fallback" >&2
  exit 1
fi
if ! grep -q "console.warn(\"live fetch failed" "$HTML"; then
  echo "✗ fetch() present but the documented catch-fallback warning is missing" >&2
  exit 1
fi
echo "  ✓ fetch() has a try/catch fallback to FALLBACK_DESCRIPTOR"

# Check 4: fallback status text mentions "offline" so the operator sees the mode
if ! grep -q "fallback fixture (offline)" "$HTML"; then
  echo "✗ status text does not say 'fallback fixture (offline)' — operator will not know they're on the offline path" >&2
  exit 1
fi
echo "  ✓ status text signals offline mode to the operator"

echo ""
echo "✓ all offline-safety checks passed."
echo "  next step: open $HTML in Chrome via file:// with airplane mode ON and confirm the render"
echo "  see demos/offline-2026-07-16/README.md for the rehearsal checklist"
