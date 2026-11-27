import '@/styles/pages/learn.css'
import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronDown, Clock, Info } from 'lucide-react'
import Seo from '@/components/Seo'
import Icon from '@/components/Icon'
import { CtaBlock } from '@/components/blocks/Blocks'
import NotFound from '@/pages/NotFound'
import { useActiveSection } from '@/components/company/useActiveSection'
import { ARTICLES, articleBySlug, type Article as ArticleT, type ArticleBlock } from '@/content/articles'
import { articleLd, breadcrumbLd } from '@/lib/schema'
import { serviceBySlug, type Service } from '@/lib/site'
import { track } from '@/lib/leads'
import { usePageMotion } from '@/lib/motion'
import { ArticleCard, fmtDate, inline, sectionsOf } from './ArticleParts'

export default function Article() {
  const { slug = '' } = useParams()
  const article = articleBySlug(slug)
  if (!article || !article.body.length) return <NotFound />
  return <ArticleView key={article.slug} a={article} />
}

function Block({ b, svc }: { b: ArticleBlock; svc?: Service }) {
  switch (b.type) {
    case 'p':
      return <p>{inline(b.text)}</p>
    case 'list': {
      const L = b.ordered ? 'ol' : 'ul'
      return <L className={b.ordered ? 'learn-ol' : 'learn-ul'}>{b.items.map((t) => <li key={t}>{inline(t)}</li>)}</L>
    }
    case 'callout':
      return (
        <aside className="learn-callout">
          <Info size={22} aria-hidden="true" className="learn-callout__icon" />
          <div>
            {b.title && <p className="learn-callout__title">{b.title}</p>}
            <p>{inline(b.text)}</p>
          </div>
        </aside>
      )
    case 'cta':
      return (
        <aside className="learn-cta" aria-label="Get help">
          <p className="learn-cta__text">{inline(b.text)}</p>
          <div className="learn-cta__actions">
            <a href="#start" className="btn btn--red" onClick={() => track('cta_click', { placement: 'article-mid' })}>Start my free assessment<ArrowRight size={18} aria-hidden="true" /></a>
            {svc && <Link to={`/services/${svc.slug}`} className="learn-cta__link">How we help: {svc.name}</Link>}
          </div>
        </aside>
      )
    default:
      return null
  }
}

function related(a: ArticleT) {
  const others = ARTICLES.filter((x) => x.slug !== a.slug && x.body.length)
  const same = others.filter((x) => x.service === a.service)
  return [...same, ...others.filter((x) => x.service !== a.service)].slice(0, 3)
}

function ArticleView({ a }: { a: ArticleT }) {
  const root = useRef<HTMLDivElement>(null)
  usePageMotion(root)
  const svc = serviceBySlug(a.service)
  const path = `/learn/${a.slug}`
  const sections = sectionsOf(a.body)
  const toc = sections.filter((s): s is typeof s & { id: string; title: string } => !!s.id && !!s.title)
  const active = useActiveSection(toc.map((s) => s.id))
  const updated = a.updated ?? a.published

  const tocLinks = (
    <ol>
      {toc.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className={active === s.id ? 'is-active' : undefined} aria-current={active === s.id ? 'true' : undefined}>{s.title}</a>
        </li>
      ))}
    </ol>
  )

  const serviceCard = svc && (
    <div className="learn-svc">
      <span className="learn-svc__icon"><Icon name={svc.icon} size={22} strokeWidth={1.8} /></span>
      <p className="learn-svc__name">{svc.name}</p>
      <p className="learn-svc__short">{svc.short}</p>
      <Link to={`/services/${svc.slug}`} className="btn btn--navy btn--block" onClick={() => track('cta_click', { placement: 'article-service-card' })}>How we help<ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
  )

  return (
    <div ref={root} className="learn-page">
      <Seo
        title={a.title}
        description={a.description}
        path={path}
        type="article"
        published={a.published}
        modified={updated}
        jsonLd={[
          articleLd({ title: a.title, description: a.description, path, datePublished: a.published, dateModified: updated }),
          breadcrumbLd([{ name: 'Learn', path: '/learn' }, { name: a.title, path }]),
        ]}
      />

      <header className="learn-head">
        <div className="wrap learn-head__inner">
          <nav className="learn-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/learn">Learn</Link></li>
              <li><span aria-current="page">{a.title}</span></li>
            </ol>
          </nav>
          <h1 className="learn-head__title">{a.title}</h1>
          <p className="learn-head__lede">{a.description}</p>
          <p className="learn-meta">
            <span><Clock size={16} aria-hidden="true" />{a.minutes} min read</span>
            <span><CalendarDays size={16} aria-hidden="true" />Updated <time dateTime={updated}>{fmtDate(updated)}</time></span>
          </p>
        </div>
      </header>

      <div className="wrap learn-layout">
        <aside className="learn-aside">
          <nav className="learn-toc" aria-label="Contents">{tocLinks}</nav>
        </aside>

        <article className="learn-body">
          <details className="learn-toc-m">
            <summary>Contents<ChevronDown size={18} aria-hidden="true" /></summary>
            <nav aria-label="Contents">{tocLinks}</nav>
          </details>

          {sections.map((s, i) => (
            s.id ? (
              <section key={s.id} id={s.id} className="learn-sec" aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`}>{s.title}</h2>
                {s.blocks.map((b, j) => <Block key={j} b={b} svc={svc} />)}
              </section>
            ) : (
              <div key={`intro-${i}`} className="learn-intro">
                {s.blocks.map((b, j) => <Block key={j} b={b} svc={svc} />)}
              </div>
            )
          ))}

          <div className="learn-rail-m">{serviceCard}</div>

          <footer className="learn-foot">
            {a.sources && a.sources.length > 0 && (
              <>
                <h2 className="learn-foot__title">Sources</h2>
                <ul>
                  {a.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener">{s.label}</a></li>)}
                </ul>
              </>
            )}
            <p className="learn-foot__note">This guide is general information about South African law and credit bureau practice, not legal advice. Every situation is different, so <Link to="/contact">talk to us</Link> about yours.</p>
          </footer>
        </article>

        <aside className="learn-rail">{serviceCard}</aside>
      </div>

      <section className="sec sec--mist learn-related" aria-labelledby="related-title">
        <div className="wrap">
          <div className="learn-related__head">
            <h2 id="related-title" className="h2">Keep reading.</h2>
            <Link to="/learn" className="go">All guides<ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="learn-grid learn-grid--3">
            {related(a).map((r) => <ArticleCard key={r.slug} a={r} />)}
          </div>
        </div>
      </section>

      <CtaBlock
        source={`learn:${a.slug}`}
        preset={svc?.situation}
        title={<>Want a straight answer<br />about your record?</>}
      />
    </div>
  )
}
