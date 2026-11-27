import '@/styles/pages/company.css'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, MapPin, Phone, Users } from 'lucide-react'
import Seo from '@/components/Seo'
import { CtaBlock, GoLink, PageHero, Steps } from '@/components/blocks/Blocks'
import { Address, DirectionsLink, HoursTable, OpenBadge } from '@/components/company/Company'
import { breadcrumbLd, organizationLd } from '@/lib/schema'
import { ASSESS_PATH, BUSINESS, PRIMARY_PHONE, SITE_URL } from '@/lib/site'
import { track } from '@/lib/leads'
import { usePageMotion } from '@/lib/motion'

// DRAFT COPY: all headlines and body text below need client approval.
const DESCRIPTION = `Truemarc Consultants has helped ${BUSINESS.clientsHelped} South Africans understand and fix their credit records since ${BUSINESS.founded}. Visit our ${BUSINESS.address.town} office or start online today.`

const VALUES = [
  { name: 'Integrity', line: 'We tell you what can be fixed and what can’t, before you commit to anything.' },
  { name: 'Transparency', line: 'You know what we’re doing on your file, and why, at every step.' },
  { name: 'Personalised solutions', line: 'No two credit records are the same, so no two plans are either.' },
]

const STEPS = [
  { title: 'We listen', body: 'A consultant calls you to understand what happened and what you need next.' },
  { title: 'We check your record', body: 'With your permission, we look at what the credit bureaus are actually showing.' },
  { title: 'You get a clear plan', body: 'What can be fixed, how long it usually takes and what it costs. No obligation.' },
]

export default function About() {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root)

  return (
    <div ref={root}>
      <Seo
        title="About us: credit help since 2015"
        description={DESCRIPTION}
        path="/about"
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'AboutPage', name: `About ${BUSINESS.name}`, url: `${SITE_URL}/about`, description: DESCRIPTION, mainEntity: organizationLd() },
          breadcrumbLd([{ name: 'About', path: '/about' }]),
        ]}
      />

      <PageHero
        id="about-title"
        crumbs={[{ to: '/about', label: 'About' }]}
        lines={[{ text: 'Bad credit' }, { text: 'isn’t the end.', accent: true }]}
        lede={<>Since {BUSINESS.founded}, Truemarc has helped {BUSINESS.clientsHelped} South Africans, many of them declined by banks, understand and fix their credit records.</>}
        actions={<>
          <Link to={ASSESS_PATH} className="btn btn--red btn--lg" onClick={() => track('cta_click', { placement: 'about-hero' })}>Start my free assessment<ArrowRight size={20} aria-hidden="true" /></Link>
          <a href={`tel:${PRIMARY_PHONE.tel}`} className="btn btn--ghost btn--lg" onClick={() => track('click_call', { placement: 'about-hero' })}><Phone size={18} aria-hidden="true" />{PRIMARY_PHONE.label}</a>
        </>}
        visual={
          <div className="co-facts" aria-label="Truemarc at a glance">
            <div className="co-facts__main hero__piece">
              <CalendarCheck size={26} aria-hidden="true" />
              <b className="num">{BUSINESS.founded}</b>
              <span>The year we started helping South Africans with their credit records.</span>
            </div>
            <div className="co-facts__chip hero__chip"><Users size={20} aria-hidden="true" /><span><b>{BUSINESS.clientsHelped}</b> clients helped</span></div>
            <div className="co-facts__chip co-facts__chip--b hero__chip"><MapPin size={20} aria-hidden="true" /><span>Office in <b>{BUSINESS.address.town}</b>, {BUSINESS.address.province}</span></div>
          </div>
        }
      />

      {/* Story */}
      <section className="sec co-story" aria-labelledby="story-title">
        <div className="wrap co-story__grid">
          <div className="co-story__text" data-reveal>
            <h2 id="story-title" className="h2">Declined shouldn’t mean defeated.</h2>
            <p>Truemarc started in {BUSINESS.founded} for a simple reason: too many people were being turned away by banks without anyone explaining why, or what they could do about it. Today we work from our office in {BUSINESS.address.town}, {BUSINESS.address.province}.</p>
            <p>Many of the people who come to us have been declined for a car, a home loan or even a phone contract. Some have a default or a judgment they didn’t know about. Others are in debt review and don’t know how to get out.</p>
            <p>We sit down with each of them, find out what’s really on their record and fix what can be fixed, the legal way.</p>
          </div>
          <div className="co-story__side" data-reveal>
            <p className="co-mission">To restore hope.</p>
            <p className="co-mission__note">That’s our mission, with continuous support and guidance along the way. Our tagline says it in two words: <i>{BUSINESS.tagline}</i>.</p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="sec sec--mist co-values" aria-labelledby="values-title">
        <div className="wrap co-values__grid">
          <h2 id="values-title" className="h2 co-values__title" data-reveal>Three things we won’t compromise on.</h2>
          <ul className="co-values__list">
            {VALUES.map((v) => (
              <li key={v.name} data-reveal>
                <h3>{v.name}</h3>
                <p>{v.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How we work */}
      <section className="sec co-how" aria-labelledby="how-title">
        <div className="wrap">
          <div className="co-how__head" data-reveal>
            <h2 id="how-title" className="h2">Straight answers from the first call.</h2>
            <GoLink to="/how-it-works">See the full process</GoLink>
          </div>
          <Steps items={STEPS} />
        </div>
      </section>

      {/* Office */}
      <section className="sec sec--night co-office" aria-labelledby="office-title">
        <div className="wrap co-office__grid">
          <div data-reveal>
            <h2 id="office-title" className="h2">Visit us in {BUSINESS.address.town}.</h2>
            <p className="co-office__lede">Prefer to talk face to face? Visit us during office hours, or start with a call or WhatsApp, wherever you are.</p>
            <Address className="co-address--dark" />
            <div className="co-office__actions">
              <DirectionsLink placement="about-office" className="btn btn--white" />
              <Link to="/contact" className="btn btn--ghost">All contact options<ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="co-office__hours" data-reveal>
            <OpenBadge tone="dark" />
            <HoursTable tone="dark" />
          </div>
        </div>
      </section>

      <CtaBlock source="about" />
    </div>
  )
}
