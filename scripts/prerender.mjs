#!/usr/bin/env node
// Production build: client bundle + SSR bundle, then every route is rendered to static HTML.
//
//   node scripts/prerender.mjs             build everything (what `npm run build` runs)
//   node scripts/prerender.mjs --no-build  re-prerender from an existing dist/ + dist-ssr/
//   node scripts/prerender.mjs --strict    exit 1 if any route fails to render
//
// Output: dist/index.html, dist/<route>/index.html, dist/404.html, dist/sitemap.xml.
// Routes: static <Route path> entries in src/App.tsx, plus /services/<slug> (SERVICES) and /learn/<slug> (ARTICLES).
// A route that throws during SSR gets the plain SPA shell (it still works in the browser) and is reported.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const SSR_OUT = path.join(ROOT, 'dist-ssr')
const LASTMOD_FILE = path.join(ROOT, 'scripts', 'sitemap-lastmod.json')
const args = new Set(process.argv.slice(2))
const c = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m` }

// ---------------------------------------------------------------------------
// 1. Build
// ---------------------------------------------------------------------------
if (!args.has('--no-build')) {
  const { build } = await import('vite')
  console.log(c.dim('› client build'))
  await build({ root: ROOT, mode: 'production' })
  console.log(c.dim('› ssr build'))
  await build({
    root: ROOT,
    mode: 'production',
    logLevel: 'warn',
    build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr', emptyOutDir: true, copyPublicDir: false, minify: false },
  })
}

const entry = path.join(SSR_OUT, 'entry-server.js')
if (!fs.existsSync(entry) || !fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(c.red('dist/ or dist-ssr/ missing: run without --no-build'))
  process.exit(1)
}

// The SSR bundle runs in plain Node (no DOM shims), so any module that touches window/document at import
// time fails here loudly instead of silently shipping an empty page. See DESIGN.md "SSR / prerender safety".
const ssr = await import(pathToFileURL(entry).href)
const { render, SERVICES, ARTICLES } = ssr
const SITE_URL = String(process.env.VITE_SITE_URL || ssr.SITE_URL).replace(/\/$/, '')

// ---------------------------------------------------------------------------
// 2. Routes
// ---------------------------------------------------------------------------
const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8')
const declared = [...appSrc.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g)].map((m) => ({ path: m[1], el: m[2] }))
const redirects = declared.filter((r) => r.el === 'Navigate').map((r) => {
  const to = appSrc.match(new RegExp(`path="${r.path}"\\s+element=\\{<Navigate\\s+to="([^"]+)"`))?.[1]
  return { from: r.path, to }
}).filter((r) => r.to)
const routes = []
for (const r of declared) {
  if (r.el === 'Navigate' || r.path === '*') continue
  if (!r.path.includes(':')) { routes.push(r.path); continue }
  if (r.path === '/services/:slug') SERVICES.forEach((s) => routes.push(`/services/${s.slug}`))
  else if (r.path === '/learn/:slug') ARTICLES.forEach((a) => routes.push(`/learn/${a.slug}`))
  else console.warn(c.yellow(`! dynamic route ${r.path} has no data source in scripts/prerender.mjs; not prerendered`))
}

// ---------------------------------------------------------------------------
// 3. Render
// ---------------------------------------------------------------------------
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const SEO_BLOCK = /<!-- seo:start[\s\S]*?<!-- seo:end -->/
if (!SEO_BLOCK.test(template) || !template.includes('<div id="root"></div>')) {
  console.error(c.red('index.html must keep the <!-- seo:start --> … <!-- seo:end --> block and an empty <div id="root"></div>'))
  process.exit(1)
}

// Preload the Latin subset of the brand font (it styles the LCP headline).
const assets = fs.readdirSync(path.join(DIST, 'assets'))
const font = assets.find((f) => /hanken-grotesk-latin-wght-normal.*\.woff2$/.test(f))
const shell = font
  ? template.replace('<meta name="theme-color"', `<link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin />\n    <meta name="theme-color"`)
  : template

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const absUrl = (route) => `${SITE_URL}${route === '/' ? '/' : route}`

function fill({ head, html, route }) {
  return shell
    .replace(SEO_BLOCK, () => head)
    .replace('<div id="root"></div>', () => `<div id="root" data-prerendered="${esc(route)}">${html}</div>`)
}

/** Fallback for a route that failed to render: generic tags, the right canonical, client-side rendering. */
function fallback(route) {
  const tags = `<link rel="canonical" href="${absUrl(route)}" />\n    <meta property="og:url" content="${absUrl(route)}" />`
  return shell.replace('<!-- seo:end -->', () => `${tags}\n    <!-- seo:end -->`)
}

function outFile(route) {
  return route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, ...route.slice(1).split('/'), 'index.html')
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

/** Render with React's SSR warnings captured per route instead of flooding the log. */
function renderRoute(url) {
  const warnings = []
  const orig = console.error
  console.error = (...a) => warnings.push(a.map(String).join(' ').split('\n')[0])
  try {
    return { ...render(url), warnings }
  } finally {
    console.error = orig
  }
}

const results = []
for (const route of routes) {
  try {
    const r = renderRoute(route)
    write(outFile(route), fill({ ...r, route }))
    results.push({ route, ok: true, ...r })
  } catch (err) {
    const where = (err?.stack || '').split('\n').slice(0, 4).join('\n      ')
    console.error(c.red(`✗ ${route} failed to render: ${err?.message}\n      ${where}`))
    write(outFile(route), fallback(route))
    results.push({ route, ok: false, error: err?.message })
  }
}

// 404: rendered from an unmatched URL so it shows the NotFound page inside the layout.
try {
  const r = renderRoute('/404')
  let head = r.head
  if (!/name="robots"/.test(head)) head += '\n    <meta name="robots" content="noindex, follow" />'
  // A 404 page has no canonical of its own.
  head = head.replace(/<link[^>]+rel="canonical"[^>]*>\s*/g, '')
  write(path.join(DIST, '404.html'), fill({ head, html: r.html, route: '/404' }))
  results.push({ route: '/404', ok: true, file: '404.html', ...r, noindex: true })
} catch (err) {
  console.error(c.red(`✗ 404 page failed to render: ${err?.message}`))
  write(path.join(DIST, '404.html'), shell.replace('<!-- seo:end -->', '<meta name="robots" content="noindex" />\n    <!-- seo:end -->'))
}

// Old URLs that the router redirects: a static fallback for hosts without .htaccess (Apache sends a 301 first).
for (const { from, to } of redirects) {
  write(outFile(from), `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex"><link rel="canonical" href="${absUrl(to)}"><meta http-equiv="refresh" content="0;url=${to}"></head><body><a href="${to}">This page has moved.</a></body></html>\n`)
}

// ---------------------------------------------------------------------------
// 4. Sitemap (lastmod only moves when a page's rendered content changes)
// ---------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10)
let lastmod = {}
try { lastmod = JSON.parse(fs.readFileSync(LASTMOD_FILE, 'utf8')) } catch { /* first build */ }
const inSitemap = results.filter((r) => r.ok && !r.noindex && r.route !== '/404')
for (const r of inSitemap) {
  const hash = crypto.createHash('sha1').update(r.head + r.html).digest('hex').slice(0, 12)
  if (lastmod[r.route]?.hash !== hash) lastmod[r.route] = { hash, lastmod: today }
}
for (const k of Object.keys(lastmod)) if (!inSitemap.some((r) => r.route === k)) delete lastmod[k]
fs.writeFileSync(LASTMOD_FILE, JSON.stringify(lastmod, null, 2) + '\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${inSitemap.map((r) => `  <url><loc>${absUrl(r.route)}</loc><lastmod>${lastmod[r.route].lastmod}</lastmod></url>`).join('\n')}
</urlset>
`
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap)
fs.rmSync(SSR_OUT, { recursive: true, force: true })

// Server-only files must never ship from a developer's machine: the live config.php and captured leads stay on
// the server (a deploy that uploaded these would overwrite the real secrets/leads).
for (const p of ['api/config.php', 'api/data']) fs.rmSync(path.join(DIST, p), { recursive: true, force: true })

// ---------------------------------------------------------------------------
// 5. Report
// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok)
const warned = new Map()
results.forEach((r) => (r.warnings || []).forEach((w) => { if (!/useLayoutEffect does nothing on the server/.test(w)) warned.set(w, r.route) }))
console.log(`\n${c.green('✓')} prerendered ${results.length - failed.length}/${results.length} pages, sitemap with ${inSitemap.length} URLs${font ? ', font preloaded' : ''}`)
for (const r of results) {
  const h1 = r.ok ? (r.html.match(/<h1[\s>]/g) || []).length : '-'
  const title = r.ok ? (r.head.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? c.red('NO TITLE')) : c.red(`FAILED: ${r.error}`)
  console.log(`  ${r.ok ? (h1 === 1 ? ' ' : c.yellow('!')) : c.red('✗')} ${r.route.padEnd(42)} h1:${h1}  ${title}`)
}
if (warned.size) {
  console.log(c.yellow('\nSSR warnings (first route that hit each):'))
  for (const [w, route] of warned) console.log(`  ${route}: ${w.slice(0, 200)}`)
}
if (failed.length) {
  console.log(c.red(`\n${failed.length} route(s) fell back to the client-rendered shell. Fix the error above; the page still works in the browser but crawlers see no content.`))
  if (args.has('--strict')) process.exit(1)
}
