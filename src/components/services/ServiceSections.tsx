import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, Clock, FileCheck2, Mail, MapPin, Phone, X } from 'lucide-react'
import Assessment from '@/components/assessment/Assessment'
import { GoLink, SecHead } from '@/components/blocks/Blocks'
import Icon, { WhatsAppIcon } from '@/components/Icon'
import type { Article } from '@/content/articles'
import { BUSINESS, PRIMARY_PHONE, type Service, type SituationId, serviceBySlug, waLink } from '@/lib/site'
import { track } from '@/lib/leads'

// Sections used by /services, /services/:slug and /how-it-works. Copy lives in src/content/services.ts.

/** A service tile: double-bezel card (soft shell + white core), icon, name, one line, link. */
export function ServiceTile({ slug, headingLevel = 3 }: { slug: string; headingLevel?: 3 | 4 }) {
  const s = serviceBySlug(slug)
  if (!s) return null
  const H = headingLevel === 3 ? 'h3' : 'h4'
  return (
    <Link to={`/services/${s.slug}`} className="svc-tile" data-reveal>
      <span className="svc-tile__core">
        <span className="svc-tile__icon"><Icon name={s.icon} size={24} strokeWidth={1.7} /></span>
        <H className="svc-tile__name">{s.name}</H>
        <span className="svc-tile__text">{s.short}</span>
        <span className="svc-tile__go">See how we help<ArrowRight size={18} aria-hidden="true" /></span>
      </span>
    </Link>
  )
}

/** "Is this you?" signs next to the assessment. On mobile the assessment comes first (right after the hero). */
export function Intake({ slug, signs, preset }: { slug: string; signs: string[]; preset?: SituationId }) {
  return (
    <section className="sec svc-intake" aria-labelledby="signs-title">
      <div className="wrap svc-intake__grid">
        <div className="svc-intake__copy" data-reveal>
          <h2 id="signs-title" className="h2">Is this you?</h2>
          <ul className="svc-signs">
            {signs.map((s) => (
              <li key={s}><span className="svc-signs__tick" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>{s}</li>
            ))}
          </ul>
          <p className="svc-intake__note">
            Sound familiar? Answer three quick questions and a consultant calls you {BUSINESS.responseTime} with a plan.
          </p>
        </div>
        <div className="svc-intake__form" id="check">
          <p className="svc-intake__lead"><Clock size={16} aria-hidden="true" />Free, no obligation. About 60 seconds.</p>
          <Assessment source={`service:${slug}`} preset={preset} variant="card" />
        </div>
      </div>
    </section>
  )
}

/** "What changes for you": before → after ledger on night. Conditional language only; no promises. */
export function Outcomes({ title, items }: { title: string; items: { before: string; after: string }[] }) {
  return (
    <section className="sec sec--night svc-outcomes" aria-labelledby="outcomes-title">
      <div className="wrap">
        <SecHead id="outcomes-title" title={title} />
        <ol className="svc-ledger">
          {items.map((o) => (
            <li key={o.before} data-reveal>
              <span className="svc-ledger__before"><X size={18} strokeWidth={2.4} aria-hidden="true" /><span><span className="sr-only">Before: </span>{o.before}</span></span>
              <span className="svc-ledger__arrow" aria-hidden="true"><ArrowRight size={20} /></span>
              <span className="svc-ledger__after"><Check size={18} strokeWidth={3} aria-hidden="true" /><span><span className="sr-only">After: </span>{o.after}</span></span>
            </li>
          ))}
        </ol>
        <div className="svc-outcomes__foot" data-reveal>
          <p className="fine">Every case is different. We tell you honestly what’s possible at your assessment.</p>
          <a href="#check" className="btn btn--red" onClick={() => track('cta_click', { placement: 'service-outcomes' })}>Check my options free<ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  )
}

/** Documents checklist + the related guide. */
export function DocsAndGuide({ docs, guide }: { docs: string[]; guide?: Article }) {
  return (
    <section className="sec svc-docs" aria-labelledby="docs-title">
      <div className="wrap svc-docs__grid">
        <div>
          <SecHead id="docs-title" title="What to have ready." intro="Don’t have everything? Start anyway. We help you find what’s missing." />
          <ul className="svc-docs__list">
            {docs.map((d) => (
              <li key={d} data-reveal><FileCheck2 size={20} strokeWidth={1.8} aria-hidden="true" />{d}</li>
            ))}
          </ul>
        </div>
        <aside className="svc-guide" data-reveal aria-label="Related guide">
          <div className="svc-guide__core">
            {guide && (
              <>
                <span className="svc-guide__icon"><BookOpen size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <h3 className="svc-guide__title"><Link to={`/learn/${guide.slug}`}>{guide.title}</Link></h3>
                <p className="svc-guide__meta">A plain-language guide · {guide.minutes} min read</p>
                <GoLink to={`/learn/${guide.slug}`}>Read the guide</GoLink>
                <hr />
              </>
            )}
            <p className="svc-guide__how">Want to see every step, from your first message to your updated record?</p>
            <GoLink to="/how-it-works">How the process works</GoLink>
          </div>
        </aside>
      </div>
    </section>
  )
}

/** Cross-links to related services. */
export function Related({ slugs, title = 'Often part of the same story.', withHub }: { slugs: string[]; title?: string; withHub?: boolean }) {
  const n = Math.min(slugs.length + (withHub ? 1 : 0), 3)
  return (
    <section className="sec svc-related" aria-labelledby="related-title">
      <div className="wrap">
        <SecHead id="related-title" title={title} />
        <div className={`svc-tiles svc-tiles--${n}`}>
          {slugs.map((s) => <ServiceTile key={s} slug={s} />)}
          {withHub && (
            <Link to="/services" className="svc-tile" data-reveal>
              <span className="svc-tile__core">
                <span className="svc-tile__icon"><Icon name="BadgeCheck" size={24} strokeWidth={1.7} /></span>
                <h3 className="svc-tile__name">Credit repair and blacklisting</h3>
                <span className="svc-tile__text">Our main work: defaults, judgments, debt review, fraud listings and more.</span>
                <span className="svc-tile__go">See credit services<ArrowRight size={18} aria-hidden="true" /></span>
              </span>
            </Link>
          )}
        </div>
        <p className="svc-related__more" data-reveal>
          <GoLink to="/services">All services</GoLink>
          <GoLink to="/how-it-works">How it works</GoLink>
        </p>
      </div>
    </section>
  )
}

/** Closing block for the non-credit lines: call, WhatsApp, contact page. No assessment. */
export function TalkToUs({ service }: { service: Service }) {
  const a = BUSINESS.address
  const wa = waLink(`Hi Truemarc, I’d like to talk to someone about ${service.name.toLowerCase()}.`)
  return (
    <section className="sec svc-talk" id="talk" aria-labelledby="talk-title">
      <div className="wrap svc-talk__grid">
        <div data-reveal>
          <h2 id="talk-title" className="h2">Talk to a consultant.<br /><span className="svc-talk__accent">Your first chat is free.</span></h2>
          <p className="svc-talk__lede">Call, WhatsApp or visit our Bethal office. We listen first, then tell you honestly how we can help.</p>
          <div className="svc-talk__actions">
            <a className="btn btn--red btn--lg" href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: `talk:${service.slug}` })}>
              <Phone size={20} aria-hidden="true" />Call {PRIMARY_PHONE.label}
            </a>
            <a className="btn btn--wa btn--lg" href={wa} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: `talk:${service.slug}` })}>
              <WhatsAppIcon size={20} />WhatsApp us
            </a>
          </div>
          <p className="svc-talk__more"><Link to="/contact">More ways to reach us<ArrowRight size={18} aria-hidden="true" /></Link></p>
        </div>
        <div className="svc-talk__card" data-reveal>
          <ul>
            <li><MapPin size={20} aria-hidden="true" /><span><b>Visit us</b>{a.line1}, {a.street}, {a.town}, {a.province}</span></li>
            <li><Clock size={20} aria-hidden="true" /><span><b>Office hours</b>{BUSINESS.hours.map((h) => h.short).join(' · ')}</span></li>
            <li><Phone size={20} aria-hidden="true" /><span><b>Phone</b>{BUSINESS.phones.map((p, i) => <span key={p.tel}>{i > 0 && ' · '}<a href={`tel:${p.tel}`}>{p.label}</a></span>)}</span></li>
            <li><Mail size={20} aria-hidden="true" /><span><b>Email</b><a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></span></li>
          </ul>
        </div>
      </div>
    </section>
  )
}
