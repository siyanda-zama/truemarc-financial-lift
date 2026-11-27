import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, HelpCircle } from 'lucide-react'
import '@/styles/pages/services.css'
import Seo from '@/components/Seo'
import Assessment from '@/components/assessment/Assessment'
import { CtaBlock, Faq, PageHero, SecHead, faqJsonLd, type QA } from '@/components/blocks/Blocks'
import Icon, { WhatsAppIcon } from '@/components/Icon'
import { HubVisual } from '@/components/services/ServiceVisual'
import { ServiceTile } from '@/components/services/ServiceSections'
import { BUSINESS, SERVICES, waLink } from '@/lib/site'
import { breadcrumbLd, serviceLd } from '@/lib/schema'
import { track } from '@/lib/leads'
import { usePageMotion } from '@/lib/motion'

// DRAFT copy for client approval.
const TITLE = 'Our Credit Services: Judgments, Defaults, Debt Review'
const DESCRIPTION = 'Declined for credit? We help with judgments, defaults, debt review, fraud listings, trace alerts and admin orders. Start with a free assessment.'

/** Services grouped by the problem the visitor has, in their words. */
const GROUPS: { title: string; line: string; slugs: string[] }[] = [
  { title: 'A listing is blocking me.', line: 'Defaults, judgments, missed payments or a trace alert on your record.', slugs: ['default-judgment-removal', 'bad-payment-profile', 'trace-alert-removal'] },
  { title: 'I’m caught in a debt or legal process.', line: 'Debt review, an admin order, or court papers you need help with.', slugs: ['debt-review', 'admin-order-rescission', 'paralegal-blacklisting'] },
  { title: 'I want to protect my name.', line: 'From identity fraud, and from surprises when you apply.', slugs: ['fraud-listing-removal', 'credit-profile-management'] },
]

const OTHER = SERVICES.filter((s) => s.group === 'other')

const FAQS: QA[] = [
  ['Is there really a blacklist in South Africa?', 'Not a single list. Credit bureaus keep a record of how you’ve paid, and lenders read it. Being “blacklisted” usually means something negative on that record.'],
  ['Can anyone remove accurate information from my record?', 'No one can lawfully remove accurate information. We challenge what’s wrong, outdated or unproven, and help with legal processes like rescinding a judgment or an admin order.'],
  ['What’s the difference between a default and a judgment?', 'A default is listed by a creditor when you fall behind on an account. A judgment is a court order against you for the debt, and usually needs a legal process to remove.'],
  ['Do you only help people in Bethal?', 'No. Our office is in Bethal, Mpumalanga, and we help clients across South Africa by phone and WhatsApp.'],
  ['What does it cost?', 'Your assessment is free. If we can help, you get a clear quote before any work starts, and you decide whether to go ahead.'],
]

export default function ServicesHub() {
  const ref = useRef<HTMLDivElement>(null)
  usePageMotion(ref)

  const jsonLd = [
    serviceLd({ name: 'Credit repair and blacklisting help', description: DESCRIPTION, path: '/services' }),
    breadcrumbLd([{ name: 'Services', path: '/services' }]),
    faqJsonLd(FAQS),
  ]

  return (
    <div ref={ref} className="svc-page svc-page--hub">
      <Seo title={TITLE} description={DESCRIPTION} path="/services" jsonLd={jsonLd} />

      <PageHero
        className="svc-hero"
        lines={[{ text: 'Clear your name.' }, { text: 'Get back to yes.', accent: true }]}
        lede={<>Credit repair, judgment removal and debt review help for South Africans who’ve been declined, since {BUSINESS.founded}.</>}
        actions={(
          <>
            <a href="#match" className="btn btn--red btn--lg" onClick={() => track('cta_click', { placement: 'services-hero' })}>
              Find the right help<ArrowRight size={20} aria-hidden="true" />
            </a>
            <a href={waLink('Hi Truemarc, I need help with my credit record.')} target="_blank" rel="noopener" className="btn btn--ghost btn--lg" onClick={() => track('click_whatsapp', { placement: 'services-hero' })}>
              <WhatsAppIcon size={20} />WhatsApp us
            </a>
          </>
        )}
        fine={<>Free · No obligation · Call back {BUSINESS.responseTime}</>}
        visual={<HubVisual />}
        crumbs={[{ to: '/services', label: 'Services' }]}
      />

      <section className="sec svc-groups" aria-labelledby="groups-title">
        <div className="wrap">
          <SecHead id="groups-title" title="Start with what’s wrong." intro="Pick the problem that sounds most like yours. Each page shows what we do, what changes and what to have ready." />
          {GROUPS.map((g, gi) => (
            <div className="svc-group" key={g.title} aria-labelledby={`group-${gi}`} role="group">
              <div className="svc-group__head" data-reveal>
                <h3 id={`group-${gi}`} className="svc-group__title">{g.title}</h3>
                <p>{g.line}</p>
              </div>
              <div className="svc-tiles svc-tiles--3">
                {g.slugs.map((s) => <ServiceTile key={s} slug={s} headingLevel={4} />)}
                {g.slugs.length < 3 && (
                  <a href="#match" className="svc-tile svc-tile--ask" data-reveal onClick={() => track('cta_click', { placement: 'services-grid-ask' })}>
                    <span className="svc-tile__core">
                      <span className="svc-tile__icon"><HelpCircle size={24} strokeWidth={1.7} aria-hidden="true" /></span>
                      <h4 className="svc-tile__name">Not sure which fits?</h4>
                      <span className="svc-tile__text">Answer three quick questions and we’ll point you to the right help.</span>
                      <span className="svc-tile__go">Take the free check<ArrowRight size={18} aria-hidden="true" /></span>
                    </span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec sec--mist svc-match" id="match" aria-labelledby="match-title">
        <div className="wrap svc-match__grid">
          <div className="svc-match__copy" data-reveal>
            <h2 id="match-title" className="h2">Not sure which one?<br /><span className="accent">Answer three questions.</span></h2>
            <p className="svc-match__lede">We match you to the right help, and a consultant calls you {BUSINESS.responseTime}.</p>
            <ol className="svc-match__qs">
              <li><span aria-hidden="true">1</span>What’s holding you back?</li>
              <li><span aria-hidden="true">2</span>What do you want to do next?</li>
              <li><span aria-hidden="true">3</span>Roughly how much do you owe?</li>
            </ol>
          </div>
          <div className="svc-match__form">
            <Assessment source="services-hub" variant="card" />
          </div>
        </div>
      </section>

      <section className="sec sec--tight svc-also" aria-labelledby="also-title">
        <div className="wrap svc-also__grid">
          <h2 id="also-title" className="svc-also__title" data-reveal>We also help at work and in business.</h2>
          <ul className="svc-also__list">
            {OTHER.map((s) => (
              <li key={s.slug} data-reveal>
                <Link to={`/services/${s.slug}`}>
                  <span className="svc-also__icon"><Icon name={s.icon} size={22} strokeWidth={1.7} /></span>
                  <span><b>{s.name}</b><small>{s.short}</small></span>
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Faq items={FAQS} id="hub-faq-title" />
      <CtaBlock source="services-cta" />
    </div>
  )
}
