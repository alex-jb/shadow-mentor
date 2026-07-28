#!/usr/bin/env bash
# Freezes a built APK as an IMMUTABLE stage artifact: records SHA-256 + size + git commit into
# FROZEN.json, copies the APK to frozen/<name>-<commit>.apk (chmod 444), and refuses to overwrite
# an existing frozen record for the same SHA. Run AFTER a successful Unity build.
#   bash demo/wednesday/freeze-apk.sh <path-to.apk> <label e.g. mock-stable|xreal-candidate>
set -euo pipefail
APK="${1:?usage: freeze-apk.sh <apk> <label>}"; LABEL="${2:?label required (mock-stable|xreal-candidate)}"
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="$HERE/frozen"; mkdir -p "$OUT"
[ -f "$APK" ] || { echo "no APK at $APK"; exit 1; }
SHA=$(shasum -a 256 "$APK" | awk '{print $1}'); SIZE=$(wc -c < "$APK" | tr -d ' ')
COMMIT=$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo unknown)
DEST="$OUT/${LABEL}-${COMMIT}.apk"
if [ -f "$DEST" ]; then
  EXIST=$(shasum -a 256 "$DEST" | awk '{print $1}')
  [ "$EXIST" = "$SHA" ] && { echo "already frozen (identical): $DEST"; exit 0; } || { echo "REFUSING: $DEST exists with a DIFFERENT hash — frozen artifacts are immutable"; exit 1; }
fi
cp "$APK" "$DEST"; chmod 444 "$DEST"
printf '{ "label": "%s", "apk": "%s", "sha256": "%s", "bytes": %s, "commit": "%s", "frozen_at_utc": "%s" }\n' \
  "$LABEL" "$(basename "$DEST")" "$SHA" "$SIZE" "$COMMIT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$OUT/${LABEL}.frozen.json"
echo "FROZEN → $DEST (read-only). Record: $OUT/${LABEL}.frozen.json"
