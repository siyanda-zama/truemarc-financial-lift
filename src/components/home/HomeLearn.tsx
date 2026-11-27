import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { GoLink } from '@/components/blocks/Blocks'
import { ARTICLES } from '@/content/articles'
import { GUIDE_SLUGS } from './content'

const GUIDES = GUIDE_SLUGS.map((slug) => ARTICLES.find((a) => a.slug === slug)).filter((a): a is (typeof ARTICLES)[number] => !!a)

/** Three guides that match what people search for: blacklisted, judgment removal, leaving debt review. */
export default function HomeLearn() {
  if (!GUIDES.length) return null
  return (
    <section className="sec sec--mist home-learn" aria-labelledby="learn-title">
      <div className="wrap">
        <div className="home-learn__head" data-reveal>
          <h2 id="learn-title" className="h2">Know where you stand before you apply.</h2>
          <GoLink to="/learn">All credit guides</GoLink>
        </div>
        <ul className="home-learn__grid">
          {GUIDES.map((g, i) => (
            <li key={g.slug} className={i === 0 ? 'home-learn__lead' : undefined} data-reveal>
              <Link to={`/learn/${g.slug}`} className="home-learn__card">
                {i === 0 && <span className="home-learn__badge" aria-hidden="true"><BookOpen size={22} strokeWidth={1.8} /></span>}
                <span className="home-learn__meta">{g.minutes} min read</span>
                <h3>{g.title}</h3>
                {i === 0 && g.description && <p>{g.description}</p>}
                <span className="home-learn__go">Read the guide<ArrowRight size={18} aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
