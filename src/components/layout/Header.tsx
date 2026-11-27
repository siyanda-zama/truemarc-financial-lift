import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, ChevronDown, Clock, Menu, Phone, X } from 'lucide-react'
import { Logo } from '@/components/brand/Brand'
import Icon, { WhatsAppIcon } from '@/components/Icon'
import { ASSESS_PATH, BUSINESS, NAV, PRIMARY_PHONE, SERVICES, waLink } from '@/lib/site'
import { lockScroll } from '@/lib/smooth'
import { track } from '@/lib/leads'
import { FOCUSABLE, WA_TEXT, ariaCurrent, inSection } from './nav'

const CREDIT = SERVICES.filter((s) => s.group === 'credit')
const DESKTOP_NAV = '(min-width: 1021px)' // mirrors the 1020px breakpoint in brand.css

export default function Header() {
  const [open, setOpen] = useState(false)
  const [mega, setMega] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  // Ads landing page: logo + call + WhatsApp only, so paid traffic has one job (the assessment) and no exits.
  const focus = pathname === ASSESS_PATH
  const megaRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<number>()

  useEffect(() => { setOpen(false); setMega(false) }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ---- Services mega menu (disclosure pattern) --------------------------------------------------
  useEffect(() => {
    if (!mega) return undefined
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const hadFocus = megaRef.current?.contains(document.activeElement)
      setMega(false)
      if (hadFocus) triggerRef.current?.focus()
    }
    const onDown = (e: globalThis.PointerEvent) => { if (!megaRef.current?.contains(e.target as Node)) setMega(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [mega])
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  const megaLinks = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href]') ?? [])
  const openMegaAndFocus = (which: 'first' | 'last') => {
    setMega(true)
    requestAnimationFrame(() => { const l = megaLinks(); (which === 'first' ? l[0] : l[l.length - 1])?.focus() })
  }
  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); openMegaAndFocus('first') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openMegaAndFocus('last') }
  }
  const onPanelKey = (e: KeyboardEvent) => {
    const links = megaLinks()
    const i = links.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    const next = { ArrowDown: (i + 1) % links.length, ArrowRight: (i + 1) % links.length, ArrowUp: (i - 1 + links.length) % links.length, ArrowLeft: (i - 1 + links.length) % links.length, Home: 0, End: links.length - 1 }[e.key]
    if (next !== undefined) { e.preventDefault(); links[next].focus() }
  }
  // Tabbing out of the menu closes it (a click elsewhere is handled by the pointerdown listener).
  const onWrapBlur = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null
    if (mega && to && !megaRef.current?.contains(to)) setMega(false)
  }
  // Hover opens for mouse only: on touch a tap would open (pointerenter) then instantly close (click).
  const onWrapEnter = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; window.clearTimeout(leaveTimer.current); setMega(true) }
  const onWrapLeave = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; leaveTimer.current = window.setTimeout(() => setMega(false), 140) }

  // ---- Mobile sheet: focus trap, Esc, scroll lock, background inert ------------------------------
  useEffect(() => {
    if (!open) return undefined
    const root = document.documentElement
    // Start the sheet exactly under the visible header (the topbar may still be partly on screen).
    const bottom = barRef.current?.getBoundingClientRect().bottom
    if (bottom) root.style.setProperty('--sheet-top', `${Math.round(bottom)}px`)
    root.classList.add('nav-open')
    lockScroll(true)
    const behind = Array.from(document.querySelectorAll<HTMLElement>('#main, .foot, .mbar, .wa-fab, .topbar'))
    behind.forEach((el) => el.setAttribute('inert', ''))
    const raf = requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('a[href]')?.focus())

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); toggleRef.current?.focus(); return }
      if (e.key !== 'Tab') return
      const items = [toggleRef.current, ...Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(Boolean) as HTMLElement[]
      const first = items[0], last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!active || !items.includes(active)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    const desktop = window.matchMedia(DESKTOP_NAV)
    const onBreakpoint = () => { if (desktop.matches) setOpen(false) }
    document.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onBreakpoint)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onBreakpoint)
      behind.forEach((el) => el.removeAttribute('inert'))
      root.classList.remove('nav-open')
      lockScroll(false)
    }
  }, [open])

  // Any link in the sheet closes it, including one to the page we're already on.
  const onSheetClick = (e: MouseEvent) => { if ((e.target as Element).closest('a')) setOpen(false) }

  return (
    <header className={`nav${scrolled ? ' nav--scrolled' : ''}${open ? ' nav--open' : ''}${focus ? ' nav--focus' : ''}`}>
      <div className="topbar">
        <div className="wrap topbar__inner">
          <p className="topbar__msg">
            <Clock size={15} aria-hidden="true" />
            {BUSINESS.hours[0].short} · {BUSINESS.hours[1].short}
          </p>
          <div className="topbar__links">
            <a href={`tel:${PRIMARY_PHONE.tel}`} onClick={() => track('click_call', { placement: 'topbar' })}>
              <Phone size={15} aria-hidden="true" />Speak to a consultant: <b>{PRIMARY_PHONE.label}</b>
            </a>
            <a href={waLink(WA_TEXT)} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'topbar' })}>
              <WhatsAppIcon size={15} />WhatsApp us
            </a>
          </div>
        </div>
      </div>

      <div className="nav__bar" ref={barRef}>
        <div className="wrap nav__inner">
          <Logo className="nav__logo" height={46} />

          {!focus && <nav className="nav__links" aria-label="Main">
            {NAV.map((item) =>
              'mega' in item && item.mega ? (
                <div className="nav__mega-wrap" key={item.to} ref={megaRef} onPointerEnter={onWrapEnter} onPointerLeave={onWrapLeave} onBlur={onWrapBlur}>
                  <button
                    ref={triggerRef}
                    type="button"
                    className={`nav__link nav__trigger${inSection(pathname, '/services') ? ' active' : ''}`}
                    aria-expanded={mega}
                    aria-controls="mega-services"
                    onClick={() => setMega((v) => !v)}
                    onKeyDown={onTriggerKey}
                  >
                    {item.label}<ChevronDown size={16} aria-hidden="true" />
                  </button>
                  <div className="mega" id="mega-services" ref={panelRef} hidden={!mega} onKeyDown={onPanelKey}>
                    <div className="mega__grid">
                      {CREDIT.map((s) => {
                        const to = `/services/${s.slug}`
                        return (
                          <Link key={s.slug} to={to} className="mega__item" aria-current={ariaCurrent(pathname, to)} onClick={() => setMega(false)}>
                            <span className="mega__icon"><Icon name={s.icon} size={20} strokeWidth={1.8} /></span>
                            <span><b>{s.name}</b><small>{s.short}</small></span>
                          </Link>
                        )
                      })}
                    </div>
                    <div className="mega__foot">
                      <Link to="/services" className="mega__all" aria-current={ariaCurrent(pathname, '/services')} onClick={() => setMega(false)}>All services<ArrowRight size={16} aria-hidden="true" /></Link>
                      <Link to={ASSESS_PATH} className="btn btn--red btn--sm" onClick={() => { setMega(false); track('cta_click', { placement: 'mega' }) }}>Not sure? Free assessment</Link>
                    </div>
                  </div>
                </div>
              ) : (
                <Link key={item.to} to={item.to} className={`nav__link${inSection(pathname, item.to) ? ' active' : ''}`} aria-current={ariaCurrent(pathname, item.to)}>{item.label}</Link>
              ),
            )}
          </nav>}

          <div className="nav__actions">
            <a className="nav__call" href={`tel:${PRIMARY_PHONE.tel}`} aria-label={`Call ${PRIMARY_PHONE.label}`} onClick={() => track('click_call', { placement: 'nav' })}>
              <Phone size={18} aria-hidden="true" /><span>{PRIMARY_PHONE.label}</span>
            </a>
            {focus ? (
              <a className="btn btn--wa btn--sm nav__wa" href={waLink(WA_TEXT)} target="_blank" rel="noopener" onClick={() => track('click_whatsapp', { placement: 'nav-focus' })}>
                <WhatsAppIcon size={18} /><span>WhatsApp</span>
              </a>
            ) : (
              <Link to={ASSESS_PATH} className="btn btn--red nav__cta" onClick={() => track('cta_click', { placement: 'nav' })}>
                Free assessment
              </Link>
            )}
            {!focus && <button ref={toggleRef} type="button" className="nav__toggle" aria-expanded={open} aria-controls="nav-sheet" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
              {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>}
          </div>
        </div>
      </div>

      {!focus && <div className="sheet" id="nav-sheet" ref={sheetRef} hidden={!open} onClick={onSheetClick}>
        <div className="wrap sheet__inner">
          <nav aria-label="Main (mobile)" className="sheet__nav">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className={inSection(pathname, item.to) ? 'active' : undefined} aria-current={ariaCurrent(pathname, item.to)}>
                {item.label}<ArrowRight size={20} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className="sheet__services">
            {CREDIT.slice(0, 6).map((s) => {
              const to = `/services/${s.slug}`
              return <Link key={s.slug} to={to} aria-current={ariaCurrent(pathname, to)}><Icon name={s.icon} size={18} />{s.name}</Link>
            })}
          </div>
          <Link to={ASSESS_PATH} className="btn btn--red btn--lg btn--block" onClick={() => track('cta_click', { placement: 'sheet' })}>Start my free assessment<ArrowRight size={20} aria-hidden="true" /></Link>
          <div className="sheet__contact">
            <a href={`tel:${PRIMARY_PHONE.tel}`} className="btn btn--line btn--block" onClick={() => track('click_call', { placement: 'sheet' })}><Phone size={18} aria-hidden="true" />Call {PRIMARY_PHONE.label}</a>
            <a href={waLink(WA_TEXT)} target="_blank" rel="noopener" className="btn btn--wa btn--block" onClick={() => track('click_whatsapp', { placement: 'sheet' })}><WhatsAppIcon size={18} />WhatsApp</a>
          </div>
        </div>
      </div>}
    </header>
  )
}
