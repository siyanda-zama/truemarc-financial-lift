# Deploy kit: zip releases for cPanel hosting with FTP only

This kit deploys a git repository to cPanel shared hosting that has **FTP only** (no SSH): Apache or LiteSpeed with `.htaccess`, and PHP 8.1 or newer. domains.co.za is the reference host. It works for a static site, an SPA or SSG export, and a PHP app.

A file-by-file FTP sync of about 1,200 files took **18 m 33 s** (43 kB/s; the server is about 250 ms from GitHub's runners). This kit uploads **one zip** over FTPS instead (about 23 s for 26 MB). A small PHP receiver on the server then:

1. checks the zip's SHA-256;
2. unpacks it safely into `~/<DEPLOY_DIR>/releases/<id>/`;
3. runs the release's own `after-unpack.php` (migrations, checks);
4. switches the live site **atomically** (a symlink and one `rename()`; the switch itself takes about 2 ms).

A failed smoke test rolls back automatically. A manual rollback takes about a second.

This kit was extracted from the UbuntuSA storefront's production deploy, which has run this way on domains.co.za since 2026. The archive validation, the switch modes, the cPanel `.htaccess` handling and the dotenv parser are ported from it nearly verbatim. Everything framework-specific was removed.

## Contents

- [How it works](#how-it-works)
- [File map](#file-map)
- [Setup](#setup)
- [Build contract](#build-contract)
- [Secrets and variables](#secrets-and-variables)
- [The first release on a server that already hosts a live site](#the-first-release-on-a-server-that-already-hosts-a-live-site)
- [Rolling back](#rolling-back)
- [The receiver: actions and error codes](#the-receiver-actions-and-error-codes)
- [after-unpack.php](#after-unpackphp)
- [Variants](#variants)
- [Forms and email with kit/mail](#forms-and-email-with-kitmail)
- [Cron jobs and CLI tools](#cron-jobs-and-cli-tools)
- [Cloudflare](#cloudflare)
- [Troubleshooting](#troubleshooting)
- [Tests](#tests)
- [Known limits](#known-limits)

## How it works

```
GitHub Actions (ubuntu-latest)                                    cPanel home (~)
──────────────────────────────                                    ───────────────
BUILD  -> deploy/public_html, deploy/app, deploy/root
detect -> POST https://<site>/_deploy/hook.php {"action":"capabilities"}
          no receiver / older receiver: upload ONLY ~10 small files ──► ~/<DEPLOY_DIR>/receiver/
                                                                    ~/<DOCROOT>/_deploy/hook.php
pack   -> <id>.zip + <id>.json (sha256)
upload -> curl -T over FTPS (--ssl-reqd), retried, size-checked ──► ~/<DEPLOY_DIR>/incoming/
release-> {"action":"release", ...} ── receiver: verify, unpack,  ► ~/<DEPLOY_DIR>/releases/<id>/
                                       after-unpack.php, switch      ~/<DOCROOT>/_current -> that release
purge  -> Cloudflare (optional)
smoke  -> SMOKE_PATHS answer 200 and the receiver reports <id> as live
confirm, or roll back automatically and fail the run
```

Server layout once releases are in use:

```
~/<DOCROOT>/                       the document root stays a real folder (public_html by default)
├── .htaccess                      installed by each release; cPanel's blocks (PHP version, INI) are kept
├── _current -> ../<DEPLOY_DIR>/releases/<live>/public_html      (a real folder in rename mode)
├── _previous -> ../<DEPLOY_DIR>/releases/<before>/public_html   old hashed assets keep loading
├── _deploy/hook.php               the stub: the receiver's only public entry point
├── media/  .well-known/  cgi-bin/  .user.ini  php.ini  error_log  .ftpquota   persistent, untouched
├── <DEPLOY_KEEP names>            persistent, untouched
└── <root/ files of the release>   e.g. api/index.php (a PHP front controller), installed at each switch
~/<DEPLOY_DIR>/                    managed by the deploy; never edit inside releases/
├── receiver/                      hook.php, VERSION, src/*.php (namespace DeployKit\, no Composer)
├── incoming/                      uploads; removed after the release, stale ones after a day
├── releases/<id>/                 public_html/, root/, app/, release.json   (3 kept)
├── current.json                   {"release":"<live id>"}: a PHP front controller reads it per request
├── current-app -> releases/<live>/app      for cron jobs
├── state.json                     mode, release history, installed root files, the legacy record
├── backup/                        the last 5 live .htaccess files before a switch changed them
├── legacy/<time>/                 the site that was there before the first release (moved, never deleted)
└── orphans/                       anything a switch had to move aside (never deleted)
~/<APP_DIR>/                       persistent, created by you
├── .env                           DEPLOY_HOOK_TOKEN, DEPLOY_KEEP, DEPLOY_MAX_ARCHIVE_MB (+ your app's own keys)
└── storage/                       logs/deploy-hook.log, ratelimits/, deploy-hook.lock
```

**The switch modes.** The first release picks one and keeps it in `state.json`:

- **Symlink mode** (preferred). `_current` and `_previous` are symlinks. Switching writes a new symlink and renames it over the old one, so every request sees the old release or the new one, never a mix. It needs the web server to follow symlinks PHP creates. cPanel allows `SymLinksIfOwnerMatch`, and the owners match because PHP runs as your user. The first release does not assume this: the receiver puts a symlink under `/_deploy/` and the workflow fetches it over HTTPS, exactly like a visitor.
- **Rename mode** (the automatic fallback). `_current` and `_previous` are real folders, moved with `rename()`. A switch takes two renames microseconds apart. While `_current` is missing, `.htaccess` serves `_previous`, so there is always a complete site.

## File map

| In the skill (`kit/deploy/`) | In your repository | On the server |
|---|---|---|
| `receiver/hook.php`, `receiver/VERSION`, `receiver/src/*.php` | `deploy-kit/receiver/...` | `~/<DEPLOY_DIR>/receiver/...` (bootstrap uploads it) |
| `public_html/_deploy/hook.php` (stub) | `deploy-kit/public_html/_deploy/hook.php` | `~/<DOCROOT>/_deploy/hook.php`, with APP_DIR, DEPLOY_DIR and DOCROOT filled in at upload |
| `public_html/.htaccess.template` | `deploy-kit/public_html/.htaccess.template` (edit your toggles here) | shipped as the release's `root/.htaccess`, installed as `~/<DOCROOT>/.htaccess` |
| `public_html/api/index.php.template` | `deploy-kit/public_html/api/index.php.template` | optional: your build copies it to `deploy/root/api/index.php` |
| `.github/workflows/deploy.yml` | `.github/workflows/deploy.yml` | |
| `.github/scripts/*.sh` | `.github/scripts/*.sh` | |
| `../mail/` (the mail kit, optional) | `mailkit/` | split by `.github/scripts/add-mailkit.sh` into `root/api/` and `app/mailkit/` ([Forms and email](#forms-and-email-with-kitmail)) |
| `README.md`, `tests/` | `deploy-kit/README.md`, `deploy-kit/tests/` (optional) | |
| (your build output) `deploy/public_html/` | not committed (`/deploy/` in `.gitignore`, anchored) | `~/<DEPLOY_DIR>/releases/<id>/public_html`, served as `~/<DOCROOT>/_current` |
| `deploy/app/` | not committed | `~/<DEPLOY_DIR>/releases/<id>/app` (`current-app`) |
| `deploy/root/` | not committed | installed into `~/<DOCROOT>/` at every switch |

Installing the kit into a repository:

```sh
KIT=~/.claude/skills/domains-cpanel-deploy/kit/deploy
mkdir -p deploy-kit .github/workflows .github/scripts
cp -R "$KIT/receiver" "$KIT/public_html" "$KIT/README.md" "$KIT/tests" deploy-kit/
cp "$KIT/.github/workflows/deploy.yml" .github/workflows/deploy.yml
cp "$KIT"/.github/scripts/*.sh .github/scripts/
# Anchored on purpose: a bare 'deploy/' also matches e.g. src/Deploy/ on case-insensitive macOS.
grep -qx '/deploy/' .gitignore 2>/dev/null || echo '/deploy/' >> .gitignore
```

The kit lives in `deploy-kit/` (the `KIT_DIR` env at the top of the workflow). `deploy/` is the build output.

## Setup

Do these in order. Until the GitHub secrets exist, the workflow skips with a notice and stays green.

1. **Choose the folder names** in the cPanel home: `APP_DIR` (default `site_app`) and `DEPLOY_DIR` (default `site_deploy`). Use different names per site on a shared account.
2. **Generate the token** on your computer:
   ```sh
   umask 077; openssl rand -hex 32 > ~/deploy-token.txt
   ```
3. **Create `~/<APP_DIR>/.env` in cPanel File Manager.** Open Settings and tick *Show Hidden Files*. In the home folder (the one above `public_html`), create the folder `<APP_DIR>` and in it the file `.env`:
   ```ini
   DEPLOY_HOOK_TOKEN=<the 64 characters from step 2>
   # Optional: more top-level names in public_html that deploys must leave alone (space separated)
   # DEPLOY_KEEP="google1234abcd.html blog"
   # Optional: raise the 300 MB archive limit
   # DEPLOY_MAX_ARCHIVE_MB=500
   ```
   Then set its permissions to `0600` (right-click > Change Permissions). The parser handles quotes, an `export` prefix, CRLF line endings and inline `# comments`.
4. **Create an FTP account that starts in the home folder.** In cPanel > FTP Accounts > Add, set the **Directory to `/`**, not the pre-filled `public_html/...`. Note the full login (`deploy@example.co.za`).
5. **Find the FTP server name.** It is the server's own hostname, from cPanel > General Information (for example `cp79.domains.co.za`). The FTP certificate is `*.domains.co.za`, so `ftp.<your-domain>` fails TLS verification. FTP never goes through Cloudflare either.
6. **Set the GitHub secrets and variables.** They must be repository-level (see [Secrets and variables](#secrets-and-variables)):
   ```sh
   R=owner/repo
   gh variable set SITE_URL --repo $R --body https://example.co.za
   gh variable set BUILD_COMMAND --repo $R --body 'npm ci && npm run build && mkdir -p deploy && cp -R dist deploy/public_html'
   gh variable set APP_DIR --repo $R --body site_app          # only if not the default
   gh variable set DEPLOY_DIR --repo $R --body site_deploy    # only if not the default
   gh secret set FTP_SERVER --repo $R          # cp79.domains.co.za
   gh secret set FTP_USERNAME --repo $R        # deploy@example.co.za
   gh secret set FTP_PASSWORD --repo $R
   gh secret set DEPLOY_HOOK_TOKEN --repo $R < ~/deploy-token.txt && rm ~/deploy-token.txt
   ```
7. **Dry run:** Actions > Deploy > Run workflow on `main`, with *Dry run* ticked. It builds, packs and checks the FTP login. If a receiver is already installed, it also lists what the first release would move, and shows the end of the `.htaccess` a release would install, with the live cPanel blocks merged in. If no receiver is installed yet, it tells you one would be installed first. Nothing is uploaded or switched.
8. **First real run.** Push to `main`, or Run workflow. The first run installs the receiver (seconds). On an empty document root it releases straight away. On a live site it stops and shows the list ([next section](#the-first-release-on-a-server-that-already-hosts-a-live-site)).

## Build contract

The workflow's step **BUILD the site into deploy/** is the only project-specific step. By default it runs the repository variable `BUILD_COMMAND` with `bash -euo pipefail`. You can also replace its `run:` block. Add setup steps (Node, PHP, Composer) above it; commented examples with pinned versions are in the workflow. The build must leave:

| Path | Required | What |
|---|---|---|
| `deploy/public_html/` | yes | The files the site serves. `index.html` is the home page. `404.html`, if present, is served for missing pages with a real 404 status. |
| `deploy/app/` | no | Code that must not be web-reachable: a PHP app, its `vendor/`. `deploy/app/deploy/after-unpack.php` runs on the server before the switch. |
| `deploy/root/` | no | Files installed into the real `~/<DOCROOT>/` at every switch. `root/.htaccess` replaces the kit's template (cPanel blocks are still kept). `root/api/index.php` is a front controller, for example. |

`pack` refuses, with the reason, what the receiver would refuse (nothing reaches the server):

- symlinks;
- `.env` files (`.env.example` is fine);
- `.htaccess` anywhere except `deploy/root/.htaccess` and under `app/`. One inside the served tree would undo the routing on Apache's second pass;
- `public_html/{media,_current,_previous,_deploy,.well-known,cgi-bin}`. These are served from the real document root, so a copy in a release would never be seen;
- `root/` names the server manages: `media`, `cgi-bin`, `_deploy`, `.user.ini` and the like;
- `php_value` or `php_flag` in `root/.htaccess` outside cPanel's blocks or an `<IfModule php…|lsapi…>` guard. On PHP-FPM hosts those make every page a 500;
- version-control folders;
- non-UTF-8 names, more than 30,000 entries, or more than 1 GiB unpacked.

Without `deploy/root/.htaccess`, `pack` copies `deploy-kit/public_html/.htaccess.template` there.

## Secrets and variables

Everything is **repository-level** (Settings > Secrets and variables > Actions). On GitHub Free, private repositories get no environment secrets: `gh secret set --env` fails with 404 "failed to fetch public key".

| Name | Kind | Required | Meaning |
|---|---|---|---|
| `FTP_SERVER` | secret | yes | The server hostname (cPanel > General Information), for example `cp79.domains.co.za`. Not `ftp.<domain>`, and not proxied by Cloudflare. |
| `FTP_USERNAME` | secret | yes | The FTP login, for example `deploy@example.co.za`. Its Directory must be `/` (the home folder). |
| `FTP_PASSWORD` | secret | yes | That account's password. Curl reads it from a mode-600 config file, never from the command line. |
| `DEPLOY_HOOK_TOKEN` | secret | yes | The same 32+ characters as `DEPLOY_HOOK_TOKEN` in `~/<APP_DIR>/.env`. |
| `CLOUDFLARE_API_TOKEN` | secret | no | A custom token with Zone > Cache Purge > Purge for this zone. With the zone id, every deploy and rollback purges everything. |
| `CLOUDFLARE_ZONE_ID` | secret | no | Cloudflare > the site > Overview > API > Zone ID (32 hex characters). |
| `SITE_URL` | variable | yes | `https://example.co.za`. The hook is called at `<SITE_URL>/_deploy/hook.php`. |
| `BUILD_COMMAND` | variable | yes, unless you edit the BUILD step | The build, for example `npm ci && npm run build && mkdir -p deploy && cp -R dist deploy/public_html`. |
| `APP_DIR` | variable | no, default `site_app` | The folder in the home with `.env` and `storage/`. |
| `DEPLOY_DIR` | variable | no, default `site_deploy` | The folder in the home with the receiver, the releases and the state. |
| `DOCROOT` | variable | no, default `public_html` | The site's document root, relative to the home. An addon domain has its own folder (cPanel > Domains shows it), for example `example2.co.za` or `public_html/example2.co.za`. |
| `FTP_PORT` | variable | no, default `21` | Explicit FTPS (AUTH TLS). Plain FTP is never used. |
| `SMOKE_PATHS` | variable | no, default `/` | Space-separated paths that must answer 200 after a release, for example `/ /about /contact /assets/app.css`. |
| `DEPLOY_ON_PUSH` | variable | no | `false`: pushes to `main` deploy nothing, and you deploy with Run workflow. This is the free-plan stand-in for an approval gate. |
| `TURNSTILE_SITE_KEY` | variable | no | The PUBLIC Turnstile site key. The BUILD step passes it to `add-mailkit.sh`, which writes it into the release's HTML ([Forms and email](#forms-and-email-with-kitmail)). |
| `SWITCH_MODE` | variable | no | `rename` or `symlink`, to force a mode instead of the probed one (for example on a host where symlinks misbehave). |

Settings in `~/<APP_DIR>/.env` on the server (never in git):

| Key | Meaning |
|---|---|
| `DEPLOY_HOOK_TOKEN` | Empty or shorter than 32 characters turns the hook off: it answers 404. |
| `DEPLOY_KEEP` | Space- or comma-separated top-level names in the document root that deploys never move, for example another site's folder or a verification file. |
| `DEPLOY_MAX_ARCHIVE_MB` | The archive size limit, default 300. |

Workflow inputs (Run workflow): `dry_run`, `rollback`, `rollback_to` (a kept release id, or `legacy`) and `adopt_existing_site`. Only `main` deploys, even when the workflow is started from another branch. One deploy runs at a time (concurrency group `deploy-production`, never cancelled mid-upload). The workflow has `permissions: contents: read`.

## The first release on a server that already hosts a live site

The receiver never hides or deletes an existing site silently.

1. After the bootstrap, `capabilities` reports `layout: flat` and `adopt_candidates`: every top-level name in the document root that the first release would move. It always leaves in place `media`, `.well-known`, `cgi-bin`, `.user.ini`, `php.ini`, `error_log`, `.ftpquota`, `_deploy`, the `DEPLOY_KEEP` names and cPanel's `.htaccess` blocks. `adopt_suspicious` flags folders named like domains (`client.co.za/`), which are often another site's document root.
2. Without consent, the workflow prints the list (in the run summary) and stops with *Existing site found*. Nothing is uploaded or changed. The receiver enforces the same rule: a first release without `"adopt":"move"` gets 409 `adopt_required`.
3. **Check the list.** Look in cPanel > Domains for addon domains or subdomains whose document root is inside `public_html`. Add those, and any file that must keep working (a search-engine verification file), to `DEPLOY_KEEP` in `~/<APP_DIR>/.env`. If such a folder must stay reachable on this domain with its own PHP (a `/blog/`), also add it to *EXTRA PERSISTENT PATHS* (rule 5) in the `.htaccess` template.
4. Run the workflow by hand with **adopt_existing_site** ticked. The release:
   1. backs up the old `.htaccess`;
   2. creates `_current` next to the old site;
   3. renames the new `.htaccess` into place (that rename is the switch);
   4. **moves** the candidates into `~/<DEPLOY_DIR>/legacy/<time>/public_html/`.
5. **Rollback restores it exactly.** Rolling back from the first release, or rolling back further than any kept release, or `rollback_to: legacy`, does four things:
   1. moves every name back;
   2. restores the old `.htaccess` byte for byte, except that cPanel blocks changed since (a new PHP version) are kept;
   3. removes the release's root files and the switch;
   4. deletes the then-empty legacy folder.

The legacy folder is never deleted automatically while it holds files. Delete it in File Manager once you no longer need a way back. The database is never touched by any of this.

## Rolling back

- **Manual:** Actions > Deploy > Run workflow on `main`, with *Roll back* ticked. The receiver switches `_current`, `current.json` and the root files back to the release before the live one, in about a second. Nothing is built or uploaded, and no release code runs. To pick a kept release, fill in `rollback_to` with its id (each run's summary shows ids), or `legacy` for the site from before the first release. Rolling back twice goes two releases back. A release you rolled back from stays on the server, marked `rolled_back`, until it is pruned.
- **Automatic:** a release that fails the smoke test is rolled back at once, Cloudflare is purged again, the previous release is smoke-tested, and the run fails with an error saying so. The automatic rollback is answered by the receiver, not by the broken release, so it works however broken the release is.
- **Not rolled back:** anything `after-unpack.php` did, such as a database migration. Write migrations that the previous release can live with, for example by adding columns rather than renaming them.
- **Then fix forward:** revert the bad commit on `main`, or the next push deploys it again.

Up to three releases are kept, chosen in this order: the live one, the one before it, the newest confirmed one that was not rolled back, then the newest others.

## The receiver: actions and error codes

`POST <SITE_URL>/_deploy/hook.php` with the token in the `X-Deploy-Token` header and a JSON body. A custom header is used because some cPanel PHP setups drop `Authorization`. Both tokens are hashed and compared with `hash_equals`.

| Body | What it does |
|---|---|
| `{"action":"capabilities"}` | Read-only. `receiver_version`, `receiver_digest`, `php_version`, `extractor` (`zip`, or `phar` as the fallback), `layout` (`flat` or `release`), `mode`, `current`, `previous`, `confirmed`, `releases`, `rollback_target`, `incoming`, `max_archive_bytes`, `kept_in_place`, `legacy`, `document_root_ok`. In the flat layout it also returns `adopt_candidates`, `adopt_suspicious` and `replaces`. |
| `{"action":"probe"}` | First release only: puts a symlink under `/_deploy/probe-…/` for the workflow to fetch. The release removes it. |
| `{"action":"release","release":"<id>","sha256":"<hex>"}` | Optional fields: `"symlinks":true\|false` (the probe result), `"mode":"symlink\|rename"` and `"adopt":"move"`. The receiver checks the size (300 MB default) and the SHA-256, then validates every entry from the zip's central directory: no `..`, absolute paths, symlinks, encrypted entries, zip64 or duplicates. It unpacks into staging, runs `app/deploy/after-unpack.php` from the new release, installs the root files, switches, writes `current.json` atomically, points `current-app` at the new release, keeps 3 releases and cleans `incoming/`. It is idempotent: the live release again answers `already_current`. |
| `{"action":"confirm","release":"<id>"}` | The live release passed the smoke test; it becomes the known-good release that is never pruned. |
| `{"action":"rollback"}` | Back to the previous release. Optional `"release":"<id>"` or `"release":"legacy"`. |

Every answer includes `capabilities`. Error answers are `{"ok":false,"request_id":"…","error":{"code":"…"},"capabilities":{…}}`. The details (which zip entry, which exception) go **only** to `~/<APP_DIR>/storage/logs/deploy-hook.log`, under the request id. Every call is logged (time, request id, event, action, release, client IP, user agent, commit, run id), and the token never is. A lock file allows one run at a time. `CF-Connecting-IP` counts as the client IP only when the TCP peer is a Cloudflare edge.

| HTTP | Code | Meaning, and the fix |
|---|---|---|
| 404 | (none) | The hook is off (`DEPLOY_HOOK_TOKEN` empty or under 32 characters), the token is wrong or missing, the request is not a POST, or it was rate-limited (30 calls per 15 minutes per client IP). The log says `disabled`, `denied`, `not_post` or `rate_limited`. A deploy uses 4 to 8 calls. |
| 409 | `adopt_required` | The first release found a live site. See the previous section. |
| 409 | `deploy_hook_busy` | Another hook run holds the lock. The script retries; otherwise wait and re-run. |
| 409 | `document_root_mismatch` | The site's `DOCUMENT_ROOT` is not `~/<DOCROOT>` (an addon domain). Set the `DOCROOT` variable. Bootstrap uploads a stub with the new name. |
| 409 | `layout_unsupported` | `~/<DOCROOT>` does not exist. |
| 409 | `root_conflict` | A `deploy/root/` name would replace a persistent or `DEPLOY_KEEP` name, or would be written through a symlinked folder. |
| 409 | `release_conflict` | A different release with this id is live. Re-run (a re-run gets a new id). |
| 409 | `not_current` | Only the live release can be confirmed. |
| 409 | `no_previous_release` | Nothing earlier to roll back to. Deploy the older commit instead. |
| 409 | `rollback_target_missing` | That id is not kept, or it is the live one (`capabilities.releases` lists the kept ones). |
| 413 | `archive_too_large` | Over `DEPLOY_MAX_ARCHIVE_MB` (default 300). |
| 422 | `invalid_request` | Malformed body, unknown action or bad id. The receiver and the scripts are probably from different kit versions. |
| 422 | `archive_not_found` | The upload did not reach `~/<DEPLOY_DIR>/incoming/`. Check the Upload step and the FTP account's directory. |
| 422 | `checksum_mismatch` | Incomplete or altered upload. Re-run; the upload is retried and size-checked. |
| 422 | `unsafe_archive` / `archive_unreadable` | An entry was refused (the log names it). Nothing changed on the server. |
| 500 | `after_unpack_failed` | `after-unpack.php` threw or returned a non-array. The new release was deleted and the live site is untouched. The exception is in the log. |
| 500 | `switch_failed` / `write_failed` / `release_incomplete` | A rename or write failed (permissions, disk quota). The previous state was put back. Check the quota in cPanel, then re-run. |
| 500 | `extract_failed`, `probe_failed`, `unsafe_delete`, `internal_error` | See the log under the request id. |
| 500 | `php_too_old` | The site runs PHP older than 8.1. Choose 8.2 or newer in MultiPHP Manager. |
| 501 | `extractor_unavailable` | PHP has neither `zip` nor `phar`. Enable `zip` in Select PHP Version or MultiPHP. |

**Receiver updates.** `capabilities` reports `receiver_version` (from `receiver/VERSION`) and `receiver_digest` (a SHA-256 over the receiver's files). The workflow bootstraps, uploading only the receiver and the stub, when any of these holds:
- no receiver answers;
- the server's version is older than the kit's;
- the version is the same but the digest differs, for example after an interrupted upload.

It never downgrades a newer receiver. Bump `VERSION` whenever you change the receiver.

## after-unpack.php

`deploy/app/deploy/after-unpack.php` is the extension point for migrations and environment checks. The receiver runs it from the **new** release, before anything is switched, under the site's own PHP (the stub runs with the domain's PHP handler). Output is captured into the report, and the time limit is 300 s.

```php
<?php
// Either return an array (with $context in scope), or return a function that takes $context:
return function (array $context): array {
    // $context: release, previous (live id or null), first_release, release_dir, app_dir, public_dir,
    //           home, app_home (~/<APP_DIR>), docroot, deploy_dir, env (the parsed .env), log (callable)
    $pdo = new PDO('mysql:host=localhost;dbname=' . $context['env']['DB_DATABASE'], $context['env']['DB_USERNAME'], $context['env']['DB_PASSWORD']);
    // ... apply migrations that are not applied yet ...
    ($context['log'])('migrations applied');      // a line in deploy-hook.log
    return ['migrations' => ['applied' => 2]];     // shown in the workflow log
};
```

If it throws, the release is deleted again and the live site is untouched. The answer carries only `after_unpack_failed`; the exception message goes to the log, because it can contain connection details. The release call can outlast Cloudflare's 100-second proxy timeout. The receiver ignores the abort and finishes, and the script's retry then gets `already_current`. Keep migrations idempotent.

## Variants

**Static export (Hugo, Astro, Eleventy, Next.js `output: 'export'`, plain HTML).** Copy the output folder to `deploy/public_html`. Clean URLs work in both styles: `/about` serves `about.html` or `about/index.html`, and `/about.html`, `/about/` and `/index.html` redirect (301) to the clean form. `404.html` is served with a real 404. Search-engine verification files (`google…html`, `yandex_…html`, `BingSiteAuth.html`) keep their `.html`.

**SPA (Vite, React, Vue, Angular).** Uncomment the three *SPA FALLBACK* lines (rule 14) in `deploy-kit/public_html/.htaccess.template`. Every path without a file extension then gets `index.html`, and real 404s only happen for missing files.

**Caching.** Hashed assets get a year, `immutable`:
- the hashed folders of Next, Astro, SvelteKit, Expo and CRA;
- scripts, styles and fonts whose name carries a hash, such as `app.3f2a9c1b.js` or Vite's `index-B9x3kQ2a.css`.

For another hashed folder, add a line under *EXTRA IMMUTABLE FOLDERS*. HTML is `no-cache`, so a deploy shows at once; other files get an hour. The security headers are `nosniff`, `SAMEORIGIN`, `Referrer-Policy` and `Permissions-Policy`. HSTS and a CSP are commented options. Indexes are off and `X-Powered-By` is dropped.

**PHP app with `app/` outside the web root and a front controller.** Put the app (with `vendor/`) in `deploy/app/`. Copy `deploy-kit/public_html/api/index.php.template` to `deploy/root/api/index.php` and set its three names. Then uncomment the *APP FRONT CONTROLLER* lines in the template: the allow line in rule 6 and the routing lines in rule 8. The front controller reads `~/<DEPLOY_DIR>/current.json` on every request and requires `releases/<id>/app/<entry>` by its real path. That switches the app atomically and avoids PHP's realpath cache and opcache pinning an old release behind a symlink for minutes. It defines `DEPLOY_APP_HOME`, so the app reads `.env` and writes storage under `~/<APP_DIR>`; never write into a release. For a different URL prefix, change `api` in both places. For a whole-site front controller (the same mechanism, not covered by the tests), use `root/index.php`. Allow `^/index\.php$` in rule 6, and put `RewriteRule ^index\.php$ - [E=DK_APP:1,L]` and `RewriteRule ^ index.php [E=DK_APP:1,L]` where the SPA lines are, after rule 13.

**Laravel.** It works as the PHP-app variant, with more glue:
- `deploy/app/` holds the whole project (built with `composer install --no-dev`);
- `deploy/public_html/` holds the contents of `public/` except `index.php`;
- `deploy/root/index.php` (a whole-site front controller) requires `releases/<id>/app/public/index.php`.

`after-unpack.php` boots the new release's app, points it at the persistent `.env` and storage (`$app->useEnvironmentPath($context['app_home'])` and `$app->useStoragePath($context['app_home'] . '/storage')`, or symlinks), and runs `migrate --force`, `config:cache` and `route:cache` through the console kernel in-process. Shared hosts often disable `exec`. Run `schedule:run` and queues by cron from `current-app`. Test the first release on a staging subdomain.

**WordPress is not a fit for release switching.** It writes into its own code tree at runtime: plugin and theme installs, core auto-updates, `wp-content/uploads`, caches. A release switch would discard those writes or need almost everything persistent. Keep WordPress flat: deploy only your own theme or plugin folder, or use a WordPress-specific tool. If a live WordPress site is being *replaced* by a new site, the adopt flow moves its files aside and a rollback restores them. Its database is left alone.

## Forms and email with kit/mail

The mail kit (`kit/mail/` next to this kit) adds a contact and quote form endpoint and a mail queue that sends through one of the domain's own cPanel mailboxes. Its README covers the mailboxes, SMTP, SPF/DKIM/DMARC, Turnstile and the templates. With zip releases its pieces go to three places. Its web stub `mailkit-config.php` finds the cPanel home by counting folders up from its own location (`MAILKIT_WEBROOT_DEPTH`), and inside a release that location would be `~/<DEPLOY_DIR>/releases/<id>/public_html`, so the endpoints never ship in `public_html/`:

| Piece of kit/mail | In the build | On the server |
|---|---|---|
| `public/contact.php`, `public/mailkit-config.php` | `deploy/root/api/` | the real `~/<DOCROOT>/api/`, installed at every switch (depth 2, one more per extra `DOCROOT` folder) |
| `src/`, `bin/`, `migrations/`, `config.php` | `deploy/app/mailkit/` | `releases/<id>/app/mailkit`, reached as `~/<DEPLOY_DIR>/current-app/mailkit` |
| `public/contact-form.js`, `.css`, your form page | `deploy/public_html/` | served from `_current/` like the rest of the site |
| `.env`, `storage/mailkit/` (spool, logs, rate limits) | never in a release | `~/<APP_DIR>/` |

1. **Copy the mail kit into the repository:** `cp -R ~/.claude/skills/domains-cpanel-deploy/kit/mail mailkit`. Its `tests/` never ship.
2. **End the build with the helper**, for example:
   ```sh
   gh variable set BUILD_COMMAND --repo $R --body 'npm ci && npm run build && mkdir -p deploy && cp -R dist deploy/public_html && bash .github/scripts/add-mailkit.sh mailkit deploy'
   ```
   For a plain static site in `site/`: `mkdir -p deploy && cp -R site deploy/public_html && bash .github/scripts/add-mailkit.sh mailkit deploy`.

   `add-mailkit.sh` copies the pieces as in the table. It fills in `MAILKIT_APP_DIR`, `MAILKIT_DEPLOY_DIR`, `MAILKIT_KIT_PATH` and `MAILKIT_WEBROOT_DEPTH` in the stub and `app_dir` in `config.php`, from the workflow's `APP_DIR`, `DEPLOY_DIR` and `DOCROOT`. Optional settings:
   - `MAILKIT_FORM_PAGE=contact.html` installs the kit's example page, posting to `/api/contact.php`, unless the build already has that page;
   - the repository variable `TURNSTILE_SITE_KEY` (the public key; the BUILD step passes it on) replaces `__TURNSTILE_SITE_KEY__` in the release's HTML;
   - `MAILKIT_URL_DIR` replaces `api`.

   It warns when a page still posts to `/contact.php` (a 404 in the release layout) or when the `.htaccess` does not allow the endpoint.
3. **Allow the endpoint:** in `deploy-kit/public_html/.htaccess.template`, uncomment the *FORM ENDPOINTS (kit/mail)* line in rule 6:
   ```apache
   RewriteRule ^api/(?:contact)\.php$ - [E=DK_APP:1,L]
   ```
   Only the listed endpoints run. They are served from the real `~/<DOCROOT>/api/`, never from `_current/`, and with their own `no-store` and security headers. The line comes before the front-controller rules (rule 8), so both can be on. List more endpoints as `(?:contact|newsletter)`, but never `mailkit-config.php`: it must answer 404. With the line commented (the default), `/api/contact.php` is blocked like any other PHP file.
4. **Point the form at the endpoint:** `action="/api/contact.php"`, with `/contact-form.js` and `/contact-form.css` loaded.
5. **Add the mail kit's keys to `~/<APP_DIR>/.env`**, next to `DEPLOY_HOOK_TOKEN`: `APP_URL`, `MAIL_ENABLED`, `MAIL_QUEUE`, `SMTP_*`, `MAIL_*` and `TURNSTILE_*` (its `env.example` lists them all). Both kits read the same file with the same parsing rules.
6. **Add the cron job** (cPanel > Cron Jobs, every 2 to 5 minutes), with your folder names:
   ```
   cd $HOME && P=$(ls /opt/cpanel/ea-php83/root/usr/bin/php /opt/alt/php83/usr/bin/php 2>/dev/null | head -1) && for f in <DEPLOY_DIR>/current-app/mailkit/bin/send-mail.php <APP_DIR>/mailkit/bin/send-mail.php; do [ -f "$f" ] && { "$P" "$f"; break; }; done >/dev/null 2>&1
   ```
   It runs `~/<DEPLOY_DIR>/current-app/mailkit/bin/send-mail.php`, the live release's copy. `config.php`'s `app_dir` points it at `~/<APP_DIR>/.env` and at the spool in `~/<APP_DIR>/storage/mailkit/`. The second path covers a flat install. Then run `<DEPLOY_DIR>/current-app/mailkit/bin/check-mail.php --to=you@example.com` the same way, as a one-off cron job without `>/dev/null 2>&1`, until it prints `READY`.

Releases and rollbacks switch the mail code. The spool, logs and rate limits in `~/<APP_DIR>/storage/mailkit/` are not touched, so queued mail survives every switch.

## Cron jobs and CLI tools

Run them from the live release through the symlink, for example:

```sh
/usr/local/bin/php /home/<cpanel-user>/<DEPLOY_DIR>/current-app/bin/cron.php
```

If cron's `php` is the wrong version, use the versioned binary: `/opt/cpanel/ea-php83/root/usr/bin/php` (MultiPHP) or `/opt/alt/php83/usr/bin/php` (CloudLinux). Where PHP may not create symlinks (rename mode with `symlink()` disabled), `current-app` is not maintained. Read the live id from `~/<DEPLOY_DIR>/current.json` instead. Tools must read `.env` and write storage under `~/<APP_DIR>`, never inside a release.

## Cloudflare

- **Bot Fight Mode blocks the deploy.** The hook calls and the smoke test come from GitHub's runners. Bot Fight Mode (Security > Bots) answers them with a challenge page, and on the free plan no rule can skip it. Turn it off, or on a paid plan add a WAF custom rule that skips bot checks for *URI Path starts with `/_deploy/`* and for the smoke paths. The scripts detect challenge pages (`cf-mitigated: challenge`, "Just a moment…") and print this hint.
- **FTP never goes through Cloudflare.** Use the server hostname as `FTP_SERVER`.
- **Flexible SSL does not loop.** The HTTPS redirect honours `X-Forwarded-Proto` and `CF-Visitor`. Prefer Full (strict) once AutoSSL has issued the origin certificate.
- With both Cloudflare secrets set, every deploy and rollback purges the whole zone cache before the smoke test. A failed purge never skips the smoke test.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| *Deploy skipped … Missing: …* | Set the listed secrets and variables, then re-run. |
| *Could not log in over FTPS* | Wrong `FTP_SERVER`, user, password or port, or `ftp.<domain>` instead of the server hostname (certificate mismatch). Test the same values in FileZilla with *Require explicit FTP over TLS*. |
| *The FTP account's top folder has no public_html/* | The FTP account's Directory is not `/`. Edit it in cPanel > FTP Accounts. |
| *The receiver does not answer* (after bootstrap) | Work through the printed checklist: the `.env` token, `DOCROOT`, the old site's `.htaccess` swallowing `/_deploy/hook.php` (a catch-all rewrite or PHP block; allow it), or the rate limit. If `deploy-hook.log` has no line at all, the request never reached the receiver. |
| *Existing site found* | Expected on a live site. See [the first release](#the-first-release-on-a-server-that-already-hosts-a-live-site). |
| *These look like other sites* | Add those folders to `DEPLOY_KEEP` unless you are sure they are part of this site. |
| Every page is a 500 after a deploy | A directive the host does not allow, usually `php_value` or `php_flag` added by hand. Check cPanel > Metrics > Errors. Roll back, then fix the template. |
| The site shows the wrong PHP version | Apply the version again in MultiPHP Manager. Deploys keep its block from then on. |
| A file you uploaded by hand into `public_html` is not served | Names the release also has are served from the release. Others are served from the real folder, but PHP there is blocked unless the path is allowed in rule 5 or 6 of the template. |
| Smoke test: *Cloudflare challenged* | See [Cloudflare](#cloudflare). |
| *Rolled back* | The new release failed the smoke test; the previous one is live again. Read the smoke-test lines, fix, and deploy again. |

## Tests

`bash tests/run.sh <work-dir>` builds a fake cPanel home that already hosts a live site. It runs real Apache 2.4 (mod_rewrite, mod_headers, `SymLinksIfOwnerMatch`, HTTPS with a throwaway certificate) in front of php-fpm, and drives the workflow's own scripts. The run:

- bootstraps onto the live site: adopt is required, then adopt with move;
- runs releases in symlink and rename mode, a PHP front controller, and mode changes;
- checks routing: clean URLs, redirects, 404 status, blocked files, `media/`, `_current` and `_previous`, HTTPS and the proxy headers;
- rolls back, including to legacy, with an exact tree comparison;
- refuses unsafe archives, a bad SHA-256 and a failing after-unpack;
- checks tokens, the rate limit and the lock;
- checks a document-root mismatch, receiver version and digest decisions, the automatic-rollback path, cPanel blocks across a PHP version change, and pack refusals;
- releases a build with kit/mail added by `add-mailkit.sh` and the FORM ENDPOINTS toggle on. A valid POST queues its emails in `~/<APP_DIR>/storage/`; the honeypot, invalid input and a foreign Origin are refused; the stub and the library files answer 404; the README cron line finds `current-app/mailkit`; and the form keeps working through a second release, a rollback, and with the toggle off (404). It runs when `kit/mail` sits next to this kit, or set `MAIL_KIT=<dir>`.

It also runs `php -l` on every PHP file, `bash -n` on every script, a YAML parse of the workflow (or `actionlint` when installed) and `tests/unit.php`. On macOS it uses `/usr/sbin/httpd` and Homebrew PHP: `PHP_BIN=/opt/homebrew/bin/php PHP_FPM_BIN=/opt/homebrew/sbin/php-fpm bash tests/run.sh /tmp/kit-test`. It stops the servers it starts.

Uploads in the test use the production curl commands against a `file://` tree, because there is no FTPS server locally.

## Known limits

- **Not tested here:**
  - a real FTPS server: the upload flags (`--ssl-reqd`, `--ftp-create-dirs`, `-K` config, the SIZE check) are the ones UbuntuSA runs in production;
  - LiteSpeed: the rules avoid Apache-only features;
  - GitHub-hosted execution of the workflow itself.
- **The database is not rolled back.** Only the files switch.
- **Rate limit:** 30 calls per 15 minutes per IP. A deploy uses 4 to 8 calls, so even a deploy, a retry and a rollback fit. If it is ever hit, the hook answers 404 and the log says `rate_limited`: wait 15 minutes.
- **Archive limits:** 300 MB (configurable), 30,000 entries, 1 GiB unpacked, no zip64. `rename()` needs the home, document root and deploy folder on one filesystem, which is normal on cPanel.
- **Addon domain inside `public_html`.** If the main site uses this kit, its `.htaccess` is also read for that folder. The addon's own `.htaccess` with `RewriteEngine On` replaces the rewrite rules, but headers and `FilesMatch` blocks still apply.
- **cPanel's own Redirects and Hotlink Protection.** Those features write unmarked rules into `.htaccess`, which a deploy replaces. Put such rules into the template instead. Only the `cPanel-generated` blocks are kept.
- **Opcache.** On hosts with `opcache.validate_timestamps=0`, a freshly bootstrapped receiver can keep running old code until PHP restarts. The digest check still reads the new files.
- **kit/mail through `current-app`.** The mail kit's stub loads its code through the `current-app` symlink. PHP's realpath cache can keep a worker on the previous release's copy for up to two minutes after a switch. That release is still kept, so the form keeps working; only a change to the mail code itself takes that long to reach every worker. `current-app` needs PHP's `symlink()`: on a host without it, install the mail kit flat (its README, Install), and the stub and the cron line fall back to `~/<APP_DIR>/mailkit/`.
- **Hashed-name heuristic.** It can mark a hand-named script like `app-Build2024.js` immutable. Rename such a file when it changes, or remove the filename rules.
