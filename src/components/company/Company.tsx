import '@/styles/pages/company.css'
import { ArrowUpRight, Mail, MapPin, Navigation, Phone } from 'lucide-react'
import { WhatsAppIcon } from '@/components/Icon'
import { BUSINESS, waLink } from '@/lib/site'
import { track } from '@/lib/leads'
import { directionsUrl, hoursRows, useOpenStatus } from './hours'

// Shared building blocks for the company pages (About, Contact, Free assessment, 404).

const WA_TEXT = 'Hi Truemarc, I need help with my credit record.'

/** Every way to reach us, as big tap targets. */
export function ContactChannels({ placement, tone = 'light', email = true, compact = false }: {
  placement: string
  tone?: 'light' | 'dark'
  email?: boolean
  compact?: boolean
}) {
  return (
    <ul className={`co-channels co-channels--${tone}${compact ? ' co-channels--compact' : ''}`}>
      {BUSINESS.phones.map((p) => (
        <li key={p.tel}>
          <a href={`tel:${p.tel}`} className="co-channel" onClick={() => track('click_call', { placement, number: p.label })}>
            <span className="co-channel__icon"><Phone size={20} aria-hidden="true" /></span>
            <span className="co-channel__text"><small>Call</small><b className="num">{p.label}</b></span>
            <ArrowUpRight className="co-channel__go" size={20} aria-hidden="true" />
          </a>
        </li>
      ))}
      <li>
        <a href={waLink(WA_TEXT)} target="_blank" rel="noopener" className="co-channel co-channel--wa" onClick={() => track('click_whatsapp', { placement })}>
          <span className="co-channel__icon"><WhatsAppIcon size={20} /></span>
          <span className="co-channel__text"><small>WhatsApp</small><b>Chat to a consultant</b></span>
          <ArrowUpRight className="co-channel__go" size={20} aria-hidden="true" />
        </a>
      </li>
      {email && (
        <li>
          <a href={`mailto:${BUSINESS.email}`} className="co-channel" onClick={() => track('click_email', { placement })}>
            <span className="co-channel__icon"><Mail size={20} aria-hidden="true" /></span>
            <span className="co-channel__text"><small>Email</small><b className="co-channel__email">{BUSINESS.email}</b></span>
            <ArrowUpRight className="co-channel__go" size={20} aria-hidden="true" />
          </a>
        </li>
      )}
    </ul>
  )
}

/** "Open now / Closed" pill. Neutral until mounted (SSR-safe). */
export function OpenBadge({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const status = useOpenStatus()
  const state = status ? (status.open ? ' co-open--on' : ' co-open--off') : ''
  return (
    <p className={`co-open co-open--${tone}${state}`} aria-live="polite">
      <span className="co-open__dot" aria-hidden="true" />
      {status ? status.label : BUSINESS.hours.filter((h) => h.open).map((h) => h.short).join(', ')}
    </p>
  )
}

/** Hours table with today's row highlighted once mounted. */
export function HoursTable({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const status = useOpenStatus()
  return (
    <dl className={`co-hours co-hours--${tone}`}>
      {hoursRows().map((r) => {
        const isToday = status ? r.days.includes(status.today) : false
        return (
          <div key={r.label} className={isToday ? 'co-hours__row co-hours__row--today' : 'co-hours__row'}>
            <dt>{r.label}{isToday && <span className="sr-only"> (today)</span>}</dt>
            <dd className="num">{r.time}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Street address as a block, with the province on its own line. */
export function Address({ className = '' }: { className?: string }) {
  const a = BUSINESS.address
  return (
    <address className={`co-address ${className}`}>
      <MapPin size={20} aria-hidden="true" />
      <span>
        {BUSINESS.name}<br />
        {a.line1}<br />
        {a.street}, {a.town} {a.postcode}<br />
        {a.province}
      </span>
    </address>
  )
}

export function DirectionsLink({ placement, className = 'btn btn--navy' }: { placement: string; className?: string }) {
  return (
    <a href={directionsUrl()} target="_blank" rel="noopener" className={className} onClick={() => track('click_directions', { placement })}>
      <Navigation size={18} aria-hidden="true" />Get directions
    </a>
  )
}
