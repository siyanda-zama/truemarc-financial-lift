import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react'
import '@/styles/assessment.css'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Lock, Phone, RotateCcw } from 'lucide-react'
import Icon, { WhatsAppIcon } from '@/components/Icon'
import { BUSINESS, DEBT_BANDS, GOALS, PRIMARY_PHONE, SITUATIONS, type SituationId, waLink } from '@/lib/site'
import { maskPhone, normalizeZaPhone, submitLead, track } from '@/lib/leads'
import { scrollToEl } from '@/lib/smooth'
import { assess, STEPS, type AssessState } from './store'

/**
 * The lead funnel: three one-tap questions, then name + number.
 * Used in the home hero, on /free-assessment, on service pages (with `preset`) and in CTA blocks.
 * Every instance reads one shared store (./store), so two cards on a page stay in sync and progress
 * survives navigation within the visit (sessionStorage).
 */
type Props = {
  /** Where this instance lives, sent with the lead, e.g. "home-hero", "service:debt-review". */
  source: string
  variant?: 'hero' | 'card' | 'page'
  /** Pre-answers question 1 (e.g. on a service page) and starts at question 2. */
  preset?: SituationId
  /** Override the first question's heading. */
  firstQuestion?: string
  className?: string
}

type Field = 'firstName' | 'phone' | 'email' | 'consent'
type Errors = Partial<Record<Field, string>>
const FIELDS: Field[] = ['firstName', 'phone', 'email', 'consent']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const labelOf = (list: readonly { id: string; label: string }[], id?: string) => list.find((o) => o.id === id)?.label ?? ''

function check(s: AssessState): Errors {
  const e: Errors = {}
  if (s.firstName.trim().length < 2) e.firstName = 'Please enter your first name.'
  if (!normalizeZaPhone(s.phone)) e.phone = 'Please enter a valid South African number, e.g. 061 234 5678.'
  if (s.email && !EMAIL.test(s.email.trim())) e.email = 'That email doesn’t look right.'
  if (!s.consent) e.consent = 'Please tick the box so we can contact you.'
  return e
}

export default function Assessment({ source, variant = 'card', preset, firstQuestion, className = '' }: Props) {
  const uid = useId()
  const shared = useSyncExternalStore(assess.subscribe, assess.get, assess.server)
  // A preset card renders "question 2, situation pre-answered" until it has synced with the store.
  // That keeps the server HTML and the first client render identical.
  const [synced, setSynced] = useState(() => !preset || (assess.isLoaded() && (assess.get().situation === preset || assess.get().status === 'done')))
  const [errors, setErrors] = useState<Errors>({})
  const [honey, setHoney] = useState('')
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const rootRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const started = useRef(false)
  const timer = useRef<number>()

  const s: AssessState = synced ? shared : { ...shared, situation: preset, step: 1, goal: undefined, debt: undefined, status: 'idle' }

  useEffect(() => {
    assess.load()
    if (preset) {
      const cur = assess.get()
      if (cur.status !== 'done' && cur.situation !== preset) {
        assess.set({ situation: preset, step: 1, goal: undefined, debt: undefined, status: 'idle' })
      }
      setSynced(true)
    }
  }, [preset])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // When this card moved to a new question (or finished), focus its heading for keyboard and
  // screen-reader users, and bring the card back into view if its top scrolled away (long lists on mobile).
  const seen = useRef({ step: s.step, status: s.status })
  useEffect(() => {
    const prev = seen.current
    seen.current = { step: s.step, status: s.status }
    const moved = prev.step !== s.step || (prev.status !== s.status && (s.status === 'done' || s.status === 'error'))
    if (!moved || assess.actor() !== uid) return
    headRef.current?.focus({ preventScroll: true })
    const el = rootRef.current
    if (el && el.getBoundingClientRect().top < 72) scrollToEl(el)
  }, [s.step, s.status, uid])

  const go = (patch: Partial<AssessState>) => {
    if (!started.current) { started.current = true; track('assessment_start', { source }) }
    assess.set(patch, uid)
  }

  const pick = (key: 'situation' | 'goal' | 'debt', id: string) => {
    const from = s.step
    setDir('fwd')
    go({ [key]: id } as Partial<AssessState>)
    track('assessment_step', { source, step: key, value: id })
    window.clearTimeout(timer.current)
    // Short pause so the tap registers visually, then advance (only if nothing else moved us meanwhile).
    timer.current = window.setTimeout(() => {
      assess.set((cur) => (cur.step === from ? { step: Math.min(from + 1, STEPS - 1) } : {}), uid)
    }, 240)
  }

  const back = () => { setDir('back'); go({ step: Math.max(0, s.step - 1) }) }

  /** Update a contact field; if it was flagged, re-check it as the visitor types. */
  const edit = (field: Field, value: string | boolean) => {
    const patch = { [field]: value } as Partial<AssessState>
    go(patch)
    if (errors[field]) setErrors((cur) => ({ ...cur, [field]: check({ ...s, ...patch })[field] }))
  }

  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    assess.set({}, uid)
    const e = check(s)
    setErrors(e)
    const firstBad = FIELDS.find((f) => e[f])
    if (firstBad) {
      track('assessment_invalid', { source, field: firstBad })
      document.getElementById(`${uid}-${firstBad}`)?.focus()
      return
    }
    if (honey) { assess.set({ status: 'done' }, uid); return } // bot: pretend it worked
    assess.set({ status: 'sending' }, uid)
    try {
      await submitLead({
        situation: s.situation, goal: s.goal, debt: s.debt,
        firstName: s.firstName.trim(), phone: normalizeZaPhone(s.phone)!, email: s.email.trim() || undefined,
        consent: s.consent, source, website: honey,
      })
      assess.set({ status: 'done' }, uid)
    } catch {
      assess.set({ status: 'error' }, uid)
      track('lead_error', { source })
    }
  }

  const restart = () => {
    setErrors({})
    setDir('fwd')
    assess.reset(preset ? { situation: preset, step: 1 } : {}, uid)
    track('assessment_restart', { source })
  }

  const summary = [
    labelOf(SITUATIONS, s.situation),
    s.goal && `Goal: ${labelOf(GOALS, s.goal)}`,
    s.debt && `Debt: ${labelOf(DEBT_BANDS, s.debt)}`,
  ].filter(Boolean).join('. ')
  const phoneE164 = normalizeZaPhone(s.phone)
  const waText = `Hi Truemarc, I'm ${s.firstName.trim() || 'interested'}. I just did the free assessment on your website. ${summary}. Please contact me${phoneE164 ? ` on ${maskPhone(phoneE164)}` : ''}.`

  const cls = `assess assess--${variant} ${className}`.trim()

  // ------------------------------------------------------------------ done
  if (s.status === 'done') {
    return (
      <div className={`${cls} assess--done`} ref={rootRef}>
        <svg className="assess__done-ring" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="29" pathLength={1} />
          <path d="M20 33.5l8 8 16.5-17" pathLength={1} />
        </svg>
        <h3 className="assess__q" tabIndex={-1} ref={headRef}>Thanks, {s.firstName.trim() || 'we’ve got it'}.</h3>
        <p className="assess__lead" aria-live="polite">
          A Truemarc consultant will call you {BUSINESS.responseTime}{phoneE164 ? <> on <b>{maskPhone(phoneE164)}</b></> : null}.
        </p>
        <ol className="assess__next">
          <li><span>1</span>We call to understand your situation.</li>
          <li><span>2</span>We check what’s listed on your credit record.</li>
          <li><span>3</span>You get a clear plan and quote. No obligation.</li>
        </ol>
        <a className="btn btn--wa btn--block" href={waLink(waText)} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'assessment-done' })}>
          <WhatsAppIcon size={20} />Want it faster? WhatsApp us now
        </a>
        <button type="button" className="assess__retry" onClick={restart}>Not you? Start a new assessment</button>
      </div>
    )
  }

  // ------------------------------------------------------------------ network error
  if (s.status === 'error') {
    return (
      <div className={`${cls} assess--error`} ref={rootRef}>
        <h3 className="assess__q" tabIndex={-1} ref={headRef}>That didn’t go through.</h3>
        <p className="assess__lead" aria-live="assertive">Your answers are saved. Send them to us on WhatsApp in one tap, or call us.</p>
        <div className="assess__stack">
          <a className="btn btn--wa btn--lg btn--block" href={waLink(waText)} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'assessment-error' })}>
            <WhatsAppIcon size={20} />Send on WhatsApp
          </a>
          <a className="btn btn--line btn--block" href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: 'assessment-error' })}><Phone size={18} aria-hidden="true" />Call {PRIMARY_PHONE.label}</a>
          <button type="button" className="assess__retry" onClick={() => assess.set({ status: 'idle' }, uid)}><RotateCcw size={16} aria-hidden="true" />Try again</button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ questions
  const qId = `${uid}-q`
  const q = (text: string) => <h3 className="assess__q" id={qId} tabIndex={-1} ref={headRef}>{text}</h3>

  // Radio group with one tab stop; arrow keys move between options, Enter/Space picks.
  const onOptKey = (ev: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(ev.key)) return
    ev.preventDefault()
    const opts = Array.from(ev.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
    const i = opts.indexOf(ev.currentTarget)
    const n = opts.length
    const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n
    opts[next]?.focus()
  }

  const options = (key: 'situation' | 'goal' | 'debt', list: readonly { id: string; label: string; icon?: string }[], cols = 2) => {
    const chosen = list.findIndex((o) => o.id === s[key])
    return (
      <div className={`assess__opts assess__opts--${cols}`} role="radiogroup" aria-labelledby={qId}>
        {list.map((o, i) => {
          const on = s[key] === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (chosen < 0 && i === 0) ? 0 : -1}
              className={`opt${on ? ' opt--on' : ''}${o.id === 'unsure' && key === 'situation' ? ' opt--wide' : ''}`}
              onClick={() => pick(key, o.id)}
              onKeyDown={onOptKey}
            >
              {o.icon && <span className="opt__icon"><Icon name={o.icon} size={20} strokeWidth={1.8} /></span>}
              <span className="opt__label">{o.label}</span>
              <span className="opt__tick" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            </button>
          )
        })}
      </div>
    )
  }

  const err = (f: Field) => errors[f] && (
    <p className="field__err" id={`${uid}-${f}-err`}><AlertCircle size={15} aria-hidden="true" />{errors[f]}</p>
  )
  const described = (f: Field) => (errors[f] ? `${uid}-${f}-err` : undefined)

  return (
    <div className={cls} ref={rootRef}>
      <div className="assess__top">
        {s.step > 0 ? (
          <button type="button" className="assess__back" onClick={back}><ArrowLeft size={16} aria-hidden="true" />Back</button>
        ) : (
          <span className="assess__free">Free · No obligation · 60 seconds</span>
        )}
        <div className="assess__progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={s.step + 1} aria-label={`Question ${s.step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => <i key={i} className={i < s.step ? 'done' : i === s.step ? 'on' : ''} />)}
        </div>
      </div>

      <div className={`assess__step assess__step--${dir}`} key={s.step}>
        {s.step === 0 && (<>{q(firstQuestion || 'What’s holding you back?')}{options('situation', SITUATIONS)}</>)}
        {s.step === 1 && (<>{q('What do you want to do next?')}{options('goal', GOALS)}</>)}
        {s.step === 2 && (<>{q('Roughly how much do you owe?')}{options('debt', DEBT_BANDS, 1)}</>)}
        {s.step === 3 && (
          <form className="assess__form" onSubmit={submit} noValidate>
            {q('Where can we reach you?')}
            <p className="assess__sub">A consultant calls you back {BUSINESS.responseTime}.</p>
            <div className="field">
              <label htmlFor={`${uid}-firstName`}>First name</label>
              <input id={`${uid}-firstName`} name="firstName" autoComplete="given-name" autoCapitalize="words" enterKeyHint="next" value={s.firstName} onChange={(e) => edit('firstName', e.target.value)} aria-invalid={!!errors.firstName} aria-describedby={described('firstName')} />
              {err('firstName')}
            </div>
            <div className="field">
              <label htmlFor={`${uid}-phone`}>Mobile number</label>
              <div className={`field__wrap${phoneE164 ? ' field__wrap--ok' : ''}`}>
                <input
                  id={`${uid}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" placeholder="061 234 5678"
                  value={s.phone}
                  onChange={(e) => edit('phone', e.target.value)}
                  onBlur={() => { if (phoneE164 && s.phone !== maskPhone(phoneE164)) go({ phone: maskPhone(phoneE164) }) }}
                  aria-invalid={!!errors.phone} aria-describedby={described('phone')}
                />
                <span className="field__ok" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
              </div>
              {err('phone')}
            </div>
            <div className="field">
              <label htmlFor={`${uid}-email`}>Email <span className="field__opt">(optional)</span></label>
              <input id={`${uid}-email`} name="email" type="email" inputMode="email" autoComplete="email" enterKeyHint="done" value={s.email} onChange={(e) => edit('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={described('email')} />
              {err('email')}
            </div>
            <div className="hp" aria-hidden="true">
              <label htmlFor={`${uid}-website`}>Website</label>
              <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
            </div>
            <label className={`check${errors.consent ? ' check--err' : ''}`}>
              <input id={`${uid}-consent`} type="checkbox" checked={s.consent} onChange={(e) => edit('consent', e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={described('consent')} />
              <span>Truemarc may contact me about my credit profile. <Link to="/privacy">Privacy notice</Link></span>
            </label>
            {err('consent')}
            <button type="submit" className="btn btn--red btn--lg btn--block assess__submit" disabled={s.status === 'sending'}>
              {s.status === 'sending' ? <><Loader2 size={20} className="spin" aria-hidden="true" />Sending…</> : <>Get my free assessment<ArrowRight size={20} aria-hidden="true" /></>}
            </button>
            <p className="assess__private"><Lock size={14} aria-hidden="true" />Your details stay private. We never sell them.</p>
          </form>
        )}
      </div>
    </div>
  )
}
