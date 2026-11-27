// Single source of truth for Truemarc's business facts, navigation and services.
// Facts here come from the client's existing site. Anything new must be confirmed with the client.

export const SITE_URL = 'https://truemarc.co.za'

export const BUSINESS = {
  name: 'Truemarc Consultants',
  short: 'Truemarc',
  tagline: 'impacting lives',
  founded: 2015,
  clientsHelped: '1,000+',
  phones: [
    { label: '061 544 9643', tel: '+27615449643' },
    { label: '076 633 9395', tel: '+27766339395' },
  ],
  // Assumed to be the WhatsApp line. Confirm with the client.
  whatsapp: '27615449643',
  email: 'admin@truemarc.co.za',
  address: {
    line1: 'Office No E1, 2nd Floor Office Park',
    street: 'Chris Hani Street',
    town: 'Bethal',
    postcode: '2310',
    province: 'Mpumalanga',
    country: 'ZA',
  },
  hours: [
    { days: 'Monday to Friday', open: '08:00', close: '17:00', short: 'Mon–Fri 8:00–17:00' },
    { days: 'Saturday', open: '09:00', close: '13:00', short: 'Sat 9:00–13:00' },
    { days: 'Sunday', open: null, close: null, short: 'Sun closed' },
  ],
  responseTime: 'within 24 hours',
} as const

export const PRIMARY_PHONE = BUSINESS.phones[0]

export function waLink(text?: string) {
  const base = `https://wa.me/${BUSINESS.whatsapp}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

// ---------------------------------------------------------------------------
// Services. `situation` links each service to the assessment's first question.
// Long-form page content lives with the service pages, not here.
// ---------------------------------------------------------------------------
export type ServiceIcon =
  | 'CreditCard' | 'Gavel' | 'Scale' | 'ShieldAlert' | 'Radar' | 'FileX2' | 'TrendingUp' | 'Landmark' | 'Users' | 'Briefcase'

export type Service = {
  slug: string
  name: string
  short: string
  icon: ServiceIcon
  group: 'credit' | 'other'
  situation?: SituationId
  keyword: string
}

export const SERVICES: Service[] = [
  { slug: 'bad-payment-profile', name: 'Bad payment profile', short: 'Missed payments dragging your score down? We correct what shouldn’t be there.', icon: 'CreditCard', group: 'credit', situation: 'declined', keyword: 'fix bad credit record South Africa' },
  { slug: 'default-judgment-removal', name: 'Defaults & judgments', short: 'Get defaults and judgments off your credit record, the legal way.', icon: 'Gavel', group: 'credit', situation: 'judgment', keyword: 'judgment removal South Africa' },
  { slug: 'debt-review', name: 'Debt review', short: 'Behind on repayments or ready to leave debt review? See your options.', icon: 'Scale', group: 'credit', situation: 'debt-review', keyword: 'debt review removal' },
  { slug: 'fraud-listing-removal', name: 'Fraud listings', short: 'Someone used your ID? We clear fraudulent listings and protect your name.', icon: 'ShieldAlert', group: 'credit', situation: 'fraud', keyword: 'fraud listing removal credit bureau' },
  { slug: 'trace-alert-removal', name: 'Trace alerts', short: 'Remove outdated trace alerts so lenders see the real you.', icon: 'Radar', group: 'credit', situation: 'unsure', keyword: 'trace alert removal' },
  { slug: 'admin-order-rescission', name: 'Admin orders', short: 'Rescind an administration order and take back control of your money.', icon: 'FileX2', group: 'credit', situation: 'admin-order', keyword: 'administration order rescission' },
  { slug: 'credit-profile-management', name: 'Credit profile management', short: 'Know your score, keep it clean and get loan-ready.', icon: 'TrendingUp', group: 'credit', situation: 'unsure', keyword: 'improve credit score South Africa' },
  { slug: 'paralegal-blacklisting', name: 'Paralegal support', short: 'Paralegal help with blacklisting disputes, letters and court processes.', icon: 'Landmark', group: 'credit', situation: 'declined', keyword: 'blacklisting paralegal' },
  { slug: 'labour-relations', name: 'Labour relations', short: 'Practical guidance on workplace disputes and labour law compliance.', icon: 'Users', group: 'other', keyword: 'labour relations consultant Mpumalanga' },
  { slug: 'general-consulting', name: 'General consulting', short: 'Advisory support for businesses that want to grow on solid ground.', icon: 'Briefcase', group: 'other', keyword: 'business consultants Bethal' },
]

export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug)

// ---------------------------------------------------------------------------
// Assessment options (the lead funnel). Keep labels short: they are tap targets.
// ---------------------------------------------------------------------------
export type SituationId = 'declined' | 'judgment' | 'debt-review' | 'over-indebted' | 'fraud' | 'admin-order' | 'unsure'

export const SITUATIONS: { id: SituationId; label: string; icon: string; service: string }[] = [
  { id: 'declined', label: 'Declined for credit', icon: 'Ban', service: 'bad-payment-profile' },
  { id: 'judgment', label: 'Default or judgment', icon: 'Gavel', service: 'default-judgment-removal' },
  { id: 'debt-review', label: 'Stuck in debt review', icon: 'Scale', service: 'debt-review' },
  { id: 'over-indebted', label: 'Struggling with debt', icon: 'Wallet', service: 'debt-review' },
  { id: 'fraud', label: 'Fraud on my name', icon: 'ShieldAlert', service: 'fraud-listing-removal' },
  { id: 'admin-order', label: 'Admin order', icon: 'FileX2', service: 'admin-order-rescission' },
  { id: 'unsure', label: 'Not sure. Check my record', icon: 'Search', service: 'credit-profile-management' },
]

export const GOALS = [
  { id: 'car', label: 'Finance a car', icon: 'Car' },
  { id: 'home', label: 'Get a home loan', icon: 'Home' },
  { id: 'credit', label: 'Get credit or a contract', icon: 'Smartphone' },
  { id: 'lower', label: 'Lower my repayments', icon: 'TrendingDown' },
  { id: 'clear', label: 'Just clear my name', icon: 'BadgeCheck' },
] as const

export const DEBT_BANDS = [
  { id: 'lt20', label: 'Under R20,000' },
  { id: '20-100', label: 'R20,000 – R100,000' },
  { id: '100-300', label: 'R100,000 – R300,000' },
  { id: 'gt300', label: 'Over R300,000' },
  { id: 'unsure', label: 'Not sure' },
] as const

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
export const NAV = [
  { to: '/services', label: 'Services', mega: true },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/learn', label: 'Learn' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
] as const

export const ASSESS_PATH = '/free-assessment'
