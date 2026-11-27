import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export const MOTION_OK = '(prefers-reduced-motion: no-preference)'
export const DESKTOP_STORY = '(min-width: 960px) and (prefers-reduced-motion: no-preference)'

type Q = (sel: string) => HTMLElement[]
export type ExtraScenes = (mm: gsap.MatchMedia, q: Q) => void

const EXPO = { ease: 'expo.out' }

/**
 * True while React hydrates a prerendered page (flag set in main.tsx, cleared by App after mount).
 * The page is already painted from static HTML then, so entrance animations would make visible content blink
 * out and back in. Skip entrances for anything already on screen; scroll-driven scenes still run.
 */
export const isHydrating = () => typeof document !== 'undefined' && document.documentElement.dataset.hydrating === '1'
const inView = (el: HTMLElement) => el.getBoundingClientRect().top < window.innerHeight

/**
 * Shared page motion. Class contract (only selectors that exist are animated):
 *  .hero__ring     brand ring sweeps in, drifts on scroll
 *  .hero__photo    clip-path opens from the bottom, img scales 1.2 → 1
 *  .hero__piece    any visual piece rises in, staggered
 *  .hero__chip     fact chips pop in, staggered
 *  .hero__fade     lede, actions, fine print fade up
 *  .hero__visual   parallax while leaving the hero
 *  [data-reveal]   fade-up once when scrolled into view (batched)
 *  [data-parallax] image scales 1.15 → 1 across its section
 * `extra(mm, q)` adds page-specific scenes inside the same matchMedia context.
 */
export function usePageMotion(scope: RefObject<HTMLElement>, extra?: ExtraScenes) {
  useGSAP(() => {
    const root = scope.current
    if (!root) return
    const q: Q = (sel) => gsap.utils.toArray<HTMLElement>(sel, root)
    const mm = gsap.matchMedia()

    const hydrating = isHydrating()
    mm.add(MOTION_OK, () => {
      const tl = gsap.timeline({ defaults: EXPO })
      const at = (sel: string, vars: gsap.TweenVars, pos: number) => { if (hydrating) return; const t = q(sel); if (t.length) tl.from(t, vars, pos) }
      at('.hero__ring', { scale: 0.6, rotate: -40, opacity: 0, duration: 1.8 }, 0)
      at('.hero__photo', { clipPath: 'inset(100% 0% 0% 0% round 28px)', duration: 1.4 }, 0.1)
      at('.hero__photo img', { scale: 1.2, duration: 1.8 }, 0.1)
      at('.hero__piece', { y: 60, opacity: 0, duration: 1.2, stagger: 0.1 }, 0.25)
      at('.hero__chip', { y: 24, scale: 0.92, opacity: 0, duration: 0.9, stagger: 0.12 }, 0.7)
      at('.hero__fade', { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, 0.35)

      const hero = q('.hero')[0]
      if (hero && q('.hero__visual').length) {
        const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
        gsap.to(q('.hero__visual'), { yPercent: -8, ease: 'none', scrollTrigger: st })
        if (q('.hero__ring').length) gsap.to(q('.hero__ring'), { rotate: 25, ease: 'none', scrollTrigger: { ...st } })
      }

      q('[data-parallax]').forEach((img) => {
        gsap.fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } })
      })

      const reveal = q('[data-reveal]').filter((el) => !(hydrating && inView(el)))
      if (reveal.length) {
        gsap.set(reveal, { y: 36, opacity: 0 })
        ScrollTrigger.batch(reveal, {
          start: 'top 90%',
          once: true,
          onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true }),
        })
      }
    })

    extra?.(mm, q)
    // Fonts/images can shift layout after mount; recompute trigger positions once settled.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    document.fonts?.ready.then(refresh)
    return () => { window.removeEventListener('load', refresh); mm.revert() }
  }, { scope })
}
