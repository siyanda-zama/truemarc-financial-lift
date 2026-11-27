// One shared answer sheet for every <Assessment /> on the page (and across pages in the visit).
// Two cards on one page (e.g. the home hero and the closing CTA) always show the same progress,
// so a visitor can start in one and finish in the other. Persisted to sessionStorage.
// SSR-safe: nothing touches window/sessionStorage until `load()` runs from an effect.

export type Status = 'idle' | 'sending' | 'done' | 'error'

export type AssessState = {
  step: number
  situation?: string
  goal?: string
  debt?: string
  firstName: string
  phone: string
  email: string
  consent: boolean
  status: Status
}

export const STEPS = 4
const KEY = 'tm_assess'

export const EMPTY: AssessState = { step: 0, firstName: '', phone: '', email: '', consent: false, status: 'idle' }

let state: AssessState = EMPTY
let loaded = false
/** The instance (useId) that made the last change. Only that card moves keyboard focus. */
let actor: string | null = null
const subs = new Set<() => void>()

const emit = () => subs.forEach((fn) => fn())

function persist() {
  try {
    // Consent is never restored (it must be given fresh), and only a finished lead survives a reload.
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, consent: false, status: state.status === 'done' ? 'done' : 'idle' }))
  } catch { /* storage blocked: progress just won't survive a reload */ }
}

type Patch = Partial<AssessState> | ((cur: AssessState) => Partial<AssessState>)

export const assess = {
  get: () => state,
  server: () => EMPTY,
  subscribe(fn: () => void) {
    subs.add(fn)
    return () => { subs.delete(fn) }
  },
  isLoaded: () => loaded,
  actor: () => actor,

  set(patch: Patch, by?: string) {
    if (by) actor = by
    const p = typeof patch === 'function' ? patch(state) : patch
    if (!Object.keys(p).length) return
    state = { ...state, ...p }
    if (loaded) persist()
    emit()
  },

  reset(base: Partial<AssessState> = {}, by?: string) {
    if (by) actor = by
    state = { ...EMPTY, ...base }
    if (loaded) persist()
    emit()
  },

  /** Restore progress from earlier in the visit. Call from an effect (client only); runs once. */
  load() {
    if (loaded || typeof window === 'undefined') return
    loaded = true
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Partial<AssessState> | null
      if (saved && typeof saved === 'object') {
        const step = Math.min(Math.max(Number(saved.step) || 0, 0), STEPS - 1)
        state = {
          ...EMPTY,
          ...saved,
          step,
          firstName: String(saved.firstName ?? ''),
          phone: String(saved.phone ?? ''),
          email: String(saved.email ?? ''),
          consent: false,
          status: saved.status === 'done' ? 'done' : 'idle',
        }
        emit()
      }
    } catch { /* ignore corrupt storage */ }
  },
}
