// Lead capture: attribution, submission and analytics events.
// Every function here is SSR-safe (no window access at import time).

export type LeadPayload = {
  situation?: string
  goal?: string
  debt?: string
  firstName: string
  phone: string
  email?: string
  message?: string
  consent: boolean
  source: string // which form/placement produced the lead, e.g. "home-hero"
  website?: string // honeypot, must stay empty
}

const ENDPOINT: string = (import.meta.env.VITE_LEAD_ENDPOINT as string) || '/api/lead.php'
const ATTR_KEY = 'tm_attr'
const ATTR_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']

const isBrowser = () => typeof window !== 'undefined'

/** Remember the first ad/campaign parameters of the visit so the lead can be credited to them. */
export function captureAttribution() {
  if (!isBrowser()) return
  try {
    if (sessionStorage.getItem(ATTR_KEY)) return
    const qs = new URLSearchParams(window.location.search)
    const attr: Record<string, string> = { landing: window.location.pathname, referrer: document.referrer || '' }
    ATTR_PARAMS.forEach((k) => { const v = qs.get(k); if (v) attr[k] = v })
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr))
  } catch { /* storage blocked: attribution is optional */ }
}

function attribution(): Record<string, string> {
  if (!isBrowser()) return {}
  try { return JSON.parse(sessionStorage.getItem(ATTR_KEY) || '{}') } catch { return {} }
}

type Win = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void }

/** Analytics event. Works with GTM (dataLayer), GA4 (gtag) and Meta Pixel (fbq) once they are installed. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (!isBrowser()) return
  const w = window as Win
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...params })
  w.gtag?.('event', event, params)
  if (event === 'generate_lead') w.fbq?.('track', 'Lead', params)
  if (import.meta.env.DEV) console.info('[track]', event, params)
}

/** South African phone numbers: accepts 0XX XXX XXXX, +27XX…, 27XX…; returns +27XXXXXXXXX or null. */
export function normalizeZaPhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '')
  let n = d
  if (n.startsWith('+27')) n = n.slice(3)
  else if (n.startsWith('0027')) n = n.slice(4)
  else if (n.startsWith('27') && n.length === 11) n = n.slice(2)
  else if (n.startsWith('0')) n = n.slice(1)
  if (!/^[1-8]\d{8}$/.test(n)) return null
  return `+27${n}`
}

export function maskPhone(e164: string) {
  const local = '0' + e164.replace('+27', '')
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}

export class LeadError extends Error {}

export async function submitLead(payload: LeadPayload): Promise<{ id?: string }> {
  const body = {
    ...payload,
    page: isBrowser() ? window.location.pathname : '',
    attribution: attribution(),
    submittedAt: new Date().toISOString(),
  }
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new LeadError('network')
  }
  let data: { ok?: boolean; id?: string; error?: string } = {}
  try { data = await res.json() } catch { /* non-JSON response */ }
  if (!res.ok || !data.ok) throw new LeadError(data.error || `http_${res.status}`)
  track('generate_lead', { source: payload.source, situation: payload.situation, goal: payload.goal, debt: payload.debt })
  return { id: data.id }
}
