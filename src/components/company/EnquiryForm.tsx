import '@/styles/pages/company.css'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Loader2, Lock, Phone, RotateCcw } from 'lucide-react'
import { WhatsAppIcon } from '@/components/Icon'
import { BUSINESS, PRIMARY_PHONE, waLink } from '@/lib/site'
import { maskPhone, normalizeZaPhone, submitLead, track } from '@/lib/leads'

/**
 * General enquiry form (Contact page). Posts through submitLead with source "contact".
 * Failure falls back to a pre-filled WhatsApp message, like the assessment does.
 */
type Status = 'idle' | 'sending' | 'done' | 'error'
type Fields = { firstName: string; phone: string; email: string; message: string; consent: boolean }

const EMPTY: Fields = { firstName: '', phone: '', email: '', message: '', consent: false }
const MAX = 1000

export default function EnquiryForm({ source = 'contact' }: { source?: string }) {
  const uid = useId()
  const [f, setF] = useState<Fields>(EMPTY)
  const [honey, setHoney] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const [status, setStatus] = useState<Status>('idle')
  const headRef = useRef<HTMLHeadingElement>(null)
  const started = useRef(false)
  const changed = useRef(false)

  useEffect(() => {
    if (changed.current && status !== 'idle' && status !== 'sending') headRef.current?.focus({ preventScroll: false })
  }, [status])

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    if (!started.current) { started.current = true; track('form_start', { source }) }
    setF((cur) => ({ ...cur, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const validate = () => {
    const e: Partial<Record<keyof Fields, string>> = {}
    if (f.firstName.trim().length < 2) e.firstName = 'Please enter your first name.'
    if (!normalizeZaPhone(f.phone)) e.phone = 'Please enter a valid South African number, e.g. 061 234 5678.'
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'That email doesn’t look right.'
    if (f.message.trim().length < 10) e.message = 'Please tell us a little more, so the right consultant calls you.'
    if (!f.consent) e.consent = 'Please agree so we can contact you.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const form = ev.currentTarget
    if (!validate()) {
      // Wait for the error attributes to render, then focus the first problem.
      window.setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    changed.current = true
    if (honey) { setStatus('done'); return } // bot: pretend it worked
    setStatus('sending')
    try {
      await submitLead({
        firstName: f.firstName.trim(),
        phone: normalizeZaPhone(f.phone)!,
        email: f.email.trim() || undefined,
        message: f.message.trim().slice(0, MAX),
        consent: f.consent,
        source,
        website: honey,
      })
      setStatus('done')
    } catch {
      setStatus('error')
      track('lead_error', { source })
    }
  }

  const phone = normalizeZaPhone(f.phone)
  const name = f.firstName.trim()
  const waText = `Hi Truemarc, I'm ${name || 'getting in touch'}. ${f.message.trim().slice(0, 600)}${phone ? ` Please contact me on ${maskPhone(phone)}.` : ''}`

  if (status === 'done') {
    return (
      <div className="co-form co-form--done" aria-live="polite">
        <span className="co-form__done-icon"><Check size={28} strokeWidth={3} aria-hidden="true" /></span>
        <h3 className="co-form__title" tabIndex={-1} ref={headRef}>Thanks{name ? `, ${name}` : ''}. Message received.</h3>
        <p className="co-form__lead">
          A consultant will get back to you {BUSINESS.responseTime}{phone ? <> on <b className="num">{maskPhone(phone)}</b></> : null}.
        </p>
        <a className="btn btn--wa btn--block" href={waLink(waText)} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'contact-done' })}>
          <WhatsAppIcon size={20} />Need it sooner? WhatsApp us
        </a>
        <button type="button" className="co-form__reset" onClick={() => { setF(EMPTY); setErrors({}); setStatus('idle') }}>
          Send another message
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="co-form co-form--error" aria-live="assertive">
        <h3 className="co-form__title" tabIndex={-1} ref={headRef}>That didn’t go through.</h3>
        <p className="co-form__lead">Your message is still here. Send it on WhatsApp in one tap, or call us.</p>
        <div className="co-form__stack">
          <a className="btn btn--wa btn--lg btn--block" href={waLink(waText)} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'contact-error' })}>
            <WhatsAppIcon size={20} />Send on WhatsApp
          </a>
          <a className="btn btn--line btn--block" href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: 'contact-error' })}>
            <Phone size={18} aria-hidden="true" />Call {PRIMARY_PHONE.label}
          </a>
          <button type="button" className="co-form__reset" onClick={() => setStatus('idle')}>
            <RotateCcw size={16} aria-hidden="true" />Try again
          </button>
        </div>
      </div>
    )
  }

  const err = (k: keyof Fields) => errors[k] && <p className="co-field__err" id={`${uid}-${k}-err`}>{errors[k]}</p>
  const aria = (k: keyof Fields) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined })

  return (
    <form className="co-form" onSubmit={submit} noValidate aria-labelledby={`${uid}-title`}>
      <h3 className="sr-only" id={`${uid}-title`}>Send us a message</h3>
      <div className="co-form__row">
        <div className="co-field">
          <label htmlFor={`${uid}-name`}>First name</label>
          <input id={`${uid}-name`} name="firstName" autoComplete="given-name" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} {...aria('firstName')} />
          {err('firstName')}
        </div>
        <div className="co-field">
          <label htmlFor={`${uid}-phone`}>Mobile number</label>
          <input id={`${uid}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="061 234 5678" value={f.phone} onChange={(e) => set('phone', e.target.value)} {...aria('phone')} />
          {err('phone')}
        </div>
      </div>
      <div className="co-field">
        <label htmlFor={`${uid}-email`}>Email <span className="co-field__opt">(optional)</span></label>
        <input id={`${uid}-email`} name="email" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} {...aria('email')} />
        {err('email')}
      </div>
      <div className="co-field">
        <label htmlFor={`${uid}-msg`}>How can we help?</label>
        <textarea id={`${uid}-msg`} name="message" rows={5} maxLength={MAX} value={f.message} onChange={(e) => set('message', e.target.value)} {...aria('message')} />
        {err('message')}
      </div>
      <div className="co-hp" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
      </div>
      <div>
        <label className={`co-check${errors.consent ? ' co-check--err' : ''}`}>
          <input type="checkbox" name="consent" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} {...aria('consent')} />
          <span>Truemarc may contact me about my enquiry. <Link to="/privacy">Privacy notice</Link></span>
        </label>
        {err('consent')}
      </div>
      <button type="submit" className="btn btn--red btn--lg btn--block co-form__submit" disabled={status === 'sending'}>
        {status === 'sending'
          ? <><Loader2 size={20} className="spin" aria-hidden="true" />Sending…</>
          : <>Send message<ArrowRight size={20} aria-hidden="true" /></>}
      </button>
      <p className="co-form__private"><Lock size={14} aria-hidden="true" />Your details stay private. We never sell them.</p>
    </form>
  )
}
