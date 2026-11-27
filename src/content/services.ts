// Long-form content for /services/:slug. One entry per SERVICES slug in src/lib/site.ts.
// ALL COPY HERE IS DRAFT for client approval. Legal statements are deliberately general and conservative;
// see the services agent report for the list of claims that need client/legal confirmation.
import type { QA } from '@/components/blocks/Blocks'

export type VisualKind =
  | 'payment-row' | 'judgment' | 'clearance' | 'fraud' | 'radar' | 'admin-order' | 'score' | 'paralegal'
  | 'labour' | 'consulting'

type Step = { title: string; body: string }

export type ServiceContent = {
  slug: string
  /** ≤ 55 chars, targets SERVICES[].keyword. Brand suffix is added by <Seo>. */
  seoTitle: string
  /** 140–160 chars, ends on the free assessment (or free consultation for non-credit lines). */
  seoDescription: string
  h1: [string, string]
  lede: string
  visual: VisualKind
  /** Credit lines: "Is this you?" signs. Other lines: "Where we help". */
  signs: string[]
  stepsTitle: string
  steps: Step[]
  outcomesTitle?: string
  outcomes?: { before: string; after: string }[]
  docs?: string[]
  faqs: QA[]
  related: string[]
  /** Guide to link when no article has `service === slug`. */
  guide?: string
  ctaTitle?: string
}

const COST: QA = ['What does it cost?', 'Your assessment is free. If we can help, you get a clear quote before any work starts, and you decide whether to go ahead.']
const COST_OTHER: QA = ['What does it cost?', 'Your first consultation is free. If we can help further, you get a clear quote before any work starts.']

export const SERVICE_CONTENT: Record<string, ServiceContent> = {
  'bad-payment-profile': {
    slug: 'bad-payment-profile',
    seoTitle: 'Fix a Bad Credit Record in South Africa',
    seoDescription: 'Missed payments or wrong listings dragging your credit score down? We check your report and dispute what shouldn’t be there. Start with a free assessment.',
    h1: ['Bad payment profile?', 'Let’s correct the record.'],
    lede: 'We go through every account on your credit report and dispute what’s wrong, outdated or unproven.',
    visual: 'payment-row',
    signs: [
      'You’ve been declined, and nobody told you why.',
      'Your report shows missed payments you don’t recognise.',
      'Accounts you settled still show as owing.',
      'Old listings are still there years later.',
    ],
    stepsTitle: 'Three steps to a cleaner report.',
    steps: [
      { title: 'We pull your report', body: 'With your consent, we get your record from the credit bureaus and go through it line by line.' },
      { title: 'We dispute what’s wrong', body: 'Incorrect, outdated or unproven items are challenged with the bureau and the creditor.' },
      { title: 'You see the update', body: 'We follow up until there’s an answer, then show you what changed and what’s next.' },
    ],
    outcomesTitle: 'From guessing to knowing.',
    outcomes: [
      { before: 'Listings you can’t explain', after: 'A report you understand, line by line' },
      { before: 'Wrong or outdated items', after: 'Disputed with the bureau and the creditor' },
      { before: 'Declined without a reason', after: 'A clear plan before your next application' },
    ],
    docs: [
      'Your ID (a clear copy is fine)',
      'Any recent credit report you have',
      'Proof of payment or settlement letters',
      'Statements for the accounts in question',
    ],
    faqs: [
      ['Can you remove missed payments that really happened?', 'No one can lawfully remove accurate information. Payment history can stay on your record for up to five years. We challenge anything that’s wrong, outdated or unproven, and help you build a better profile from here.'],
      ['How long does it take?', 'It depends on the creditor and the bureau. A bureau must investigate a dispute, usually within 20 business days, but follow-ups can take longer. We give you a realistic timeline at your assessment.'],
      ['Can I dispute it myself?', 'Yes. You can get a free credit report from each bureau once a year and dispute errors at no cost. We do the legwork for people who don’t have the time, or whose case needs letters and follow-ups.'],
      ['Will my score go up straight away?', 'Not always. Your score changes when the bureau updates your record, and it also depends on how you manage your accounts from now on. We show you what lenders look at.'],
      COST,
    ],
    related: ['default-judgment-removal', 'credit-profile-management', 'trace-alert-removal'],
  },

  'default-judgment-removal': {
    slug: 'default-judgment-removal',
    seoTitle: 'Judgment Removal South Africa: Defaults & Judgments',
    seoDescription: 'A default or judgment blocking your applications? We help you get judgments rescinded and defaults cleared, the legal way. Start with a free assessment.',
    h1: ['A judgment on your name?', 'Let’s get it rescinded.'],
    lede: 'We help you clear defaults and have judgments rescinded through the proper legal process, so they stop blocking your applications.',
    visual: 'judgment',
    signs: [
      'A creditor took you to court, maybe without you knowing.',
      'You’ve paid the debt, but the judgment is still listed.',
      'An old default keeps getting you declined.',
      'You want a home or car loan and a judgment is in the way.',
    ],
    stepsTitle: 'How a judgment comes off.',
    steps: [
      { title: 'We find the listing', body: 'We check your record and the court file to see exactly what was granted, and when.' },
      { title: 'We take the right route', body: 'A paid-up removal, the creditor’s consent or a rescission application, depending on your case.' },
      { title: 'We confirm it’s gone', body: 'Once it’s rescinded or removed, we check that the bureaus have updated your record.' },
    ],
    outcomesTitle: 'What changes when it’s rescinded.',
    outcomes: [
      { before: 'A judgment on your record', after: 'Rescinded by the court and removed' },
      { before: 'A paid debt still listed', after: 'Removed once proof of payment is lodged' },
      { before: 'Declined for a home or car loan', after: 'Applying without a judgment in the way' },
    ],
    docs: [
      'Your ID',
      'The summons or court case number, if you have it',
      'Proof that the debt is paid, or a settlement letter',
      'Any letters from the creditor or their attorneys',
    ],
    faqs: [
      ['What’s the difference between a default and a judgment?', 'A default is listed by a creditor when you fall behind on an account. A judgment is a court order against you for the debt. A judgment is more serious and usually needs a legal process to remove.'],
      ['Is a paid judgment removed automatically?', 'Not always. Once the capital is paid, the bureaus must remove a paid-up judgment when they receive proof of payment. A court can also rescind a judgment once the debt, interest and costs are paid in full. We help you take the right route.'],
      ['Can a judgment be rescinded if I haven’t paid?', 'Sometimes, for example if you never knew about the case or have a valid defence. It depends on your facts, so we look at your case first.'],
      ['How long does a judgment stay on my record?', 'Up to five years, or until a court rescinds it. Rescission can remove it sooner.'],
      ['How long does it take?', 'It depends on the route, the creditor and the court. We give you a realistic timeline once we’ve seen your case.'],
    ],
    related: ['bad-payment-profile', 'paralegal-blacklisting', 'admin-order-rescission'],
  },

  'debt-review': {
    slug: 'debt-review',
    seoTitle: 'Debt Review Removal and Clearance Certificates',
    seoDescription: 'Paid off your debts but still flagged under debt review? We help you get your clearance certificate and your record updated. Start with a free assessment.',
    h1: ['Stuck in debt review?', 'There is a way out.'],
    lede: 'We explain your options, chase your clearance certificate and make sure the bureaus remove the debt review flag.',
    visual: 'clearance',
    signs: [
      'Your debts are paid, but you’re still flagged.',
      'Your debt counsellor has gone quiet.',
      'You can’t get credit until the flag is gone.',
      'You’re not sure if you’re allowed to leave.',
    ],
    stepsTitle: 'Your way out, in three steps.',
    steps: [
      { title: 'We check your status', body: 'Where your debt review stands, whether a court order was made, and what’s still owed.' },
      { title: 'We take the right route', body: 'Your clearance certificate if you qualify, or the legal process that fits your case.' },
      { title: 'We confirm the flag is gone', body: 'We follow up with your debt counsellor and the bureaus until your record shows it.' },
    ],
    outcomesTitle: 'What changes when you’re cleared.',
    outcomes: [
      { before: 'Flagged under debt review', after: 'Clearance certificate issued' },
      { before: 'Locked out of new credit', after: 'Free to apply again' },
      { before: 'No word from your debt counsellor', after: 'Someone following up for you' },
    ],
    docs: [
      'Your ID',
      'Your debt counsellor’s name and contact details',
      'Your debt review court order, if there is one',
      'Paid-up letters or recent statements from your creditors',
    ],
    faqs: [
      ['How do I get out of debt review?', 'The usual way is to pay off the debts in your plan and get a clearance certificate from your debt counsellor. In some cases there’s a legal process to end it earlier. Which applies depends on your case, so we check first.'],
      ['What is a clearance certificate?', 'It’s the certificate your debt counsellor issues once you’ve met the requirements of your debt review. When the bureaus receive it, they must remove the debt review flag from your record.'],
      ['My debts are paid. Why am I still flagged?', 'Often the clearance certificate hasn’t been issued, or hasn’t reached the bureaus. Your debt counsellor must issue and file it once you qualify. We follow up until it’s done.'],
      ['Does my home loan have to be paid off first?', 'Not necessarily. If your other debts in the plan are settled and your home loan is up to date and affordable, you can qualify for a clearance certificate. We check how this applies to you.'],
      ['Can I get credit while I’m under debt review?', 'Generally, no. That’s why getting the flag removed matters so much once you qualify.'],
    ],
    related: ['admin-order-rescission', 'bad-payment-profile', 'credit-profile-management'],
  },

  'fraud-listing-removal': {
    slug: 'fraud-listing-removal',
    seoTitle: 'Fraud Listing Removal at the Credit Bureaus',
    seoDescription: 'Accounts opened in your name, or wrongly flagged as a fraud risk? We help you dispute fraudulent listings and protect your ID. Start with a free assessment.',
    h1: ['Someone used your ID?', 'Let’s clear your name.'],
    lede: 'We help you dispute accounts you never opened, challenge wrong fraud listings and protect your identity.',
    visual: 'fraud',
    signs: [
      'There are accounts on your report you never opened.',
      'Your ID was lost or stolen.',
      'A lender says you’re flagged for fraud.',
      'Collectors call about debts that aren’t yours.',
    ],
    stepsTitle: 'Three steps to your name back.',
    steps: [
      { title: 'We map the damage', body: 'We pull your report and list every account and listing that isn’t yours.' },
      { title: 'We dispute each one', body: 'With your police case and affidavit, we challenge each account with the creditor and the bureaus.' },
      { title: 'We protect your ID', body: 'We help you apply for free SAFPS protective registration, so lenders take extra care with your ID.' },
    ],
    outcomesTitle: 'What changes for you.',
    outcomes: [
      { before: 'Accounts you never opened', after: 'Disputed with the creditor and the bureaus' },
      { before: 'Flagged as a fraud risk', after: 'The listing challenged, with evidence' },
      { before: 'Your ID out in the wild', after: 'Protective registration in place' },
    ],
    docs: [
      'Your ID, or temporary ID if yours was stolen',
      'A SAPS case number and affidavit',
      'Letters, SMSes or statements about the accounts',
      'Your latest credit report, if you have one',
    ],
    faqs: [
      ['What should I do first?', 'Report it to the police and get a case number. Then contact us. The case number and your affidavit are the backbone of every dispute.'],
      ['What is SAFPS protective registration?', 'It’s a free service from the Southern African Fraud Prevention Service. It alerts its member organisations to take extra care when someone applies using your ID.'],
      ['What if I’m flagged as a fraudster by mistake?', 'A wrong fraud listing can be challenged with evidence. We help you build that case and take it up with the organisation that listed you.'],
      ['Will I have to pay the fraudulent debts?', 'Generally, you can’t be held to an agreement you never entered into. But you need to show that, which is why we start with your police case and the paper trail.'],
      ['How long does it take?', 'It depends on how many accounts are involved and how quickly each creditor responds. We give you a realistic timeline once we’ve seen your report.'],
    ],
    related: ['bad-payment-profile', 'credit-profile-management', 'paralegal-blacklisting'],
  },

  'trace-alert-removal': {
    slug: 'trace-alert-removal',
    seoTitle: 'Trace Alert Removal from Your Credit Report',
    seoDescription: 'A trace alert on your credit report means a creditor is looking for you. We help you deal with them and update your details. Start with a free assessment.',
    h1: ['Trace alert on file?', 'Let’s get it sorted.'],
    lede: 'A trace alert means a creditor is looking for you, so we help you deal with them and get your details updated.',
    visual: 'radar',
    signs: [
      'You moved or changed numbers and lost touch with a creditor.',
      'A lender mentioned a trace alert when you applied.',
      'You don’t know who’s looking for you, or why.',
      'You want to settle the account and move on.',
    ],
    stepsTitle: 'Found, sorted, updated.',
    steps: [
      { title: 'We find who placed it', body: 'We check your report to see which creditor placed the alert and what it’s about.' },
      { title: 'We deal with the creditor', body: 'We contact them, confirm your details and sort out the account behind the alert.' },
      { title: 'We update your record', body: 'We make sure your contact details are current and the outdated alert is closed.' },
    ],
    outcomesTitle: 'What changes for you.',
    outcomes: [
      { before: 'A creditor looking for you', after: 'The account dealt with, directly' },
      { before: 'Old contact details on file', after: 'Your current details on record' },
      { before: 'Questions at every application', after: 'A cleaner report to apply with' },
    ],
    docs: [
      'Your ID',
      'Proof of your current address',
      'Your current phone number and email',
      'Any letters or messages from the creditor',
    ],
    faqs: [
      ['What is a trace alert?', 'It’s a request by a creditor to be notified when your contact details change on your credit record, usually because they couldn’t reach you.'],
      ['Does a trace alert mean I’m blacklisted?', 'No. There’s no single blacklist in South Africa. But a lender who sees a trace alert may ask questions, and it usually points to an account that needs attention.'],
      ['Will it go away on its own?', 'Trace alerts are usually time-limited, but the account behind one doesn’t go away by itself. We help you deal with both.'],
      ['How long does it take to sort out?', 'It depends on the creditor and the account. Once we’ve seen your report, we give you a realistic timeline.'],
      COST,
    ],
    related: ['bad-payment-profile', 'credit-profile-management', 'default-judgment-removal'],
    guide: 'am-i-blacklisted',
  },

  'admin-order-rescission': {
    slug: 'admin-order-rescission',
    seoTitle: 'Administration Order Rescission in South Africa',
    seoDescription: 'Under an administration order and want out? We help you apply to have it rescinded and make sure your credit record is updated. Start with a free assessment.',
    h1: ['Under an admin order?', 'Take back control.'],
    lede: 'If your debts are paid or the order no longer fits your life, we help you apply to have it rescinded.',
    visual: 'admin-order',
    signs: [
      'Money comes off your salary every month for the order.',
      'You think your debts should be paid by now.',
      'You can’t get credit while the order stands.',
      'Your administrator doesn’t give you clear answers.',
    ],
    stepsTitle: 'How an admin order ends.',
    steps: [
      { title: 'We get the full picture', body: 'We request the order, the payments made and what’s still owed from your administrator.' },
      { title: 'We prepare the application', body: 'We prepare the paperwork to ask the court to rescind the order, and guide you through it.' },
      { title: 'We update your record', body: 'Once the order is rescinded, we check that the bureaus have updated your record.' },
    ],
    outcomesTitle: 'What changes when it’s rescinded.',
    outcomes: [
      { before: 'Balances you can’t follow', after: 'A clear statement of what’s owed' },
      { before: 'An order that never seems to end', after: 'A clear path to rescission' },
      { before: 'An admin order on your record', after: 'Removed once the court rescinds it' },
    ],
    docs: [
      'Your ID',
      'The administration order and case number',
      'Your administrator’s name and contact details',
      'Recent payslips and any payment statements',
    ],
    faqs: [
      ['What is an administration order?', 'It’s a court order that places your debts under an administrator, who collects one payment from you and pays your creditors. It’s meant for people with smaller total debts.'],
      ['Can an admin order be rescinded?', 'Yes. A court can rescind an administration order, for example once your debts are paid. Every case is different, so we look at yours first.'],
      ['Will rescinding it clear my record?', 'An administration order can stay on your record until a court rescinds it. Once it’s rescinded, the bureaus must update your record.'],
      ['What if I still owe some creditors?', 'Then rescission may not be the right step yet, and older court orders against you could revive. We check what you still owe before we advise you.'],
      ['How long does it take?', 'It depends on your administrator, the court and your paperwork. We give you a realistic timeline once we have your file.'],
    ],
    related: ['debt-review', 'default-judgment-removal', 'paralegal-blacklisting'],
    guide: 'am-i-blacklisted',
  },

  'credit-profile-management': {
    slug: 'credit-profile-management',
    seoTitle: 'Improve Your Credit Score in South Africa',
    seoDescription: 'Planning a home or car loan? We read your credit report with you, fix what’s wrong and show you what lenders look at. Start with a free assessment.',
    h1: ['Know your score.', 'Get loan-ready.'],
    lede: 'We read your credit report with you, fix what’s wrong and show you what lenders look at before you apply.',
    visual: 'score',
    signs: [
      'You’re planning to apply for a home or car loan.',
      'You’ve never seen your own credit report.',
      'Your score dropped and you don’t know why.',
      'You’ve cleared a listing and want to keep it clean.',
    ],
    stepsTitle: 'Apply when you’re ready, not hoping.',
    steps: [
      { title: 'We read your report', body: 'We go through your report with you and explain what each line means to a lender.' },
      { title: 'We fix what’s wrong', body: 'Anything incorrect or outdated is disputed, so your score reflects the real you.' },
      { title: 'We plan your next move', body: 'Practical steps to strengthen your profile, and when it makes sense to apply.' },
    ],
    outcomesTitle: 'What changes for you.',
    outcomes: [
      { before: 'A score you don’t understand', after: 'You know what drives it' },
      { before: 'Errors pulling you down', after: 'Disputed and corrected' },
      { before: 'Applying and hoping', after: 'Applying when you’re ready' },
    ],
    docs: [
      'Your ID',
      'Your latest payslip or proof of income',
      'Any recent credit report you have',
      'A list of your accounts and monthly repayments',
    ],
    faqs: [
      ['How do I check my credit score?', 'You’re entitled to one free credit report a year from each credit bureau. We can help you get yours and explain what it says.'],
      ['What hurts a credit score most?', 'Missed payments, defaults and judgments, using too much of your available credit, and lots of credit applications in a short time.'],
      ['Does checking my own report lower my score?', 'No. Checking your own report doesn’t count against you. Applications for credit are what lenders see.'],
      ['How quickly can my score improve?', 'Corrections can show once the bureau updates your record, but good habits take months to build up. We give you a realistic picture at your assessment.'],
      COST,
    ],
    related: ['bad-payment-profile', 'default-judgment-removal', 'debt-review'],
  },

  'paralegal-blacklisting': {
    slug: 'paralegal-blacklisting',
    seoTitle: 'Blacklisting Paralegal Help for Credit Disputes',
    seoDescription: 'Dealing with a blacklisting dispute, a letter of demand or court papers? We draft the letters and follow up so you’re not alone. Start with a free assessment.',
    h1: ['Blacklisting dispute?', 'Get paralegal help.'],
    lede: 'We draft the letters, prepare the paperwork and keep your dispute moving, so you’re not doing it alone.',
    visual: 'paralegal',
    signs: [
      'You’ve received a letter of demand or a summons.',
      'A creditor or bureau won’t respond to you.',
      'You don’t understand the court papers you were given.',
      'You need a dispute put in writing, properly.',
    ],
    stepsTitle: 'Paperwork, handled properly.',
    steps: [
      { title: 'We read your papers', body: 'We go through your letters, court documents and credit report, and explain them plainly.' },
      { title: 'We draft and send', body: 'We prepare disputes, letters and applications, and send them to the right people.' },
      { title: 'We follow up', body: 'We keep pushing for answers, and tell you straight away if your matter needs an attorney.' },
    ],
    outcomesTitle: 'What changes for you.',
    outcomes: [
      { before: 'Papers you don’t understand', after: 'A plain explanation of where you stand' },
      { before: 'Letters that go unanswered', after: 'Disputes sent properly, and followed up' },
      { before: 'Facing it alone', after: 'Someone in your corner, step by step' },
    ],
    docs: [
      'Your ID',
      'Every letter, summons or court document you’ve received',
      'Your credit report, if you have it',
      'Proof of payments or agreements with the creditor',
    ],
    faqs: [
      ['What can a paralegal do for me?', 'We help with research, letters, disputes and preparing documents. A paralegal isn’t an attorney, so if your matter needs court representation, we tell you.'],
      ['I got a summons. What now?', 'Don’t ignore it. A summons comes with strict deadlines. Contact us straight away so we can look at it with you and you can act in time.'],
      ['Is there really a blacklist?', 'Not a single list. Credit bureaus keep a record of how you’ve paid. Lenders read that record, and that’s what people mean by being blacklisted.'],
      ['How long does it take?', 'It depends on the matter and how quickly the other side responds. We give you a realistic timeline once we’ve seen your papers.'],
      COST,
    ],
    related: ['default-judgment-removal', 'admin-order-rescission', 'fraud-listing-removal'],
    guide: 'am-i-blacklisted',
  },

  'labour-relations': {
    slug: 'labour-relations',
    seoTitle: 'Labour Relations Consultant in Mpumalanga',
    seoDescription: 'Facing a workplace dispute, disciplinary hearing or dismissal? Get practical labour relations guidance from our Bethal office. Book a free consultation.',
    h1: ['A problem at work?', 'Get practical guidance.'],
    lede: 'We help employees and employers understand their rights and handle workplace disputes the right way.',
    visual: 'labour',
    signs: [
      'Disciplinary hearings and warnings',
      'Dismissals and retrenchments',
      'Disputes about pay, hours or leave',
      'Workplace policies and compliance',
    ],
    stepsTitle: 'Clear advice, then a plan.',
    steps: [
      { title: 'Tell us what happened', body: 'Call, WhatsApp or visit us in Bethal. We listen first.' },
      { title: 'Know where you stand', body: 'We explain your rights and obligations under South African labour law, plainly.' },
      { title: 'Act on a clear plan', body: 'We help you prepare letters, documents and next steps, and tell you when you need an attorney.' },
    ],
    faqs: [
      ['Do you help employees or employers?', 'Both. Tell us your side and we’ll explain where you stand and what your options are.'],
      ['Can you help with a CCMA case?', 'We can help you understand the process and prepare. Who may represent you at the CCMA depends on the type of case, so we explain your options.'],
      ['Is there a time limit to act?', 'Often, yes. An unfair dismissal dispute, for example, must usually be referred to the CCMA within 30 days of the dismissal. Talk to us early.'],
      COST_OTHER,
    ],
    related: ['general-consulting'],
  },

  'general-consulting': {
    slug: 'general-consulting',
    seoTitle: 'Business Consultants in Bethal, Mpumalanga',
    seoDescription: 'Starting or growing a small business? Get practical advice on planning, compliance and paperwork from our Bethal office, since 2015. Book a free consultation.',
    h1: ['Building a business?', 'Build on solid ground.'],
    lede: 'Practical advice for small businesses that want to grow, stay compliant and keep their paperwork in order.',
    visual: 'consulting',
    signs: [
      'Setting up a new business properly',
      'Planning, budgets and cash flow',
      'Compliance, policies and paperwork',
      'Getting ready to apply for business finance',
    ],
    stepsTitle: 'Advice you can act on.',
    steps: [
      { title: 'Tell us about your business', body: 'Call, WhatsApp or visit us in Bethal. We start with where you are now.' },
      { title: 'Find what matters most', body: 'We help you see what needs attention first, and what can wait.' },
      { title: 'Get a practical plan', body: 'Clear next steps, with support for the paperwork along the way.' },
    ],
    faqs: [
      ['What kind of businesses do you help?', 'Mostly small and growing businesses in and around Bethal. Tell us what you need and we’ll say honestly if we’re the right fit.'],
      ['Can you help me get business finance?', 'We can help you get your paperwork and credit profile in order before you apply. The lender decides on approval.'],
      ['Can we meet in person?', 'Yes. Visit our office in Bethal, or talk to us by phone or WhatsApp.'],
      COST_OTHER,
    ],
    related: ['labour-relations'],
  },
}

export const serviceContent = (slug: string): ServiceContent | undefined => SERVICE_CONTENT[slug]
