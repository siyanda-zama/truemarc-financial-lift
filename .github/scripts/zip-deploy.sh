#!/usr/bin/env bash
# Zip releases for cPanel hosting with FTP only (deploy-kit/README.md). The site goes up as ONE archive
# over FTPS; the deploy receiver verifies it, unpacks it into ~/<DEPLOY_DIR>/releases/<id>, runs the
# release's after-unpack step and switches the live site atomically. One 30 MB file costs a few round
# trips; 1,200 small files cost thousands (the server is ~250 ms from GitHub: 18 minutes vs 23 seconds).
#
#   zip-deploy.sh detect      <site-url> <kit-dir> [after-bootstrap]  ask the receiver; must it be (re)installed?
#   zip-deploy.sh bootstrap   <kit-dir>                       upload ONLY the receiver and the stub (seconds)
#   zip-deploy.sh ftp-check                                   FTPS login works and starts in the cPanel home
#   zip-deploy.sh pack        <bundle-dir> <kit-dir> <id> <out>   check the build, write <out>/<id>.zip and .json
#   zip-deploy.sh upload      <out> <id> <remote-dir>         curl -T over FTPS, with retries and a size check
#   zip-deploy.sh release     <site-url> <out> <id>           symlink probe (first release only), then release
#   zip-deploy.sh confirm     <site-url> <id>                 the release passed the smoke test
#   zip-deploy.sh rollback    <site-url> [<id>|legacy]        back to the previous release (or to that one)
#   zip-deploy.sh fetch       <remote-path> <local-file>      download one file over FTPS (the dry-run preview)
#   zip-deploy.sh render-stub <kit-dir> <out-file>            the stub with APP_DIR, DEPLOY_DIR, DOCROOT filled in
#   zip-deploy.sh receiver-digest <receiver-dir>              what capabilities.receiver_digest must say
#   zip-deploy.sh version-lt  <a> <b>                         exit 0 when version a is older than b
#
# Env: DEPLOY_HOOK_TOKEN (hook calls); FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_PORT (default 21);
# APP_DIR, DEPLOY_DIR, DOCROOT (folders in the cPanel home; default site_app, site_deploy, public_html);
# MODE (release: the mode detect reported, empty = probe first), SWITCH_MODE (force symlink or rename),
# ADOPT (move = the first release may move an existing site into ~/<DEPLOY_DIR>/legacy/<time>/).
# Results are written as key=value lines to $GITHUB_OUTPUT when it is set, and always printed.
#
# FTP_SERVER must be the server's own hostname (cPanel > General Information, e.g. cp79.domains.co.za):
# the FTP certificate is *.domains.co.za, so ftp.<your-domain> fails verification. FTP never goes
# through Cloudflare, so an orange-clouded ftp. record cannot work either. Uploads are explicit FTPS
# (AUTH TLS on port 21, --ssl-reqd): plain FTP is never used.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command="${1:-}"
if [[ $# -gt 0 ]]; then shift; fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077

APP_DIR="${APP_DIR:-site_app}"
DEPLOY_DIR="${DEPLOY_DIR:-site_deploy}"
DOCROOT="${DOCROOT:-public_html}"
DOCROOT="${DOCROOT#/}"
DOCROOT="${DOCROOT%/}"

output() {
  printf '%s=%s\n' "$1" "$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; fi
}

die() {
  echo "::error::$*"
  exit 1
}

# json <file> <python expression over d> -> the value ("" for None; lists of strings space-joined)
json() {
  python3 -I -c 'import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
v = eval(sys.argv[2], {"d": d})
if isinstance(v, list) and all(isinstance(x, str) for x in v):
    print(" ".join(v))
else:
    print("" if v is None else (json.dumps(v) if isinstance(v, (dict, list, bool)) else v))' "$1" "$2"
}

sha256() {
  if command -v sha256sum > /dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

plain_name() {
  [[ "$1" =~ ^[A-Za-z0-9._-]+$ && "$1" != . && "$1" != .. ]]
}

check_names() {
  plain_name "$APP_DIR" || die "APP_DIR must be a plain folder name in the cPanel home, such as site_app."
  plain_name "$DEPLOY_DIR" || die "DEPLOY_DIR must be a plain folder name in the cPanel home, such as site_deploy."
  [[ "$APP_DIR" != "$DEPLOY_DIR" ]] || die "APP_DIR and DEPLOY_DIR must be different folders."
  local segment
  IFS=/ read -r -a segments <<< "$DOCROOT"
  [[ ${#segments[@]} -gt 0 ]] || die "DOCROOT must name the site's document root, such as public_html."
  for segment in "${segments[@]}"; do
    plain_name "$segment" || die "DOCROOT must be a folder path in the cPanel home, such as public_html or shop.example.com."
  done
  [[ "${segments[0]}" != "$APP_DIR" && "${segments[0]}" != "$DEPLOY_DIR" ]] || die "DOCROOT must not be APP_DIR or DEPLOY_DIR."
}

valid_id() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ && "$1" != *..* ]] || die "Bad release id: $1"
}

version_lt() {
  [[ "$1" != "$2" && "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n 1)" == "$1" ]]
}

# The same digest the receiver reports: sha256 over "<file>\t<sha256>\n" lines in byte order.
receiver_digest() {
  (
    cd "$1"
    { printf '%s\n' hook.php VERSION; find src -maxdepth 1 -type f -name '*.php'; } | LC_ALL=C sort | while IFS= read -r file; do
      printf '%s\t%s\n' "$file" "$(sha256 "$file")"
    done
  ) > "$work/digest.txt"
  sha256 "$work/digest.txt"
}

render_stub() { # render_stub <kit-dir> <out-file>
  check_names
  sed -e "s|^const DEPLOY_KIT_APP_DIR = '[^']*';|const DEPLOY_KIT_APP_DIR = '$APP_DIR';|" \
      -e "s|^const DEPLOY_KIT_DEPLOY_DIR = '[^']*';|const DEPLOY_KIT_DEPLOY_DIR = '$DEPLOY_DIR';|" \
      -e "s|^const DEPLOY_KIT_DOCROOT = '[^']*';|const DEPLOY_KIT_DOCROOT = '$DOCROOT';|" \
      "$1/public_html/_deploy/hook.php" > "$2"
  grep -q "^const DEPLOY_KIT_APP_DIR = '$APP_DIR';" "$2" && grep -q "^const DEPLOY_KIT_DEPLOY_DIR = '$DEPLOY_DIR';" "$2" \
    && grep -q "^const DEPLOY_KIT_DOCROOT = '$DOCROOT';" "$2" || die "Could not fill in the folder names in the stub."
}

hook() {
  DEPLOY_HOOK_RESPONSE="$work/answer.json" bash "$here/call-deploy-hook.sh" "$@"
}

ftp_setup() {
  # DEPLOY_FTP_BASE exists for tests/run.sh only: it points the very same curl uploads at a local file:// tree.
  if [[ -z "${DEPLOY_FTP_BASE:-}" ]]; then
    : "${FTP_SERVER:?FTP_SERVER is not set}" "${FTP_USERNAME:?FTP_USERNAME is not set}" "${FTP_PASSWORD:?FTP_PASSWORD is not set}"
  fi
  esc() { local v="${1//\\/\\\\}"; printf '%s' "${v//\"/\\\"}"; }
  # Credentials go into a curl config file (mode 600), never onto the command line.
  printf 'user = "%s:%s"\n' "$(esc "${FTP_USERNAME:-}")" "$(esc "${FTP_PASSWORD:-}")" > "$work/ftp.cfg"
  ftp_opts=(-K "$work/ftp.cfg" --ssl-reqd -sS --connect-timeout 30 --ftp-create-dirs)
  ftp_base="${DEPLOY_FTP_BASE:-ftp://${FTP_SERVER:-}:${FTP_PORT:-21}}"
  ftp_base="${ftp_base%/}"
}

case "$command" in
  detect)
    base="${1:?usage: zip-deploy.sh detect <site-url> <kit-dir> [after-bootstrap]}"
    kit="${2:?kit dir}"
    after="${3:-}"
    check_names
    kit_version="$(tr -d '[:space:]' < "$kit/receiver/VERSION")"
    kit_digest="$(receiver_digest "$kit/receiver")"
    DEPLOY_HOOK_SOFT=1 DEPLOY_HOOK_QUIET=1 DEPLOY_HOOK_STATUS="$work/status" hook "$base" capabilities > "$work/hook.out" 2>&1 || true
    status="$(cat "$work/status" 2> /dev/null || echo 000)"
    if grep -qiE 'challenge-platform|cf-chl|<title>Just a moment' "$work/answer.json" 2> /dev/null; then
      echo "::warning title=Cloudflare challenged the deploy::Bot Fight Mode (Cloudflare > Security > Bots) or a WAF rule answers GitHub's runners with a challenge page. Turn Bot Fight Mode off (the free plan cannot skip it with a rule), or skip bot checks for URI path starts with /_deploy/."
      die "Cloudflare blocked the request to /_deploy/hook.php (HTTP $status)."
    fi
    python3 -I - "$work/answer.json" "$work/caps.json" <<'PY' || true
import json, sys
try:
    answer = json.load(open(sys.argv[1], encoding="utf-8"))
except (ValueError, OSError):
    sys.exit(1)
caps = answer.get("capabilities") if isinstance(answer, dict) else None
if isinstance(caps, dict) and caps.get("receiver_version"):
    json.dump(caps, open(sys.argv[2], "w"))
PY
    if [[ ! -s "$work/caps.json" ]]; then
      case "$status" in
        404) reason="no receiver answered at /_deploy/hook.php (HTTP 404)" ;;
        200) reason="/_deploy/hook.php answered with a page, not the receiver (the site's own rewrite rules?)" ;;
        *) reason="/_deploy/hook.php answered HTTP $status without receiver data" ;;
      esac
      if [[ "$after" == after-bootstrap ]]; then
        echo "::error title=The receiver does not answer::After installing it, $reason. Check, in this order:"
        echo "  1. ~/$APP_DIR/.env exists and has DEPLOY_HOOK_TOKEN=<the same 64 characters as the GitHub secret> (32 or more; an empty or short token turns the hook off)."
        echo "  2. DOCROOT ($DOCROOT) is this site's document root (cPanel > Domains). An addon domain has its own folder."
        echo "  3. The site's existing .htaccess lets /_deploy/hook.php through (a catch-all rewrite or a PHP block can swallow it)."
        echo "  4. The hook was called more than 10 times in 15 minutes from this IP (rate limit): wait and re-run."
        echo "  The last line of ~/$APP_DIR/storage/logs/deploy-hook.log says which (disabled, denied, rate_limited); no line at all means the request never reached the receiver."
        exit 1
      fi
      echo "Bootstrap needed: $reason."
      output bootstrap true
      output bootstrap_reason "$reason"
      exit 0
    fi
    server_version="$(json "$work/caps.json" 'd.get("receiver_version")')"
    server_digest="$(json "$work/caps.json" 'd.get("receiver_digest")')"
    bootstrap=false
    reason=""
    if version_lt "$server_version" "$kit_version"; then
      bootstrap=true; reason="the server's receiver $server_version is older than the kit's $kit_version"
    elif [[ "$server_version" == "$kit_version" && "$server_digest" != "$kit_digest" ]]; then
      bootstrap=true; reason="the server's receiver files differ from the kit's (an interrupted upload, or an edit without a VERSION bump)"
    elif version_lt "$kit_version" "$server_version"; then
      echo "::warning::The server runs receiver $server_version, newer than this repository's kit ($kit_version). It is left as it is; update deploy-kit/ in the repository."
    fi
    if [[ "$after" == after-bootstrap && "$bootstrap" == true ]]; then
      die "The receiver was uploaded but $reason. Re-run the workflow; if it persists, delete ~/$DEPLOY_DIR/receiver/ in cPanel File Manager and re-run."
    fi
    if [[ "$bootstrap" == true ]]; then
      echo "Bootstrap needed: $reason."
      output bootstrap true
      output bootstrap_reason "$reason"
      exit 0
    fi
    extractor="$(json "$work/caps.json" 'd.get("extractor")')"
    [[ -n "$extractor" ]] || die "PHP on the server has neither the zip nor the phar extension. Enable zip in cPanel > Select PHP Version (or MultiPHP) and re-run."
    if [[ "$(json "$work/caps.json" 'd.get("document_root_ok")')" == false ]]; then
      die "This site's document root is not ~/$DOCROOT (an addon domain?). Set the repository variable DOCROOT to the folder cPanel > Domains shows for it."
    fi
    [[ "$(json "$work/caps.json" 'd.get("docroot_exists")')" == true ]] || die "~/$DOCROOT does not exist on the server. Check the DOCROOT variable."
    ignored="$(json "$work/caps.json" 'd.get("deploy_keep_ignored") or []')"
    if [[ -n "$ignored" ]]; then echo "::warning::DEPLOY_KEEP in ~/$APP_DIR/.env has entries that are not plain top-level names and are ignored: $ignored"; fi
    output bootstrap false
    output receiver_version "$server_version"
    output layout "$(json "$work/caps.json" 'd.get("layout")')"
    output mode "$(json "$work/caps.json" 'd.get("mode")')"
    output current "$(json "$work/caps.json" 'd.get("current")')"
    output rollback_target "$(json "$work/caps.json" 'd.get("rollback_target")')"
    output incoming "$(json "$work/caps.json" 'd.get("incoming") or ""')"
    output max_archive_bytes "$(json "$work/caps.json" 'd.get("max_archive_bytes")')"
    output releases "$(json "$work/caps.json" 'd.get("releases") or []')"
    output adopt_candidates "$(json "$work/caps.json" 'd.get("adopt_candidates") or []')"
    output adopt_suspicious "$(json "$work/caps.json" 'd.get("adopt_suspicious") or []')"
    output kept_in_place "$(json "$work/caps.json" 'd.get("kept_in_place") or []')"
    echo "Receiver $server_version on PHP $(json "$work/caps.json" 'd.get("php_version")'): layout $(json "$work/caps.json" 'd.get("layout")'), mode $(json "$work/caps.json" 'd.get("mode") or "not chosen yet"'), extractor $extractor, live release $(json "$work/caps.json" 'd.get("current") or "none"'), kept releases: $(json "$work/caps.json" '", ".join(d.get("releases") or []) or "none"')."
    ;;

  bootstrap)
    kit="${1:?usage: zip-deploy.sh bootstrap <kit-dir>}"
    check_names
    ftp_setup
    render_stub "$kit" "$work/stub.php"
    uploads=()
    while IFS= read -r file; do
      uploads+=(-T "$kit/receiver/$file" "$ftp_base/$DEPLOY_DIR/receiver/$file")
    done < <(cd "$kit/receiver" && find src -maxdepth 1 -type f -name '*.php' | LC_ALL=C sort)
    # hook.php after the classes it loads, VERSION after hook.php, the stub last: an interrupted upload leaves
    # an old VERSION or a digest mismatch behind, and the next run uploads again. One curl, one connection.
    uploads+=(-T "$kit/receiver/hook.php" "$ftp_base/$DEPLOY_DIR/receiver/hook.php")
    uploads+=(-T "$kit/receiver/VERSION" "$ftp_base/$DEPLOY_DIR/receiver/VERSION")
    uploads+=(-T "$work/stub.php" "$ftp_base/$DOCROOT/_deploy/hook.php")
    started=$SECONDS
    ok=0
    for attempt in 1 2 3; do
      if curl "${ftp_opts[@]}" --fail-early --max-time 300 "${uploads[@]}" 2> "$work/err"; then ok=1; break; fi
      echo "attempt $attempt: receiver upload failed ($(head -c 200 "$work/err" | tr '\n' ' ')), retrying"
      sleep $((attempt * 10))
    done
    [[ "$ok" == 1 ]] || die "Could not upload the receiver over FTPS after 3 attempts."
    echo "Installed the receiver ($(($(cd "$kit/receiver" && find src -maxdepth 1 -type f -name '*.php' | wc -l) + 2)) files) in ~/$DEPLOY_DIR/receiver/ and the stub in ~/$DOCROOT/_deploy/hook.php in $((SECONDS - started))s."
    output bootstrap_seconds "$((SECONDS - started))"
    ;;

  ftp-check)
    check_names
    ftp_setup
    top="${DOCROOT%%/*}"
    if ! listing="$(curl "${ftp_opts[@]}" --max-time 120 --list-only "$ftp_base/" 2> "$work/err")"; then
      die "Could not log in over FTPS ($(head -c 200 "$work/err" | tr '\n' ' ')). Check FTP_SERVER (the server hostname such as cp79.domains.co.za, not ftp.<domain>), FTP_USERNAME, FTP_PASSWORD and FTP_PORT."
    fi
    if ! grep -qx "$top" <<< "$(tr -d '\r' <<< "$listing" | sed 's#^\./##; s#/$##')"; then
      die "The FTP account's top folder has no $top/. Use an FTP account whose Directory is the cPanel home (/), not public_html (cPanel > FTP Accounts)."
    fi
    echo "FTPS login ok; the account starts in the cPanel home (it has $top/)."
    ;;

  pack)
    bundle="${1:?usage: zip-deploy.sh pack <bundle-dir> <kit-dir> <release-id> <out>}"
    kit="${2:?kit dir}"
    id="${3:?release id}"
    out="${4:?out dir}"
    valid_id "$id"
    [[ -d "$bundle/public_html" ]] || die "The build did not create $bundle/public_html/ (deploy-kit/README.md, Build contract)."
    if [[ -f "$bundle/root/.htaccess" ]]; then
      echo "root/.htaccess: the build's own (it replaces the kit's template)."
    else
      mkdir -p "$bundle/root"
      cp "$kit/public_html/.htaccess.template" "$bundle/root/.htaccess"
      echo "root/.htaccess: the kit's template."
    fi
    # The server refuses the same things (and nothing is changed there); refusing them here says why.
    python3 -I - "$bundle" <<'PY'
import os, re, sys
bundle = sys.argv[1]
problems, count, total = [], 0, 0
for top in ("public_html", "app", "root"):
    base = os.path.join(bundle, top)
    if not os.path.isdir(base):
        continue
    for dirpath, dirnames, filenames in os.walk(base):
        for name in dirnames + filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, bundle).replace(os.sep, "/")
            count += 1
            try:
                rel.encode("utf-8")
            except UnicodeEncodeError:
                problems.append(repr(rel) + ": the name is not UTF-8")
                continue
            if os.path.islink(full):
                problems.append(rel + ": a symlink (copy the file instead; the server refuses links)")
                continue
            if os.path.isfile(full):
                total += os.path.getsize(full)
            elif not os.path.isdir(full):
                problems.append(rel + ": not a regular file")
            if re.search(r"[\x00-\x1f\x7f\\]", rel):
                problems.append(repr(rel) + ": control character or backslash in the name")
            if re.match(r"^public_html/(media|_current|_previous|_deploy|\.well-known|cgi-bin)(/|$)", rel):
                problems.append(rel + ": served from the real document root, never from a release (use another folder name)")
            if rel == "public_html/.deploy-release":
                problems.append(rel + ": reserved for the receiver's release marker")
            if re.match(r"^root/(media|_current|_previous|_deploy|\.well-known|cgi-bin|\.user\.ini|php\.ini|error_log|\.ftpquota)(/|$)", rel):
                problems.append(rel + ": a name the server manages; root/ must not replace it")
            if re.search(r"(^|/)\.env(\.(?!example$)[^/]*)?$", rel):
                problems.append(rel + ": an environment file (secrets stay in ~/<APP_DIR>/.env on the server)")
            if re.search(r"(^|/)\.(git|svn|hg)$", rel):
                problems.append(rel + ": version-control data")
            if name == ".htaccess" and rel != "root/.htaccess" and not rel.startswith("app/"):
                problems.append(rel + ": .htaccess files belong in deploy/root/.htaccess only (one inside the served tree would undo the routing)")
if count > 29990:
    problems.append(f"{count} files and folders: the server unpacks at most 30000 entries")
if total > 1024 ** 3:
    problems.append(f"{total} bytes unpacked: the server unpacks at most 1 GiB")
if problems:
    print("::error title=The build cannot be released::" + str(len(problems)) + " problem(s):")
    for problem in problems[:25]:
        print("  " + problem)
    sys.exit(1)
PY
    # php_value / php_flag outside cPanel's blocks or a <IfModule php...|lsapi...> guard = a 500 on PHP-FPM hosts.
    if awk '
      /^[[:space:]]*#/ { if ($0 ~ /BEGIN cPanel-generated/) cp = 1; if ($0 ~ /END cPanel-generated/) cp = 0; next }
      tolower($0) ~ /^[[:space:]]*<ifmodule/ { depth++; php[depth] = (tolower($0) ~ /php|lsapi/); if (php[depth]) guard++ }
      tolower($0) ~ /^[[:space:]]*<\/ifmodule>/ { if (depth > 0) { if (php[depth]) guard--; depth-- } }
      !cp && !guard && tolower($1) ~ /^php_(value|flag|admin_value|admin_flag)$/ { bad = 1; print "  line " FNR ": " $0 }
      END { exit bad ? 0 : 1 }' "$bundle/root/.htaccess"; then
      die "root/.htaccess sets PHP ini values directly (above). On PHP-FPM hosts that is a 500 on every page: use cPanel > MultiPHP INI Editor instead."
    fi
    mkdir -p "$out"
    out="$(cd "$out" && pwd)"
    archive="$out/$id.zip"
    rm -f "$archive"
    started=$SECONDS
    parts=(public_html root)
    if [[ -d "$bundle/app" ]]; then parts+=(app); fi
    (cd "$bundle" && zip -q -r -X "$archive" "${parts[@]}" -x '*.DS_Store')
    GIT_SHA="${GITHUB_SHA:-}" python3 -I - "$out/manifest.json" "$id" <<'PY'
import datetime, json, os, sys
json.dump({
    "release": sys.argv[2],
    "git_sha": os.environ.get("GIT_SHA") or None,
    "run_id": os.environ.get("GITHUB_RUN_ID") or None,
    "packed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
}, open(sys.argv[1], "w"), indent=2)
PY
    (cd "$out" && zip -q -X "$archive" manifest.json)
    sha="$(sha256 "$archive")"
    bytes="$(wc -c < "$archive" | tr -d ' ')"
    files="$(find "${parts[@]/#/$bundle/}" -type f | wc -l | tr -d ' ')"
    if [[ -n "${MAX_ARCHIVE_BYTES:-}" && "$bytes" -gt "$MAX_ARCHIVE_BYTES" ]]; then
      die "The archive is $bytes bytes; the server takes at most $MAX_ARCHIVE_BYTES (DEPLOY_MAX_ARCHIVE_MB in ~/$APP_DIR/.env raises it)."
    fi
    python3 -I - "$out/$id.json" "$id" "$sha" "$bytes" "$files" <<'PY'
import json, os, sys
path, rid, sha, size, files = sys.argv[1:]
json.dump({"release": rid, "sha256": sha, "bytes": int(size), "files": int(files),
           "git_sha": os.environ.get("GITHUB_SHA") or None, "run_id": os.environ.get("GITHUB_RUN_ID") or None},
          open(path, "w"), indent=2)
PY
    echo "Packed $files files ($(printf '%s ' "${parts[@]}")) into $(basename "$archive"): $((bytes / 1024)) KB in $((SECONDS - started))s, sha256 $sha"
    output archive "$archive"
    output sha256 "$sha"
    output bytes "$bytes"
    output files "$files"
    output pack_seconds "$((SECONDS - started))"
    ;;

  upload)
    out="${1:?usage: zip-deploy.sh upload <out> <release-id> <remote-dir>}"
    id="${2:?release id}"
    remote="${3:-$DEPLOY_DIR/incoming}"
    remote="${remote#/}"
    [[ "$remote" =~ ^[A-Za-z0-9._/-]+$ && "$remote" != *..* ]] || die "Bad remote folder: $remote"
    ftp_setup
    started=$SECONDS
    # The archive first, the manifest last: the receiver only ever sees a manifest next to a complete
    # upload, and it checks the archive's SHA-256 anyway.
    for file in "$id.zip" "$id.json"; do
      size="$(wc -c < "$out/$file" | tr -d ' ')"
      ok=0
      for attempt in 1 2 3 4 5; do
        if curl "${ftp_opts[@]}" --max-time 900 -T "$out/$file" "$ftp_base/$remote/$file" 2> "$work/err"; then
          remote_size="$(curl "${ftp_opts[@]}" --max-time 60 -I "$ftp_base/$remote/$file" 2> /dev/null | tr -d '\r' | awk 'tolower($1) == "content-length:" { print $2; exit }')"
          if [[ "$remote_size" == "$size" ]]; then ok=1; break; fi
          echo "attempt $attempt: $file arrived with ${remote_size:-unknown} of $size bytes, uploading again"
        else
          echo "attempt $attempt: upload of $file failed ($(head -c 200 "$work/err" | tr '\n' ' '))"
        fi
        sleep $((attempt * ${UPLOAD_RETRY_DELAY:-10}))
      done
      [[ "$ok" == 1 ]] || die "Could not upload $file over FTPS after 5 attempts."
    done
    echo "Uploaded $id.zip ($(wc -c < "$out/$id.zip" | tr -d ' ') bytes) and $id.json to ~/$remote in $((SECONDS - started))s."
    output upload_seconds "$((SECONDS - started))"
    ;;

  release)
    base="${1:?usage: zip-deploy.sh release <site-url> <out> <release-id>}"
    base="${base%/}"
    out="${2:?out dir}"
    id="${3:?release id}"
    valid_id "$id"
    sha="$(json "$out/$id.json" 'd["sha256"]')"
    args=(release="$id" sha256="$sha")
    if [[ -n "${ADOPT:-}" ]]; then
      [[ "$ADOPT" == move ]] || die "ADOPT must be move."
      args+=(adopt=move)
    fi
    if [[ -n "${SWITCH_MODE:-}" ]]; then
      [[ "$SWITCH_MODE" == symlink || "$SWITCH_MODE" == rename ]] || die "SWITCH_MODE must be symlink or rename."
      args+=(mode="$SWITCH_MODE")
    elif [[ -z "${MODE:-}" ]]; then
      # First release: does the web server follow a symlink PHP creates? The receiver puts one under /_deploy/,
      # and we fetch it exactly like a visitor would (through Cloudflare, if it is in front).
      DEPLOY_HOOK_QUIET=1 hook "$base" probe
      probe_path="$(json "$work/answer.json" '((d.get("data") or {}).get("probe") or {}).get("url_path")')"
      expect="$(json "$work/answer.json" '((d.get("data") or {}).get("probe") or {}).get("expect")')"
      symlinks=false
      if [[ -n "$probe_path" && "$probe_path" =~ ^/_deploy/probe-[0-9a-f]+/[0-9a-f]+\.txt$ ]]; then
        for attempt in 1 2 3; do
          body="$(curl -sS --connect-timeout 30 --max-time 20 -A 'deploy-kit-probe' "$base$probe_path" 2> /dev/null || true)"
          if [[ "$body" == "$expect" ]]; then symlinks=true; break; fi
          sleep "${PROBE_RETRY_DELAY:-3}"
        done
        echo "Symlink probe: the web server $([[ "$symlinks" == true ]] && echo follows || echo does not follow) symlinks PHP creates: $([[ "$symlinks" == true ]] && echo symlink || echo rename) mode."
      else
        echo "Symlink probe: PHP cannot create symlinks on this server: rename mode."
      fi
      args+=(symlinks="$symlinks")
    fi
    started=$SECONDS
    hook "$base" release "${args[@]}"
    output release "$id"
    output previous "$(json "$work/answer.json" 'd["data"].get("previous")')"
    output mode "$(json "$work/answer.json" 'd["data"].get("mode")')"
    output first_release "$(json "$work/answer.json" 'd["data"].get("first_release", False)')"
    output already_current "$(json "$work/answer.json" 'd["data"].get("already_current", False)')"
    output legacy_dir "$(json "$work/answer.json" '(d["data"].get("legacy") or {}).get("dir")')"
    output server_timings "$(json "$work/answer.json" '", ".join(k + " " + str(v) + " ms" for k, v in (d["data"].get("timings_ms") or {}).items())')"
    output release_seconds "$((SECONDS - started))"
    ;;

  confirm)
    base="${1:?usage: zip-deploy.sh confirm <site-url> <release-id>}"
    id="${2:?release id}"
    valid_id "$id"
    DEPLOY_HOOK_QUIET=1 hook "$base" confirm release="$id"
    echo "Release $id confirmed: it is the known-good release a rollback returns to."
    ;;

  rollback)
    base="${1:?usage: zip-deploy.sh rollback <site-url> [<release-id>|legacy]}"
    if [[ -n "${2:-}" ]]; then
      [[ "$2" == legacy ]] || valid_id "$2"
      hook "$base" rollback release="$2"
    else
      hook "$base" rollback
    fi
    output release "$(json "$work/answer.json" 'd["data"].get("release") or "none"')"
    output rolled_back_from "$(json "$work/answer.json" 'd["data"].get("rolled_back_from")')"
    ;;

  fetch)
    remote="${1:?usage: zip-deploy.sh fetch <remote-path> <local-file>}"
    local_file="${2:?local file}"
    remote="${remote#/}"
    [[ "$remote" =~ ^[A-Za-z0-9._/-]+$ && "$remote" != *..* ]] || die "Bad remote path: $remote"
    ftp_setup
    if curl "${ftp_opts[@]}" --max-time 120 -o "$local_file" "$ftp_base/$remote" 2> "$work/err"; then
      echo "Downloaded ~/$remote ($(wc -c < "$local_file" | tr -d ' ') bytes)."
    else
      rm -f "$local_file"
      echo "~/$remote is not on the server (or cannot be read)."
    fi
    ;;

  render-stub)
    render_stub "${1:?usage: zip-deploy.sh render-stub <kit-dir> <out-file>}" "${2:?out file}"
    ;;

  receiver-digest)
    receiver_digest "${1:?usage: zip-deploy.sh receiver-digest <receiver-dir>}"
    ;;

  version-lt)
    version_lt "${1:?usage: zip-deploy.sh version-lt <a> <b>}" "${2:?b}"
    ;;

  *)
    sed -n '2,25p' "$0"
    exit 2
    ;;
esac
