import { Link, useLocation } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Logo } from '@/components/brand/Brand'
import { WhatsAppIcon } from '@/components/Icon'
import { ASSESS_PATH, BUSINESS, SERVICES, waLink } from '@/lib/site'
import { track } from '@/lib/leads'
import { ariaCurrent } from './nav'

const COMPANY = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/about', label: 'About Truemarc' },
  { to: '/learn', label: 'Learn' },
  { to: '/contact', label: 'Contact' },
  { to: '/services/labour-relations', label: 'Labour relations' },
  { to: '/services/general-consulting', label: 'General consulting' },
]

export default function Footer() {
  const { pathname } = useLocation()
  const a = BUSINESS.address
  // The mobile quick-contact bar floats over the bottom of the page everywhere except the assessment page.
  const withBar = pathname !== ASSESS_PATH
  return (
    <footer className={`foot${withBar ? ' foot--bar' : ''}`}>
      <div className="wrap">
        <div className="foot__top">
          <div className="foot__intro">
            <Logo tone="light" height={52} className="foot__logo" />
            <p>Credit repair, debt review and blacklisting help for South Africans since {BUSINESS.founded}.</p>
            <Link to={ASSESS_PATH} className="btn btn--red" onClick={() => track('cta_click', { placement: 'footer' })}>Start a free assessment</Link>
          </div>
          <div className="foot__cols">
            <div>
              <h2>Services</h2>
              <ul>
                {SERVICES.filter((s) => s.group === 'credit').map((s) => {
                  const to = `/services/${s.slug}`
                  return <li key={s.slug}><Link to={to} aria-current={ariaCurrent(pathname, to)}>{s.name}</Link></li>
                })}
              </ul>
            </div>
            <div>
              <h2>Company</h2>
              <ul>
                {COMPANY.map((l) => <li key={l.to}><Link to={l.to} aria-current={ariaCurrent(pathname, l.to)}>{l.label}</Link></li>)}
              </ul>
            </div>
            <div>
              <h2>Talk to us</h2>
              <ul className="foot__contact">
                {BUSINESS.phones.map((p) => (
                  <li key={p.tel}><a href={`tel:${p.tel}`} onClick={() => track('click_call', { placement: 'footer' })}><Phone size={16} aria-hidden="true" />{p.label}</a></li>
                ))}
                <li><a href={waLink()} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'footer' })}><WhatsAppIcon size={16} />WhatsApp</a></li>
                <li><a href={`mailto:${BUSINESS.email}`}><Mail size={16} aria-hidden="true" />{BUSINESS.email}</a></li>
                <li><span><MapPin size={16} aria-hidden="true" />{a.line1}, {a.street}, {a.town} {a.postcode}</span></li>
              </ul>
              <p className="foot__hours">{BUSINESS.hours.map((h) => h.short).join(' · ')}</p>
            </div>
          </div>
        </div>
        <p className="foot__tagline" aria-hidden="true">{BUSINESS.tagline}</p>
        <div className="foot__bottom">
          {/* The year is baked in at build time; suppress the mismatch warning if a visitor's clock is in a new year. */}
          <p>© <span suppressHydrationWarning>{new Date().getFullYear()}</span> {BUSINESS.name}. All rights reserved.</p>
          <nav aria-label="Legal">
            <Link to="/privacy" aria-current={ariaCurrent(pathname, '/privacy')}>Privacy notice</Link>
            <Link to="/terms" aria-current={ariaCurrent(pathname, '/terms')}>Terms of use</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
