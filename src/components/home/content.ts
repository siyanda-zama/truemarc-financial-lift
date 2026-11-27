// Home page copy. Everything here is DRAFT copy for client approval (facts come from BUSINESS in lib/site).
import type { QA } from '@/components/blocks/Blocks'
import { BUSINESS } from '@/lib/site'

export const HERO = {
  lines: ['Declined for credit?', 'Let’s clear your name.'],
  lede: `Judgments, defaults, debt review and fraud listings, handled by people who’ve helped ${BUSINESS.clientsHelped} South Africans since ${BUSINESS.founded}.`,
}

export const FACTS = [
  { big: `Since ${BUSINESS.founded}`, small: 'Over 10 years of credit repair' },
  { big: BUSINESS.clientsHelped, small: 'Clients helped, many after a bank said no' },
  { big: '24 hours', small: 'To hear back from a consultant' },
  { big: 'Free', small: 'Assessment, with no obligation' },
]

/** The "from red to green" scene: one chapter per listing on the sample report. */
export const LISTINGS = [
  { name: 'Judgment', sub: 'Civil judgment', icon: 'Gavel', title: 'Judgments, rescinded.', body: 'Paid up, or there are valid grounds? We help you apply to court to have it set aside.' },
  { name: 'Default', sub: 'Store account', icon: 'FileX2', title: 'Defaults, disputed.', body: 'We check each default against the rules and dispute the ones that shouldn’t be there.' },
  { name: 'Bad payment profile', sub: 'Missed payments', icon: 'CreditCard', title: 'Payment history, corrected.', body: 'Wrong or outdated entries go to the credit bureaus, who must investigate them.' },
  { name: 'Debt review flag', sub: 'Under debt review', icon: 'Scale', title: 'Debt review, closed properly.', body: 'Debts settled? We help you get the clearance certificate that lifts the flag.' },
] as const

export const STEPS = [
  { title: 'Tell us what’s wrong', body: 'Three quick questions here, a WhatsApp or a call. Free, with no obligation.' },
  { title: 'We check your record', body: `A consultant calls you ${BUSINESS.responseTime} and goes through what’s listed.` },
  { title: 'You get a clear plan', body: 'What can be fixed, how, and what it costs. Then we do the work.' },
]

/** Guides teased on the home page (slugs must exist in content/articles.ts). */
export const GUIDE_SLUGS = ['am-i-blacklisted', 'how-to-remove-a-judgment', 'how-to-get-out-of-debt-review']

export const FAQS: QA[] = [
  [
    'How do I know if I’m blacklisted?',
    'There’s no single blacklist in South Africa. Lenders check your record at the credit bureaus, where defaults, judgments or a debt review flag can lead to a decline. You’re entitled to one free credit report a year from each bureau, and we can go through yours with you.',
  ],
  [
    'Can you remove a judgment from my credit record?',
    'Often, yes. A judgment stays on your record for up to five years unless a court rescinds it. If it’s been paid in full, or there are other valid grounds, you can apply to have it rescinded and the bureaus must then remove it. We check your judgment first and tell you honestly which route applies.',
  ],
  [
    'Can I get out of debt review?',
    'Yes. Once the debts in your plan are paid, your debt counsellor issues a clearance certificate and the flag is removed. If you can afford your debts again before then, there may be a legal way to exit early, depending on how far your case has gone. We explain your options.',
  ],
  [
    'Is the assessment really free?',
    'Yes. The assessment and first consultation are free, with no obligation. If you want us to take your case further, you get a clear quote before any work starts.',
  ],
  [
    'How long does credit repair take?',
    'It depends on what’s listed. A credit bureau must investigate a disputed listing within 20 business days, while court processes like rescinding a judgment take longer. You get a realistic timeline once we’ve seen your record.',
  ],
  [
    'Do you only help people in Mpumalanga?',
    `No. Our office is in ${BUSINESS.address.town}, ${BUSINESS.address.province}, but we help clients across South Africa by phone, WhatsApp and email.`,
  ],
]
