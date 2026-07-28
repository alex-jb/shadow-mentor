#!/usr/bin/env bash
# Pre-class preflight — everything that must be true before the demo. Read-only checks; exits non-zero on
# any failure so it's obvious before class. No network required.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO"
FX="demo/today-class/fixtures"; FAIL=0
ok(){ echo "  ✅ $1"; }; bad(){ echo "  ❌ $1"; FAIL=1; }
echo "== Shadow classroom demo preflight =="
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && ok "in a git repo" || bad "not a git repo"
BR=$(git branch --show-current 2>/dev/null); [ "$BR" = "feat/shadow-spatial-ux-asset-audit-v11" ] && ok "branch $BR" || echo "  ⚠️ on branch $BR (expected feat/shadow-spatial-ux-asset-audit-v11)"
echo "  commit: $(git rev-parse --short HEAD)"
for f in verify.html demos/guided-shadow-demo.html demos/replay/3d/index.html demos/replay/3d/dist/audit-room.js; do
  [ -f "$f" ] && ok "exists: $f" || bad "MISSING: $f"
done
for f in pristine-banking-bundle.json tampered-banking-bundle.json SHA256SUMS.txt; do
  [ -f "$FX/$f" ] && ok "fixture: $f" || bad "MISSING fixture: $FX/$f"
done
if [ -f "$FX/SHA256SUMS.txt" ]; then ( cd "$FX" && shasum -a 256 -c SHA256SUMS.txt >/dev/null 2>&1 ) && ok "fixture hashes match" || bad "fixture hash MISMATCH"; fi
# frozen artifacts unchanged
VH=$(shasum -a 256 verify.html | cut -d' ' -f1)
[ "$VH" = "c478b46f42d0a9aea407a68a14178ffd638ba608b8972c806bd612c9f7d0d6bc" ] && ok "frozen verify.html unchanged" || echo "  ⚠️ verify.html hash $VH (differs from documented frozen hash)"
command -v python3 >/dev/null && ok "python3 available (server)" || echo "  ⚠️ python3 missing — use file:// fallback"
if lsof -iTCP:8137 -sTCP:LISTEN >/dev/null 2>&1; then echo "  ⚠️ port 8137 busy — demo-stop.sh first"; else ok "port 8137 free"; fi
# offline safety: no external RUNTIME resources (scripts/styles/images/fonts/fetch) — <a href> links are fine.
for f in verify.html demos/guided-shadow-demo.html; do
  n=$(grep -coE '(src|href)="https?://|url\(https?://|fetch\("?https?://|import[^"]*"https?://' "$f" | head -1)
  # exclude <a href="http…"> (a plain hyperlink, not loaded at runtime)
  rt=$(grep -oE '(<script[^>]*src="https?://|<link[^>]*href="https?://|<img[^>]*src="https?://|url\(https?://|fetch\("?https?://)' "$f" | wc -l | tr -d ' ')
  [ "$rt" -eq 0 ] && ok "no external RUNTIME resources in $(basename $f) (offline-safe)" || echo "  ⚠️ $f loads $rt external runtime resource(s) — investigate"
done
echo "== $( [ $FAIL -eq 0 ] && echo 'PREFLIGHT OK' || echo 'PREFLIGHT FAILED — fix the ❌ above' ) =="
exit $FAIL
