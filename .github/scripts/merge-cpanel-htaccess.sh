#!/usr/bin/env bash
# Keep the blocks cPanel writes into the document root's .htaccess when that file is replaced.
#
# cPanel's MultiPHP Manager stores the site's PHP version as a handler block in the .htaccess
# ("# php -- BEGIN cPanel-generated handler, do not edit"), and the MultiPHP INI Editor adds
# "# BEGIN cPanel-generated php ini directives" blocks. A new .htaccess without them silently drops the
# site to the server's default PHP version, which may be too old.
#
# The deploy receiver does this itself at every switch (receiver/src/HtaccessComposer.php). This script
# is the same merge for the workflow's dry run (a preview of the .htaccess a release would install) and
# for a hand-made upload.
#
# Usage: merge-cpanel-htaccess.sh <existing-server-htaccess> <new-htaccess>
# Appends every cPanel-generated block of the first file to the second, unless the second already has
# one with the same BEGIN line. A missing or empty first file is a no-op.
set -euo pipefail

existing="${1:?usage: merge-cpanel-htaccess.sh <existing> <new>}"
target="${2:?usage: merge-cpanel-htaccess.sh <existing> <new>}"

if [[ ! -s "$existing" ]]; then
  echo "No existing .htaccess on the server; nothing to preserve."
  exit 0
fi
if [[ ! -f "$target" ]]; then
  echo "::error::There is no new .htaccess to merge into ($target)."
  exit 1
fi

blocks="$(mktemp)"
trap 'rm -f "$blocks"' EXIT

# Each block from a "BEGIN cPanel-generated" line to its "END cPanel-generated" line, skipping blocks whose
# BEGIN line the target already has.
status=0
awk -v target="$target" '
  BEGIN { while ((getline line < target) > 0) have[line] = 1 }
  /BEGIN cPanel-generated/ { inblock = 1; skip = ($0 in have); count += skip ? 0 : 1 }
  inblock && !skip { print }
  /END cPanel-generated/ { inblock = 0; skip = 0 }
  END { if (count == 0) exit 3 }
' "$existing" > "$blocks" || status=$?

if [[ "$status" == 3 ]]; then
  echo "The server's .htaccess has no cPanel-generated blocks to preserve (or the new file has them already)."
  exit 0
elif [[ "$status" != 0 ]]; then
  exit "$status"
fi

{
  printf '\n# Preserved from the server by the deploy receiver (cPanel-managed; change these in cPanel, not here).\n'
  cat "$blocks"
} >> "$target"
echo "Preserved $(grep -c 'BEGIN cPanel-generated' "$blocks") cPanel-generated block(s) in .htaccess."
