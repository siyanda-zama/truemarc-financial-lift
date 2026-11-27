import type { MouseEvent, ReactNode } from 'react'
import { gsap } from 'gsap'
import { track } from '@/lib/leads'
import { scrollToEl } from '@/lib/smooth'

/**
 * In-page "start the assessment" link. Glides to the closing assessment card (#start, rendered by CtaBlock)
 * and puts keyboard focus on its question. The cards share one store, so any progress made in the hero card
 * is already there. Falls back to a plain #start anchor without JS.
 */
export default function AssessLink({ placement, className = 'btn btn--red btn--lg', target = 'start', children }: {
  placement: string; className?: string; target?: string; children: ReactNode
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    track('cta_click', { placement })
    const el = document.getElementById(target)
    if (!el) return
    e.preventDefault()
    e.stopPropagation() // Lenis also handles #anchors on window; we want the card, not the section top
    // Land on the card itself, not the section top (on phones the card sits below the section's copy).
    const card = el.querySelector<HTMLElement>('.assess') ?? el
    // If the card hasn't been revealed yet it is still offset by the reveal tween; settle it first so we measure the real position.
    const pending = card.closest<HTMLElement>('[data-reveal]')
    if (pending) gsap.set(pending, { y: 0, opacity: 1 })
    scrollToEl(card)
    window.setTimeout(() => el.querySelector<HTMLElement>('.assess__q')?.focus({ preventScroll: true }), 900)
  }
  return <a href={`#${target}`} className={className} onClick={onClick}>{children}</a>
}
