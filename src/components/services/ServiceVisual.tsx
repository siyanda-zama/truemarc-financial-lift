import type { CSSProperties, ReactNode } from 'react'
import {
  AlertTriangle, BadgeCheck, BriefcaseBusiness, CalendarCheck, Check, CreditCard, FileText, Gavel, Landmark, Mail, Phone,
  Radar, Scale, ShieldAlert, ShieldCheck, TrendingUp, User, Users,
} from 'lucide-react'
import type { VisualKind } from '@/content/services'
import { BUSINESS } from '@/lib/site'

// Bespoke hero visuals for the services pages. Pure CSS/SVG, decorative (aria-hidden), sized in container
// units (cqw) so each one scales as a single drawing from 1440px down to 390px.
// `.hero__piece` / `.hero__chip` hook into usePageMotion's hero entrance.

type V = CSSProperties & Record<`--${string}`, string | number>
const v = (o: Record<string, string | number>) => o as V

function Chip({ children, ok = true, className = '' }: { children: ReactNode; ok?: boolean; className?: string }) {
  return <span className={`chip svc-vis__chip hero__chip${ok ? ' chip--ok' : ''} ${className}`}>{children}</span>
}

function Lines({ widths = [100, 92, 74, 96, 58], className = '' }: { widths?: number[]; className?: string }) {
  return <span className={`svc-lines ${className}`}>{widths.map((w, i) => <i key={i} style={v({ '--w': `${w}%` })} />)}</span>
}

function Signature({ className = '' }: { className?: string }) {
  return (
    <svg className={`svc-sig ${className}`} viewBox="0 0 160 48" fill="none" aria-hidden="true">
      <path d="M4 34c10-14 18-26 24-24 7 3-9 30-2 30 6 0 12-22 20-22 7 0 2 16 9 16 8 0 12-14 20-14 6 0 4 10 10 10 9 0 16-12 30-14 10-1 20 2 38 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------- per-service visuals

/** Defaults & judgments: a court order, stamped "Rescinded". */
function JudgmentVisual() {
  return (
    <div className="svc-vis svc-vis--judgment">
      <div className="svc-paper svc-paper--back hero__piece" />
      <div className="svc-paper svc-paper--front hero__piece">
        <div className="svc-paper__head">
          <span className="svc-paper__crest"><Landmark strokeWidth={1.6} /></span>
          <span><b>In the Magistrate’s Court</b><small>Case no. •••• / 20••</small></span>
        </div>
        <p className="svc-paper__title">Default judgment</p>
        <Lines />
        <Lines widths={[88, 100, 64]} />
        <span className="svc-paper__sign"><Signature /><small>Clerk of the court</small></span>
      </div>
      <div className="svc-stamp"><span>Rescinded</span></div>
      <Chip><BadgeCheck size={18} />Removed from your record</Chip>
    </div>
  )
}

/** Debt review: the clearance certificate, sealed. */
function ClearanceVisual() {
  return (
    <div className="svc-vis svc-vis--cert">
      <div className="svc-cert hero__piece">
        <div className="svc-cert__core">
          <p className="svc-cert__act">National Credit Act · Section 71</p>
          <p className="svc-cert__title">Clearance certificate</p>
          <Lines className="svc-lines--center" widths={[86, 100, 70]} />
          <span className="svc-cert__fields">
            <small>Consumer</small><i />
            <small>Identity no.</small><i style={v({ width: '70%' })} />
            <small>Date issued</small><i style={v({ width: '45%' })} />
          </span>
          <div className="svc-cert__foot">
            <span className="svc-cert__sign"><Signature /><small>Debt counsellor</small></span>
            <span className="svc-seal"><Check strokeWidth={3} /></span>
          </div>
        </div>
      </div>
      <div className="svc-status hero__piece">
        <small>Credit record status</small>
        <s>Under debt review</s>
        <b><Check size={16} strokeWidth={3} />Cleared</b>
      </div>
    </div>
  )
}

/** Fraud: the ID card, the account you never opened, and a shield. */
function FraudVisual() {
  return (
    <div className="svc-vis svc-vis--fraud">
      <div className="svc-alert hero__piece">
        <AlertTriangle size={18} strokeWidth={2} />
        <span><b>Account you never opened</b><small>Retail credit · ••••</small></span>
      </div>
      <div className="svc-idcard hero__piece">
        <span className="svc-idcard__top">Identity card<i /></span>
        <span className="svc-idcard__photo"><User strokeWidth={1.4} /></span>
        <span className="svc-idcard__fields">
          <small>Surname</small><i style={v({ '--w': '62%' })} />
          <small>Names</small><i style={v({ '--w': '80%' })} />
          <small>Identity number</small><b>•••••• •••• •••</b>
        </span>
        <span className="svc-idcard__chip" />
      </div>
      <div className="svc-shield">
        <svg viewBox="0 0 120 140" aria-hidden="true">
          <path d="M60 6 110 24v40c0 34-21 58-50 70C31 122 10 98 10 64V24Z" />
        </svg>
        <Check strokeWidth={3} />
      </div>
      <Chip><ShieldCheck size={18} />Protective registration</Chip>
    </div>
  )
}

/** Trace alert: a radar that finds you, and your details updated. */
function RadarVisual() {
  return (
    <div className="svc-vis svc-vis--radar">
      <div className="svc-radar hero__piece">
        <span className="svc-radar__sweep" />
        <span className="svc-radar__ring" style={v({ '--s': 1 })} />
        <span className="svc-radar__ring" style={v({ '--s': 0.72 })} />
        <span className="svc-radar__ring" style={v({ '--s': 0.44 })} />
        <span className="svc-radar__cross" />
        <span className="svc-radar__blip svc-radar__blip--alert" style={v({ '--x': '70%', '--y': '28%' })}><i />Trace alert</span>
        <span className="svc-radar__blip svc-radar__blip--you" style={v({ '--x': '36%', '--y': '62%' })}><i /><User size={14} strokeWidth={2.4} />You</span>
      </div>
      <div className="svc-contact hero__piece">
        <span className="svc-contact__row"><Phone size={16} /><i style={v({ '--w': '64%' })} /><Check size={16} strokeWidth={3} /></span>
        <span className="svc-contact__row"><Mail size={16} /><i style={v({ '--w': '78%' })} /><Check size={16} strokeWidth={3} /></span>
      </div>
      <Chip><BadgeCheck size={18} />Contact details updated</Chip>
    </div>
  )
}

/** Admin order: the payslip with the order's deduction struck off. */
function AdminOrderVisual() {
  return (
    <div className="svc-vis svc-vis--slip">
      <div className="svc-paper svc-paper--order hero__piece">
        <span className="svc-paper__crest"><FileText strokeWidth={1.6} /></span>
        <p>Administration order</p>
        <Lines widths={[90, 70]} />
      </div>
      <div className="svc-slip hero__piece">
        <div className="svc-slip__head"><b>Payslip</b><i /></div>
        <div className="svc-slip__row"><span>Basic salary</span><i style={v({ '--w': '62%' })} /></div>
        <div className="svc-slip__row"><span>Tax</span><i style={v({ '--w': '30%' })} /></div>
        <div className="svc-slip__row svc-slip__row--cut"><span>Admin order instalment</span><i style={v({ '--w': '40%' })} /><em>Ended</em></div>
        <div className="svc-slip__row svc-slip__row--total"><span>Take-home</span><i style={v({ '--w': '70%' })} /><TrendingUp size={18} strokeWidth={2.4} /></div>
      </div>
      <Chip><BadgeCheck size={18} />Order rescinded</Chip>
    </div>
  )
}

/** Bad payment profile: months in arrears, going from red to green. Digits as on a real bureau report. */
const PROFILE: { name: string; icon: ReactNode; months: number[]; disputed?: boolean }[] = [
  { name: 'Store card', icon: <CreditCard size={16} />, months: [3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'Personal loan', icon: <FileText size={16} />, months: [2, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'Phone contract', icon: <Phone size={16} />, months: [3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0], disputed: true },
]
function PaymentRowVisual() {
  return (
    <div className="svc-vis svc-vis--profile">
      <div className="svc-report hero__piece">
        <div className="svc-report__head">
          <b>Payment profile</b>
          <small>Last 12 months</small>
        </div>
        {PROFILE.map((acc, r) => (
          <div className="svc-report__acc" key={acc.name}>
            <span className="svc-report__name">{acc.icon}{acc.name}{acc.disputed && <em>Disputed</em>}</span>
            <span className="svc-cells">
              {acc.months.map((m, i) => (
                <i key={i} className={m === 0 ? 'svc-c-ok' : `svc-c-late svc-c-late--${Math.min(m, 3)}`} style={v({ '--i': r * 3 + i })}>{m}</i>
              ))}
            </span>
          </div>
        ))}
        <p className="svc-report__key"><span><i className="svc-c-late svc-c-late--3" />Months behind</span><span><i className="svc-c-ok" />Paid up</span></p>
      </div>
      <Chip><BadgeCheck size={18} />Wrong listings disputed</Chip>
    </div>
  )
}

/** Credit profile: the score ring, red to green. Bands only, no invented numbers. */
function ScoreVisual() {
  // 270° gauge, r=80 → circumference 502.65, arc 377. Five segments with small gaps.
  const C = 2 * Math.PI * 80
  const seg = 377 / 5
  const cols = [['var(--red)', 1], ['var(--red)', 0.55], ['var(--white)', 0.28], ['var(--green)', 0.6], ['var(--green)', 1]] as const
  return (
    <div className="svc-vis svc-vis--score">
      <div className="svc-score hero__piece">
        <svg viewBox="0 0 200 200" className="svc-score__gauge" aria-hidden="true">
          <g transform="rotate(135 100 100)">
            {cols.map(([c, o], i) => (
              <circle key={i} className="svc-score__seg" style={v({ '--i': i })} cx="100" cy="100" r="80" fill="none" stroke={c} strokeOpacity={o} strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${(seg - 18).toFixed(2)} ${C.toFixed(2)}`} strokeDashoffset={-(i * seg + 9).toFixed(2)} />
            ))}
          </g>
          <g className="svc-score__needle">
            <circle cx="100" cy="20" r="11" fill="var(--white)" />
            <circle cx="100" cy="20" r="5" fill="var(--green)" />
          </g>
        </svg>
        <span className="svc-score__read"><small>Credit health</small><b>Good</b><em>Loan-ready</em></span>
      </div>
      <ul className="svc-factors hero__piece">
        <li><Check size={16} strokeWidth={3} />Payments on time</li>
        <li><Check size={16} strokeWidth={3} />Errors corrected</li>
        <li><Check size={16} strokeWidth={3} />Ready to apply</li>
      </ul>
    </div>
  )
}

/** Paralegal: the dispute letter, with the scales. */
function ParalegalVisual() {
  return (
    <div className="svc-vis svc-vis--letter">
      <div className="svc-envelope hero__piece"><span /></div>
      <div className="svc-paper svc-paper--letter hero__piece">
        <span className="svc-paper__date"><i /><i /></span>
        <p className="svc-paper__title">Re: Disputed listing</p>
        <Lines widths={[100, 94, 86, 100, 60]} />
        <Lines widths={[96, 72]} />
        <span className="svc-paper__sign"><Signature /><small>Yours faithfully</small></span>
      </div>
      <span className="svc-scales hero__piece"><Scale strokeWidth={1.5} /></span>
      <Chip><BadgeCheck size={18} />Dispute sent and followed up</Chip>
    </div>
  )
}

/** Labour relations: a hearing, prepared. */
function LabourVisual() {
  return (
    <div className="svc-vis svc-vis--plan">
      <div className="svc-plan hero__piece">
        <div className="svc-plan__head">
          <span className="svc-plan__date"><small>Thu</small><b>14</b></span>
          <span><b>Disciplinary hearing</b><small>Prepared together</small></span>
        </div>
        <ul className="svc-plan__list">
          <li className="svc-done"><Check size={16} strokeWidth={3} />Notice received</li>
          <li className="svc-done"><Check size={16} strokeWidth={3} />Your rights explained</li>
          <li className="svc-done"><Check size={16} strokeWidth={3} />Documents ready</li>
          <li><CalendarCheck size={16} />The hearing</li>
        </ul>
      </div>
      <span className="svc-scales svc-scales--sm hero__piece"><Users strokeWidth={1.5} /></span>
    </div>
  )
}

/** General consulting: a plan with growth that builds. */
function ConsultingVisual() {
  return (
    <div className="svc-vis svc-vis--plan">
      <div className="svc-plan hero__piece">
        <div className="svc-plan__head">
          <span className="svc-plan__date svc-plan__date--icon"><BriefcaseBusiness strokeWidth={1.6} /></span>
          <span><b>Business plan</b><small>Next 12 months</small></span>
        </div>
        <span className="svc-bars">{[30, 42, 38, 56, 68, 86].map((h, i) => <i key={i} style={v({ '--h': `${h}%`, '--i': i })} />)}</span>
        <ul className="svc-plan__list svc-plan__list--row">
          <li className="svc-done"><Check size={16} strokeWidth={3} />Registered</li>
          <li className="svc-done"><Check size={16} strokeWidth={3} />Compliant</li>
          <li className="svc-done"><Check size={16} strokeWidth={3} />Finance-ready</li>
        </ul>
      </div>
    </div>
  )
}

const VISUALS: Record<VisualKind, () => JSX.Element> = {
  'payment-row': PaymentRowVisual,
  judgment: JudgmentVisual,
  clearance: ClearanceVisual,
  fraud: FraudVisual,
  radar: RadarVisual,
  'admin-order': AdminOrderVisual,
  score: ScoreVisual,
  paralegal: ParalegalVisual,
  labour: LabourVisual,
  consulting: ConsultingVisual,
}

export default function ServiceVisual({ kind }: { kind: VisualKind }) {
  const C = VISUALS[kind]
  return <div className="svc-vis-wrap" aria-hidden="true"><C /></div>
}

// ---------------------------------------------------------------------------- hub + how-it-works

/** /services: a fanned hand of service cards, the front one resolved. */
const FAN = [
  { name: 'Trace alerts', icon: Radar, status: 'Updated' },
  { name: 'Debt review', icon: Scale, status: 'Clearance issued' },
  { name: 'Fraud listings', icon: ShieldAlert, status: 'Disputed' },
  { name: 'Defaults & judgments', icon: Gavel, status: 'Rescinded' },
]
export function HubVisual() {
  return (
    <div className="svc-vis-wrap" aria-hidden="true">
      <div className="svc-vis svc-vis--fan">
        <div className="svc-fan hero__piece">
          {FAN.map(({ name, icon: I, status }, i) => (
            <div key={name} className={`svc-fan__card${i === FAN.length - 1 ? ' svc-fan__card--front' : ''}`} style={v({ '--i': i })}>
              <span className="svc-fan__icon"><I strokeWidth={1.6} /></span>
              <b>{name}</b>
              <span className="svc-fan__lines"><i /><i /></span>
              <span className="svc-fan__status"><Check size={14} strokeWidth={3} />{status}</span>
            </div>
          ))}
        </div>
        <Chip ok={false} className="svc-vis__chip--facts"><Users size={18} />{BUSINESS.clientsHelped} clients helped since {BUSINESS.founded}</Chip>
      </div>
    </div>
  )
}

/** /how-it-works: the case tracker on a phone. */
const TRACK = [
  { t: 'Assessment received', s: 'done' },
  { t: 'Consultant called you', s: 'done' },
  { t: 'Credit report checked', s: 'done' },
  { t: 'Plan and quote', s: 'now' },
  { t: 'Record updated', s: 'next' },
] as const
export function HowVisual() {
  return (
    <div className="svc-vis-wrap" aria-hidden="true">
      <div className="svc-vis svc-vis--phone">
        <div className="how-phone hero__piece">
          <span className="how-phone__notch" />
          <div className="how-phone__screen">
            <p className="how-phone__title">Your case</p>
            <span className="how-phone__bar"><i /></span>
            <ol className="how-phone__track">
              {TRACK.map((x) => (
                <li key={x.t} className={`how-t-${x.s}`}>
                  <span className="how-phone__dot">{x.s === 'done' ? <Check size={12} strokeWidth={3.5} /> : null}</span>
                  {x.t}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="how-note hero__piece">
          <span className="how-note__icon"><Phone size={18} /></span>
          <span><b>Truemarc</b><small>We’ll call you back {BUSINESS.responseTime}.</small></span>
        </div>
        <Chip><BadgeCheck size={18} />Free · No obligation</Chip>
      </div>
    </div>
  )
}
