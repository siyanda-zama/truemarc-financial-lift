import '@/styles/pages/company.css'
import { Link } from 'react-router-dom'
import { ArrowRight, Phone } from 'lucide-react'
import Seo from '@/components/Seo'
import Icon, { WhatsAppIcon } from '@/components/Icon'
import { Ring } from '@/components/brand/Brand'
import { ASSESS_PATH, PRIMARY_PHONE, SERVICES, waLink } from '@/lib/site'
import { track } from '@/lib/leads'

// Self-contained: also rendered by service and article pages for unknown slugs.
// DRAFT COPY: needs client approval.
export default function NotFound() {
  const credit = SERVICES.filter((s) => s.group === 'credit')
  return (
    <>
      <Seo
        noindex
        title="Page not found"
        description="This page has moved or never existed. Find credit repair, debt review and blacklisting help, or start a free assessment with Truemarc Consultants."
        path="/404"
      />

      <section className="co-404" aria-labelledby="nf-title">
        <div className="wrap co-404__grid">
          <div className="co-404__art" aria-hidden="true">
            <span>4</span>
            <Ring className="co-404__ring" swooshColor="var(--white)" />
            <span>4</span>
          </div>
          <div className="co-404__copy">
            <h1 id="nf-title" className="co-404__title">We couldn’t find <span>that page.</span></h1>
            <p className="co-404__lede">The link may be old or mistyped. Your credit questions still have answers.</p>
            <div className="co-404__actions">
              <Link to={ASSESS_PATH} className="btn btn--red btn--lg" onClick={() => track('cta_click', { placement: '404' })}>Start my free assessment<ArrowRight size={20} aria-hidden="true" /></Link>
              <a href={`tel:${PRIMARY_PHONE.tel}`} className="btn btn--ghost btn--lg" onClick={() => track('click_call', { placement: '404' })}><Phone size={18} aria-hidden="true" />{PRIMARY_PHONE.label}</a>
              <a href={waLink('Hi Truemarc, I need help with my credit record.')} target="_blank" rel="noopener" className="btn btn--wa btn--lg" onClick={() => track('click_whatsapp', { placement: '404' })}><WhatsAppIcon size={20} />WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec--tight co-404-help" aria-labelledby="nf-help">
        <div className="wrap">
          <h2 id="nf-help" className="h3 co-404-help__title">Most people are looking for one of these.</h2>
          <ul className="co-404-help__list">
            {credit.map((s) => (
              <li key={s.slug}>
                <Link to={`/services/${s.slug}`}>
                  <span className="co-404-help__icon"><Icon name={s.icon} size={20} strokeWidth={1.8} /></span>
                  {s.name}
                  <ArrowRight size={18} aria-hidden="true" className="co-404-help__go" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="co-404-help__more">
            Or go to the <Link to="/">home page</Link>, read our <Link to="/learn">credit guides</Link>, or <Link to="/contact">contact us</Link>.
          </p>
        </div>
      </section>
    </>
  )
}
