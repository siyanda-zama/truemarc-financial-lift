import { useEffect, useState } from 'react'
import { Clock, MapPin, Phone } from 'lucide-react'
import { WhatsAppIcon } from '@/components/Icon'
import { BUSINESS, PRIMARY_PHONE, waLink } from '@/lib/site'
import { track } from '@/lib/leads'

type Open = { open: boolean; until?: string } | null

/** Is the Bethal office open right now (South African time)? Client only, so it never mismatches the prerender. */
function officeStatus(now = new Date()): Open {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Johannesburg', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    const day = get('weekday')
    const mins = Number(get('hour')) * 60 + Number(get('minute'))
    const slot = day === 'Sun' ? BUSINESS.hours[2] : day === 'Sat' ? BUSINESS.hours[1] : BUSINESS.hours[0]
    if (!slot.open || !slot.close) return { open: false }
    const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
    return mins >= toMin(slot.open) && mins < toMin(slot.close) ? { open: true, until: slot.close } : { open: false }
  } catch {
    return null
  }
}

/** The human moment: brand tagline over a team photo, and every real way to reach a person. */
export default function HomeTalk() {
  const [status, setStatus] = useState<Open>(null)
  useEffect(() => {
    setStatus(officeStatus())
    const t = window.setInterval(() => setStatus(officeStatus()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const a = BUSINESS.address

  return (
    <section className="home-talk" aria-labelledby="talk-title">
      <div className="home-talk__media">
        <img
          data-parallax
          src="/img/team-hero.webp"
          srcSet="/img/team-hero-960.webp 960w, /img/team-hero.webp 1920w"
          sizes="100vw"
          alt="Consultants talking with clients around a table"
          width={1920}
          height={1080}
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="wrap home-talk__inner">
        <div className="home-talk__copy">
          <p className="home-talk__tagline">{BUSINESS.tagline}</p>
          <h2 id="talk-title" className="h2">Talk to someone who’s seen it all before.</h2>
          <p className="home-talk__lede">
            Since {BUSINESS.founded} we’ve helped {BUSINESS.clientsHelped} people who were told no. No judgement, no jargon.
          </p>
        </div>
        <div className="home-talk__panel" data-reveal>
          <ul className="home-talk__ways">
            <li>
              <a href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: 'home-talk' })}>
                <span className="home-talk__icon"><Phone size={20} aria-hidden="true" /></span>
                <span><small>Call a consultant</small><b>{PRIMARY_PHONE.label}</b></span>
              </a>
            </li>
            <li>
              <a href={waLink('Hi Truemarc, I’d like to speak to a consultant about my credit record.')} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'home-talk' })}>
                <span className="home-talk__icon home-talk__icon--wa"><WhatsAppIcon size={20} /></span>
                <span><small>WhatsApp</small><b>Chat to us</b></span>
              </a>
            </li>
            <li>
              <span className="home-talk__visit">
                <span className="home-talk__icon"><MapPin size={20} aria-hidden="true" /></span>
                <span><small>Visit us in {a.town}</small><b>{a.line1}, {a.street}</b></span>
              </span>
            </li>
          </ul>
          <p className="home-talk__hours">
            <Clock size={18} aria-hidden="true" />
            <span>
              {status && (
                <b className="home-talk__now">
                  {status.open ? `Open now, until ${status.until}.` : 'Closed right now. Leave your details and we’ll call you.'}
                </b>
              )}
              <span>{BUSINESS.hours[0].short} · {BUSINESS.hours[1].short}</span>
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
