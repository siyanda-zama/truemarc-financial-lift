#!/usr/bin/env bash
# Adds kit/mail (MailKit: the contact/quote form endpoint and the mail queue) to a zip-release build.
# Run it at the end of the BUILD step, once deploy/public_html exists:
#
#   bash .github/scripts/add-mailkit.sh <mail-kit-dir> <deploy-dir>
#
#   src/ bin/ migrations/ config.php -> <deploy>/app/mailkit/  (~/<DEPLOY_DIR>/current-app/mailkit on the
#                                       server; config.php gets app_dir = APP_DIR, so cron finds the .env)
#   public/contact.php               -> <deploy>/root/api/      (each switch installs root/ into the REAL
#   public/mailkit-config.php        -> <deploy>/root/api/       ~/<DOCROOT>/api/: never ship them in
#                                       public_html/, because mailkit-config.php finds the cPanel home by
#                                       counting folders up from its own location, and inside a release
#                                       that location is ~/<DEPLOY_DIR>/releases/<id>/public_html)
#   public/contact-form.js and .css  -> <deploy>/public_html/  (unless the build already has its own)
#
# Env: APP_DIR, DEPLOY_DIR, DOCROOT   as in the workflow (defaults site_app, site_deploy, public_html)
#      MAILKIT_URL_DIR                the endpoint's folder, default api (the form posts to /api/contact.php)
#      MAILKIT_FORM_PAGE              optional, e.g. contact.html: also install the kit's example page there
#      TURNSTILE_SITE_KEY             optional, the PUBLIC key: replaces __TURNSTILE_SITE_KEY__ in the HTML
#      KIT_DIR                        where the deploy kit is (default deploy-kit), for the .htaccess check
# The .htaccess must allow the endpoint: uncomment "FORM ENDPOINTS (kit/mail)" in rule 6 of the template.
set -euo pipefail

mail="${1:?usage: add-mailkit.sh <mail-kit-dir> <deploy-dir>}"
deploy="${2:?usage: add-mailkit.sh <mail-kit-dir> <deploy-dir>}"
APP_DIR="${APP_DIR:-site_app}"
DEPLOY_DIR="${DEPLOY_DIR:-site_deploy}"
DOCROOT="${DOCROOT:-public_html}"
DOCROOT="${DOCROOT#/}"
DOCROOT="${DOCROOT%/}"
url_dir="${MAILKIT_URL_DIR:-api}"

die() {
  echo "::error::add-mailkit: $*"
  exit 1
}
plain() { [[ "$1" =~ ^[A-Za-z0-9._-]+$ && "$1" != . && "$1" != .. ]]; }

plain "$APP_DIR" && plain "$DEPLOY_DIR" && plain "$url_dir" || die "APP_DIR, DEPLOY_DIR and MAILKIT_URL_DIR must be plain folder names."
IFS=/ read -r -a segments <<< "$DOCROOT"
for segment in "${segments[@]}"; do plain "$segment" || die "DOCROOT must be a folder path such as public_html."; done
for file in src/bootstrap.php bin/send-mail.php config.php public/contact.php public/mailkit-config.php; do
  [[ -f "$mail/$file" ]] || die "$mail/$file is missing: point the first argument at the mail kit folder."
done
[[ -d "$deploy/public_html" ]] || die "$deploy/public_html does not exist yet: run this after the site's own build."

# Folders between the cPanel home and ~/<DOCROOT>/<url_dir>/mailkit-config.php.
depth=$((${#segments[@]} + 1))

app="$deploy/app/mailkit"
rm -rf "$app"
mkdir -p "$app" "$deploy/root/$url_dir"
cp -R "$mail/src" "$mail/bin" "$mail/migrations" "$app/"
# The cron scripts run from ~/<DEPLOY_DIR>/current-app/mailkit/, which is not inside APP_DIR: tell them where .env is.
sed -e "s|'app_dir' => '[^']*'|'app_dir' => '$APP_DIR'|" "$mail/config.php" > "$app/config.php"
grep -q "'app_dir' => '$APP_DIR'" "$app/config.php" || die "could not set app_dir in config.php."

cp "$mail/public/contact.php" "$deploy/root/$url_dir/contact.php"
sed -e "s|^const MAILKIT_APP_DIR = '[^']*';|const MAILKIT_APP_DIR = '$APP_DIR';|" \
    -e "s|^const MAILKIT_DEPLOY_DIR = '[^']*';|const MAILKIT_DEPLOY_DIR = '$DEPLOY_DIR';|" \
    -e "s|^const MAILKIT_KIT_PATH = '[^']*';|const MAILKIT_KIT_PATH = 'mailkit';|" \
    -e "s|^const MAILKIT_WEBROOT_DEPTH = [0-9]*;|const MAILKIT_WEBROOT_DEPTH = $depth;|" \
    "$mail/public/mailkit-config.php" > "$deploy/root/$url_dir/mailkit-config.php"
for expected in "MAILKIT_APP_DIR = '$APP_DIR';" "MAILKIT_DEPLOY_DIR = '$DEPLOY_DIR';" "MAILKIT_KIT_PATH = 'mailkit';" "MAILKIT_WEBROOT_DEPTH = $depth;"; do
  grep -qF "const $expected" "$deploy/root/$url_dir/mailkit-config.php" || die "could not set $expected in mailkit-config.php."
done

for asset in contact-form.js contact-form.css; do
  if [[ ! -e "$deploy/public_html/$asset" ]]; then cp "$mail/public/$asset" "$deploy/public_html/$asset"; fi
done

if [[ -n "${MAILKIT_FORM_PAGE:-}" ]]; then
  # Top level only: the example page loads contact-form.js and .css by relative path.
  [[ "$MAILKIT_FORM_PAGE" =~ ^[A-Za-z0-9._-]+\.html$ ]] || die "MAILKIT_FORM_PAGE must be a top-level .html name such as contact.html."
  if [[ -e "$deploy/public_html/$MAILKIT_FORM_PAGE" ]]; then
    echo "add-mailkit: $MAILKIT_FORM_PAGE exists in the build; the example page was not copied."
  else
    sed -e "s|action=\"/contact.php\"|action=\"/$url_dir/contact.php\"|" "$mail/public/contact-form.html" > "$deploy/public_html/$MAILKIT_FORM_PAGE"
  fi
fi

if [[ -n "${TURNSTILE_SITE_KEY:-}" ]]; then
  [[ "$TURNSTILE_SITE_KEY" =~ ^[A-Za-z0-9_-]+$ ]] || die "TURNSTILE_SITE_KEY must be the public site key (letters, digits, - and _)."
  python3 -I - "$deploy/public_html" "$TURNSTILE_SITE_KEY" <<'PY'
import os, sys
root, key = sys.argv[1], sys.argv[2]
for dirpath, _, names in os.walk(root):
    for name in names:
        if name.endswith(".html"):
            path = os.path.join(dirpath, name)
            text = open(path, encoding="utf-8", errors="surrogateescape").read()
            if "__TURNSTILE_SITE_KEY__" in text:
                open(path, "w", encoding="utf-8", errors="surrogateescape").write(text.replace("__TURNSTILE_SITE_KEY__", key))
PY
fi

# In the release layout /contact.php is not served (PHP runs only where .htaccess allows it).
stale="$(grep -rlF 'action="/contact.php"' "$deploy/public_html" --include='*.html' 2> /dev/null || true)"
if [[ -n "$stale" ]]; then
  echo "::warning title=Form posts to /contact.php::These pages post to /contact.php, which answers 404 in the release layout; change their action to /$url_dir/contact.php: $(tr '\n' ' ' <<< "$stale")"
fi
htaccess="$deploy/root/.htaccess"
[[ -f "$htaccess" ]] || htaccess="${KIT_DIR:-deploy-kit}/public_html/.htaccess.template"
if [[ -f "$htaccess" ]] && ! grep -qE "^[[:space:]]*RewriteRule \^$url_dir/\(\?:[^)]*contact[^)]*\)" "$htaccess"; then
  echo "::warning title=Form endpoint not enabled::$htaccess does not allow /$url_dir/contact.php yet: uncomment the FORM ENDPOINTS (kit/mail) line in rule 6, or the form answers 404."
fi

echo "add-mailkit: kit in app/mailkit (app_dir $APP_DIR), endpoint root/$url_dir/contact.php (home $depth folders up, deploy dir $DEPLOY_DIR)."
