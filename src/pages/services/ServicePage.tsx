import { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowRight, Check, Phone } from 'lucide-react'
import '@/styles/pages/services.css'
import Seo from '@/components/Seo'
import { CtaBlock, Faq, GoLink, PageHero, SecHead, Steps, faqJsonLd } from '@/components/blocks/Blocks'
import { WhatsAppIcon } from '@/components/Icon'
import ServiceVisual from '@/components/services/ServiceVisual'
import { DocsAndGuide, Intake, Outcomes, Related, TalkToUs } from '@/components/services/ServiceSections'
import { ARTICLES, articleBySlug } from '@/content/articles'
import { type ServiceContent, serviceContent } from '@/content/services'
import { BUSINESS, PRIMARY_PHONE, type Service, serviceBySlug, waLink } from '@/lib/site'
import { breadcrumbLd, serviceLd } from '@/lib/schema'
import { track } from '@/lib/leads'
import { usePageMotion } from '@/lib/motion'
import NotFound from '@/pages/NotFound'

export default function ServicePage() {
  const { slug = '' } = useParams()
  const service = serviceBySlug(slug)
  const content = serviceContent(slug)
  if (!service || !content) return <NotFound />
  // key: remount per service so the page motion re-runs when moving between services.
  return <ServiceView key={slug} service={service} content={content} />
}

function ServiceView({ service, content }: { service: Service; content: ServiceContent }) {
  const ref = useRef<HTMLDivElement>(null)
  usePageMotion(ref)

  const { slug } = service
  const path = `/services/${slug}`
  const credit = service.group === 'credit'
  const guide = ARTICLES.find((a) => a.service === slug) ?? (content.guide ? articleBySlug(content.guide) : undefined)
  const lower = service.name.toLowerCase()
  const wa = waLink(`Hi Truemarc, I need help with ${lower}.`)

  const jsonLd = [
    serviceLd({ name: service.name, description: content.seoDescription, path }),
    breadcrumbLd([{ name: 'Services', path: '/services' }, { name: service.name, path }]),
    faqJsonLd(content.faqs),
  ]

  const actions = credit ? (
    <>
      <a href="#check" className="btn btn--red btn--lg" onClick={() => track('cta_click', { placement: `service-hero:${slug}` })}>
        Start my free check<ArrowRight size={20} aria-hidden="true" />
      </a>
      <a href={wa} target="_blank" rel="noopener" className="btn btn--ghost btn--lg" onClick={() => track('click_whatsapp', { placement: `service-hero:${slug}` })}>
        <WhatsAppIcon size={20} />WhatsApp us
      </a>
    </>
  ) : (
    <>
      <a href={`tel:${PRIMARY_PHONE.tel}`} className="btn btn--red btn--lg" onClick={() => track('click_call', { placement: `service-hero:${slug}` })}>
        <Phone size={20} aria-hidden="true" />Call {PRIMARY_PHONE.label}
      </a>
      <a href={wa} target="_blank" rel="noopener" className="btn btn--ghost btn--lg" onClick={() => track('click_whatsapp', { placement: `service-hero:${slug}` })}>
        <WhatsAppIcon size={20} />WhatsApp us
      </a>
    </>
  )

  return (
    <div ref={ref} className={`svc-page svc-page--${credit ? 'credit' : 'other'}`}>
      <Seo title={content.seoTitle} description={content.seoDescription} path={path} jsonLd={jsonLd} />

      <PageHero
        className="svc-hero"
        lines={[{ text: content.h1[0] }, { text: content.h1[1], accent: true }]}
        lede={content.lede}
        actions={actions}
        fine={credit
          ? <>Free · No obligation · Call back {BUSINESS.responseTime}</>
          : <>Free first consultation · {BUSINESS.hours[0].short}</>}
        visual={<ServiceVisual kind={content.visual} />}
        crumbs={[{ to: '/services', label: 'Services' }, { to: path, label: service.name }]}
      />

      {credit ? (
        <>
          <Intake slug={slug} signs={content.signs} preset={service.situation} />

          <section className="sec sec--mist svc-steps" aria-labelledby="steps-title">
            <div className="wrap">
              <SecHead id="steps-title" title={content.stepsTitle} />
              <Steps items={content.steps} />
              <p className="svc-steps__more" data-reveal><GoLink to="/how-it-works">See the full process, start to finish</GoLink></p>
            </div>
          </section>

          {content.outcomes && <Outcomes title={content.outcomesTitle ?? 'What changes for you.'} items={content.outcomes} />}
          {content.docs && <DocsAndGuide docs={content.docs} guide={guide} />}
          <Faq items={content.faqs} id="svc-faq-title" title={<>Questions about {lower}, answered.</>} />
          <Related slugs={content.related} />
          <CtaBlock source={`service:${slug}`} preset={service.situation} {...(content.ctaTitle ? { title: content.ctaTitle } : {})} />
        </>
      ) : (
        <>
          <section className="sec svc-where" aria-labelledby="where-title">
            <div className="wrap svc-where__grid">
              <SecHead id="where-title" title="Where we can help." intro={service.short} />
              <ul className="svc-where__list">
                {content.signs.map((s) => (
                  <li key={s} data-reveal><span className="svc-signs__tick" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>{s}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="sec sec--mist svc-steps" aria-labelledby="steps-title">
            <div className="wrap">
              <SecHead id="steps-title" title={content.stepsTitle} />
              <Steps items={content.steps} />
            </div>
          </section>

          <Faq items={content.faqs} id="svc-faq-title" />
          <Related slugs={content.related} title="Other ways we help." withHub />
          <TalkToUs service={service} />
        </>
      )}
    </div>
  )
}
