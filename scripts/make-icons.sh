#!/usr/bin/env bash
# Render favicons, app icons and the 1200x630 link-preview image from scripts/icons/* (headless Chrome + Pillow).
#   npm run icons            (or: bash scripts/make-icons.sh)
#   SHARE_NAME=share-2027-03.jpg npm run icons   new share-image name = cache-bust for WhatsApp/Facebook
# After changing SHARE_NAME, update SHARE_IMAGE in src/components/Seo.tsx and the og:image tags in index.html;
# after changing any icon, bump ?v=YYYYMMDD on the icon links in index.html.
# Writes public/{favicon.ico,favicon.svg,site.webmanifest untouched}, public/icons/*, public/img/$SHARE_NAME,
# and scripts/icons/contact-sheet.png (look at the 16px and 32px favicons before shipping).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/scripts/icons"; P="$ROOT/public"; SHARE_NAME="${SHARE_NAME:-share-2026-11.jpg}"
C="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
cp "$SRC"/favicon.svg "$SRC"/icon.html "$SRC"/share.html "$W"/
cp "$ROOT/node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2" "$W/font.woff2"
cp "$P/brand/truemarc-logo-light.png" "$W/logo-light.png"
shot() { "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 "$@" >/dev/null 2>&1; }
# Headless Chrome won't render a window narrower than ~500px: render at >= 512 and scale down.
shot --default-background-color=00000000 --window-size=512,512 --screenshot="$W/_fav-512.png" "file://$W/favicon.svg"
shot --window-size=512,512 --screenshot="$W/_icon-512.png" "file://$W/icon.html"
shot --virtual-time-budget=2000 --window-size=1200,630 --screenshot="$W/_share.png" "file://$W/share.html"
mkdir -p "$P/icons" "$P/img"
python3 - "$W" "$P" "$SHARE_NAME" "$SRC" <<'PY'
import sys
from PIL import Image
W, P, NAME, SRC = sys.argv[1:5]
icon = Image.open(f'{W}/_icon-512.png').convert('RGB')
fav = Image.open(f'{W}/_fav-512.png').convert('RGBA')
for n in (512, 192):
    icon.resize((n, n), Image.LANCZOS).save(f'{P}/icons/icon-{n}.png', optimize=True)
icon.resize((180, 180), Image.LANCZOS).save(f'{P}/icons/apple-touch-icon.png', optimize=True)
fav.resize((32, 32), Image.LANCZOS).save(f'{P}/icons/favicon-32.png', optimize=True)
fav.save(f'{P}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
share = Image.open(f'{W}/_share.png').convert('RGB')
assert share.size == (1200, 630), share.size
share.save(f'{P}/img/{NAME}', quality=86, optimize=True, progressive=True)
sheet = Image.new('RGB', (1200, 950), '#808080')
sheet.paste(share, (0, 0))
sheet.paste(icon.resize((300, 300)), (0, 640))
for x, n in ((340, 128), (500, 32), (560, 16)):
    f = fav.resize((n, n), Image.LANCZOS); sheet.paste(f, (x, 640), f)
for x, n in ((620, 16), (760, 32)):  # 16 and 32 blown up 8x/4x to judge legibility
    f = fav.resize((n, n), Image.LANCZOS).resize((128, 128), Image.NEAREST); sheet.paste(f, (x, 640), f)
sheet.save(f'{SRC}/contact-sheet.png')
print(f'wrote icons + img/{NAME}; review {SRC}/contact-sheet.png')
PY
cp "$SRC/favicon.svg" "$P/favicon.svg"; cp "$SRC/favicon.svg" "$P/icons/favicon.svg"
