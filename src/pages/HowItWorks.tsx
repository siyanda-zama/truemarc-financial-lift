import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, FolderOpen, IdCard, MessageCircle, Minus, ShieldCheck } from 'lucide-react'
import '@/styles/pages/services.css'
import Seo from '@/components/Seo'
import { CtaBlock, Faq, PageHero, SecHead, faqJsonLd, type QA } from '@/components/blocks/Blocks'
import { WhatsAppIcon } from '@/components/Icon'
import { HowVisual } from '@/components/services/ServiceVisual'
import { ASSESS_PATH, BUSINESS, waLink } from '@/lib/site'
import { breadcrumbLd } from '@/lib/schema'
import { track } from '@/lib/leads'
import { MOTION_OK, usePageMotion } from '@/lib/motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// DRAFT copy for client approval (stages, promises, cost wording, FAQs).
const TITLE = 'How Credit Repair Works, Step by Step'
const DESCRIPTION = 'What happens from your first message to your updated credit record: what we need from you, what to expect and how costs work. Start with a free assessment.'

const STAGES = [
  { when: 'About 60 seconds', title: 'Tell us what’s wrong', body: 'Answer three quick questions online, or call or WhatsApp us.', you: 'A few taps and your number.' },
  { when: `${BUSINESS.responseTime.charAt(0).toUpperCase()}${BUSINESS.responseTime.slice(1)}`, title: 'A consultant calls you', body: 'We listen, ask a few questions and explain what we can see in your situation.', you: 'Tell us what happened, honestly.' },
  { when: 'With your consent', title: 'We check your credit record', body: 'We get your credit report and go through every listing with you.', you: 'Your ID and your go-ahead.' },
  { when: 'Before any work starts', title: 'You get a plan and a quote', body: 'What we can do, what we can’t, roughly how long it may take, and what it costs.', you: 'Decide. There’s no obligation.' },
  { when: 'Until there’s an outcome', title: 'We do the work, you see the result', body: 'Disputes, letters and applications, followed up until there’s an answer. Then we show you your updated record.', you: 'Send documents when we ask.' },
]

const NEEDS = [
  { icon: IdCard, title: 'Your ID', body: 'A clear copy is fine. We need it to request your credit report.' },
  { icon: ShieldCheck, title: 'Your consent', body: 'We only check your record with your permission.' },
  { icon: FolderOpen, title: 'Your paperwork', body: 'Letters, court papers, statements or proof of payment, if you have them.' },
  { icon: MessageCircle, title: 'Honest answers', body: 'The full picture helps us give you the right advice.' },
]

const WILL = [
  'Tell you straight, even when the answer is no.',
  'Explain every step in plain language.',
  'Give you a quote before any work starts.',
  'Keep you updated until there’s an outcome.',
]
const WONT = [
  'Promise to remove accurate information.',
  'Guarantee you’ll be approved for credit.',
  'Start work without your go-ahead.',
  'Sell your details.',
]

const FAQS: QA[] = [
  ['How long does the whole process take?', 'It depends on what’s on your record. A dispute with a credit bureau can be answered within weeks, while a court process takes longer. We give you a realistic timeline at your assessment.'],
  ['Do I have to come to the office?', 'No. You can deal with us by phone and WhatsApp, or visit our office in Bethal if you prefer.'],
  ['Is the assessment really free?', 'Yes. The assessment and your first consultation are free, with no obligation to go ahead.'],
  ['Will checking my credit report affect my score?', 'No. Checking your own record doesn’t count against you. Applications for credit are what lenders see.'],
  ['Can you guarantee my listing will be removed?', 'No one honestly can. Accurate information can stay on your record for its legal period. We tell you upfront what’s possible in your case.'],
]

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)

  // The page's one scroll moment: the timeline fills red → green and each stage lights up as you reach it.
  usePageMotion(ref, (mm, q) => {
    mm.add(MOTION_OK, () => {
      const root = ref.current
      const line = q('.how-line')[0]
      const fill = q('.how-line__fill')[0]
      if (!root || !line || !fill) return undefined
      root.classList.add('how-anim')
      gsap.fromTo(fill, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: line, start: 'top 65%', end: 'bottom 65%', scrub: 0.6 } })
      const triggers = q('.how-stage').map((st) => ScrollTrigger.create({ trigger: st, start: 'top 65%', onEnter: () => st.classList.add('is-on'), onLeaveBack: () => st.classList.remove('is-on') }))
      return () => { root.classList.remove('how-anim'); triggers.forEach((t) => t.kill()) }
    })
  })

  return (
    <div ref={ref} className="svc-page how-page">
      <Seo title={TITLE} description={DESCRIPTION} path="/how-it-works" jsonLd={[breadcrumbLd([{ name: 'How it works', path: '/how-it-works' }]), faqJsonLd(FAQS)]} />

      <PageHero
        className="svc-hero"
        lines={[{ text: 'Clear steps.' }, { text: 'No surprises.', accent: true }]}
        lede="Here’s what happens from the moment you ask for help to the day we show you your updated record."
        actions={(
          <>
            <Link to={ASSESS_PATH} className="btn btn--red btn--lg" onClick={() => track('cta_click', { placement: 'how-hero' })}>
              Start free assessment<ArrowRight size={20} aria-hidden="true" />
            </Link>
            <a href={waLink('Hi Truemarc, I’d like to know how your process works.')} target="_blank" rel="noopener" className="btn btn--ghost btn--lg" onClick={() => track('click_whatsapp', { placement: 'how-hero' })}>
              <WhatsAppIcon size={20} />WhatsApp us
            </a>
          </>
        )}
        fine={<>Free · No obligation · Call back {BUSINESS.responseTime}</>}
        visual={<HowVisual />}
        crumbs={[{ to: '/how-it-works', label: 'How it works' }]}
      />

      <section className="sec how-steps" aria-labelledby="stages-title">
        <div className="wrap">
          <SecHead id="stages-title" title="Five steps, start to finish." intro="What we do, what you do, and when." />
          <div className="how-line">
            <span className="how-line__track" aria-hidden="true"><span className="how-line__fill" /></span>
            <ol className="how-line__list">
              {STAGES.map((st, i) => (
                <li className="how-stage" key={st.title}>
                  <span className="how-stage__dot" aria-hidden="true">{i === STAGES.length - 1 ? <Check size={20} strokeWidth={3} /> : i + 1}</span>
                  <p className="how-stage__when">{st.when}</p>
                  <div className="how-stage__body">
                    <h3>{st.title}</h3>
                    <p>{st.body}</p>
                    <p className="how-stage__you"><b>From you:</b> {st.you}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="sec sec--mist how-needs" aria-labelledby="needs-title">
        <div className="wrap">
          <SecHead id="needs-title" title="What we need from you." intro="Four things. If something’s missing, we help you get it." />
          <ul className="how-needs__grid">
            {NEEDS.map(({ icon: I, title, body }) => (
              <li key={title} className="how-need" data-reveal>
                <span className="how-need__icon"><I size={24} strokeWidth={1.7} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sec sec--night how-promise" aria-labelledby="promise-title">
        <div className="wrap">
          <SecHead id="promise-title" title="Straight talk, from day one." intro="How long it takes depends on the listing, the creditor, the bureau and sometimes the court. You get a realistic timeline at your assessment." />
          <div className="how-promise__grid">
            <div className="how-promise__col how-promise__col--will" data-reveal>
              <h3>We will</h3>
              <ul>{WILL.map((w) => <li key={w}><span aria-hidden="true"><Check size={16} strokeWidth={3} /></span>{w}</li>)}</ul>
            </div>
            <div className="how-promise__col how-promise__col--wont" data-reveal>
              <h3>We won’t</h3>
              <ul>{WONT.map((w) => <li key={w}><span aria-hidden="true"><Minus size={16} strokeWidth={3} /></span>{w}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section className="sec how-cost" aria-labelledby="cost-title">
        <div className="wrap how-cost__grid">
          <div data-reveal>
            <h2 id="cost-title" className="h2">A clear quote before any work starts.</h2>
            <p className="how-cost__lede">Your assessment is free. If we can help, we explain the work and what it costs upfront, and you decide.</p>
            <Link to={ASSESS_PATH} className="btn btn--red btn--lg" onClick={() => track('cta_click', { placement: 'how-cost' })}>
              Start free assessment<ArrowRight size={20} aria-hidden="true" />
            </Link>
          </div>
          <div className="how-quote" data-reveal aria-label="How costs work">
            <div className="how-quote__core">
              <p className="how-quote__title">How costs work</p>
              <dl>
                <div><dt>Your assessment</dt><dd className="how-quote__free">Free</dd></div>
                <div><dt>Your plan</dt><dd>Explained first</dd></div>
                <div><dt>The cost</dt><dd>Quoted upfront</dd></div>
                <div><dt>Your decision</dt><dd>No obligation</dd></div>
              </dl>
              <p className="how-quote__foot"><Check size={16} strokeWidth={3} aria-hidden="true" />Nothing starts until you say yes.</p>
            </div>
          </div>
        </div>
      </section>

      <Faq items={FAQS} id="how-faq-title" />
      <CtaBlock source="how-it-works" title={<>Ready for step one?<br />It takes 60 seconds.</>} />
    </div>
  )
}
