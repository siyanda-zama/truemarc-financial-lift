import { useEffect, useState } from 'react'

/**
 * Scroll-spy for an in-page table of contents. Returns the id of the section currently being read.
 * IntersectionObserver only (no scroll listeners); null until mounted, so SSR output is neutral.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join('|')

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined
    const visible = new Set<string>()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id) })
      // The first section (in document order) whose heading sits in the reading band wins.
      const current = ids.find((id) => visible.has(id))
      if (current) setActive(current)
    }, { rootMargin: '-110px 0px -55% 0px', threshold: 0 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return active
}
