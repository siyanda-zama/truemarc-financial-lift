#!/usr/bin/env bash
# Screenshot a local route with headless Chrome (dev server must be running).
#   scripts/shot.sh <route> <out.png> [desktop|mobile] [height]
# desktop = 1440 wide. mobile = true 390px viewport (rendered through the dev server's /__shot iframe,
# because headless Chrome clamps windows to >= 500px). Height defaults: 5000 desktop / 3000 mobile.
set -euo pipefail
route="${1:-/}"; out="$2"; mode="${3:-desktop}"; base="${SHOT_BASE:-http://localhost:8080}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ "$mode" = "mobile" ]; then
  h="${4:-3000}"
  enc="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$route")"
  "$CHROME" --headless=new --hide-scrollbars --window-size=500,"$h" --virtual-time-budget=10000 --screenshot="$out" "$base/__shot?u=$enc&w=390&h=$h" >/dev/null 2>&1
  python3 -c "from PIL import Image; im=Image.open('$out'); im.crop((0,0,390,im.height)).save('$out')"
else
  h="${4:-5000}"
  "$CHROME" --headless=new --hide-scrollbars --window-size=1440,"$h" --virtual-time-budget=9000 --screenshot="$out" "$base$route" >/dev/null 2>&1
fi
echo "$out"
