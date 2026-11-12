#!/usr/bin/env bash
# Renders the store images in this folder from src/*.html with headless Chrome.
# Usage (from the repo root): bash docs/store/assets/render.sh
# Needs google-chrome (or set CHROME=/path/to/chrome). Fake, neutral data only — no real names.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-google-chrome}"
shot() { # <html> <png> <width> <height> [transparent]
  local bg=()
  [[ "${5:-}" == "transparent" ]] && bg=(--default-background-color=00000000)
  "$CHROME" --headless --disable-gpu --hide-scrollbars --no-sandbox --force-device-scale-factor=1 \
    --allow-file-access-from-files "${bg[@]}" --window-size="$3,$4" --screenshot="$PWD/$2" "file://$PWD/src/$1" >/dev/null 2>&1
  echo "$2 ($3x$4)"
}
shot screenshot-1-dang-gio-hoc.html screenshot-1-dang-gio-hoc-1280x800.png 1280 800
shot screenshot-2-popup-khoa.html   screenshot-2-viec-hom-nay-1280x800.png 1280 800
shot screenshot-3-gio-tu-do.html    screenshot-3-gio-tu-do-1280x800.png 1280 800
shot promo-small-440x280.html       promo-small-440x280.png 440 280
shot icon.html                      store-icon-128.png 128 128 transparent
shot logo-edge.html                 edge-logo-300.png 300 300 transparent
mkdir -p icons
for s in 16 32 48; do shot icon-tight.html "icons/icon-$s.png" "$s" "$s" transparent; done
shot icon.html icons/icon-128.png 128 128 transparent
