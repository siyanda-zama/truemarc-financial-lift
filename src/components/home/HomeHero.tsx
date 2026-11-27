import { Phone } from 'lucide-react'
import Assessment from '@/components/assessment/Assessment'
import { Ring } from '@/components/brand/Brand'
import { WhatsAppIcon } from '@/components/Icon'
import { PRIMARY_PHONE, waLink } from '@/lib/site'
import { track } from '@/lib/leads'
import { HERO } from './content'

// React 18's DOM types don't know fetchpriority yet; pass it through as a plain attribute.
const HIGH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>

/**
 * Photo-led hero with the funnel inside it. The photo is the LCP image (eager, high priority).
 * The brand ring is line-drawn over the photo, the way a bank draws its shape over imagery.
 * Desktop: headline bottom-left over the photo, assessment card on the right.
 * Mobile: photo, headline over its foot, then the card straight away, then the lede and contact links.
 */
export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero__media">
        <img
          className="home-hero__img"
          src="/img/consultant-female.webp"
          srcSet="/img/consultant-female-960.webp 960w, /img/consultant-female.webp 1920w"
          sizes="(min-width: 960px) 62vw, 100vw"
          width={1920}
          height={1080}
          alt=""
          {...HIGH_PRIORITY}
        />
        <Ring className="home-hero__ring" swoosh={false} stroke="var(--red)" width={5} />
      </div>

      <div className="wrap home-hero__grid">
        <h1 id="home-title" className="home-hero__title">
          <span className="home-hero__line"><span>{HERO.lines[0]}</span></span>{' '}
          <span className="home-hero__line home-hero__line--accent"><span>{HERO.lines[1]}</span></span>
        </h1>
        <p className="home-hero__lede hero__fade">{HERO.lede}</p>
        <div className="home-hero__talk hero__fade">
          <a className="btn btn--ghost" href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: 'home-hero' })}>
            <Phone size={18} aria-hidden="true" />Call {PRIMARY_PHONE.label}
          </a>
          <a className="btn btn--ghost" href={waLink('Hi Truemarc, I need help with my credit record.')} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'home-hero' })}>
            <WhatsAppIcon size={18} />WhatsApp us
          </a>
        </div>
        <div className="home-hero__card" id="assessment">
          <Assessment variant="hero" source="home-hero" />
        </div>
      </div>
    </section>
  )
}
