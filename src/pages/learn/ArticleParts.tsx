import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'
import Icon from '@/components/Icon'
import { serviceBySlug } from '@/lib/site'
import type { Article, ArticleBlock } from '@/content/articles'

// Rendering helpers for /learn. Prefix: learn-

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-11-27" → "27 November 2026" (deterministic, no locale APIs, so SSR and client match). */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export const slugify = (t: string) => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Minimal inline markup for article strings: [label](/path or https://…) and **bold**.
 * Internal paths become <Link>, external URLs open in a new tab.
 */
export function inline(text: string): ReactNode {
  const out: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      const [label, href] = [m[1], m[2]]
      out.push(href.startsWith('/')
        ? <Link key={k++} to={href}>{label}</Link>
        : <a key={k++} href={href} target="_blank" rel="noopener">{label}</a>)
    } else {
      out.push(<strong key={k++}>{m[3]}</strong>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length === 1 ? out[0] : out.map((n, i) => <Fragment key={i}>{n}</Fragment>)
}

export type ArticleSection = { id: string | null; title: string | null; blocks: ArticleBlock[] }

/** Groups the flat block list into sections that start at each H2 (the intro has no heading). */
export function sectionsOf(body: ArticleBlock[]): ArticleSection[] {
  const out: ArticleSection[] = [{ id: null, title: null, blocks: [] }]
  body.forEach((b) => {
    if (b.type === 'h2') out.push({ id: slugify(b.text), title: b.text, blocks: [] })
    else out[out.length - 1].blocks.push(b)
  })
  return out.filter((s) => s.title || s.blocks.length)
}

/** Guide card used on the hub and in "related guides". */
export function ArticleCard({ a, headingLevel = 3 }: { a: Article; headingLevel?: 2 | 3 }) {
  const svc = serviceBySlug(a.service)
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <Link to={`/learn/${a.slug}`} className="learn-card" data-reveal>
      <span className="learn-card__icon"><Icon name={svc?.icon ?? 'Search'} size={22} strokeWidth={1.8} /></span>
      <H className="learn-card__title">{a.title}</H>
      <p className="learn-card__desc">{a.description}</p>
      <span className="learn-card__meta">
        <span><Clock size={15} aria-hidden="true" />{a.minutes} min read</span>
        <span className="learn-card__go">Read the guide<ArrowRight size={17} aria-hidden="true" /></span>
      </span>
    </Link>
  )
}
