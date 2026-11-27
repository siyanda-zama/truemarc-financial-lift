import '@/styles/pages/company.css'
import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { usePageMotion } from '@/lib/motion'
import { useActiveSection } from './useActiveSection'

export type LegalSection = { id: string; title: string; body: ReactNode }

/**
 * Readable legal page: light header, narrow text column, sticky contents on desktop,
 * collapsible contents on mobile. Used by /privacy and /terms.
 */
export default function LegalDoc({ title, updated, intro, sections, crumb }: {
  title: string
  /** Human date, e.g. "27 November 2026" */
  updated: string
  intro: ReactNode
  sections: LegalSection[]
  crumb: { to: string; label: string }
}) {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root)
  const active = useActiveSection(sections.map((s) => s.id))

  const links = (
    <ol>
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} className={active === s.id ? 'is-active' : undefined}>{s.title}</a>
        </li>
      ))}
    </ol>
  )

  return (
    <div ref={root} className="co-legal">
      <header className="co-legal__head">
        <div className="wrap">
          <nav className="co-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li><span aria-current="page">{crumb.label}</span></li>
            </ol>
          </nav>
          <h1 className="co-legal__title">{title}</h1>
          <p className="co-legal__updated">Last updated {updated}</p>
          <div className="co-legal__intro">{intro}</div>
        </div>
      </header>

      <div className="wrap co-legal__grid">
        <aside className="co-legal__aside">
          <nav className="co-toc co-toc--desktop" aria-label="Contents">{links}</nav>
          <details className="co-toc co-toc--mobile">
            <summary>Contents<ChevronDown size={18} aria-hidden="true" /></summary>
            <nav aria-label="Contents">{links}</nav>
          </details>
        </aside>
        <article className="co-legal__body">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="co-legal__sec" aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`}>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}
