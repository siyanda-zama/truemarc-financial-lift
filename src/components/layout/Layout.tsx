import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Phone } from 'lucide-react'
import Header from './Header'
import Footer from './Footer'
import { WhatsAppIcon } from '@/components/Icon'
import { ASSESS_PATH, PRIMARY_PHONE, waLink } from '@/lib/site'
import { scrollToEl, scrollToTop, useSmoothScroll } from '@/lib/smooth'
import { captureAttribution, track } from '@/lib/leads'
import { WA_TEXT, ariaCurrent, prefersReducedMotion } from './nav'

/**
 * Route changes: go to #hash if present, else top, and move keyboard/screen-reader focus to the new page's
 * <main> (otherwise focus stays on the link that was clicked, somewhere in the old page).
 * The first render is left alone so the browser can restore scroll on reload/back.
 */
function RouteEffects() {
  const { pathname, hash } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    const isFirst = first.current
    first.current = false
    if (hash) {
      const t = window.setTimeout(() => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)))
        if (el) scrollToEl(el, prefersReducedMotion())
      }, 60)
      return () => window.clearTimeout(t)
    }
    if (isFirst) return undefined
    scrollToTop()
    document.getElementById('main')?.focus({ preventScroll: true })
    // SPA page view for Google Tag Manager (trigger on the "virtual_pageview" custom event). Helmet updates
    // the title on the next frame, hence the short delay.
    const t = window.setTimeout(() => track('virtual_pageview', { page_path: pathname, page_title: document.title }), 150)
    return () => window.clearTimeout(t)
  }, [pathname, hash])
  return null
}

/**
 * While a text field has focus on a phone, the on-screen keyboard pushes fixed elements up over the form.
 * html.kb-open hides the quick-contact bar until the field loses focus.
 */
function useKeyboardAware() {
  useEffect(() => {
    const isField = (el: Element | null) =>
      !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|image|hidden)$/i.test((el as HTMLInputElement).type)))
    const sync = () => document.documentElement.classList.toggle('kb-open', isField(document.activeElement))
    const onOut = () => window.setTimeout(sync, 0)
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', onOut)
    return () => { document.removeEventListener('focusin', sync); document.removeEventListener('focusout', onOut); document.documentElement.classList.remove('kb-open') }
  }, [])
}

/** Mobile: always-visible Call / WhatsApp / Free check bar. Hidden on the assessment page itself. */
function MobileBar() {
  const { pathname } = useLocation()
  if (pathname === ASSESS_PATH) return null
  // Pages with a closing assessment (#start) keep the visitor on the page: scroll there and focus the question.
  const onAssess = (e: MouseEvent<HTMLAnchorElement>) => {
    track('cta_click', { placement: 'mobile-bar' })
    const focusCard = (card: Element) => card.querySelector<HTMLElement>('.assess__q, [role="radio"][tabindex="0"], input')?.focus({ preventScroll: true })
    // A funnel card already on screen (e.g. the home hero): just focus it.
    const onScreen = Array.from(document.querySelectorAll('.assess')).find((c) => {
      const r = c.getBoundingClientRect()
      return r.top < window.innerHeight * 0.6 && r.bottom > 140
    })
    if (onScreen) { e.preventDefault(); focusCard(onScreen); return }
    const start = document.getElementById('start')
    if (!start) return
    e.preventDefault()
    scrollToEl(start, prefersReducedMotion())
    window.setTimeout(() => focusCard(start), 700)
  }
  return (
    <nav className="mbar" aria-label="Quick contact">
      <a href={`tel:${PRIMARY_PHONE.tel}`} className="mbar__btn" aria-label={`Call ${PRIMARY_PHONE.label}`} onClick={() => track('click_call', { placement: 'mobile-bar' })}>
        <Phone size={20} aria-hidden="true" /><span aria-hidden="true">Call</span>
      </a>
      <a href={waLink(WA_TEXT)} target="_blank" rel="noopener" className="mbar__btn mbar__btn--wa" onClick={() => track('click_whatsapp', { placement: 'mobile-bar' })}>
        <WhatsAppIcon size={20} /><span>WhatsApp</span>
      </a>
      <Link to={ASSESS_PATH} className="mbar__cta" aria-current={ariaCurrent(pathname, ASSESS_PATH)} onClick={onAssess}>
        Free assessment<ArrowRight size={18} aria-hidden="true" />
      </Link>
    </nav>
  )
}

/** Desktop: floating WhatsApp button. */
function WhatsAppFab() {
  return (
    <a className="wa-fab" href={waLink(WA_TEXT)} target="_blank" rel="noopener" aria-label="Chat to Truemarc on WhatsApp" onClick={() => track('click_whatsapp', { placement: 'fab' })}>
      <WhatsAppIcon size={28} />
      <span className="wa-fab__label" aria-hidden="true">Chat to a consultant</span>
    </a>
  )
}

/** Skip link: focus <main> directly (smooth scrolling would otherwise leave focus on the link). */
function onSkip(e: MouseEvent<HTMLAnchorElement>) {
  const main = document.getElementById('main')
  if (!main) return
  e.preventDefault()
  main.focus({ preventScroll: true })
  scrollToEl(main, true)
}

export default function Layout({ children }: { children: ReactNode }) {
  useSmoothScroll()
  useKeyboardAware()
  useEffect(() => { captureAttribution() }, [])
  return (
    <>
      <a href="#main" className="skip" onClick={onSkip}>Skip to content</a>
      <Header />
      <RouteEffects />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <MobileBar />
      <WhatsAppFab />
    </>
  )
}
