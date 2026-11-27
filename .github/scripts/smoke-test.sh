#!/usr/bin/env bash
# Post-deploy smoke test: every SMOKE_PATHS entry answers 200 (after at most 3 redirects), and the receiver
# reports the expected release as the live one.
#
# Usage: smoke-test.sh <site-url>
# Env:   SMOKE_PATHS            space-separated paths, default "/" (e.g. "/ /about /contact /assets/app.css")
#        SMOKE_EXPECT_RELEASE   optional: the release id capabilities.current must name ("none" = no release
#                               is live, e.g. after a rollback to the site from before the first release)
#        SMOKE_ATTEMPTS (default 5), SMOKE_DELAY seconds (default 5), SMOKE_TAG (cache-buster)
#        DEPLOY_HOOK_TOKEN      for the release check
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base="${1:?usage: smoke-test.sh <site-url>}"
base="${base%/}"
attempts="${SMOKE_ATTEMPTS:-5}"
delay="${SMOKE_DELAY:-5}"
tag="${SMOKE_TAG:-$(date +%s)}"
paths="${SMOKE_PATHS:-/}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fetch() { # fetch <url> -> $status, $work/body, $work/headers
  status="$(curl -sS -L --max-redirs 3 --max-time 20 -A 'deploy-kit-smoke-test' -H 'Cache-Control: no-cache' \
    -D "$work/headers" -o "$work/body" -w '%{http_code}' "$1" 2> "$work/curl-error")" || status=000
}

explain() {
  if grep -qi '^cf-mitigated: *challenge' "$work/headers" 2> /dev/null || grep -qiE 'challenge-platform|cf-chl|<title>Just a moment' "$work/body" 2> /dev/null; then
    echo "::warning title=Cloudflare challenged the smoke test::Bot Fight Mode (Cloudflare > Security > Bots) or a WAF rule answers GitHub's runners with a challenge page. Turn Bot Fight Mode off (on the free plan no rule can skip it), or add a WAF skip rule for the smoke paths."
  fi
  if [[ -s "$work/curl-error" ]]; then echo "curl: $(head -c 300 "$work/curl-error")"; fi
  echo "Response starts with: $(head -c 300 "$work/body" 2> /dev/null | tr -d '\r' | tr '\n' ' ')"
}

failed=0
for path in $paths; do
  [[ "$path" == /* ]] || path="/$path"
  separator='?'
  [[ "$path" == *\?* ]] && separator='&'
  url="$base$path${separator}smoke=$tag"
  ok=0
  for ((i = 1; i <= attempts; i++)); do
    fetch "$url"
    if [[ "$status" == 200 ]]; then ok=1; break; fi
    echo "wait $path: HTTP $status (attempt $i of $attempts)"
    if ((i < attempts)); then sleep "$delay"; fi
  done
  if [[ "$ok" == 1 ]]; then
    echo "ok   $path ($(wc -c < "$work/body" | tr -d ' ') bytes) on attempt $i"
  else
    echo "::error title=Smoke test failed::$path last answered HTTP $status."
    explain
    failed=1
  fi
done

# The switch is atomic, so the receiver either names the new release or the switch did not happen: one call
# is enough (and it keeps the hook well under its 10 calls per 15 minutes).
if [[ "$failed" == 0 && -n "${SMOKE_EXPECT_RELEASE:-}" ]]; then
  if DEPLOY_HOOK_QUIET=1 DEPLOY_HOOK_RESPONSE="$work/caps.json" bash "$here/call-deploy-hook.sh" "$base" capabilities > "$work/hook.out" 2>&1; then
    live="$(python3 -I -c 'import json,sys; print((json.load(open(sys.argv[1])).get("capabilities") or {}).get("current") or "none")' "$work/caps.json" 2> /dev/null || echo '?')"
    if [[ "$live" == "$SMOKE_EXPECT_RELEASE" ]]; then
      echo "ok   the receiver reports release $live as live"
    else
      echo "::error title=Smoke test failed::The receiver reports release $live as live, not $SMOKE_EXPECT_RELEASE."
      failed=1
    fi
  else
    cat "$work/hook.out"
    echo "::error title=Smoke test failed::The receiver did not answer the capabilities check."
    failed=1
  fi
fi

exit "$failed"
