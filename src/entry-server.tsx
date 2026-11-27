/* eslint-disable react-refresh/only-export-components -- server-only entry, never hot-reloaded */
// Server entry used only by scripts/prerender.mjs (never shipped to the browser).
// Renders one route to static HTML and returns the <head> tags Helmet collected for it.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async'
import App from './App'

export { SITE_URL, SERVICES } from './lib/site'
export { ARTICLES } from './content/articles'

export type RenderResult = { html: string; head: string; noindex: boolean }

export function render(url: string): RenderResult {
  const ctx: { helmet?: HelmetServerState | null } = {}
  const html = renderToString(
    <HelmetProvider context={ctx}>
      <StaticRouter location={url} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </StaticRouter>
    </HelmetProvider>,
  )
  const h = ctx.helmet
  if (!h) return { html, head: '', noindex: false }
  // With prioritizeSeoTags, title/description/canonical/og land in `priority`; the rest in meta/link/script.
  const head = [h.title, h.priority, h.meta, h.link, h.script]
    .map((d) => d.toString())
    .filter(Boolean)
    .join('\n    ')
  return { html, head, noindex: /<meta[^>]+name="robots"[^>]+noindex/i.test(head) }
}
