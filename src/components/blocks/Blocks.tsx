import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CalendarCheck, MapPin, Phone, Plus, Users } from 'lucide-react'
import SplitText from '@/components/bits/SplitText'
import Assessment from '@/components/assessment/Assessment'
import { Ring } from '@/components/brand/Brand'
import { WhatsAppIcon } from '@/components/Icon'
import { BUSINESS, PRIMARY_PHONE, type SituationId, waLink } from '@/lib/site'
import { track } from '@/lib/leads'

// ---------------------------------------------------------------------------
// PageHero: dark hero shared by inner pages. Two short lines; the second in the accent.
// `visual` is the page's own bespoke piece (right column). Without it, the hero is one column.
// ---------------------------------------------------------------------------
export function PageHero({ id = 'hero-title', lines, lede, actions, fine, visual, crumbs, className = '', children }: {
  id?: string
  lines: { text: string; accent?: boolean }[]
  lede?: ReactNode
  actions?: ReactNode
  fine?: ReactNode
  visual?: ReactNode
  crumbs?: { to: string; label: string }[]
  className?: string
  children?: ReactNode
}) {
  return (
    <section className={`hero hero--page${visual ? '' : ' hero--text'} ${className}`} aria-labelledby={id}>
      <Ring className="hero__ring" swoosh={false} stroke="rgba(255,255,255,0.07)" width={2} />
      <div className="wrap hero__grid">
        <div className="hero__copy">
          {crumbs && (
            <nav className="crumbs hero__fade" aria-label="Breadcrumb">
              <ol>
                <li><Link to="/">Home</Link></li>
                {crumbs.map((c, i) => (
                  <li key={c.to}>{i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link to={c.to}>{c.label}</Link>}</li>
                ))}
              </ol>
            </nav>
          )}
          <h1 id={id} className="hero__title">
            {lines.map((l, i) => (
              <Fragment key={l.text}>
                {i > 0 && ' '}
                <SplitText tag="span" className={`hero__line${l.accent ? ' hero__line--accent' : ''}`} text={l.text} splitType="words" textAlign="left" delay={60} duration={1.05} threshold={0} rootMargin="0px" />
              </Fragment>
            ))}
          </h1>
          {lede && <p className="hero__lede hero__fade">{lede}</p>}
          {actions && <div className="hero__actions hero__fade">{actions}</div>}
          {fine && <p className="hero__fine hero__fade">{fine}</p>}
        </div>
        {visual && <div className="hero__visual">{visual}</div>}
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section heading: says the point, not the category. No eyebrow labels.
// ---------------------------------------------------------------------------
export function SecHead({ title, id, intro, center, children }: { title: ReactNode; id?: string; intro?: ReactNode; center?: boolean; children?: ReactNode }) {
  return (
    <header className={`sec-head${center ? ' sec-head--center' : ''}`} data-reveal>
      <h2 id={id} className="h2">{title}</h2>
      {intro && <p className="sec-head__intro">{intro}</p>}
      {children}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Trust facts: only facts the client has stated.
// ---------------------------------------------------------------------------
export function TrustRow({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const items = [
    { icon: CalendarCheck, b: `Since ${BUSINESS.founded}`, s: 'Over 10 years of credit repair' },
    { icon: Users, b: `${BUSINESS.clientsHelped} clients`, s: 'Helped after being declined' },
    { icon: BadgeCheck, b: 'Free assessment', s: 'No obligation' },
    { icon: MapPin, b: 'Bethal office', s: 'Clients across SA' },
  ]
  return (
    <ul className={`trust trust--${tone}`}>
      {items.map(({ icon: I, b, s }) => (
        <li key={b}><I size={22} strokeWidth={1.8} aria-hidden="true" /><span><b>{b}</b><small>{s}</small></span></li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Steps: 3 short steps.
// ---------------------------------------------------------------------------
export function Steps({ items, className = '' }: { items: { title: string; body: string }[]; className?: string }) {
  return (
    <ol className={`steps ${className}`}>
      {items.map((s, i) => (
        <li key={s.title} data-reveal>
          <span className="steps__num" aria-hidden="true">{i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// FAQ accordion (native <details>). Pair with faqJsonLd() in the page's <Seo>.
// ---------------------------------------------------------------------------
export type QA = [question: string, answer: string]

export function Faq({ items, title = 'Questions, answered.', id = 'faq-title', aside }: { items: QA[]; title?: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section className="sec faq" aria-labelledby={id}>
      <div className="wrap faq__grid">
        <div className="faq__intro" data-reveal>
          <h2 id={id} className="h2">{title}</h2>
          {aside ?? (
            <p>Still unsure? <a href={`tel:${PRIMARY_PHONE.tel}`}>Call {PRIMARY_PHONE.label}</a> or <a href={waLink()} target="_blank" rel="noopener">WhatsApp us</a>.</p>
          )}
        </div>
        <div className="faq__list">
          {items.map(([q, a]) => (
            <details key={q} data-reveal>
              <summary>{q}<Plus size={22} aria-hidden="true" /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export const faqJsonLd = (items: QA[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
})

// ---------------------------------------------------------------------------
// The closing conversion block used at the bottom of most pages:
// headline + contact channels on the left, the assessment on the right.
// ---------------------------------------------------------------------------
export function CtaBlock({ title = <>Let’s get your name{' '}<br />back in good standing.</>, lede, source, preset, id = 'start' }: {
  title?: ReactNode; lede?: ReactNode; source: string; preset?: SituationId; id?: string
}) {
  return (
    <section className="cta" id={id} aria-labelledby={`${id}-title`}>
      <Ring className="cta__ring" swoosh={false} stroke="rgba(255,255,255,0.08)" width={2} />
      <div className="wrap cta__grid">
        <div className="cta__copy" data-reveal>
          <h2 id={`${id}-title`} className="h2">{title}</h2>
          <p className="cta__lede">{lede ?? <>Answer three quick questions. A consultant calls you {BUSINESS.responseTime} with a clear plan.</>}</p>
          <div className="cta__channels">
            <a href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: `cta:${source}` })}><Phone size={18} aria-hidden="true" />{PRIMARY_PHONE.label}</a>
            <a href={waLink('Hi Truemarc, I need help with my credit record.')} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: `cta:${source}` })}><WhatsAppIcon size={18} />WhatsApp us</a>
          </div>
        </div>
        <div className="cta__form" data-reveal>
          <Assessment source={source} preset={preset} variant="card" />
        </div>
      </div>
    </section>
  )
}

/** Small inline link with arrow, for "read more" style links. */
export function GoLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="go">{children}<ArrowRight size={18} aria-hidden="true" /></Link>
}
