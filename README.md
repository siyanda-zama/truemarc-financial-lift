# truemarc.co.za

Website for Truemarc Consultants (credit repair, debt review and blacklisting help; Bethal, Mpumalanga).
Vite + React + TypeScript. Every page is prerendered to static HTML at build time, so search engines and
WhatsApp/Facebook link previews see the real content and tags. Leads go to a small PHP endpoint on the same host.

Design system, copy rules and file ownership: [DESIGN.md](DESIGN.md).

## Run locally

```bash
npm install          # Node 20+
npm run dev          # http://localhost:8080 (form posts go to a stub that writes .leads/leads.jsonl)
```

`VITE_LEAD_FAIL=1 npm run dev` rehearses a failed lead submission (the form then offers WhatsApp/call instead).

## Build

```bash
npm run build        # client bundle + SSR bundle → prerender every route → dist/
npm run check        # SEO check of dist/: titles, descriptions, canonicals, og tags, one <h1>, valid JSON-LD
npm run preview      # http://localhost:4173, serves dist/ with clean URLs and real 404s, like the live server
npm run typecheck
```

`npm run build` (scripts/prerender.mjs) writes `dist/index.html`, `dist/<route>/index.html` for every route in
`src/App.tsx` (plus one per service in `SERVICES` and one per guide in `ARTICLES`), `dist/404.html` and
`dist/sitemap.xml`. A page that crashes during prerender falls back to the client-rendered shell and is reported in the
build log (`node scripts/prerender.mjs --strict` makes that an error). New dynamic routes need a data source added in
the script.

Sitemap `<lastmod>` only changes when a page's rendered content changes; the hashes live in
`scripts/sitemap-lastmod.json`. Commit that file after a build.

Code rules for prerendering: no `window`/`document` at module top level or during render, no random values or
`Date.now()` in rendered output (see DESIGN.md).

### Environment variables (build time, all optional)

Put them in `.env.production.local` (gitignored) or the CI environment.

| Variable | Effect |
|---|---|
| `VITE_GTM_ID` | `GTM-XXXXXXX`: adds Google Tag Manager. `track()` events land in `dataLayer`: `generate_lead`, `cta_click`, `click_call`, `click_whatsapp`, plus `virtual_pageview` on in-site navigation |
| `VITE_META_PIXEL_ID` | Adds the Meta Pixel; a submitted lead fires `Lead` |
| `VITE_SITE_URL` | Overrides `https://truemarc.co.za` in index.html and the sitemap (for a staging domain) |
| `VITE_LEAD_ENDPOINT` | Lead endpoint URL (default `/api/lead.php`) |

Analytics scripts load after the page has finished loading, so they never slow down the first view. If you enable
them, mention Google Analytics/Meta cookies in the privacy notice.

## Deploy (GitHub Actions → zip release on cp65.domains.co.za)

Deploys use the zip-release kit in `deploy-kit/` (details: `deploy-kit/README.md`). One run takes about a minute:
build → one zip over FTPS → the receiver on the server verifies, unpacks and switches `public_html/_current` to the new
release → smoke test → confirm, or automatic rollback.

- **Build:** `npm run build:deploy` (prerender + SEO check + `scripts/build-deploy.sh`) writes `deploy/public_html/`
  (the site) and `deploy/root/api/` (the lead endpoint + inbox, installed into the real `~/public_html/api/`).
- **Run a deploy:** GitHub → Actions → Deploy → Run workflow (tick *Dry run* to test without changing anything).
  Pushes to `main` deploy automatically once the repository variable `DEPLOY_ON_PUSH` is `true`.
- **Roll back:** the same screen → tick *Roll back* (about a second; code only).
- **Never upload files into `public_html` by hand.** The site is served from `_current/`; use git.
- **Server folders** (cPanel home): `truemarc_app/` holds `.env` (settings, keys from `.env.example`) and
  `storage/leads/` (the leads database, rate limits, error log); `truemarc_deploy/` holds the receiver and the
  releases. Neither is in git. Include both in cPanel backups.
- **Routing** (`deploy-kit/public_html/.htaccess.template`): HTTPS, www → apex, clean URLs, real 404s, the old
  `/why-choose-us` → `/about`, caching, security headers. Only `api/lead.php` and `api/leads.php` may run PHP.

GitHub settings (repository level): secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `DEPLOY_HOOK_TOKEN`;
variables `SITE_URL`, `APP_DIR=truemarc_app`, `DEPLOY_DIR=truemarc_deploy`, `BUILD_COMMAND`, `SMOKE_PATHS`,
`DEPLOY_ON_PUSH`. The `.githooks/pre-commit` guard (`git config core.hooksPath .githooks`) refuses a committed
`.env` or a secret value in `.env.example`.

Checks after a deploy:

```bash
curl -sI https://truemarc.co.za/about | head -1               # 200
curl -sI https://www.truemarc.co.za/ | grep -i location        # → https://truemarc.co.za/
curl -sI https://truemarc.co.za/why-choose-us | grep -i location
curl -sI https://truemarc.co.za/nope | head -1                # 404
curl -sI https://truemarc.co.za/.env | head -1                # 404
curl -sI https://truemarc.co.za/api/_lib.php | head -1        # 404
```

## Lead endpoint (`/api/lead.php`)

`POST` JSON with `firstName`, `phone` (any SA format), `consent: true`, and optionally `email`, `message`,
`situation`, `goal`, `debt`, `source`, `page`, `attribution`. Answers `{ "ok": true, "id": "TM-…" }` or
`{ "ok": false, "error": "…" }` with a matching HTTP status. Leads are stored in SQLite
(`~/truemarc_app/storage/leads/leads.sqlite`; append-only `leads.jsonl` if the host has no pdo_sqlite) **before** the
notification email is sent, so a mail problem never loses a lead. Honeypot field, per-IP rate limit, same-origin
check; visitor IPs are stored only as a salted hash. Settings come from `~/truemarc_app/.env` (keys in `.env.example`):
SMTP host `cp65.domains.co.za`, port 465, `ssl`, the full mailbox address as username.

Leads inbox: **https://truemarc.co.za/api/leads.php** (password hash in `LEADS_ADMIN_PASSWORD_HASH`). Search, tap to
call/WhatsApp, and **Download CSV**. Problems are logged to `~/truemarc_app/storage/leads/error.log`.

## Icons and link previews

Sources live in `scripts/icons/` (`favicon.svg`, `icon.html`, `share.html`). `npm run icons` (needs Google Chrome and
Python with Pillow) renders `public/favicon.ico`, `public/icons/*` and `public/img/share-2026-11.jpg`, plus
`scripts/icons/contact-sheet.png` to eyeball the 16px favicon. When you change the share image, give it a new name
(`SHARE_NAME=share-2027-03.jpg npm run icons`) and update `SHARE_IMAGE` in `src/components/Seo.tsx` and the og:image
tags in `index.html`: WhatsApp and Facebook cache previews per image URL. When you change the icons, bump the
`?v=` date on the icon links in `index.html` and `public/site.webmanifest`.
