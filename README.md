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
npm run preview      # http://localhost:4173, serves dist/ the way .htaccess does on the live server
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

## Deploy (cPanel / Apache or LiteSpeed shared hosting)

1. `npm run build`.
2. Upload the **contents** of `dist/` (including the hidden `.htaccess` files) to `public_html/`.
   **Never delete `public_html/api/config.php` or `public_html/api/data/`**: they exist only on the server and hold
   the settings and the captured leads. (The build never contains them.)
3. First deploy only: set up the lead endpoint (below), then check the site:

```bash
curl -sI https://truemarc.co.za/about | head -1          # 200
curl -sI https://truemarc.co.za/about/ | grep -i location # → /about
curl -sI https://truemarc.co.za/why-choose-us | grep -i location
curl -sI https://truemarc.co.za/nope | head -1           # 404
curl -s  https://truemarc.co.za/ | grep -oE 'property="og:(image|url)" content="[^"]*"'
curl -sI https://truemarc.co.za/api/config.php | head -1 # 403
```

`public/.htaccess` handles HTTPS, clean URLs (`/about` → `about/index.html`, trailing slash → 301), real 404s,
the old `/why-choose-us` URL, caching (hashed `/assets/*` for a year, HTML always revalidated), compression and
security headers. Once DNS and SSL are confirmed, uncomment the **www → apex** redirect and, later, **HSTS** in that file.

An automated deploy (e.g. GitHub Actions → FTPS) only needs to upload `dist/`; it must not delete
`api/config.php` or `api/data/` on the server.

## Lead endpoint (`/api/lead.php`)

`POST` JSON with `firstName`, `phone` (any SA format), `consent: true`, and optionally `email`, `message`,
`situation`, `goal`, `debt`, `source`, `page`, `attribution`. Answers `{ "ok": true, "id": "TM-…" }` or
`{ "ok": false, "error": "…" }` with a matching HTTP status. Leads are stored in SQLite (`api/data/leads.sqlite`;
append-only `leads.jsonl` if the host has no pdo_sqlite) **before** the notification email is sent, so a mail problem
never loses a lead. Honeypot field, per-IP rate limit, same-origin check; visitor IPs are stored only as a salted hash.

Setup on the server (cPanel File Manager is fine):

1. Create the mailbox `website@truemarc.co.za` (cPanel → Email Accounts). Notifications go to `admin@truemarc.co.za`.
2. Copy `api/config.example.php` to `api/config.php` and fill in the SMTP password, an admin password hash and a
   secret (the file explains each one). Recommended: point `data_dir` outside `public_html`.
3. Make sure `truemarc.co.za` has **SPF, DKIM and DMARC** records (cPanel → Email Deliverability → "Repair"), or the
   notifications will land in spam.
4. Send a test lead from the live site's free assessment and confirm the email arrives.

Leads inbox: **https://truemarc.co.za/api/leads.php** (password from step 2). Search, tap to call/WhatsApp, and
**Download CSV** for Excel/Google Sheets. Problems are logged to `api/data/error.log` (never shown to visitors).

## Icons and link previews

Sources live in `scripts/icons/` (`favicon.svg`, `icon.html`, `share.html`). `npm run icons` (needs Google Chrome and
Python with Pillow) renders `public/favicon.ico`, `public/icons/*` and `public/media/share-2026-11.jpg`, plus
`scripts/icons/contact-sheet.png` to eyeball the 16px favicon. When you change the share image, give it a new name
(`SHARE_NAME=share-2027-03.jpg npm run icons`) and update `SHARE_IMAGE` in `src/components/Seo.tsx` and the og:image
tags in `index.html`: WhatsApp and Facebook cache previews per image URL. When you change the icons, bump the
`?v=` date on the icon links in `index.html` and `public/site.webmanifest`.
