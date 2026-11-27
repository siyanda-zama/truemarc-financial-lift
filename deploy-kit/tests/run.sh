#!/usr/bin/env bash
# End-to-end test of the deploy kit on this machine: a fake cPanel home that already hosts a live site, real
# Apache (mod_rewrite, mod_headers, SymLinksIfOwnerMatch, HTTPS) in front of php-fpm, and the workflow's own
# scripts driving bootstrap, releases, routing, rollbacks and refusals.
#
# The uploads are the production curl commands pointed at a file:// tree (DEPLOY_FTP_BASE), because there
# is no FTPS server here; curl's file:// does not create folders, so the test creates the three upload
# folders that --ftp-create-dirs creates on a real server.
#
# Usage: bash tests/run.sh [work-dir]
# Env:   PHP_BIN, PHP_FPM_BIN, HTTPD_BIN, APACHE_MODULES (defaults: php on PATH, its php-fpm, macOS Apache)
set -uo pipefail

kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
W="${1:-$(mktemp -d)}"
mkdir -p "$W"
W="$(cd "$W" && pwd -P)"
E="$W/e2e"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
PHP_FPM_BIN="${PHP_FPM_BIN:-$(dirname "$(dirname "$PHP_BIN")")/sbin/php-fpm}"
HTTPD_BIN="${HTTPD_BIN:-/usr/sbin/httpd}"
APACHE_MODULES="${APACHE_MODULES:-/usr/libexec/apache2}"
# The kit as shipped has .github/ inside it; in a repository it sits next to deploy-kit/.
github="$kit/.github"
if [[ ! -f "$github/scripts/zip-deploy.sh" && -f "$kit/../.github/scripts/zip-deploy.sh" ]]; then github="$(cd "$kit/../.github" && pwd)"; fi
ZD="$github/scripts/zip-deploy.sh"
SCRIPTS="$github/scripts"
WORKFLOW="$github/workflows/deploy.yml"

passed=0
failed=0
pass() { passed=$((passed + 1)); echo "ok   $*"; }
fail() { failed=$((failed + 1)); echo "FAIL $*"; }
phase() { echo; echo "── $* ──"; }
# check <label> <command...>: passes when the command succeeds; shows its output when it does not.
check() {
  local label="$1"; shift
  if "$@" > "$E/check.out" 2>&1; then pass "$label"; else fail "$label"; sed 's/^/     | /' "$E/check.out" | tail -n 20; fi
}
is() { [[ "$1" == "$2" ]] || { echo "expected [$2], got [$1]"; return 1; }; }
has() { grep -qF -- "$2" "$1" || { echo "[$2] not in $1:"; head -c 1500 "$1"; return 1; }; }
lacks() { ! grep -qF -- "$2" "$1" || { echo "[$2] unexpectedly in $1"; return 1; }; }

for tool in "$PHP_BIN" "$PHP_FPM_BIN" "$HTTPD_BIN" curl zip python3 openssl; do
  command -v "$tool" > /dev/null 2>&1 || { echo "missing tool: $tool"; exit 2; }
done

# ───────────────────────────── static checks ─────────────────────────────
phase "static checks"
mkdir -p "$W"
rm -rf "$E"
mkdir -p "$E"
while IFS= read -r file; do
  check "php -l ${file#"$kit"/}" "$PHP_BIN" -l "$file"
done < <(find "$kit" -type f \( -name '*.php' -o -name '*.php.template' \) | sort)
while IFS= read -r file; do
  check "bash -n ${file#"$kit"/}" bash -n "$file"
done < <(find "$kit" "$SCRIPTS" -type f -name '*.sh' | sort -u)
if command -v actionlint > /dev/null 2>&1; then
  check "actionlint deploy.yml" actionlint "$WORKFLOW"
else
  check "deploy.yml parses as YAML (ruby; actionlint is not installed)" ruby -ryaml -e '
    y = YAML.load_file(ARGV[0]); on = y["on"] || y[true]
    raise "jobs" unless y["jobs"].keys.sort == %w[deploy rollback]
    raise "inputs" unless on["workflow_dispatch"]["inputs"].keys.sort == %w[adopt_existing_site dry_run rollback rollback_to]
    raise "permissions" unless y["permissions"] == {"contents" => "read"}
    raise "concurrency" unless y["concurrency"]["group"] && y["concurrency"]["cancel-in-progress"] == false
    y["jobs"].each { |name, job| job["steps"].each { |s| raise "step without name in #{name}" unless s["name"] } }' "$WORKFLOW"
fi
check "every run: block in the workflow passes bash -n (expressions replaced by placeholders)" ruby -ryaml -e '
  y = YAML.load_file(ARGV[0]); bad = []
  y["jobs"].each { |job, j| j["steps"].each { |s| next unless s["run"]
    code = s["run"].gsub(/\$\{\{.*?\}\}/, "PLACEHOLDER")
    IO.popen(["bash", "-n"], "r+", err: [:child, :out]) { |io| io.write(code); io.close_write; out = io.read; bad << "#{job}/#{s["name"]}: #{out}" unless out.empty? }
    bad << "#{job}/#{s["name"]}: exit #{$?.exitstatus}" unless $?.success? } }
  abort(bad.join("\n")) unless bad.empty?' "$WORKFLOW"
check "the workflow has no file-sync path (no FTP-Deploy-Action, no lftp/mirror)" bash -c "! grep -qiE 'FTP-Deploy-Action|lftp|mirror -R' '$WORKFLOW' '$SCRIPTS'/*.sh"
check "the workflow gates pushes on DEPLOY_ON_PUSH and deploys main only" bash -c "grep -qF \"vars.DEPLOY_ON_PUSH != 'false'\" '$WORKFLOW' && grep -qF \"github.ref == 'refs/heads/main'\" '$WORKFLOW'"
check "the .htaccess template has no php_value / php_flag directives" bash -c "! grep -qiE '^[[:space:]]*php_(value|flag|admin_value|admin_flag)' '$kit/public_html/.htaccess.template'"
check "uploads use explicit FTPS with --ssl-reqd and --ftp-create-dirs" bash -c "grep -qF -- '--ssl-reqd' '$ZD' && grep -qF -- '--ftp-create-dirs' '$ZD'"

# ───────────────────────────── unit tests ─────────────────────────────
phase "unit tests (receiver classes)"
"$PHP_BIN" "$kit/tests/unit.php" "$W" > "$E/unit.out" 2>&1
unit_status=$?
unit_passed="$(grep -c '^ok - ' "$E/unit.out")"
unit_failed="$(grep -c '^not ok - ' "$E/unit.out")"
grep '^not ok - ' "$E/unit.out" | sed 's/^/FAIL /'
tail -n 1 "$E/unit.out"
passed=$((passed + unit_passed))
failed=$((failed + unit_failed))
if [[ "$unit_status" != 0 && "$unit_failed" == 0 ]]; then fail "unit.php crashed"; cat "$E/unit.out" | tail -n 20; fi
check "bash and PHP compute the same receiver digest" bash -c "
  a=\"\$(bash '$ZD' receiver-digest '$kit/receiver')\"
  b=\"\$('$PHP_BIN' -r 'foreach ([\"ReleaseException\",\"Env\",\"ClientIp\",\"RateLimiter\",\"ArchiveExtractor\",\"HtaccessComposer\",\"ReleaseManager\",\"Hook\"] as \$c) require \"$kit/receiver/src/\$c.php\"; \$h = new DeployKit\\Hook(\"$kit/receiver\", \"/\", \"a\", \"b\", \"c\", [\"ReleaseException\",\"Env\",\"ClientIp\",\"RateLimiter\",\"ArchiveExtractor\",\"HtaccessComposer\",\"ReleaseManager\",\"Hook\"]); echo \$h->receiverDigest();')\"
  [[ -n \"\$a\" && \"\$a\" == \"\$b\" ]] || { echo \"bash \$a php \$b\"; exit 1; }"
check "hook.php loads every src/ class (the digest list is complete)" bash -c "
  for f in '$kit'/receiver/src/*.php; do n=\$(basename \"\$f\" .php); grep -q \"'\$n'\" '$kit/receiver/hook.php' || { echo \"\$n missing\"; exit 1; }; done"
check "version-lt: 0.9.9 < 1.0.0 < 1.0.10, and not the other way" bash -c "
  bash '$ZD' version-lt 0.9.9 1.0.0 && bash '$ZD' version-lt 1.0.0 1.0.10 && ! bash '$ZD' version-lt 1.0.0 1.0.0 && ! bash '$ZD' version-lt 1.1.0 1.0.9"

# ───────────────────────────── the fake cPanel home ─────────────────────────────
H="$E/home"
PUB="$H/public_html"
DEP="$H/site_deploy"
APP="$H/site_app"
TOKEN="$(openssl rand -hex 32)"
mkdir -p "$PUB/old" "$PUB/assets" "$PUB/media" "$PUB/.well-known/acme-challenge" "$PUB/cgi-bin" "$PUB/client2.com" "$PUB/other.example.org" "$APP"
printf '<html><body>old home</body></html>\n' > "$PUB/index.html"
printf '<html><body>old about</body></html>\n' > "$PUB/about.html"
printf '<html><body>old page</body></html>\n' > "$PUB/old/page.html"
printf '<?php echo "legacy php";\n' > "$PUB/legacy.php"
printf 'body{}\n' > "$PUB/assets/old.css"
printf 'JPEGDATA' > "$PUB/media/photo.jpg"
printf '<?php echo "uploaded php";\n' > "$PUB/media/evil.php"
printf 'acme-token' > "$PUB/.well-known/acme-challenge/tok"
printf 'memory_limit=256M\n' > "$PUB/.user.ini"
printf 'x=1\n' > "$PUB/php.ini"
printf '[old] error\n' > "$PUB/error_log"
printf '1 2\n' > "$PUB/.ftpquota"
printf 'google-site-verification: google1234abcd.html\n' > "$PUB/google1234abcd.html"
printf '<html>client2 site</html>\n' > "$PUB/client2.com/index.html"
printf '<html>other site</html>\n' > "$PUB/other.example.org/index.html"
cat > "$PUB/.htaccess" <<'HT'
# The existing site's own rules (hand-made).
Options -Indexes
DirectoryIndex index.html
# php -- BEGIN cPanel-generated handler, do not edit
# Set the "ea-php83" package as the default "PHP" programming language.
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php83 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit

# BEGIN cPanel-generated php ini directives, do not edit
# Manual editing of this file may result in unexpected behavior.
<IfModule php8_module>
   php_flag display_errors Off
   php_value memory_limit 256M
</IfModule>
<IfModule lsapi_module>
   php_flag display_errors Off
</IfModule>
# END cPanel-generated php ini directives, do not edit
HT
cp "$PUB/.htaccess" "$E/original.htaccess"
# CRLF line endings, an export prefix and inline comments, as a .env edited in cPanel's File Manager can have.
printf '# Deploy kit test\r\nexport APP_ENV=production\r\nDEPLOY_HOOK_TOKEN=%s   # an inline comment like this once broke a production DB login\r\nDEPLOY_KEEP="google1234abcd.html client2.com"\r\nDB_PASSWORD=pa#ss\r\n' "$TOKEN" > "$APP/.env"
cp "$APP/.env" "$E/env.good"

snapshot() { # snapshot <dir> <out> [excluded top-level names...]: types, link targets and content hashes
  python3 -I - "$@" <<'PY'
import hashlib, os, sys
root, out, excluded = sys.argv[1], sys.argv[2], set(sys.argv[3:])
lines = []
for dirpath, dirnames, filenames in os.walk(root):
    rel_dir = os.path.relpath(dirpath, root)
    if rel_dir == ".":
        dirnames[:] = [d for d in dirnames if d not in excluded]
        filenames = [f for f in filenames if f not in excluded]
    for name in dirnames + filenames:
        full = os.path.join(dirpath, name)
        rel = os.path.normpath(os.path.join(rel_dir, name))
        if os.path.islink(full):
            lines.append("L " + rel + " -> " + os.readlink(full))
        elif os.path.isdir(full):
            lines.append("D " + rel)
        else:
            lines.append("F " + rel + " " + hashlib.sha256(open(full, "rb").read()).hexdigest())
open(out, "w").write("\n".join(sorted(lines)) + "\n")
PY
}
same_tree() { # same_tree <expected-snapshot> <dir> [excluded...]
  local expected="$1" dir="$2"; shift 2
  snapshot "$dir" "$E/snapshot.now" "$@"
  diff "$expected" "$E/snapshot.now"
}
snapshot "$PUB" "$E/snapshot.original"

# ───────────────────────────── servers ─────────────────────────────
phase "servers (php-fpm + Apache with HTTPS)"
free_port() { "$PHP_BIN" -r '$s = stream_socket_server("tcp://127.0.0.1:0"); $n = stream_socket_get_name($s, false); echo substr($n, strrpos($n, ":") + 1);'; }
FPM_PORT="$(free_port)"
HTTP_PORT="$(free_port)"
HTTPS_PORT="$(free_port)"
while [[ "$HTTPS_PORT" == "$HTTP_PORT" || "$HTTPS_PORT" == "$FPM_PORT" ]]; do HTTPS_PORT="$(free_port)"; done
mkdir -p "$E/run" "$E/logs" "$E/tls" "$E/curlhome" "$E/out" "$E/cf/cfchallenge/_deploy"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=127.0.0.1" -keyout "$E/tls/key.pem" -out "$E/tls/cert.pem" > /dev/null 2>&1
cat > "$E/php-fpm.conf" <<EOF
[global]
pid = $E/run/php-fpm.pid
error_log = $E/logs/php-fpm.log
daemonize = no
[www]
listen = 127.0.0.1:$FPM_PORT
pm = static
pm.max_children = 4
catch_workers_output = yes
security.limit_extensions = .php
php_admin_value[error_log] = $E/logs/php-error.log
php_admin_flag[log_errors] = on
php_admin_flag[display_errors] = off
php_admin_value[error_reporting] = -1
php_admin_value[opcache.revalidate_freq] = 0
EOF
types=""
if [[ -f /private/etc/apache2/mime.types ]]; then types="TypesConfig /private/etc/apache2/mime.types"; fi
cat > "$E/httpd.conf" <<EOF
ServerRoot "$E"
DefaultRuntimeDir "$E/run"
Mutex file:$E/run default
PidFile "$E/run/httpd.pid"
Listen 127.0.0.1:$HTTP_PORT
Listen 127.0.0.1:$HTTPS_PORT https
LoadModule mpm_prefork_module $APACHE_MODULES/mod_mpm_prefork.so
LoadModule unixd_module $APACHE_MODULES/mod_unixd.so
LoadModule authz_core_module $APACHE_MODULES/mod_authz_core.so
LoadModule authz_host_module $APACHE_MODULES/mod_authz_host.so
LoadModule mime_module $APACHE_MODULES/mod_mime.so
LoadModule dir_module $APACHE_MODULES/mod_dir.so
LoadModule alias_module $APACHE_MODULES/mod_alias.so
LoadModule rewrite_module $APACHE_MODULES/mod_rewrite.so
LoadModule headers_module $APACHE_MODULES/mod_headers.so
LoadModule env_module $APACHE_MODULES/mod_env.so
LoadModule setenvif_module $APACHE_MODULES/mod_setenvif.so
LoadModule filter_module $APACHE_MODULES/mod_filter.so
LoadModule deflate_module $APACHE_MODULES/mod_deflate.so
LoadModule log_config_module $APACHE_MODULES/mod_log_config.so
LoadModule proxy_module $APACHE_MODULES/mod_proxy.so
LoadModule proxy_fcgi_module $APACHE_MODULES/mod_proxy_fcgi.so
LoadModule socache_shmcb_module $APACHE_MODULES/mod_socache_shmcb.so
LoadModule ssl_module $APACHE_MODULES/mod_ssl.so
StartServers 2
MinSpareServers 1
MaxSpareServers 4
ServerName 127.0.0.1
ErrorLog "$E/logs/apache-error.log"
LogLevel warn
LogFormat "%h %>s %r" plain
CustomLog "$E/logs/access.log" plain
$types
DocumentRoot "$PUB"
<Directory />
  Options None
  AllowOverride None
  Require all denied
</Directory>
<Directory "$PUB">
  Options SymLinksIfOwnerMatch
  AllowOverride All
  Require all granted
</Directory>
<FilesMatch "\.php$">
  SetHandler "proxy:fcgi://127.0.0.1:$FPM_PORT"
</FilesMatch>
# A stand-in for a Cloudflare challenge page (Bot Fight Mode), for the scripts' hint.
Alias /cfchallenge/ "$E/cf/cfchallenge/"
<Directory "$E/cf">
  Require all denied
  ErrorDocument 403 "<html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>"
  Header always set cf-mitigated challenge
</Directory>
SSLSessionCache none
<VirtualHost 127.0.0.1:$HTTPS_PORT>
  SSLEngine on
  SSLCertificateFile "$E/tls/cert.pem"
  SSLCertificateKeyFile "$E/tls/key.pem"
</VirtualHost>
EOF
# Each server in its own session: Apache's prefork signals its whole process group when it stops, which
# would otherwise include this script.
own_session() { python3 -I -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' "$@"; }
own_session "$PHP_FPM_BIN" -F -y "$E/php-fpm.conf" > "$E/logs/php-fpm.out" 2>&1 &
fpm_pid=$!
own_session "$HTTPD_BIN" -f "$E/httpd.conf" -DFOREGROUND > "$E/logs/httpd.out" 2>&1 &
httpd_pid=$!
cleanup() {
  kill "$httpd_pid" "$fpm_pid" 2> /dev/null
  wait "$httpd_pid" "$fpm_pid" 2> /dev/null
  "$HTTPD_BIN" -f "$E/httpd.conf" -k stop > /dev/null 2>&1 || true
}
trap 'status=$?; cleanup; exit $status' EXIT
SITE="https://127.0.0.1:$HTTPS_PORT"
PLAIN="http://127.0.0.1:$HTTP_PORT"
port_open() { "$PHP_BIN" -r 'exit(@fsockopen("127.0.0.1", (int) $argv[1]) ? 0 : 1);' "$1"; }
up=0
for _ in $(seq 1 75); do
  if port_open "$FPM_PORT" && curl -sk -o /dev/null "$SITE/" && curl -s -o /dev/null "$PLAIN/"; then up=1; break; fi
  sleep 0.2
done
if [[ "$up" != 1 ]]; then
  echo "servers did not start:"; cat "$E/logs/httpd.out" "$E/logs/apache-error.log" "$E/logs/php-fpm.out" 2> /dev/null | tail -n 30
  exit 2
fi
pass "Apache (HTTPS :$HTTPS_PORT, HTTP :$HTTP_PORT) and php-fpm (:$FPM_PORT) are up"

# The scripts run unmodified: curl reads this file (the test certificate is self-signed).
printf 'insecure\n' > "$E/curlhome/.curlrc"
export CURL_HOME="$E/curlhome"
export DEPLOY_HOOK_TOKEN="$TOKEN" DEPLOY_FTP_BASE="file://$H" APP_DIR=site_app DEPLOY_DIR=site_deploy DOCROOT=public_html
export DEPLOY_HOOK_RETRY_DELAY=1 UPLOAD_RETRY_DELAY=0 PROBE_RETRY_DELAY=1 SMOKE_DELAY=1 SMOKE_ATTEMPTS=2
unset GITHUB_OUTPUT GITHUB_STEP_SUMMARY

# zd <args>: zip-deploy.sh as the workflow runs it (with a fresh rate-limit window: the test calls the hook
# far more often than 10 times in 15 minutes). Output in $E/zd.out, step outputs in $E/gh-output.
zd() {
  rm -rf "$APP/storage/ratelimits"
  : > "$E/gh-output"
  GITHUB_OUTPUT="$E/gh-output" bash "$ZD" "$@" > "$E/zd.out" 2>&1
}
out() { grep "^$1=" "$E/gh-output" | tail -n 1 | cut -d= -f2-; }
zd_ok() { zd "$@" || { cat "$E/zd.out"; return 1; }; }
zd_fails() { if zd "$@"; then cat "$E/zd.out"; echo "(expected a failure)"; return 1; fi; }

req() { # req <url-path> [curl args] -> $code; body in $E/body, headers in $E/hdr
  local path="$1"; shift
  code="$(curl -sS -k -o "$E/body" -D "$E/hdr" -w '%{http_code}' "$@" "$SITE$path" 2> "$E/curl.err")" || code=000
}
answers() { # answers <path> <code> [substring] [curl args...]
  local path="$1" want="$2" text="${3:-}"; shift 3 2> /dev/null || shift $#
  req "$path" "$@"
  [[ "$code" == "$want" ]] || { echo "GET $path: HTTP $code, expected $want"; head -c 400 "$E/body"; return 1; }
  if [[ -n "$text" ]]; then grep -qF -- "$text" "$E/body" || { echo "GET $path: body lacks [$text]:"; head -c 400 "$E/body"; return 1; }; fi
}
blocked() { req "$1"; [[ "$code" == 403 || "$code" == 404 ]] || { echo "GET $1: HTTP $code"; head -c 300 "$E/body"; return 1; }; }
redirects() { # redirects <path> <location>
  req "$1"
  [[ "$code" == 301 ]] || { echo "GET $1: HTTP $code"; return 1; }
  local location
  location="$(tr -d '\r' < "$E/hdr" | awk 'tolower($1) == "location:" { print $2 }')"
  [[ "$location" == "$2" ]] || { echo "GET $1: location is [$location], expected [$2]"; return 1; }
}
header() { # header <path> <header-regex>
  req "$1"
  grep -qiE "$2" "$E/hdr" || { echo "GET $1 headers lack /$2/:"; cat "$E/hdr"; return 1; }
}
hook_raw() { # hook_raw <token> <json-body> [curl args] -> $code, body in $E/body
  local token="$1" body="$2"; shift 2
  code="$(curl -sS -k -o "$E/body" -D "$E/hdr" -w '%{http_code}' -X POST -H "X-Deploy-Token: $token" -H 'Content-Type: application/json' --data-binary "$body" "$@" "$SITE/_deploy/hook.php" 2> /dev/null)" || code=000
}
current() { python3 -I -c 'import json,sys; print((json.load(open(sys.argv[1])).get("release") or ""))' "$DEP/current.json" 2> /dev/null; }

asset_hash() { case "$1" in v1) echo 3f2a9c1b ;; v2) echo 7c9d0e1f ;; v3) echo 1a2b3c4d ;; v4) echo 5e6f7a8b ;; v5) echo 9a8b7c6d ;; *) echo 0f1e2d3c ;; esac; }
# bundle <dir> <version> [noabout] [fc] [fail]: what a project's BUILD step leaves in deploy/
bundle() {
  local dir="$1" v="$2"; shift 2
  local opts=" $* "
  rm -rf "$dir"
  mkdir -p "$dir/public_html/docs" "$dir/public_html/assets" "$dir/public_html/vite" "$dir/public_html/img" "$dir/app/deploy"
  printf '<!doctype html><html><head><title>%s</title></head><body>home %s</body></html>\n' "$v" "$v" > "$dir/public_html/index.html"
  [[ "$opts" == *" noabout "* ]] || printf '<html><body>about %s</body></html>\n' "$v" > "$dir/public_html/about.html"
  printf '<html><body>docs %s</body></html>\n' "$v" > "$dir/public_html/docs/index.html"
  printf '<html><body>not found page %s</body></html>\n' "$v" > "$dir/public_html/404.html"
  printf 'console.log("%s")\n' "$v" > "$dir/public_html/assets/app-$(asset_hash "$v").js"
  printf 'body{color:red}\n' > "$dir/public_html/assets/style.css"
  printf 'vite' > "$dir/public_html/vite/index-B9x3kQ2a.js"
  printf 'secret notes\n' > "$dir/public_html/notes.md"
  printf 'PNG' > "$dir/public_html/img/logo.png"
  if [[ "$opts" == *" fail "* ]]; then
    printf '<?php\nthrow new RuntimeException("db migration exploded: secret-detail-123");\n' > "$dir/app/deploy/after-unpack.php"
  else
    cat > "$dir/app/deploy/after-unpack.php" <<'PHP'
<?php
// Runs on the server, from the NEW release, before the switch.
return function (array $context): array {
    file_put_contents($context['app_home'] . '/after-unpack-' . $context['release'] . '.json', json_encode([
        'previous' => $context['previous'], 'first' => $context['first_release'], 'db' => $context['env']['DB_PASSWORD'] ?? null,
        'public_index' => is_file($context['public_dir'] . '/index.html'),
    ]));
    ($context['log'])('after-unpack ran for ' . $context['release']);
    return ['migrations' => ['applied' => 0], 'release_seen' => $context['release']];
};
PHP
  fi
  if [[ "$opts" == *" fc "* ]]; then
    mkdir -p "$dir/root/api" "$dir/app/public"
    cp "$kit/public_html/api/index.php.template" "$dir/root/api/index.php"
    printf '<?php\nheader("Content-Type: application/json");\necho json_encode(["release" => DEPLOY_RELEASE, "env_found" => is_file(DEPLOY_APP_HOME . "/.env"), "uri" => $_SERVER["REQUEST_URI"]]);\n' > "$dir/app/public/index.php"
    python3 -I - "$kit/public_html/.htaccess.template" "$dir/root/.htaccess" <<'PY'
import sys
text = open(sys.argv[1]).read()
for line in ["RewriteCond %{REQUEST_URI} !^/api/index\\.php$", "RewriteCond %{HTTP:Authorization} .",
             "RewriteRule ^api(?:/|$) - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]",
             "RewriteRule ^api/index\\.php$ - [E=DK_APP:1,L]", "RewriteRule ^api(?:/|$) api/index.php [E=DK_APP:1,L]"]:
    assert text.count("  # " + line + "\n") == 1, line
    text = text.replace("  # " + line + "\n", "  " + line + "\n")
open(sys.argv[2], "w").write(text)
PY
  fi
}
# ship <id> <version> [bundle options]: build, pack and upload like the workflow; then the caller releases
ship() {
  local id="$1" v="$2"; shift 2
  bundle "$E/deploy-$id" "$v" "$@"
  zd_ok pack "$E/deploy-$id" "$kit" "$id" "$E/out" || return 1
  zd_ok upload "$E/out" "$id" "site_deploy/incoming"
}

# ───────────────────────────── bootstrap onto a live site ─────────────────────────────
phase "bootstrap onto an existing flat site"
check "before: the existing site works (static page)" answers / 200 "old home"
check "before: the existing site works (its PHP)" answers /legacy.php 200 "legacy php"
check "detect: no receiver yet means bootstrap" eval 'zd detect "$SITE" "$kit" && [[ "$(out bootstrap)" == true ]] || { cat "$E/zd.out"; false; }'
mkdir -p "$DEP/receiver/src" "$DEP/incoming" "$PUB/_deploy"
check "bootstrap uploads only the receiver and the stub (one curl, file:// stand-in for FTPS)" zd_ok bootstrap "$kit"
check "bootstrap: the receiver is outside the web root, the stub has the folder names" bash -c "
  [[ -f '$DEP/receiver/hook.php' && -f '$DEP/receiver/VERSION' && -f '$DEP/receiver/src/ReleaseManager.php' ]] &&
  grep -q \"const DEPLOY_KIT_APP_DIR = 'site_app';\" '$PUB/_deploy/hook.php' && '$PHP_BIN' -l '$PUB/_deploy/hook.php'"
check "bootstrap: the live site is untouched apart from the new _deploy/ folder" same_tree "$E/snapshot.original" "$PUB" _deploy
check "bootstrap: the existing site still answers" answers / 200 "old home"
check "detect after bootstrap: the receiver answers with the kit's version and digest" eval 'zd detect "$SITE" "$kit" after-bootstrap && [[ "$(out bootstrap)" == false && "$(out receiver_version)" == "$(tr -d '\''[:space:]'\'' < "$kit/receiver/VERSION")" ]] || { cat "$E/zd.out"; false; }'
check "capabilities: layout flat, the adopt candidates and the suspicious folder are listed" bash -c "
  [[ \"\$(grep '^layout=' '$E/gh-output' | cut -d= -f2)\" == flat ]] &&
  [[ \"\$(grep '^adopt_candidates=' '$E/gh-output' | cut -d= -f2-)\" == 'about.html assets index.html legacy.php old other.example.org' ]] &&
  [[ \"\$(grep '^adopt_suspicious=' '$E/gh-output' | cut -d= -f2-)\" == 'other.example.org' ]] || { cat '$E/gh-output'; exit 1; }"
check "capabilities: persistent names and DEPLOY_KEEP stay in place" bash -c "
  [[ \"\$(grep '^kept_in_place=' '$E/gh-output' | cut -d= -f2-)\" == '.ftpquota .htaccess .user.ini .well-known _deploy cgi-bin client2.com error_log google1234abcd.html media php.ini' ]] || { cat '$E/gh-output'; exit 1; }"

# ───────────────────────────── the hook's gate ─────────────────────────────
phase "token, rate limit, lock"
rm -rf "$APP/storage/ratelimits"
hook_raw "$(openssl rand -hex 32)" '{"action":"capabilities"}'
check "a wrong token answers 404" is "$code" 404
hook_raw "" '{"action":"capabilities"}'
check "no token answers 404" is "$code" 404
req /_deploy/hook.php
check "a GET answers 404" is "$code" 404
hook_raw "$TOKEN" '{"action":"capabilities"}' -H 'Authorization: Bearer x'
check "the right token answers 200 (X-Deploy-Token; Authorization is ignored)" is "$code" 200
check "the hook's answer carries no X-Powered-By and is no-store" bash -c "! grep -qi '^x-powered-by' '$E/hdr' && grep -qi '^cache-control: no-store' '$E/hdr'"
printf 'DEPLOY_HOOK_TOKEN=%s\n' "${TOKEN:0:31}" > "$APP/.env"
hook_raw "${TOKEN:0:31}" '{"action":"capabilities"}'
check "a token shorter than 32 characters disables the hook (404)" is "$code" 404
printf 'DEPLOY_HOOK_TOKEN=\n' > "$APP/.env"
hook_raw "" '{"action":"capabilities"}'
check "an empty token disables the hook (404)" is "$code" 404
cp "$E/env.good" "$APP/.env"
check "the log records disabled and denied calls" bash -c "grep -q '\"event\":\"disabled\"' '$APP/storage/logs/deploy-hook.log' && grep -q '\"event\":\"denied\"' '$APP/storage/logs/deploy-hook.log'"
check "the log never contains the token" lacks "$APP/storage/logs/deploy-hook.log" "$TOKEN"
rm -rf "$APP/storage/ratelimits"
ok_calls=0
for i in $(seq 1 30); do hook_raw "$TOKEN" '{"action":"capabilities"}' -H "CF-Connecting-IP: 198.51.100.$i"; [[ "$code" == 200 ]] && ok_calls=$((ok_calls + 1)); done
hook_raw "$TOKEN" '{"action":"capabilities"}' -H 'CF-Connecting-IP: 198.51.100.99'
check "rate limit: 30 calls in the window pass, the 31st answers 404 (a spoofed CF-Connecting-IP does not help)" bash -c "[[ $ok_calls == 30 && $code == 404 ]] || { echo 'ok calls $ok_calls, 11th $code'; exit 1; }"
check "the log records rate_limited" has "$APP/storage/logs/deploy-hook.log" '"event":"rate_limited"'
rm -rf "$APP/storage/ratelimits"
"$PHP_BIN" -r '$h = fopen($argv[1], "c"); flock($h, LOCK_EX); touch($argv[2]); sleep(4);' "$APP/storage/deploy-hook.lock" "$E/locked" &
lock_pid=$!
for _ in $(seq 1 30); do [[ -f "$E/locked" ]] && break; sleep 0.1; done
hook_raw "$TOKEN" '{"action":"probe"}'
check "a second concurrent hook run answers 409 deploy_hook_busy" bash -c "[[ '$code' == 409 ]] && grep -q deploy_hook_busy '$E/body'"
wait "$lock_pid"
hook_raw "$TOKEN" '{"action":"nope"}'
check "an unknown action answers 422 invalid_request (code and request id only)" bash -c "[[ '$code' == 422 ]] && python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d[\"error\"]==({\"code\":\"invalid_request\"}) and d[\"request_id\"]' '$E/body'"
check "Cloudflare challenge pages get the Bot Fight Mode hint" bash -c "! bash '$SCRIPTS/call-deploy-hook.sh' '$SITE/cfchallenge' capabilities > '$E/cf.out' 2>&1; grep -q 'Bot Fight Mode' '$E/cf.out' || { cat '$E/cf.out'; exit 1; }"

# ───────────────────────────── release 1: consent, then adopt ─────────────────────────────
phase "release 1 onto the live site"
check "pack + upload release r1 (the kit's .htaccess template goes in as root/.htaccess)" ship r1 v1
check "pack: root/.htaccess is the kit's template" cmp "$E/deploy-r1/root/.htaccess" "$kit/public_html/.htaccess.template"
check "release without adopt is refused with adopt_required and the list" eval 'zd_fails release "$SITE" "$E/out" r1 && grep -q '\''adopt_required'\'' "$E/zd.out" && grep -q '\''about.html, assets, index.html, legacy.php, old, other.example.org'\'' "$E/zd.out" || { cat "$E/zd.out"; false; }'
check "refused: nothing moved, no _current, the old site still answers" eval 'same_tree "$E/snapshot.original" "$PUB" _deploy && [[ ! -e "$PUB/_current" ]]'
check "refused: the upload stays in incoming/ for the retry" test -f "$DEP/incoming/r1.zip"
check "release with adopt=move succeeds (probe over HTTPS picks symlink mode)" eval 'ADOPT=move zd_ok release "$SITE" "$E/out" r1 && [[ "$(out mode)" == symlink && "$(out first_release)" == true ]] && grep -q '\''follows symlinks'\'' "$E/zd.out"'
legacy_dir="$H/$(grep '^legacy_dir=' "$E/gh-output" | cut -d= -f2-)"
check "_current is a symlink into releases/r1" bash -c "[[ -L '$PUB/_current' && \"\$(readlink '$PUB/_current')\" == ../site_deploy/releases/r1/public_html ]]"
check "the old site's names moved to legacy/<time>/ (nothing deleted)" bash -c "for n in about.html assets index.html legacy.php old other.example.org; do [[ -e '$legacy_dir/public_html/'\$n && ! -e '$PUB/'\$n ]] || { echo \$n; exit 1; }; done"
check "the old .htaccess is backed up byte for byte" cmp "$legacy_dir/root/.htaccess" "$E/original.htaccess"
check "persistent names and DEPLOY_KEEP are untouched" bash -c "for n in media/photo.jpg .well-known/acme-challenge/tok .user.ini php.ini error_log .ftpquota google1234abcd.html client2.com/index.html _deploy/hook.php; do [[ -e '$PUB/'\$n ]] || { echo \$n; exit 1; }; done; [[ -d '$PUB/cgi-bin' ]]"
check "the live .htaccess is the kit's, with both cPanel blocks once" bash -c "grep -q 'Deploy kit: the document root' '$PUB/.htaccess' && [[ \$(grep -c 'BEGIN cPanel-generated handler' '$PUB/.htaccess') == 1 && \$(grep -c 'BEGIN cPanel-generated php ini' '$PUB/.htaccess') == 1 ]] && grep -q 'ea-php83' '$PUB/.htaccess' && ! grep -q 'hand-made' '$PUB/.htaccess'"
check "after-unpack.php of r1 ran with the context (first release, .env values)" bash -c "python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d==({\"previous\":None,\"first\":True,\"db\":\"pa#ss\",\"public_index\":True}), d' '$APP/after-unpack-r1.json'"
check "the after-unpack report is in the answer and its log line in deploy-hook.log" bash -c "grep -q '\"release_seen\": \"r1\"' '$E/zd.out' && grep -q 'after-unpack ran for r1' '$APP/storage/logs/deploy-hook.log'"
check "current.json names r1, current-app points at its app/" bash -c "[[ \"\$(python3 -I -c 'import json;print(json.load(open(\"$DEP/current.json\"))[\"release\"])')\" == r1 && \"\$(readlink '$DEP/current-app')\" == releases/r1/app ]]"
check "incoming/ is cleaned up and no probe is left behind" bash -c "[[ ! -e '$DEP/incoming/r1.zip' && -z \"\$(ls '$PUB/_deploy' | grep probe)\" ]]"
check "smoke test: SMOKE_PATHS answer 200 and the receiver reports r1 live" bash -c "rm -rf '$APP/storage/ratelimits'; SMOKE_PATHS='/ /about /docs /assets/style.css' SMOKE_EXPECT_RELEASE=r1 bash '$SCRIPTS/smoke-test.sh' '$SITE'"
check "confirm r1" zd_ok confirm "$SITE" r1

# ───────────────────────────── routing ─────────────────────────────
phase "routing through _current"
check "/ serves the release's home" answers / 200 "home v1"
check "/about serves about.html (clean URL)" answers /about 200 "about v1"
check "/docs serves docs/index.html" answers /docs 200 "docs v1"
check "/about.html redirects 301 to /about" redirects /about.html "https://127.0.0.1:$HTTPS_PORT/about"
check "/about/ redirects 301 to /about" redirects /about/ "https://127.0.0.1:$HTTPS_PORT/about"
check "/docs/ redirects 301 to /docs" redirects /docs/ "https://127.0.0.1:$HTTPS_PORT/docs"
check "/index.html redirects 301 to /" redirects /index.html "https://127.0.0.1:$HTTPS_PORT/"
check "/docs/index.html redirects 301 to /docs" redirects /docs/index.html "https://127.0.0.1:$HTTPS_PORT/docs"
check "/about.html?x=1 keeps the query string" redirects "/about.html?x=1" "https://127.0.0.1:$HTTPS_PORT/about?x=1"
check "a missing page answers 404 with the release's 404.html" answers /no-such-page 404 "not found page v1"
check "a missing asset answers 404" answers /assets/missing.js 404
check "/.env answers 403/404" blocked /.env
check "/.htaccess answers 403/404" blocked /.htaccess
check "/.deploy-release (the marker) answers 403/404" blocked /.deploy-release
check "/notes.md answers 403/404" blocked /notes.md
check "/x/.git/config answers 404" answers /x/.git/config 404
check "/backup.sql and /site.env answer 403/404" eval 'blocked /backup.sql && blocked /site.env && blocked /app.yml && blocked /old.bak'
check "/.user.ini and /error_log answer 403/404" eval 'blocked /.user.ini && blocked /error_log && blocked /php.ini'
check "/media/photo.jpg is served from the real folder" answers /media/photo.jpg 200 "JPEGDATA"
check "/media/ never runs PHP (404)" answers /media/evil.php 404
check "/media/ files get the sandbox CSP" header /media/photo.jpg '^content-security-policy: .*sandbox'
check "/.well-known/acme-challenge/ is served" answers /.well-known/acme-challenge/tok 200 "acme-token"
check "/_current/index.html answers 404" answers /_current/index.html 404
check "/_current and /_previous/ answer 404" eval 'answers /_current 404 && answers /_previous/ 404 && answers /_current/ 404'
check "/_deploy/ serves nothing but the hook" eval 'answers /_deploy/ 404 && answers /_deploy/other.txt 404 && blocked /_deploy/hook.php.bak'
check "PHP outside the allow-list answers 404 (the moved legacy.php, a double extension)" eval 'answers /legacy.php 404 && answers /img/logo.php.png 404'
check "a DEPLOY_KEEP file in the real folder is still served, with its .html" answers /google1234abcd.html 200 "google-site-verification"
check "a DEPLOY_KEEP folder in the real folder is still served" answers /client2.com/index.html 200 "client2 site"
check "the moved other site is gone from the web root (moved, not deleted)" answers /other.example.org/index.html 404
check "hashed assets: one year, immutable" header /assets/app-3f2a9c1b.js '^cache-control: public, max-age=31536000, immutable'
check "Vite-style hashed names: immutable" header /vite/index-B9x3kQ2a.js '^cache-control: public, max-age=31536000, immutable'
check "other assets: one hour" header /assets/style.css '^cache-control: public, max-age=3600'
check "HTML: no-cache" header /about '^cache-control: no-cache'
check "the home page: no-cache" header / '^cache-control: no-cache'
check "security headers are set" eval 'header / '\''^x-content-type-options: nosniff'\'' && header / '\''^x-frame-options: SAMEORIGIN'\'' && header / '\''^referrer-policy: '\'' && header / '\''^permissions-policy: '\'''
check "no X-Powered-By, no directory index" eval 'answers /img/ 404 && ! grep -qi '\''^x-powered-by'\'' "$E/hdr"'
check "plain HTTP redirects to HTTPS" bash -c "c=\$(curl -s -o /dev/null -D - '$PLAIN/about' | tr -d '\r'); grep -q '^HTTP/1.1 301' <<< \"\$c\" && grep -qi '^location: https://127.0.0.1:$HTTP_PORT/about' <<< \"\$c\""
check "X-Forwarded-Proto: https does not redirect (no loop behind a proxy)" bash -c "[[ \$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' '$PLAIN/about') == 200 ]]"
check "CF-Visitor https does not redirect (Cloudflare Flexible)" bash -c "[[ \$(curl -s -o /dev/null -w '%{http_code}' -H 'CF-Visitor: {\"scheme\":\"https\"}' '$PLAIN/about') == 200 ]]"
check "ACME validation passes over plain HTTP" bash -c "[[ \$(curl -s '$PLAIN/.well-known/acme-challenge/tok') == acme-token ]]"

# ───────────────────────────── release 2 ─────────────────────────────
phase "release 2"
check "pack + upload release r2 (about.html removed, a new asset name)" ship r2 v2 noabout
check "release r2 (symlink mode, as the server reports it)" eval 'MODE=symlink zd_ok release "$SITE" "$E/out" r2 && [[ "$(out previous)" == r1 && "$(out mode)" == symlink ]]'
check "r2 is live" answers / 200 "home v2"
check "_previous points at r1" bash -c "[[ \"\$(readlink '$PUB/_previous')\" == ../site_deploy/releases/r1/public_html ]]"
check "a page r2 removed answers 404 (pages never come from _previous)" answers /about 404 "not found page v2"
check "r1's hashed asset still loads through _previous (pages loaded before the switch)" answers /assets/app-3f2a9c1b.js 200 'console.log("v1")'
check "r2's own asset loads" answers /assets/app-7c9d0e1f.js 200 'console.log("v2")'
check "after-unpack of r2 saw r1 as the previous release" bash -c "grep -q '\"previous\":\"r1\"' '$APP/after-unpack-r2.json'"
check "releasing the live release again answers already_current" eval 'MODE=symlink zd_ok release "$SITE" "$E/out" r2 && [[ "$(out already_current)" == true ]]'
check "the cPanel blocks are still there once" bash -c "[[ \$(grep -c 'BEGIN cPanel-generated' '$PUB/.htaccess') == 2 ]]"
check "the live .htaccess before a switch that changes it is kept in backup/" bash -c "ls '$DEP/backup/' | grep -q '^htaccess.before-r1-'"

# ───────────────────────────── rollback ─────────────────────────────
phase "rollback, down to the site from before"
check "rollback switches back to r1" eval 'zd_ok rollback "$SITE" && [[ "$(out release)" == r1 && "$(out rolled_back_from)" == r2 ]]'
check "r1 is live again" answers / 200 "home v1"
check "after the rollback, r2's assets still load through _previous" answers /assets/app-7c9d0e1f.js 200 'console.log("v2")'
check "the smoke test reports r1 live" bash -c "rm -rf '$APP/storage/ratelimits'; SMOKE_EXPECT_RELEASE=r1 bash '$SCRIPTS/smoke-test.sh' '$SITE'"
check "rollback again restores the old site (legacy)" eval 'zd_ok rollback "$SITE" && [[ "$(out release)" == none ]]'
check "the old site's files are back exactly, .htaccess byte for byte" same_tree "$E/snapshot.original" "$PUB" _deploy
check "no _current, no current.json, no current-app, legacy folder gone" bash -c "[[ ! -e '$PUB/_current' && ! -e '$PUB/_previous' && ! -e '$DEP/current.json' && ! -e '$DEP/current-app' && ! -e '$legacy_dir' ]]"
check "the old site answers, its PHP too" eval 'answers / 200 '\''old home'\'' && answers /legacy.php 200 '\''legacy php'\'''
check "the smoke test accepts 'none' after a rollback to the old site" bash -c "rm -rf '$APP/storage/ratelimits'; SMOKE_EXPECT_RELEASE=none bash '$SCRIPTS/smoke-test.sh' '$SITE'"
check "a further rollback is refused (no_previous_release)" eval 'zd_fails rollback "$SITE" && grep -q no_previous_release "$E/zd.out"'

# ───────────────────────────── rename mode and a PHP front controller ─────────────────────────────
phase "forced rename mode, a PHP front controller, mode changes"
check "pack + upload r3 with root/api/index.php and the front controller lines enabled" ship r3 v3 fc
check "release r3 with SWITCH_MODE=rename (adopting the old site again)" eval 'ADOPT=move SWITCH_MODE=rename zd_ok release "$SITE" "$E/out" r3 && [[ "$(out mode)" == rename ]]'
legacy_dir="$H/$(grep '^legacy_dir=' "$E/gh-output" | cut -d= -f2-)"
check "rename mode: _current is a real folder" bash -c "[[ -d '$PUB/_current' && ! -L '$PUB/_current' ]]"
check "rename mode: r3 is live" answers / 200 "home v3"
check "the front controller reaches r3's app outside the web root" answers /api/ping 200 '"release":"r3","env_found":true,"uri":"\/api\/ping"'
check "the front controller gets the app's own headers (no kit Cache-Control)" eval 'req /api/ping; ! grep -qi '\''^cache-control: public'\'' "$E/hdr"'
check "pack + upload r4 (front controller again)" ship r4 v4 fc
check "release r4 keeps rename mode" eval 'MODE=rename zd_ok release "$SITE" "$E/out" r4 && [[ "$(out mode)" == rename ]]'
check "rename mode: _previous is r3's real folder, the API switched with current.json" bash -c "[[ -d '$PUB/_previous' && ! -L '$PUB/_previous' && \"\$(cat '$PUB/_previous/.deploy-release')\" == r3 ]] && curl -sk '$SITE/api/ping' | grep -q '\"release\":\"r4\"'"
mv "$PUB/_current" "$PUB/_current.away"
check "while a rename switch is in flight (_current missing), _previous serves the site" answers / 200 "home v3"
mv "$PUB/_current.away" "$PUB/_current"
check "r3's asset loads through _previous in rename mode" answers /assets/app-1a2b3c4d.js 200 'console.log("v3")'
check "pack + upload r5 (no front controller)" ship r5 v5
check "release r5 with SWITCH_MODE=symlink switches the mode" eval 'SWITCH_MODE=symlink zd_ok release "$SITE" "$E/out" r5 && [[ "$(out mode)" == symlink ]] && [[ -L "$PUB/_current" && -L "$PUB/_previous" ]]'
check "r5 is live; the root file r4 installed (api/index.php) is gone" eval 'answers / 200 '\''home v5'\'' && [[ ! -e "$PUB/api" ]] && answers /api/ping 404'
check "only three releases are kept, on disk too" bash -c "[[ \"\$(ls '$DEP/releases' | sort | tr '\n' ' ')\" == 'r3 r4 r5 ' ]]"
check "rollback to r4 brings its front controller back" eval 'zd_ok rollback "$SITE" && [[ "$(out release)" == r4 ]] && curl -sk "$SITE/api/ping" | grep -q '\''"release":"r4"'\'''
check "rollback_to a release that is not kept is refused" eval 'zd_fails rollback "$SITE" r1 && grep -q rollback_target_missing "$E/zd.out"'
check "rollback_to r5 by id" eval 'zd_ok rollback "$SITE" r5 && [[ "$(out release)" == r5 ]]'

# ───────────────────────────── refusals ─────────────────────────────
phase "unsafe archives, bad checksum, failing after-unpack"
live_before="$(current)"
hostile() { # hostile <id> <json entries to add>: a crafted archive uploaded with its correct sha256
  local id="$1" extra="$2"
  local sha
  sha="$(printf '[{"name":"public_html/"},{"name":"public_html/index.html","data":"<html>x</html>"},{"name":"root/.htaccess","data":"RewriteEngine On\\n"},%s]' "$extra" | "$PHP_BIN" "$kit/tests/make-zip.php" "$DEP/incoming/$id.zip")"
  printf '{"release":"%s","sha256":"%s"}' "$id" "$sha" > "$E/out/$id.json"
}
hostile h1 '{"name":"public_html/../../../evil.txt","data":"escaped"}'
check "an archive with ../ is refused (unsafe_archive)" eval 'MODE=symlink zd_fails release "$SITE" "$E/out" h1 && grep -q unsafe_archive "$E/zd.out"'
hostile h2 '{"name":"public_html/link","data":"/etc/passwd","mode":41471}'
check "an archive with a symlink entry is refused" eval 'MODE=symlink zd_fails release "$SITE" "$E/out" h2 && grep -q unsafe_archive "$E/zd.out"'
hostile h3 '{"name":"app/.env","data":"DB_PASSWORD=leak"}'
check "an archive with a .env is refused" eval 'MODE=symlink zd_fails release "$SITE" "$E/out" h3 && grep -q unsafe_archive "$E/zd.out"'
check "refused archives wrote nothing and switched nothing" bash -c "[[ \"\$(python3 -I -c 'import json;print(json.load(open(\"$DEP/current.json\"))[\"release\"])')\" == '$live_before' ]] && ! find '$E' -name evil.txt | grep -q . && [[ ! -e '$DEP/releases/h1' && ! -e '$DEP/releases/h2' && ! -e '$DEP/releases/h3' ]]"
check "the log names the refused entry; the HTTP answer does not" bash -c "grep -q 'Refused entry' '$APP/storage/logs/deploy-hook.log' && ! grep -q 'Refused entry' '$E/zd.out'"
check "pack + upload r6" ship r6 v6
python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); d["sha256"]="0"*64; json.dump(d, open(sys.argv[1],"w"))' "$E/out/r6.json"
check "a wrong sha256 is refused (checksum_mismatch)" eval 'MODE=symlink zd_fails release "$SITE" "$E/out" r6 && grep -q checksum_mismatch "$E/zd.out"'
check "nothing switched after the checksum mismatch" bash -c "[[ \"\$(python3 -I -c 'import json;print(json.load(open(\"$DEP/current.json\"))[\"release\"])')\" == '$live_before' && ! -e '$DEP/releases/r6' ]]"
check "pack + upload r7 whose after-unpack.php throws" ship r7 v7 fail
check "a failing after-unpack.php stops the release (after_unpack_failed)" eval 'MODE=symlink zd_fails release "$SITE" "$E/out" r7 && grep -q after_unpack_failed "$E/zd.out"'
check "after the failure: the live site is untouched and r7 is deleted" eval 'answers / 200 '\''home v5'\'' && [[ "$(current)" == "$live_before" && ! -e "$DEP/releases/r7" ]]'
check "the exception message is in deploy-hook.log, never in the HTTP answer" bash -c "grep -q 'secret-detail-123' '$APP/storage/logs/deploy-hook.log' && ! grep -q 'secret-detail-123' '$E/zd.out'"

# ───────────────────────────── addon domains ─────────────────────────────
phase "document root mismatch (addon domains)"
cp "$PUB/_deploy/hook.php" "$E/stub.good"
mkdir -p "$H/other_root"
DOCROOT=other_root bash "$ZD" render-stub "$kit" "$PUB/_deploy/hook.php" > /dev/null
rm -rf "$APP/storage/ratelimits"
hook_raw "$TOKEN" '{"action":"probe"}'
check "a stub naming another DOCROOT than the site's document root gets 409 document_root_mismatch" bash -c "[[ '$code' == 409 ]] && grep -q document_root_mismatch '$E/body'"
check "detect stops with the DOCROOT hint" eval 'DOCROOT=other_root zd_fails detect "$SITE" "$kit" && grep -q '\''Set the repository variable DOCROOT'\'' "$E/zd.out"'
cp "$E/stub.good" "$PUB/_deploy/hook.php"
check "the nested-DOCROOT stub finds the home two folders further up" bash -c "DOCROOT=public_html/shop.example.com bash '$ZD' render-stub '$kit' '$E/nested.php' && grep -q \"DEPLOY_KIT_DOCROOT = 'public_html/shop.example.com'\" '$E/nested.php' && '$PHP_BIN' -l '$E/nested.php'"

# ───────────────────────────── receiver versions ─────────────────────────────
phase "receiver updates (bootstrap decisions)"
cp "$DEP/receiver/VERSION" "$E/VERSION.good"
echo 0.9.0 > "$DEP/receiver/VERSION"
check "an older receiver on the server means bootstrap" eval 'zd detect "$SITE" "$kit" && [[ "$(out bootstrap)" == true ]] && grep -q '\''older than the kit'\'' "$E/zd.out"'
echo 9.9.9 > "$DEP/receiver/VERSION"
check "a newer receiver on the server is left alone, with a warning" eval 'zd detect "$SITE" "$kit" && [[ "$(out bootstrap)" == false ]] && grep -q '\''newer than this repository'\'' "$E/zd.out"'
cp "$E/VERSION.good" "$DEP/receiver/VERSION"
printf '\n// edited on the server\n' >> "$DEP/receiver/src/Env.php"
check "same version but different files (an interrupted upload) means bootstrap" eval 'zd detect "$SITE" "$kit" && [[ "$(out bootstrap)" == true ]] && grep -q '\''files differ'\'' "$E/zd.out"'
check "bootstrap again repairs it" eval 'zd_ok bootstrap "$kit" && zd_ok detect "$SITE" "$kit" after-bootstrap && [[ "$(out bootstrap)" == false ]]'
cp "$E/env.good" "$APP/.env"
printf 'DEPLOY_HOOK_TOKEN=%s\n' "$(openssl rand -hex 32)" > "$APP/.env"
check "after bootstrap, a token mismatch fails with the checklist (not a loop)" eval 'zd_fails detect "$SITE" "$kit" after-bootstrap && grep -q '\''has DEPLOY_HOOK_TOKEN'\'' "$E/zd.out"'
cp "$E/env.good" "$APP/.env"

# ───────────────────────────── the workflow's automatic rollback ─────────────────────────────
phase "smoke failure -> automatic rollback (the workflow's steps)"
check "pack + upload r8" ship r8 v8
check "release r8" eval 'MODE=symlink zd_ok release "$SITE" "$E/out" r8 && [[ "$(out previous)" == r5 ]]'
check "the smoke test fails when a SMOKE_PATHS entry is missing" bash -c "rm -rf '$APP/storage/ratelimits'; ! SMOKE_PATHS='/ /must-exist' SMOKE_ATTEMPTS=1 SMOKE_EXPECT_RELEASE=r8 bash '$SCRIPTS/smoke-test.sh' '$SITE' > '$E/smoke.out' 2>&1 && grep -q '/must-exist last answered HTTP 404' '$E/smoke.out'"
check "the automatic rollback returns to r5 and r5 passes the smoke test" eval 'zd_ok rollback "$SITE" && [[ "$(out release)" == r5 ]] && rm -rf "$APP/storage/ratelimits" && SMOKE_EXPECT_RELEASE=r5 bash "$SCRIPTS/smoke-test.sh" "$SITE"'
check "the smoke test names the wrong live release" bash -c "rm -rf '$APP/storage/ratelimits'; ! SMOKE_EXPECT_RELEASE=r8 bash '$SCRIPTS/smoke-test.sh' '$SITE' > '$E/smoke.out' 2>&1 && grep -q 'reports release r5 as live, not r8' '$E/smoke.out'"

# ───────────────────────────── cPanel blocks over time ─────────────────────────────
phase "cPanel's .htaccess blocks"
python3 -I -c 'import sys; p=sys.argv[1]; s=open(p).read(); open(p,"w").write(s.replace("ea-php83","ea-php82"))' "$PUB/.htaccess"
check "pack + upload r9" ship r9 v9
check "release r9 keeps the PHP version MultiPHP changed in the meantime" eval 'MODE=symlink zd_ok release "$SITE" "$E/out" r9 && grep -q ea-php82 "$PUB/.htaccess" && ! grep -q ea-php83 "$PUB/.htaccess" && [[ $(grep -c '\''BEGIN cPanel-generated'\'' "$PUB/.htaccess") == 2 ]]'
check "rollback_to legacy restores the old site and keeps the newer PHP version" eval 'zd_ok rollback "$SITE" legacy && [[ "$(out release)" == none ]] && grep -q ea-php82 "$PUB/.htaccess" && grep -q '\''hand-made'\'' "$PUB/.htaccess" && ! grep -q '\''Deploy kit'\'' "$PUB/.htaccess"'
check "apart from the PHP version, the old site is back exactly" eval 'python3 -I -c '\''import sys; p=sys.argv[1]; s=open(p).read(); open(p,"w").write(s.replace("ea-php82","ea-php83"))'\'' "$PUB/.htaccess" && same_tree "$E/snapshot.original" "$PUB" _deploy'
cp "$kit/public_html/.htaccess.template" "$E/merged.htaccess"
check "merge-cpanel-htaccess.sh keeps the same blocks the receiver keeps" bash -c "bash '$SCRIPTS/merge-cpanel-htaccess.sh' '$E/original.htaccess' '$E/merged.htaccess' > /dev/null &&
  '$PHP_BIN' -r 'require \"$kit/receiver/src/HtaccessComposer.php\"; echo DeployKit\\HtaccessComposer::compose(file_get_contents(\"$kit/public_html/.htaccess.template\"), file_get_contents(\"$E/original.htaccess\"));' > '$E/composed.htaccess' &&
  diff <(sed -n '/BEGIN cPanel/,/END cPanel/p' '$E/merged.htaccess') <(sed -n '/BEGIN cPanel/,/END cPanel/p' '$E/composed.htaccess') && [[ \$(grep -c 'BEGIN cPanel-generated' '$E/merged.htaccess') == 2 ]]"
check "merge-cpanel-htaccess.sh does not add a block twice" bash -c "bash '$SCRIPTS/merge-cpanel-htaccess.sh' '$E/original.htaccess' '$E/merged.htaccess' > /dev/null && [[ \$(grep -c 'BEGIN cPanel-generated' '$E/merged.htaccess') == 2 ]]"

# ───────────────────────────── forms and email (kit/mail) ─────────────────────────────
MAIL_KIT="${MAIL_KIT:-$kit/../mail}"
if [[ ! -f "$MAIL_KIT/public/contact.php" ]]; then
  echo "note: kit/mail not found next to the deploy kit (set MAIL_KIT=<dir>); its scenario was skipped"
else
phase "forms and email with kit/mail (FORM ENDPOINTS toggle)"
MAIL_KIT="$(cd "$MAIL_KIT" && pwd)"
# What the mail kit needs next to the deploy token: Turnstile off, mail queued in files but not sent.
printf 'DEPLOY_HOOK_TOKEN=%s\nDEPLOY_KEEP="google1234abcd.html client2.com"\nAPP_ENV=development\nAPP_URL=%s\nMAIL_ENABLED=false\nMAIL_QUEUE=file\nMAIL_FROM_ADDRESS=website@example.test\nMAIL_FROM_NAME="Example Site"\nMAIL_REPLY_TO=support@example.test\nMAIL_STAFF_NOTIFY=staff@example.test\nMAIL_INFO_ADDRESS=info@example.test\nTURNSTILE_SECRET_KEY=\nTURNSTILE_HOSTNAMES=\n' "$TOKEN" "$SITE" > "$APP/.env"
mail_bundle() { # mail_bundle <dir> <version> on|off: a site build with the mail kit added by add-mailkit.sh
  local dir="$1" v="$2" toggle="$3"
  bundle "$dir" "$v"
  mkdir -p "$dir/root"
  python3 -I - "$kit/public_html/.htaccess.template" "$dir/root/.htaccess" "$toggle" <<'PY2'
import sys
text = open(sys.argv[1]).read()
line = "  # RewriteRule ^api/(?:contact)\\.php$ - [E=DK_APP:1,L]\n"
assert text.count(line) == 1, "the FORM ENDPOINTS line is missing from the template"
open(sys.argv[2], "w").write(text.replace(line, "  RewriteRule ^api/(?:contact)\\.php$ - [E=DK_APP:1,L]\n") if sys.argv[3] == "on" else text)
PY2
  APP_DIR=site_app DEPLOY_DIR=site_deploy DOCROOT=public_html MAILKIT_FORM_PAGE=contact.html TURNSTILE_SITE_KEY=0x4AAAAAAATestSiteKey \
    bash "$SCRIPTS/add-mailkit.sh" "$MAIL_KIT" "$dir"
}
ship_mail() { # ship_mail <id> <version> on|off
  local id="$1" v="$2" toggle="$3"
  mail_bundle "$E/deploy-$id" "$v" "$toggle" > "$E/add-mailkit.out" 2>&1 || { cat "$E/add-mailkit.out"; return 1; }
  zd_ok pack "$E/deploy-$id" "$kit" "$id" "$E/out" || return 1
  zd_ok upload "$E/out" "$id" "site_deploy/incoming"
}
post_form() { # post_form <json> [origin]: POST /api/contact.php the way contact-form.js does
  local json="$1" origin="${2:-$SITE}"
  rm -rf "$APP/storage/mailkit/ratelimits"
  code="$(curl -sS -k -o "$E/body" -D "$E/hdr" -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -H "Origin: $origin" --data-binary "$json" "$SITE/api/contact.php" 2> /dev/null)" || code=000
}
spooled() { find "$APP/storage/mailkit/spool" -type f -name '*.json' 2> /dev/null | wc -l | tr -d ' '; }
form_ok() { # form_ok <label>: a valid post is accepted and queues the staff email and the acknowledgement
  local before
  before="$(spooled)"
  post_form '{"form":"contact","name":"Thandi Test","email":"thandi@example.test","message":"Hello, we need 200 branded pens by Friday.","website":""}'
  [[ "$code" == 200 ]] && grep -q '"ok":true' "$E/body" && grep -q '"reference":"C-' "$E/body" || { echo "HTTP $code"; head -c 400 "$E/body"; return 1; }
  [[ "$(spooled)" == $((before + 2)) ]] || { echo "spool: $before before, $(spooled) after"; return 1; }
}
form_refused() { # form_refused <json> <origin> <http code> <error code or ok>: refused (or silently dropped), nothing queued
  local before
  before="$(spooled)"
  post_form "$1" "$2"
  [[ "$code" == "$3" ]] && grep -q "$4" "$E/body" || { echo "HTTP $code"; head -c 400 "$E/body"; return 1; }
  [[ "$(spooled)" == "$before" ]] || { echo "spool: $before before, $(spooled) after"; return 1; }
}
cron_line() { # the README's cron line with this machine's PHP added to the binaries it probes
  python3 -I - "$kit/README.md" "$PHP_BIN" "$1" <<'PY2'
import sys
line = next(l.strip() for l in open(sys.argv[1]) if l.strip().startswith("cd $HOME && P=$(ls /opt/cpanel/ea-php83"))
line = line.replace("<DEPLOY_DIR>", "site_deploy").replace("<APP_DIR>", "site_app")
line = line.replace("/opt/alt/php83/usr/bin/php 2>/dev/null", "/opt/alt/php83/usr/bin/php '" + sys.argv[2] + "' 2>/dev/null")
print(line if sys.argv[3] == "full" else line.removesuffix(" >/dev/null 2>&1"))
PY2
}
check "add-mailkit.sh adds the mail kit to the build (toggle on: no warnings)" eval 'ship_mail m1 vm1 on && ! grep -q "::warning" "$E/add-mailkit.out"'
check "the build: endpoints in root/api/ (depth 2, the deploy dir set), the kit in app/mailkit/ (app_dir set)" eval '
  d="$E/deploy-m1"; [[ -f "$d/root/api/contact.php" && -f "$d/app/mailkit/src/bootstrap.php" && -f "$d/app/mailkit/bin/send-mail.php" && -f "$d/public_html/contact-form.js" && ! -e "$d/public_html/contact.php" && ! -e "$d/app/mailkit/tests" ]] &&
  grep -q "const MAILKIT_WEBROOT_DEPTH = 2;" "$d/root/api/mailkit-config.php" && grep -q "const MAILKIT_DEPLOY_DIR = '\''site_deploy'\'';" "$d/root/api/mailkit-config.php" &&
  grep -q "const MAILKIT_APP_DIR = '\''site_app'\'';" "$d/root/api/mailkit-config.php" && grep -q "'\''app_dir'\'' => '\''site_app'\''" "$d/app/mailkit/config.php" &&
  "$PHP_BIN" -l "$d/root/api/mailkit-config.php" && "$PHP_BIN" -l "$d/app/mailkit/config.php"'
check "release m1 with the mail kit (adopting the old site again)" eval 'ADOPT=move MODE=symlink zd_ok release "$SITE" "$E/out" m1'
check "the endpoints are real files in ~/public_html/api/, the kit is at current-app/mailkit" eval '[[ -f "$PUB/api/contact.php" && ! -L "$PUB/api/contact.php" && -f "$PUB/api/mailkit-config.php" && -f "$DEP/current-app/mailkit/bin/send-mail.php" && "$(readlink "$DEP/current-app")" == releases/m1/app ]]'
check "the form page posts to /api/contact.php and carries the Turnstile site key" eval 'answers /contact 200 "action=\"/api/contact.php\"" && grep -q 0x4AAAAAAATestSiteKey "$E/body" && answers /contact-form.js 200'
check "a valid POST with a matching Origin succeeds and queues two emails under ~/site_app/storage/" form_ok
check "the endpoint keeps its own no-store (the kit's caching and security headers stay out)" eval '! grep -qi "^cache-control: public" "$E/hdr" && grep -qi "^cache-control: no-store" "$E/hdr" && [[ $(grep -ci "^referrer-policy" "$E/hdr") == 1 ]]'
check "a POST from another origin is refused (403 forbidden_origin)" form_refused '{"form":"contact","name":"Eve","email":"eve@example.test","message":"This comes from another site."}' "https://evil.example" 403 forbidden_origin
check "a POST with the honeypot filled is answered ok and dropped" eval 'form_refused '\''{"form":"contact","name":"Bot","email":"bot@example.test","message":"Buy cheap things now please.","website":"http://spam.example"}'\'' "$SITE" 200 "\"ok\":true" && grep -q "honeypot filled" "$APP/storage/mailkit/logs/mail.log"'
check "an invalid POST is refused (422 validation_failed)" form_refused '{"form":"contact","name":"","email":"not-an-email","message":"short"}' "$SITE" 422 validation_failed
check "a GET reaches the endpoint and is refused (405)" answers /api/contact.php 405
check "/api/mailkit-config.php answers 404 (GET and POST)" eval 'answers /api/mailkit-config.php 404 && answers /api/mailkit-config.php 404 "" -X POST'
check "the kit's library files answer 404 (they are outside the web root)" eval 'for p in /mailkit/src/bootstrap.php /mailkit/src/Kit.php /app/mailkit/src/Kit.php /api/src/Kit.php /src/bootstrap.php /mailkit/bin/send-mail.php /mailkit/config.php /api/config.php /migrations/001_email_queue.sql /current-app/mailkit/src/Kit.php; do blocked "$p" || return 1; done; c=$(curl -sk --path-as-is -o /dev/null -w "%{http_code}" "$SITE/_current/../app/mailkit/src/Kit.php"); [[ $c == 400 || $c == 403 || $c == 404 ]] || { echo "../ path: $c"; false; }'
check "nothing is written inside a release (spool, logs and limits stay in ~/site_app)" eval '! find "$DEP/releases" -path "*storage*" | grep -q . && [[ -d "$APP/storage/mailkit/spool" ]]'
check "the README cron line finds current-app/mailkit/bin/send-mail.php and sees the queued mail" eval 'line="$(cron_line verbose)"; o="$(env -i HOME="$H" PATH=/usr/bin:/bin bash -c "$line" 2>&1)"; c=$?; [[ $c == 0 && "$o" == "send-mail: MAIL_ENABLED is not true; $(spooled) message(s) waiting in the queue" ]] || { echo "exit $c: $o"; false; }'
check "the full README cron line is silent and exits 0" eval 'line="$(cron_line full)"; o="$(env -i HOME="$H" PATH=/usr/bin:/bin bash -c "$line" 2>&1)"; c=$?; [[ $c == 0 && -z "$o" ]] || { echo "exit $c: $o"; false; }'
check "pack + upload m2 (the mail kit again)" ship_mail m2 vm2 on
check "release m2" eval 'MODE=symlink zd_ok release "$SITE" "$E/out" m2 && [[ "$(out previous)" == m1 && "$(readlink "$DEP/current-app")" == releases/m2/app ]]'
check "after the second release the form still works" form_ok
check "rollback to m1" eval 'zd_ok rollback "$SITE" && [[ "$(out release)" == m1 && "$(readlink "$DEP/current-app")" == releases/m1/app && -f "$PUB/api/contact.php" ]]'
check "after the rollback the form still works" form_ok
check "with the toggle off, add-mailkit.sh warns that the endpoint is not enabled" eval 'ship_mail m3 vm3 off && grep -q "Form endpoint not enabled" "$E/add-mailkit.out"'
check "release m3 (toggle off): the endpoint is blocked like any PHP (404), nothing queued" eval 'MODE=symlink zd_ok release "$SITE" "$E/out" m3 && form_refused '\''{"form":"contact","name":"Thandi","email":"thandi@example.test","message":"Hello there, toggle is off."}'\'' "$SITE" 404 ""'
check "a nested DOCROOT gives the stub one more folder of depth" eval 'bundle "$E/deploy-nested" vn && DOCROOT=public_html/shop.example.com bash "$SCRIPTS/add-mailkit.sh" "$MAIL_KIT" "$E/deploy-nested" > /dev/null && grep -q "const MAILKIT_WEBROOT_DEPTH = 3;" "$E/deploy-nested/root/api/mailkit-config.php"'
check "rollback m3 -> m1 leaves the form working for the rest of the run" eval 'zd_ok rollback "$SITE" && [[ "$(out release)" == m1 ]]'
fi

# ───────────────────────────── pack refusals ─────────────────────────────
phase "pack refuses what the server would refuse"
refuse_pack() { # refuse_pack <label> <expected text> <setup commands>
  local label="$1" text="$2" setup="$3"
  bundle "$E/deploy-bad" vbad
  (cd "$E/deploy-bad" && eval "$setup")
  check "pack refuses $label" eval 'zd_fails pack "$E/deploy-bad" "$kit" bad "$E/out-bad" && grep -qF -- "$text" "$E/zd.out"'
}
refuse_pack "a symlink" "a symlink" "ln -s /etc/passwd public_html/passwd"
refuse_pack "a .htaccess inside public_html" ".htaccess files belong in deploy/root/.htaccess" "printf 'RewriteEngine Off' > public_html/.htaccess"
refuse_pack "a .env file" "an environment file" "printf 'X=1' > app/.env"
refuse_pack "public_html/media/" "served from the real document root" "mkdir -p public_html/media && printf x > public_html/media/a.jpg"
refuse_pack "php_value in root/.htaccess" "sets PHP ini values directly" "mkdir -p root && printf 'RewriteEngine On\nphp_value memory_limit 256M\n' > root/.htaccess"
refuse_pack "a root/ file that replaces cgi-bin" "a name the server manages" "mkdir -p root/cgi-bin && printf x > root/cgi-bin/x"
check "pack accepts php_value inside a cPanel block or a <IfModule php...> guard" eval 'bundle "$E/deploy-ok" vok && mkdir -p "$E/deploy-ok/root" && printf '\''RewriteEngine On\n<IfModule php8_module>\n  php_value memory_limit 256M\n</IfModule>\n'\'' > "$E/deploy-ok/root/.htaccess" && zd_ok pack "$E/deploy-ok" "$kit" ok1 "$E/out-ok"'

# ───────────────────────────── summary ─────────────────────────────
echo
if [[ -s "$E/logs/php-error.log" ]] && grep -qiE 'fatal|parse error|warning|deprecated|notice' "$E/logs/php-error.log"; then
  fail "PHP logged errors, warnings or deprecations:"; grep -iE 'fatal|parse error|warning|deprecated|notice' "$E/logs/php-error.log" | head -n 10
else
  pass "php-fpm logged no errors, warnings, notices or deprecations (error_reporting=-1)"
fi
echo "deploy kit tests: $passed passed, $failed failed (work dir $E)"
[[ "$failed" == 0 ]]
