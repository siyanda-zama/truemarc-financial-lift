#!/usr/bin/env bash
# Call the deploy receiver: POST <site>/_deploy/hook.php, token in the X-Deploy-Token header.
#
# Usage: call-deploy-hook.sh <site-url> <action> [key=value ...]
#   action     capabilities, probe, release, confirm, rollback (deploy-kit/README.md, "Actions")
#   key=value  extra JSON fields: release=<id> sha256=<hex> symlinks=true mode=rename adopt=move
#              ("true"/"false" become booleans)
# Env:   DEPLOY_HOOK_TOKEN (required); DEPLOY_COMMIT, DEPLOY_RUN (optional, logged on the server)
#        DEPLOY_HOOK_RESPONSE=<file>  receives the raw answer (JSON, or whatever page came instead)
#        DEPLOY_HOOK_STATUS=<file>    receives the HTTP status
#        DEPLOY_HOOK_QUIET=1          do not print the answer on success
#        DEPLOY_HOOK_SOFT=1           do not fail on an HTTP error (the caller reads the status and answer)
#        DEPLOY_HOOK_RETRY_DELAY      seconds between retries (default 10; busy waits twice as long)
#
# The token goes into a header file (mode 600), never onto a command line or into the log. The X-Deploy-
# Token header is used because some cPanel PHP setups drop Authorization before PHP sees it.
set -euo pipefail

base="${1:?usage: call-deploy-hook.sh <site-url> <action> [key=value ...]}"
base="${base%/}"
action="${2:?usage: call-deploy-hook.sh <site-url> <action> [key=value ...]}"
shift 2
: "${DEPLOY_HOOK_TOKEN:?DEPLOY_HOOK_TOKEN is not set}"
url="$base/_deploy/hook.php"
delay="${DEPLOY_HOOK_RETRY_DELAY:-10}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077
{
  printf 'X-Deploy-Token: %s\n' "$DEPLOY_HOOK_TOKEN"
  if [[ -n "${DEPLOY_COMMIT:-}" ]]; then printf 'X-Deploy-Commit: %s\n' "$DEPLOY_COMMIT"; fi
  if [[ -n "${DEPLOY_RUN:-}" ]]; then printf 'X-Deploy-Run: %s\n' "$DEPLOY_RUN"; fi
  printf 'Content-Type: application/json\n'
} > "$work/headers"

# The JSON body is built by Python, so no value can break the quoting.
python3 -I - "$action" "$@" > "$work/body.json" <<'PY'
import json, sys
body = {"action": sys.argv[1]}
for pair in sys.argv[2:]:
    key, _, value = pair.partition("=")
    body[key] = {"true": True, "false": False}.get(value, value)
print(json.dumps(body))
PY

# A release can outlast Cloudflare's 100-second proxy timeout (524) while PHP carries on (the receiver
# ignores the abort). The release action is idempotent ("already_current"), so a retry after a gateway
# error, or after "busy" while the first run finishes, picks up the result.
status=000
for attempt in 1 2 3 4 5; do
  status="$(curl -sS --connect-timeout 30 --max-time 300 -A 'deploy-kit-hook' -X POST -H @"$work/headers" \
    --data-binary @"$work/body.json" -D "$work/response-headers" -o "$work/answer" -w '%{http_code}' "$url" 2> "$work/err")" || status=000
  case "$status" in
    000|502|504|520|521|522|523|524|525|526)
      if [[ "$attempt" -lt 5 ]]; then echo "attempt $attempt: HTTP $status, retrying in ${delay}s"; sleep "$delay"; fi ;;
    409)
      if [[ "$attempt" -lt 5 ]] && grep -q '"deploy_hook_busy"' "$work/answer" 2> /dev/null; then
        echo "attempt $attempt: another deploy hook run is in progress, retrying in $((delay * 2))s"; sleep $((delay * 2))
      else
        break
      fi
      ;;
    *) break ;;
  esac
done

touch "$work/answer"
if [[ -n "${DEPLOY_HOOK_RESPONSE:-}" ]]; then cp "$work/answer" "$DEPLOY_HOOK_RESPONSE"; fi
if [[ -n "${DEPLOY_HOOK_STATUS:-}" ]]; then printf '%s\n' "$status" > "$DEPLOY_HOOK_STATUS"; fi

# Pretty-print a JSON answer (names, ids and counts only, never secrets); otherwise its first bytes.
show() {
  python3 -I -c 'import json, sys
raw = open(sys.argv[1], encoding="utf-8", errors="replace").read()
try:
    print(json.dumps(json.loads(raw), indent=2))
except ValueError:
    print(raw[:300])' "$work/answer" 2> /dev/null || head -c 300 "$work/answer"
}

challenged() {
  grep -qi '^cf-mitigated: *challenge' "$work/response-headers" 2> /dev/null \
    || grep -qiE 'challenge-platform|cf-chl|<title>Just a moment' "$work/answer" 2> /dev/null
}

cloudflare_hint() {
  echo "::warning title=Cloudflare challenged the deploy::Cloudflare answered with a challenge page instead of letting the request reach the server. Bot Fight Mode (Security > Bots) blocks GitHub's runners and cannot be skipped by a rule on the free plan: turn it off, or on a paid plan add a WAF custom rule that skips bot checks for URI path starts with /_deploy/ (deploy-kit/README.md, Cloudflare)."
}

# What the error codes mean and what fixes them (deploy-kit/README.md has the full table).
explain() {
  local code="$1"
  case "$code" in
    adopt_required)
      echo "::error title=Existing site found (adopt_required)::The document root already holds a site. The first release moves these top-level names into ~/<DEPLOY_DIR>/legacy/<time>/ (never deleted; a rollback restores them): $(python3 -I -c 'import json,sys; c=json.load(open(sys.argv[1])).get("capabilities") or {}; print(", ".join(c.get("adopt_candidates") or []) or "(none)")' "$work/answer" 2> /dev/null). Keep any of them in place with DEPLOY_KEEP in ~/<APP_DIR>/.env, then run the workflow by hand with adopt_existing_site ticked." ;;
    checksum_mismatch) echo "The upload was incomplete or changed on the way. Re-run the workflow (the upload is retried and size-checked)." ;;
    archive_not_found) echo "The upload did not reach ~/<DEPLOY_DIR>/incoming/. Check the Upload step; the FTP account must start in the cPanel home folder." ;;
    archive_too_large) echo "The archive is over the server's limit (DEPLOY_MAX_ARCHIVE_MB in ~/<APP_DIR>/.env, default 300)." ;;
    unsafe_archive) echo "The server refused an entry of the archive (absolute path, .., symlink, .env, a server-only folder, .htaccess outside root/). deploy-hook.log names it under the request id. Nothing was changed." ;;
    after_unpack_failed) echo "app/deploy/after-unpack.php of the new release failed; the release was deleted and the live site is untouched. The exception is in ~/<APP_DIR>/storage/logs/deploy-hook.log under the request id." ;;
    document_root_mismatch) echo "This site's document root is not the DOCROOT folder (an addon domain?). Set the repository variable DOCROOT to its folder (cPanel > Domains shows it) and deploy again." ;;
    root_conflict) echo "A file in deploy/root/ would replace a name the deploy keeps in place (media, cgi-bin, _deploy, a DEPLOY_KEEP entry...). Rename it in the build." ;;
    switch_failed|write_failed) echo "A rename or write in the document root failed (permissions, disk quota). The receiver put the previous state back; check the quota in cPanel, then deploy again." ;;
    no_previous_release|rollback_target_missing) echo "There is no such earlier release on the server (capabilities.releases lists the kept ones). Deploy the older commit instead." ;;
    not_current) echo "Only the live release can be confirmed." ;;
    release_conflict) echo "A different release with this id is live. Re-run the workflow (a re-run gets a new id)." ;;
    extractor_unavailable) echo "PHP has neither the zip nor the phar extension. Enable zip in cPanel > Select PHP Version (or MultiPHP)." ;;
    layout_unsupported) echo "The DOCROOT folder does not exist in the cPanel home." ;;
    deploy_hook_busy) echo "Another deploy hook run is still in progress. Wait a minute and re-run." ;;
    php_too_old) echo "The site runs PHP older than 8.1. Choose 8.2 or newer in cPanel > MultiPHP Manager." ;;
    invalid_request) echo "The request was malformed (this script and the receiver disagree?). Make sure the kit's receiver and scripts come from the same version." ;;
    internal_error) echo "An unexpected error in the receiver. deploy-hook.log has it under the request id." ;;
  esac
}

case "$status" in
  200)
    if [[ "${DEPLOY_HOOK_QUIET:-}" != 1 ]]; then
      echo "Deploy hook ($action) answered:"
      show
    fi
    ;;
  *)
    if [[ "${DEPLOY_HOOK_SOFT:-}" == 1 ]]; then
      exit 0
    fi
    if challenged; then
      cloudflare_hint
      exit 1
    fi
    if [[ "$status" == 404 ]]; then
      echo "::error title=Deploy hook answered 404::Either DEPLOY_HOOK_TOKEN in ~/<APP_DIR>/.env is empty, shorter than 32 characters or different from the GitHub secret; or the hook was rate limited (10 calls per 15 minutes); or the receiver is not installed in this DOCROOT. The last line of ~/<APP_DIR>/storage/logs/deploy-hook.log says which (disabled, denied, rate_limited)."
      exit 1
    fi
    code="$(python3 -I -c 'import json,sys; print(((json.load(open(sys.argv[1])).get("error") or {}).get("code")) or "")' "$work/answer" 2> /dev/null || true)"
    request="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get("request_id") or "")' "$work/answer" 2> /dev/null || true)"
    if [[ "$code" == adopt_required ]]; then
      explain "$code"
    elif [[ -n "$code" ]]; then
      echo "::error title=Deploy hook ($action) failed: $code::HTTP $status, request id ${request:-?}. $(explain "$code")"
    else
      echo "::error::The deploy hook ($action) answered HTTP $status without a receiver answer."
      if [[ -s "$work/err" ]]; then echo "curl: $(head -c 300 "$work/err")"; fi
      show
    fi
    exit 1
    ;;
esac
