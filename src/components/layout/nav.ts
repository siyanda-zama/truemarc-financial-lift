// Small helpers shared by the header, mobile sheet and footer.

/** aria-current="page" only on the exact page (NavLink would also mark parents like /services). */
export const ariaCurrent = (pathname: string, to: string) => (pathname === to ? ('page' as const) : undefined)

/** Section highlight: /services is "active" on /services/debt-review too. */
export const inSection = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`)

export const WA_TEXT = 'Hi Truemarc, I need help with my credit record.'

export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
