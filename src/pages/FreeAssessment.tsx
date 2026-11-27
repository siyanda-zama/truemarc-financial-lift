import '@/styles/pages/company.css'
import { useRef } from 'react'
import { BadgeCheck, Handshake, Lock } from 'lucide-react'
import Seo from '@/components/Seo'
import Assessment from '@/components/assessment/Assessment'
import { Faq, faqJsonLd, TrustRow, type QA } from '@/components/blocks/Blocks'
import { Ring } from '@/components/brand/Brand'
import { breadcrumbLd } from '@/lib/schema'
import { BUSINESS } from '@/lib/site'
import { usePageMotion } from '@/lib/motion'

// Paid-ads landing page. Distraction-light: one promise, the assessment, reassurance, a short FAQ.
// DRAFT COPY: headline, points and FAQ answers need client approval.

const POINTS = [
  { icon: BadgeCheck, title: 'Free', body: 'The assessment and your first call cost nothing.' },
  { icon: Handshake, title: 'No obligation', body: 'You decide if and when to go ahead.' },
  { icon: Lock, title: 'Private', body: 'Used only to help you. Never sold.' },
]

const FAQ: QA[] = [
  ['Is the assessment really free?', 'Yes. The assessment and the call that follows are free, and there’s no obligation to use our services afterwards.'],
  ['What happens after I send my details?', `A consultant calls you ${BUSINESS.responseTime} to understand your situation. If you want to go ahead, we check what’s listed on your credit record and give you a clear plan and quote.`],
  ['Will this affect my credit score?', 'No. The assessment isn’t a credit application, so it isn’t recorded as an enquiry on your credit record.'],
  ['Can you guarantee a listing will be removed?', 'No one can honestly promise that. Accurate, up-to-date information is allowed to stay on your record. We check every listing, challenge what’s wrong or outdated, and tell you upfront what’s realistic.'],
  ['Is my information safe?', 'We only use your details to contact you about your credit profile, and we never sell them. Our privacy notice explains how we look after them.'],
]

const DESCRIPTION = 'Declined for credit? Answer three quick questions and a Truemarc consultant calls you within 24 hours with a clear plan. Free, private, no obligation.'

export default function FreeAssessment() {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root)

  return (
    <div ref={root}>
      <Seo
        title="Free credit assessment"
        description={DESCRIPTION}
        path="/free-assessment"
        jsonLd={[breadcrumbLd([{ name: 'Free assessment', path: '/free-assessment' }]), faqJsonLd(FAQ)]}
      />

      <section className="co-fa" aria-labelledby="fa-title">
        <Ring className="co-fa__ring" swoosh={false} stroke="rgba(255,255,255,0.07)" width={2} />
        <div className="wrap co-fa__grid">
          <div className="co-fa__head">
            <h1 id="fa-title" className="co-fa__title">See what’s holding <span>your credit back.</span></h1>
            <p className="co-fa__lede">Three quick questions. A consultant calls you {BUSINESS.responseTime} with a clear plan.</p>
          </div>
          <div className="co-fa__form">
            <Assessment variant="page" source="free-assessment" />
          </div>
          <ul className="co-fa__points">
            {POINTS.map(({ icon: I, title, body }) => (
              <li key={title}>
                <span className="co-fa__icon"><I size={22} strokeWidth={1.9} aria-hidden="true" /></span>
                <span><b>{title}</b><small>{body}</small></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sec--tight co-fa-trust" aria-label="Why people choose Truemarc">
        <div className="wrap"><TrustRow /></div>
      </section>

      <Faq items={FAQ} id="fa-faq" title="Before you start." />
    </div>
  )
}
