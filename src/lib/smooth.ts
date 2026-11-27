import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null

// Lenis drives the public site's scroll on GSAP's ticker so ScrollTrigger scenes stay in step.
// Skipped entirely when the visitor prefers reduced motion.
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    lenis = new Lenis({ lerp: 0.11, anchors: { offset: -96 } })
    document.documentElement.classList.add('lenis')
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis?.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis?.destroy()
      lenis = null
      document.documentElement.classList.remove('lenis')
    }
  }, [])
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}

export function scrollToEl(el: HTMLElement, immediate = false) {
  if (lenis) lenis.scrollTo(el, { offset: -96, immediate })
  else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' })
}

/** Pause smooth scroll while a modal/sheet is open. */
export function lockScroll(locked: boolean) {
  if (!lenis) return
  if (locked) lenis.stop()
  else lenis.start()
}
