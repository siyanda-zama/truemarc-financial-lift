import { useEffect, useState } from 'react'
import { BUSINESS } from '@/lib/site'

// Office hours, computed in South African time. Browser-only: the hook returns null on the server
// and on the first client render, so prerendered HTML stays neutral and hydration matches.

const TZ = 'Africa/Johannesburg'
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_TO_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

type Slot = { open: string; close: string } | null

/** Monday-first week built from BUSINESS.hours ("Monday to Friday", "Saturday", "Sunday"). */
function week(): Slot[] {
  const out: Slot[] = Array(7).fill(null)
  BUSINESS.hours.forEach((h) => {
    const slot = h.open && h.close ? { open: h.open, close: h.close } : null
    const d = h.days.toLowerCase()
    if (d.includes('monday to friday')) [0, 1, 2, 3, 4].forEach((i) => { out[i] = slot })
    else {
      const i = DAY_NAMES.findIndex((n) => d.startsWith(n.toLowerCase()))
      if (i >= 0) out[i] = slot
    }
  })
  return out
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
/** "08:00" → "8:00" */
export const fmtTime = (hhmm: string) => hhmm.replace(/^0/, '')

export type OpenStatus = {
  open: boolean
  /** 0 = Monday … 6 = Sunday, in SA time */
  today: number
  /** Short sentence, e.g. "Open now · closes 17:00" or "Closed · opens Monday 8:00" */
  label: string
}

export function computeStatus(now: Date = new Date()): OpenStatus {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const today = SHORT_TO_INDEX[get('weekday')] ?? 0
  const mins = Number(get('hour')) * 60 + Number(get('minute'))
  const w = week()
  const slot = w[today]

  if (slot && mins >= toMin(slot.open) && mins < toMin(slot.close)) {
    return { open: true, today, label: `Open now · closes ${fmtTime(slot.close)}` }
  }
  if (slot && mins < toMin(slot.open)) {
    return { open: false, today, label: `Closed · opens today at ${fmtTime(slot.open)}` }
  }
  for (let k = 1; k <= 7; k++) {
    const d = (today + k) % 7
    const next = w[d]
    if (next) {
      const when = k === 1 ? 'tomorrow' : DAY_NAMES[d]
      return { open: false, today, label: `Closed · opens ${when} at ${fmtTime(next.open)}` }
    }
  }
  return { open: false, today, label: 'Closed' }
}

/** Client-only open/closed status, refreshed every minute. Null until mounted. */
export function useOpenStatus(): OpenStatus | null {
  const [status, setStatus] = useState<OpenStatus | null>(null)
  useEffect(() => {
    const update = () => {
      try { setStatus(computeStatus()) } catch { setStatus(null) }
    }
    update()
    const t = window.setInterval(update, 60_000)
    return () => window.clearInterval(t)
  }, [])
  return status
}

/** Rows for an hours table: one per BUSINESS.hours entry, with the Monday-first day indexes it covers. */
export function hoursRows() {
  return BUSINESS.hours.map((h) => {
    const d = h.days.toLowerCase()
    const days = d.includes('monday to friday') ? [0, 1, 2, 3, 4] : [DAY_NAMES.findIndex((n) => d.startsWith(n.toLowerCase()))]
    return { label: h.days, time: h.open && h.close ? `${fmtTime(h.open)}–${fmtTime(h.close)}` : 'Closed', days }
  })
}

/** Google Maps search for the office address (no embed, no API key). */
export function directionsUrl() {
  const a = BUSINESS.address
  const q = `${a.street}, ${a.town}, ${a.postcode}, ${a.province}, South Africa`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
