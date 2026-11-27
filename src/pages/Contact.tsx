import '@/styles/pages/company.css'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'
import Seo from '@/components/Seo'
import { PageHero } from '@/components/blocks/Blocks'
import { Address, ContactChannels, DirectionsLink, HoursTable, OpenBadge } from '@/components/company/Company'
import EnquiryForm from '@/components/company/EnquiryForm'
import { breadcrumbLd, organizationLd } from '@/lib/schema'
import { ASSESS_PATH, BUSINESS, SITE_URL } from '@/lib/site'
import { track } from '@/lib/leads'
import { usePageMotion } from '@/lib/motion'

// DRAFT COPY: headlines and body text need client approval.
const DESCRIPTION = `Call ${BUSINESS.phones[0].label}, WhatsApp or email Truemarc Consultants in ${BUSINESS.address.town}, ${BUSINESS.address.province}. Send a message and a consultant gets back to you ${BUSINESS.responseTime}.`

export default function Contact() {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root)

  return (
    <div ref={root}>
      <Seo
        title="Contact us: call, WhatsApp or visit"
        description={DESCRIPTION}
        path="/contact"
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'ContactPage', name: `Contact ${BUSINESS.name}`, url: `${SITE_URL}/contact`, description: DESCRIPTION, mainEntity: organizationLd() },
          breadcrumbLd([{ name: 'Contact', path: '/contact' }]),
        ]}
      />

      <PageHero
        id="contact-title"
        className="co-contact-hero"
        crumbs={[{ to: '/contact', label: 'Contact' }]}
        lines={[{ text: 'Talk to us.' }, { text: 'Real people answer.', accent: true }]}
        lede={<>Call, WhatsApp or send a message, and a consultant gets back to you {BUSINESS.responseTime}.</>}
        visual={
          <div className="co-reach hero__piece">
            <OpenBadge />
            <ContactChannels placement="contact-hero" />
          </div>
        }
      />

      {/* Message + faster option */}
      <section className="sec co-msg" aria-labelledby="msg-title">
        <div className="wrap co-msg__grid">
          <div className="co-msg__intro" data-reveal>
            <h2 id="msg-title" className="h2">Send us a message.</h2>
            <p className="co-msg__lede">Tell us what’s going on in a few lines. A consultant reads every message and calls you back {BUSINESS.responseTime}.</p>
            <Link to={ASSESS_PATH} className="co-faster" onClick={() => track('cta_click', { placement: 'contact-faster' })}>
              <span className="co-faster__icon"><Clock3 size={22} aria-hidden="true" /></span>
              <span className="co-faster__text">
                <b>Want a faster answer?</b>
                <span>The free assessment takes about a minute and tells us exactly where to start.</span>
              </span>
              <ArrowRight className="co-faster__go" size={22} aria-hidden="true" />
            </Link>
          </div>
          <div className="co-msg__form" data-reveal>
            <EnquiryForm source="contact" />
          </div>
        </div>
      </section>

      {/* Office */}
      <section className="sec sec--mist co-visit" aria-labelledby="visit-title">
        <div className="wrap co-visit__grid">
          <div data-reveal>
            <h2 id="visit-title" className="h2">Visit the {BUSINESS.address.town} office.</h2>
            <Address />
            <div className="co-visit__actions">
              <DirectionsLink placement="contact-office" />
            </div>
          </div>
          <div className="co-visit__hours card" data-reveal>
            <OpenBadge />
            <HoursTable />
            <p className="fine">All times are South African time.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
