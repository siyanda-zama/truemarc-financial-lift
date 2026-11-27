#!/usr/bin/env bash
# Purge the whole Cloudflare cache for the zone, after a deploy or a rollback. Everything, because it is
# simple and no cached HTML may point at assets the new release no longer has.
# Env: CLOUDFLARE_API_TOKEN (permission Zone > Cache Purge > Purge, for this zone), CLOUDFLARE_ZONE_ID
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is not set}" "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID is not set}"
[[ "$CLOUDFLARE_ZONE_ID" =~ ^[0-9a-f]{32}$ ]] || { echo "::error::CLOUDFLARE_ZONE_ID must be the 32-character zone id (Cloudflare > the site > Overview > API)."; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077
# The token goes in a header file, never on the command line.
printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$CLOUDFLARE_API_TOKEN" > "$work/headers"
status="$(curl -sS --connect-timeout 30 --max-time 60 -o "$work/cf.json" -w '%{http_code}' -X POST -H @"$work/headers" \
  --data '{"purge_everything":true}' "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache")" || status=000
if [[ "$status" == 200 ]] && grep -q '"success": *true' "$work/cf.json"; then
  echo "Cloudflare cache purged."
else
  echo "::error::Cloudflare purge failed (HTTP $status). The token needs Zone > Cache Purge > Purge for this zone."
  python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(json.dumps(d.get("errors", []), indent=2))' "$work/cf.json" 2> /dev/null || true
  exit 1
fi
