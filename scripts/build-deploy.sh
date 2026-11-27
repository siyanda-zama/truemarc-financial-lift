#!/usr/bin/env bash
# Turn the prerendered site (dist/) into the deploy kit's release contract (deploy/).
# Run by `npm run build:deploy` (the workflow's BUILD_COMMAND); see deploy-kit/README.md, "Build contract".
#
#   deploy/public_html/   what the site serves (from dist/). Served as ~/public_html/_current/ on the server.
#   deploy/root/api/      the PHP lead endpoint + leads inbox. Every release installs them into the REAL
#                         ~/public_html/api/ (the .htaccess lets only lead.php and leads.php run).
#
# Never shipped: .htaccess files inside the served tree (the kit installs its own), .env files, the dev
# lead stub's .leads/, node_modules. Lead data and settings live in ~/<APP_DIR>/ on the server only.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_DIR="${APP_DIR:-truemarc_app}"
[[ "$APP_DIR" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "build-deploy: bad APP_DIR '$APP_DIR'" >&2; exit 1; }
[[ -f dist/index.html && -f dist/404.html ]] || { echo "build-deploy: dist/ is missing or not prerendered. Run npm run build first." >&2; exit 1; }

rm -rf deploy
mkdir -p deploy/public_html deploy/root/api

rsync -a \
  --exclude '.htaccess' --exclude '.gitignore' --exclude '.DS_Store' \
  --exclude '/api/' --exclude '*.php' --exclude '.env*' \
  dist/ deploy/public_html/

cp server/api/lead.php server/api/leads.php server/api/_lib.php deploy/root/api/
sed -i.bak "s/__APP_DIR__/${APP_DIR}/g" deploy/root/api/_lib.php && rm -f deploy/root/api/_lib.php.bak

# Guard rails: fail the build rather than ship something the receiver would refuse or the site would leak.
bad=$(find deploy/public_html \( -name '.htaccess' -o -name '.env*' -o -name '*.php' -o -type l \) -print)
[[ -z "$bad" ]] || { echo "build-deploy: refusing to ship:" >&2; echo "$bad" >&2; exit 1; }
grep -q "__APP_DIR__" deploy/root/api/_lib.php && { echo "build-deploy: APP_DIR placeholder not replaced" >&2; exit 1; }
for p in index.html 404.html sitemap.xml robots.txt services/index.html free-assessment/index.html; do
  [[ -f "deploy/public_html/$p" ]] || { echo "build-deploy: missing deploy/public_html/$p" >&2; exit 1; }
done

pages=$(find deploy/public_html -name '*.html' | wc -l | tr -d ' ')
files=$(find deploy -type f | wc -l | tr -d ' ')
size=$(du -sh deploy | cut -f1)
echo "build-deploy: ${pages} pages, ${files} files, ${size} in deploy/ (APP_DIR=${APP_DIR})"
