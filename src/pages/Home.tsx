import { useRef } from 'react'
import { Phone } from 'lucide-react'
import { gsap } from 'gsap'
import '@/styles/pages/home.css'
import Seo from '@/components/Seo'
import { CtaBlock, Faq, faqJsonLd, GoLink, SecHead, Steps } from '@/components/blocks/Blocks'
import { organizationLd } from '@/lib/schema'
import { isHydrating, MOTION_OK, usePageMotion, type ExtraScenes } from '@/lib/motion'
import { PRIMARY_PHONE } from '@/lib/site'
import { track } from '@/lib/leads'
import HomeHero from '@/components/home/HomeHero'
import StoryReport, { storyScene } from '@/components/home/StoryReport'
import HomeServices from '@/components/home/HomeServices'
import HomeTalk from '@/components/home/HomeTalk'
import HomeLearn from '@/components/home/HomeLearn'
import AssessLink from '@/components/home/AssessLink'
import { FACTS, FAQS, STEPS } from '@/components/home/content'

const TITLE = 'Credit Repair & Blacklisting Help in South Africa | Truemarc'
const DESCRIPTION = 'Declined for credit? Truemarc helps South Africans remove judgments and defaults, exit debt review and clear their name. Free assessment, call back in 24 hours.'

// Hero entrance: headline lines rise out of a mask, the photo settles, the ring draws itself over it.
// (Lede and contact links use the shared .hero__fade contract in lib/motion.)
// Skipped while hydrating a prerendered page: the hero is already painted, so an entrance would make it blink.
const heroIntro: ExtraScenes = (mm, q) => {
  if (isHydrating()) return
  mm.add(MOTION_OK, () => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    tl.from(q('.home-hero__img'), { scale: 1.1, duration: 2.4 }, 0)
      .from(q('.home-hero__line > span'), { yPercent: 110, duration: 1.2, stagger: 0.12 }, 0.1)
      .from(q('.home-hero__card'), { y: 36, opacity: 0, duration: 1.1 }, 0.25)
    q('.home-hero__ring circle').forEach((c) => {
      const len = (c as unknown as SVGCircleElement).getTotalLength()
      tl.fromTo(c, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 0.35)
    })
  })
}

const homeScenes: ExtraScenes = (mm, q) => {
  heroIntro(mm, q)
  storyScene(mm, q)
}

export default function Home() {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root, homeScenes)

  return (
    <div className="home" ref={root}>
      <Seo rawTitle title={TITLE} description={DESCRIPTION} path="/" jsonLd={[organizationLd(), faqJsonLd(FAQS)]} />

      <HomeHero />

      {/* Facts the client has stated. Nothing invented. */}
      <section className="home-facts" aria-label="Truemarc at a glance">
        <ul className="wrap home-facts__list">
          {FACTS.map((f) => (
            <li key={f.big} data-reveal>
              <b>{f.big}</b>
              <span>{f.small}</span>
            </li>
          ))}
        </ul>
      </section>

      <StoryReport />

      <HomeServices />

      <section className="sec sec--mist home-how" aria-labelledby="how-title">
        <div className="wrap">
          <SecHead id="how-title" title="Three steps to a clear plan." />
          <Steps items={STEPS} />
          <div className="home-how__cta" data-reveal>
            <AssessLink placement="home-steps">Start my free assessment</AssessLink>
            <a className="home-how__call" href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: 'home-steps' })}>
              <Phone size={18} aria-hidden="true" />or call {PRIMARY_PHONE.label}
            </a>
            <span className="home-how__more"><GoLink to="/how-it-works">How credit repair works</GoLink></span>
          </div>
        </div>
      </section>

      <HomeTalk />

      <HomeLearn />

      <Faq items={FAQS} title="Credit repair questions, answered." />

      <CtaBlock source="home-cta" />
    </div>
  )
}
