import '@/styles/pages/learn.css'
import { useRef } from 'react'
import Seo from '@/components/Seo'
import { CtaBlock, PageHero } from '@/components/blocks/Blocks'
import { ARTICLES } from '@/content/articles'
import { breadcrumbLd } from '@/lib/schema'
import { SITE_URL } from '@/lib/site'
import { usePageMotion } from '@/lib/motion'
import { ArticleCard } from './ArticleParts'

// Guides grouped by the problem people search for. DRAFT COPY: headings need client approval.
const GROUPS = [
  { id: 'where-you-stand', title: 'Not sure what’s on your record?', slugs: ['am-i-blacklisted', 'how-to-improve-your-credit-score'] },
  { id: 'holding-you-back', title: 'Something on your record holding you back?', slugs: ['what-is-a-default-listing', 'how-to-remove-a-judgment', 'how-to-get-out-of-debt-review', 'fraud-listing-on-my-name'] },
]

const DESCRIPTION = 'Plain-language guides to South African credit records: checking if you’re blacklisted, defaults, judgments, debt review, fraud listings and your score.'

export default function LearnHub() {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root)
  const live = ARTICLES.filter((a) => a.body.length)

  return (
    <div ref={root}>
      <Seo
        title="Credit guides for South Africans"
        description={DESCRIPTION}
        path="/learn"
        jsonLd={[
          breadcrumbLd([{ name: 'Learn', path: '/learn' }]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Credit guides for South Africans',
            url: `${SITE_URL}/learn`,
            description: DESCRIPTION,
            hasPart: live.map((a) => ({ '@type': 'Article', headline: a.title, url: `${SITE_URL}/learn/${a.slug}` })),
          },
        ]}
      />

      <PageHero
        id="learn-title"
        crumbs={[{ to: '/learn', label: 'Learn' }]}
        lines={[{ text: 'Credit questions,' }, { text: 'answered plainly.', accent: true }]}
        lede="Short, practical guides to credit records, judgments, debt review and fraud in South Africa, without the jargon."
      />

      <section className="sec learn-hub" aria-label="Guides">
        <div className="wrap">
          {GROUPS.map((g) => {
            const items = g.slugs.map((s) => live.find((a) => a.slug === s)).filter((a): a is (typeof live)[number] => !!a)
            if (!items.length) return null
            return (
              <div key={g.id} className="learn-hub__group" aria-labelledby={`${g.id}-title`} role="group">
                <h2 id={`${g.id}-title`} className="h2 learn-hub__title" data-reveal>{g.title}</h2>
                <div className="learn-grid">
                  {items.map((a) => <ArticleCard key={a.slug} a={a} />)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <CtaBlock source="learn" title={<>Rather talk it through<br />with a consultant?</>} />
    </div>
  )
}
