#!/usr/bin/env node
// SEO check of the built site (run after `npm run build`):  node scripts/check-dist.mjs [--json]
// Per page: unique <title> and description, canonical, absolute og:url/og:image, exactly one <h1>, valid JSON-LD.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const files = []
;(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) { if (!['assets', 'api', 'media', 'brand', 'icons'].includes(f.name)) walk(p) }
    else if (f.name.endsWith('.html')) files.push(p)
  }
})(DIST)

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const attr = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : null }
const meta = (html, key) => attr(html, new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]+content="([^"]*)"`))

const rows = []
for (const file of files.sort()) {
  const html = fs.readFileSync(file, 'utf8')
  const rel = path.relative(DIST, file)
  if (/http-equiv="refresh"/.test(html)) continue // redirect stubs
  const route = rel === 'index.html' ? '/' : rel === '404.html' ? '/404' : `/${rel.replace(/\/index\.html$/, '')}`
  const head = html.slice(0, html.indexOf('</head>'))
  const body = html.slice(html.indexOf('<body'))
  const problems = []
  const titles = head.match(/<title[^>]*>/g) || []
  const title = attr(head, /<title[^>]*>([^<]*)<\/title>/)
  const desc = meta(head, 'description')
  const descs = (head.match(/<meta[^>]+name="description"/g) || []).length
  const canonical = attr(head, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/)
  const ogUrl = meta(head, 'og:url'), ogImage = meta(head, 'og:image'), ogTitle = meta(head, 'og:title')
  const robots = meta(head, 'robots') || ''
  const h1 = (body.match(/<h1[\s>]/g) || []).length
  const ld = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  const types = []
  for (const [, json] of ld) {
    try {
      const o = JSON.parse(json)
      for (const x of Array.isArray(o) ? o : [o]) {
        if (!x['@context']) problems.push('JSON-LD without @context')
        types.push([].concat(x['@type'] || '?').join('+'))
      }
    } catch (e) { problems.push(`invalid JSON-LD: ${e.message}`) }
  }
  if (titles.length !== 1) problems.push(`${titles.length} <title> tags`)
  if (descs !== 1) problems.push(`${descs} meta descriptions`)
  if (!title) problems.push('no title')
  else if (title.length > 65) problems.push(`title ${title.length} chars`)
  if (!desc) problems.push('no description')
  else if (desc.length < 70 || desc.length > 170) problems.push(`description ${desc.length} chars`)
  if (route !== '/404') {
    if (!canonical) problems.push('no canonical')
    else if (!canonical.startsWith('https://')) problems.push('canonical not absolute')
    else if (new URL(canonical).pathname !== route) problems.push(`canonical → ${new URL(canonical).pathname}`)
    if (!ogUrl?.startsWith('https://')) problems.push('og:url missing/relative')
    if (!ogTitle) problems.push('no og:title')
  }
  if (!ogImage?.startsWith('https://')) problems.push('og:image missing/relative')
  if (h1 !== 1) problems.push(`${h1} <h1>`)
  if (!/<div id="root" data-prerendered=/.test(html)) problems.push('not prerendered (client-only shell)')
  rows.push({ route, title, titleLen: title?.length ?? 0, desc, descLen: desc?.length ?? 0, canonical, h1, ld: types, noindex: /noindex/.test(robots), bytes: Buffer.byteLength(html), problems })
}

// Duplicates across pages
const dup = (key) => {
  const seen = new Map()
  rows.forEach((r) => { if (r[key]) seen.set(r[key], [...(seen.get(r[key]) || []), r.route]) })
  for (const [v, routes] of seen) if (routes.length > 1) routes.forEach((rt) => rows.find((r) => r.route === rt).problems.push(`duplicate ${key} (${routes.length} pages)`))
}
dup('title'); dup('desc')

if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(0) }
const pad = (s, n) => String(s).padEnd(n)
console.log(`${pad('route', 40)} ${pad('title', 5)} ${pad('desc', 5)} h1  ${pad('JSON-LD', 46)} problems`)
for (const r of rows) {
  console.log(`${pad(r.route, 40)} ${pad(r.titleLen, 5)} ${pad(r.descLen, 5)} ${pad(r.h1, 3)} ${pad(r.ld.join(', ') || '-', 46)} ${r.problems.join('; ') || 'ok'}${r.noindex ? ' (noindex)' : ''}`)
}
const bad = rows.filter((r) => r.problems.length)
console.log(`\n${rows.length} pages, ${bad.length} with problems`)
process.exit(bad.length ? 1 : 0)
