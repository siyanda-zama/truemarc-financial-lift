import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { GoLink, SecHead } from '@/components/blocks/Blocks'
import Icon, { WhatsAppIcon } from '@/components/Icon'
import { SERVICES, waLink } from '@/lib/site'
import { track } from '@/lib/leads'
import AssessLink from './AssessLink'

const CREDIT = SERVICES.filter((s) => s.group === 'credit')

/** The 8 credit services as a scannable link list, plus one "not sure?" tile that routes to the assessment. */
export default function HomeServices() {
  return (
    <section className="sec home-svc" aria-labelledby="svc-title">
      <div className="wrap">
        <SecHead
          id="svc-title"
          title={<>Credit repair for whatever’s <span className="accent">holding you back.</span></>}
          intro="Choose what sounds like you, or let the free assessment work it out."
        />
        <div className="home-svc__grid">
          <ul className="home-svc__list">
            {CREDIT.map((s) => (
              <li key={s.slug} data-reveal>
                <Link to={`/services/${s.slug}`} className="home-svc__item">
                  <span className="home-svc__icon"><Icon name={s.icon} size={22} strokeWidth={1.8} /></span>
                  <span className="home-svc__text">
                    <h3>{s.name}</h3>
                    <p>{s.short}</p>
                  </span>
                  <ArrowRight className="home-svc__arrow" size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          <aside className="home-svc__hot" aria-labelledby="svc-hot-title" data-reveal>
            <div className="home-svc__hot-media" aria-hidden="true">
              <img src="/img/consultant-male-960.webp" alt="" width={960} height={540} loading="lazy" decoding="async" />
            </div>
            <div className="home-svc__hot-body">
              <h3 id="svc-hot-title">Not sure which one you need?</h3>
              <p>Answer three quick questions and a consultant tells you what applies to you. Free.</p>
              <AssessLink placement="home-services" className="btn btn--red btn--lg btn--block">Start my free assessment</AssessLink>
              <a className="home-svc__wa" href={waLink('Hi Truemarc, I’m not sure what’s on my credit record. Can you help?')} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'home-services' })}>
                <WhatsAppIcon size={18} />Or ask us on WhatsApp
              </a>
            </div>
          </aside>
        </div>
        <div className="home-svc__all" data-reveal>
          <GoLink to="/services">All services, including labour relations</GoLink>
        </div>
      </div>
    </section>
  )
}
