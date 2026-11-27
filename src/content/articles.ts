// Learn guides. Slugs, `service` and `published` are fixed (other pages link to them and the prerender reads this list).
// Owned by the Company & Content agent. DRAFT: all guide copy needs client (and ideally legal) review.
//
// Inline markup inside `text` / `items`: [label](/internal-path or https://external) and **bold**.
// Block types: p, h2 (becomes a table-of-contents entry), list, callout (explainer box), cta (the one mid-article CTA).

export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'callout'; title?: string; text: string }
  | { type: 'cta'; text: string }

export type Article = {
  slug: string
  title: string // H1, also the <title> base. ≤ 55 chars
  description: string // meta description, 140–160 chars
  minutes: number // reading time, computed from the body below
  service: string // related service slug (for the CTA + cross-link)
  published: string // ISO date
  updated?: string // ISO date, shown as "Updated …"
  body: ArticleBlock[]
  sources?: { label: string; url: string }[]
}

type Draft = Omit<Article, 'minutes'>

const DRAFTS: Draft[] = [
  {
    slug: 'am-i-blacklisted',
    title: 'Am I blacklisted? How to check your credit record',
    description: 'There’s no official blacklist in South Africa. See what lenders actually check, how to get your free credit report from each bureau and how to dispute errors.',
    service: 'credit-profile-management',
    published: '2026-11-27',
    body: [
      { type: 'p', text: 'If you’ve been declined for a loan, a car or even a phone contract, it’s easy to assume you’ve been “blacklisted”. In South Africa there is no single blacklist. What lenders look at is your **credit record**, held by credit bureaus, and the credit score worked out from it.' },
      { type: 'p', text: 'The good news: you can see exactly what they see, for free.' },

      { type: 'h2', text: 'What “blacklisted” usually means' },
      { type: 'p', text: 'People say they are blacklisted when their credit record shows something negative. That could be:' },
      { type: 'list', items: [
        'missed or late payments on an account',
        'an account listed as in default, handed over for collection or written off',
        'a court judgment or an administration order',
        'a debt review flag, which is not a negative listing but does stop new credit',
        'an account someone opened fraudulently in your name',
      ] },
      { type: 'p', text: 'Each of these is recorded separately, and each has its own limit on how long it may stay. Our guide on [default listings and how long they stay](/learn/what-is-a-default-listing) sets out the time limits.' },

      { type: 'h2', text: 'How to get your free credit report' },
      { type: 'p', text: 'The National Credit Act gives you the right to see your credit record free of charge once every 12 months, at **each** registered credit bureau. The main bureaus are:' },
      { type: 'list', items: [
        '**TransUnion** (transunion.co.za)',
        '**Experian** (experian.co.za), which took over Compuscan in 2019',
        '**XDS** (xds.co.za)',
      ] },
      { type: 'p', text: 'Not every lender reports to every bureau, so the reports can differ. If you have been declined, it’s worth checking all three. You register online and confirm your identity, usually with your ID number and a few questions about your accounts.' },
      { type: 'callout', title: 'Checking won’t hurt your score', text: 'Looking at your own credit report does not lower your score. The bureaus treat it differently from the enquiry a lender makes when you apply for credit.' },

      { type: 'h2', text: 'What to look for on your report' },
      { type: 'list', items: [
        '**Personal details.** Are your name, ID number and addresses right? An address you have never lived at can be a sign of fraud.',
        '**Accounts.** Do you recognise every account, and are the balances and statuses correct?',
        '**Payment history.** Are there missed payments you dispute, or accounts still shown as unpaid after you settled them?',
        '**Adverse listings.** Defaults, handovers, write-offs, judgments or administration orders, and the date each was listed.',
        '**Enquiries.** Applications for credit that you did not make.',
      ] },
      { type: 'p', text: 'If you have settled an account that was listed as adverse, the law says the credit provider must tell the bureaus within seven days, and the bureau must then remove the adverse listing within seven days (section 71A of the Act). If it’s still there, that is worth following up.' },
      { type: 'cta', text: '**Not sure what your report is telling you?** Our consultants read credit reports every day and can explain yours in plain language.' },

      { type: 'h2', text: 'If something on your report is wrong' },
      { type: 'p', text: 'You can dispute information you believe is wrong, free of charge. Contact the bureau (most have an online dispute form), explain what’s wrong and send any proof you have.' },
      { type: 'p', text: 'The bureau, or the credit provider that supplied the information, then has **20 business days** to show credible evidence that it is correct. If it can’t, the information must be removed. If you’re unhappy with the outcome, you can complain to the National Credit Regulator or to the credit division of the National Financial Ombud Scheme.' },
      { type: 'p', text: 'If you find an account you never opened, read our guide on [what to do when someone takes credit in your name](/learn/fraud-listing-on-my-name).' },

      { type: 'h2', text: 'What if the listing is correct?' },
      { type: 'p', text: 'Accurate, up-to-date information is allowed to stay on your record for the period the law sets, and nobody can lawfully remove it just because you ask. But you still have options: settle the account so it is updated, pay off a judgment and apply to have it rescinded, and build a record of on-time payments so newer information outweighs the old.' },
      { type: 'p', text: 'Our guide on [improving your credit score](/learn/how-to-improve-your-credit-score) covers the steps that help most.' },

      { type: 'h2', text: 'How we can help' },
      { type: 'p', text: 'Truemarc checks what is on your record, explains it in plain language and tells you honestly what can be fixed. See [how we help you manage your credit profile](/services/credit-profile-management), or start the free assessment below.' },
    ],
    sources: [
      { label: 'National Credit Act 34 of 2005 (section 72)', url: 'https://www.gov.za/sites/default/files/gcis_document/201409/a34-050_0.pdf' },
      { label: 'National Credit Amendment Act 19 of 2014 (section 71A)', url: 'https://www.parliament.gov.za/storage/app/img/Acts/2014/Act_19_of_2014_National_Credit_Amendment_Act.pdf' },
      { label: 'Experian: Your right of access to your credit report', url: 'https://www.experian.co.za/legal/trust-centre/consumer-trust-centre/data-rights/right-of-access' },
      { label: 'Experian: Completion of the acquisition of Compuscan (2019)', url: 'https://www.experianplc.com/newsroom/press-releases/2019/completion-of-acquisition-of-compuscan' },
      { label: 'NCR: Guideline on disputes (December 2025)', url: 'https://www.ncr.org.za/documents/Guidelines/Guideline%20December%202025.pdf' },
    ],
  },
  {
    slug: 'how-to-remove-a-judgment',
    title: 'How to remove a judgment from your credit record',
    description: 'How long a civil judgment stays on your credit record in South Africa, and the lawful ways to remove it: paying it off, consent, or rescission by the court.',
    service: 'default-judgment-removal',
    published: '2026-11-27',
    body: [
      { type: 'p', text: 'A civil judgment is a court order that says you owe a debt. Many are granted **by default**, because the summons went to an old address or the person didn’t respond in time. Either way, a judgment on your credit record makes most lenders say no.' },
      { type: 'p', text: 'There are lawful ways to get a judgment off your record. Which one fits depends on whether the debt is paid and how the judgment was granted.' },

      { type: 'h2', text: 'How long a judgment stays on your record' },
      { type: 'p', text: 'Under the National Credit Regulations, a civil judgment, including a default judgment, may be shown on your credit record for **up to five years**. It must come off sooner if:' },
      { type: 'list', items: [
        'the judgment debt is paid in full,',
        'a court rescinds (cancels) the judgment, or',
        'the creditor abandons the judgment.',
      ] },

      { type: 'h2', text: 'Route 1: Pay it off and have the listing removed' },
      { type: 'p', text: 'When you settle a judgment debt that came from a credit agreement, the credit provider must tell all the credit bureaus within seven days, and each bureau must then remove the listing within seven days (section 71A of the National Credit Act).' },
      { type: 'p', text: 'Ask the creditor, or its attorneys, for a paid-up letter. Check your credit report a few weeks later. If the judgment is still listed, dispute it with the bureau and attach the letter.' },
      { type: 'callout', title: 'Removed is not the same as rescinded', text: 'Paying the debt gets the judgment off your credit record, but the judgment itself still exists in the court file. Rescission cancels the judgment altogether, which some people want for a completely clean slate.' },

      { type: 'h2', text: 'Route 2: Rescission once the debt is paid' },
      { type: 'p', text: 'Since 1 August 2018, the Magistrates’ Courts Act lets a court rescind a judgment once the judgment debt, interest and costs have been paid in full. You can apply with or without the creditor’s consent, but the creditor must be given notice of the application (at least 10 court days). The High Court has a similar process under section 23A of the Superior Courts Act.' },
      { type: 'p', text: 'Once a court rescinds a judgment, the National Credit Act requires the credit bureaus to remove all information about it from your record.' },
      { type: 'cta', text: '**Have a judgment on your record?** We check how it was granted and whether it has been paid, and tell you which route fits your situation.' },

      { type: 'h2', text: 'Route 3: Rescission with the creditor’s consent' },
      { type: 'p', text: 'If the creditor agrees in writing that the judgment may be rescinded, you can apply to court for rescission on that basis (section 36(2) of the Magistrates’ Courts Act). This is often part of a settlement. The court has a discretion, but consent makes the application much simpler, and there is no short deadline.' },

      { type: 'h2', text: 'Route 4: A default judgment you didn’t know about' },
      { type: 'p', text: 'If the judgment was granted in your absence, you can ask the court to rescind it. In the Magistrate’s Court, you must normally apply **within 20 days** after finding out about the judgment, and show good cause: a reasonable explanation for not defending the case, and a genuine defence. The High Court has a similar 20-day rule.' },
      { type: 'p', text: 'A judgment that was obtained by fraud or by a mistake can also be rescinded, with a longer time limit.' },
      { type: 'callout', title: 'Act quickly', text: 'If you have only just found out about a default judgment, don’t wait. The time limit is short, and missing it makes rescission much harder.' },

      { type: 'h2', text: 'What a rescission application involves' },
      { type: 'list', ordered: true, items: [
        'Get the details of the judgment: the court, the case number and the creditor.',
        'Gather your proof: a paid-up letter, the creditor’s written consent, or the facts that support your defence.',
        'Prepare the application and a supporting affidavit, and serve them on the creditor.',
        'Attend the hearing. Paid-up applications can be heard in chambers.',
        'Send the court order to the credit bureaus and check that your record is updated.',
      ] },
      { type: 'p', text: 'Court procedure is technical, and mistakes cause delays and extra costs, so get help with the paperwork if you need it.' },

      { type: 'h2', text: 'Don’t ignore a summons' },
      { type: 'p', text: 'The easiest judgment to deal with is the one that is never granted. If you receive a summons, don’t ignore it. Contact the creditor or get advice straight away, while you still have time to respond.' },

      { type: 'h2', text: 'How we can help' },
      { type: 'p', text: 'Truemarc finds out exactly how your judgment was granted, gathers the paperwork and guides the rescission or removal through to an updated credit record. See [how we help with defaults and judgments](/services/default-judgment-removal), or start the free assessment below.' },
    ],
    sources: [
      { label: 'Courts of Law Amendment Act 7 of 2017', url: 'https://www.gov.za/sites/default/files/gcis_document/201708/410172-82017act7of2017courtsoflawamendacta.pdf' },
      { label: 'Amended Magistrates’ Courts Rules, rule 49 (GN R632 of 2018)', url: 'https://www.gov.za/sites/default/files/gcis_document/201806/41723rg10840gon632.pdf' },
      { label: 'National Credit Amendment Regulations, 2015 (regulation 17)', url: 'https://www.gov.za/sites/default/files/gcis_document/201503/38557rg10382gon202.pdf' },
      { label: 'National Credit Amendment Act 19 of 2014 (section 71A)', url: 'https://www.parliament.gov.za/storage/app/img/Acts/2014/Act_19_of_2014_National_Credit_Amendment_Act.pdf' },
    ],
  },
  {
    slug: 'how-to-get-out-of-debt-review',
    title: 'How to get out of debt review',
    description: 'How debt review ends in South Africa: what a clearance certificate is, why you can no longer simply cancel, and what to do if your certificate is delayed.',
    service: 'debt-review',
    published: '2026-11-27',
    body: [
      { type: 'p', text: 'Debt review is meant to be a lifeline. Your debts are restructured into one monthly payment you can afford, and while you stick to the plan your credit providers can’t take legal action to enforce those debts.' },
      { type: 'p', text: 'But it also puts a flag on your credit record, and while it’s there you can’t take on new credit. So it’s natural to want to know how to get out. The honest answer is that there are fewer exits than many websites claim, and the rules changed in 2022. Here’s how it works now.' },

      { type: 'h2', text: 'How debt review works' },
      { type: 'list', ordered: true, items: [
        'You apply to a registered debt counsellor, who checks whether you are over-indebted. This is section 86 of the National Credit Act.',
        'The debt counsellor notifies your credit providers and every registered credit bureau, and a debt review flag is placed on your credit record.',
        'If you are over-indebted, the debt counsellor proposes a new repayment plan. It is made an order of the Magistrate’s Court, or a consent order of the National Consumer Tribunal.',
        'You pay one amount each month, which is shared out between your credit providers.',
      ] },
      { type: 'p', text: 'While you are under debt review, the Act says you may not take on further credit (section 88). Any new credit you do get can later be declared reckless.' },
      { type: 'callout', title: 'Is debt review “blacklisting”?', text: 'No. The National Credit Regulator (NCR) says the debt review flag is not a negative listing. It tells lenders you are in a repayment plan, which is why new credit is usually declined until the flag is lifted.' },

      { type: 'h2', text: 'The main way out: a clearance certificate' },
      { type: 'p', text: 'Once your repayment plan has been made an order of court, the NCR’s guidelines say the way out is a **clearance certificate** issued under section 71 of the Act. Your debt counsellor must issue it within seven days after you have either:' },
      { type: 'list', items: [
        'paid off every debt that is part of your debt review, or',
        'paid off everything except your home loan (or another prescribed long-term agreement), and shown that you can keep paying that home loan with no arrears.',
      ] },
      { type: 'p', text: 'Within seven days of issuing the certificate, the debt counsellor must file a copy with the NCR and with all registered credit bureaus. The bureaus must then remove the debt review flag and the default information that led to it. Your normal payment history stays on your record.' },
      { type: 'p', text: 'In practice, the slowest part is often collecting a paid-up letter from every credit provider in your plan. Ask for each one as soon as an account is settled.' },

      { type: 'h2', text: 'Can you leave before a court order?' },
      { type: 'p', text: 'Many websites still say you can simply cancel debt review before your case goes to court. That changed on 7 March 2022. The NCR now takes the view that once you have applied, you cannot voluntarily withdraw before the debt counsellor issues the notice known as Form 17.2.' },
      { type: 'p', text: 'There is a narrow route. If your circumstances have changed, the new facts can be put before the Magistrate’s Court, which may reject the proposal or find that you are not over-indebted. If that happens, the debt counsellor must update the credit bureaus. You will still owe the debt counsellor’s fees for work already done.' },
      { type: 'cta', text: '**Not sure how close you are to a clearance certificate?** A consultant can look at your debt review status and what’s left to pay, and tell you the realistic next step.' },

      { type: 'h2', text: 'If your certificate is delayed or refused' },
      { type: 'list', ordered: true, items: [
        'Ask your debt counsellor for the certificate in writing, and attach your paid-up letters.',
        'If they refuse or don’t respond, you can ask the National Consumer Tribunal to review the decision. Section 71(3) of the Act gives you this right.',
        'If the certificate is issued but not filed with the bureaus, you can file a copy with the NCR yourself and lodge a complaint at complaints@ncr.org.za.',
        'Once it’s filed, get your free credit report and check that the flag has actually gone. Our guide on [checking your credit record](/learn/am-i-blacklisted) explains how.',
      ] },

      { type: 'h2', text: 'Be wary of “debt review removal” promises' },
      { type: 'p', text: 'In 2025 the NCR warned consumers about businesses that promise to remove debt review for a large upfront fee. Once your plan is a court order, debt review ends with a clearance certificate, not a shortcut. Anyone who tells you otherwise should be able to explain, in writing, exactly which legal process they will use.' },

      { type: 'h2', text: 'How we can help' },
      { type: 'p', text: 'Getting out of debt review is mostly paperwork and persistence: tracking down paid-up letters, following up with your debt counsellor and making sure the bureaus update your record. Truemarc helps you see where you stand and what’s left to do. See [how we help with debt review](/services/debt-review), or start the free assessment below.' },
    ],
    sources: [
      { label: 'National Credit Regulator: Debt counselling', url: 'https://ncr.org.za/index.php/departments/debt-counselling' },
      { label: 'NCR: Explanatory note to the Withdrawal Guidelines (01 of 2022)', url: 'https://ncr.org.za/documents/Explanatory%20Note%20to%20the%20Withdrawal%20Guidelines-01%20of%202022.pdf' },
      { label: 'NCR: Withdrawal from debt review guidelines (2021)', url: 'https://ncr.org.za/documents/27%20May%202021-Debt%20Withdrawal%20%20review.pdf' },
      { label: 'NCR: Circular 2 of 2025 on debt review removal', url: 'https://www.ncr.org.za/documents/Circulars/Circular%202%20of%202025%20-%20Debt%20Review%20Removal%20(003)%20(002).pdf' },
      { label: 'National Credit Amendment Act 19 of 2014 (section 71)', url: 'https://www.parliament.gov.za/storage/app/img/Acts/2014/Act_19_of_2014_National_Credit_Amendment_Act.pdf' },
    ],
  },
  {
    slug: 'what-is-a-default-listing',
    title: 'What a default listing means and how long it stays',
    description: 'What a default listing is, the warning lenders must give you first, how long each type of listing may stay on your credit record, and when it must come off.',
    service: 'bad-payment-profile',
    published: '2026-11-27',
    body: [
      { type: 'p', text: 'A default listing is a negative note on your credit record that says you fell behind on an account. Lenders see it when you apply for credit, and it is one of the most common reasons people get declined.' },
      { type: 'p', text: 'Here’s what it means, how long it can stay and what you can do about it.' },

      { type: 'h2', text: 'What counts as a default listing' },
      { type: 'p', text: 'The National Credit Regulations describe two kinds of negative, or “adverse”, information that a credit provider can report about an account:' },
      { type: 'list', items: [
        '**How you paid.** Classifications such as slow paying, delinquent, in default, or absconded (meaning the lender couldn’t reach you).',
        '**What the lender did about it.** Enforcement steps such as handing the account over for collection, taking legal action, or writing the debt off.',
      ] },
      { type: 'p', text: 'Your **payment profile**, the month-by-month record of whether you paid each account, is kept separately and also shows missed payments.' },

      { type: 'h2', text: 'You must be warned first' },
      { type: 'p', text: 'The regulations say a credit provider must give you at least **20 business days’ notice** before it reports adverse information about you to a credit bureau.' },
      { type: 'p', text: 'The regulations add a few more protections:' },
      { type: 'list', items: [
        'An account may only be listed as adverse once at least **three consecutive** minimum payments have been missed.',
        'If you settle the arrears within the notice period, or dispute what you owe, the adverse information may not be submitted.',
        'A debt that has prescribed under the Prescription Act may not be reported at all.',
      ] },
      { type: 'p', text: 'The notice is your chance to pay the arrears or agree on an arrangement before anything is listed. If you never received one, say so when you dispute the listing.' },

      { type: 'h2', text: 'How long each listing can stay' },
      { type: 'p', text: 'The National Credit Regulations, as amended in 2015, set the longest time each type of information may be shown on your credit record:' },
      { type: 'list', items: [
        '**How you paid** (slow paying, in default and similar): up to 1 year',
        '**Enforcement action** (handed over, legal action, written off): up to 1 year',
        '**Payment profile:** up to 5 years',
        '**Enquiries:** up to 1 year',
        '**Civil court judgments:** up to 5 years, or until rescinded or abandoned',
        '**Administration orders:** up to 5 years, or until rescinded',
        '**Debt review:** until a clearance certificate is issued',
      ] },
      { type: 'p', text: 'These are maximum periods. When a period runs out, the information must come off your record, whether or not you ask.' },
      { type: 'callout', title: 'Paying it off changes what lenders see', text: 'When you settle an account that was listed as adverse, the credit provider must tell the bureaus within seven days, and the bureau must then remove the adverse listing within seven days (section 71A of the National Credit Act).' },

      { type: 'h2', text: 'When a default must come off early' },
      { type: 'list', items: [
        '**It’s wrong.** It isn’t your account, the amount is wrong, it was already paid, or you were never given notice. You can dispute it for free, and the bureau or lender then has 20 business days to prove it is correct or remove it.',
        '**It’s settled.** Once you pay the account in full, the adverse listing must be removed under section 71A.',
        '**It’s out of date.** Anything older than its retention period must be removed.',
      ] },
      { type: 'p', text: 'If a default is accurate, recent and unpaid, it may lawfully stay until its time runs out. Be wary of anyone who promises otherwise.' },
      { type: 'cta', text: '**Declined because of a default?** We check every listing on your record, challenge what’s wrong or out of date, and give you a realistic plan for the rest.' },

      { type: 'h2', text: 'Rebuilding after a default' },
      { type: 'p', text: 'A default loses weight as it gets older, and what you do now matters most. Bring other accounts up to date, pay on time every month, keep card balances low and avoid applying for new credit for a while. Our guide on [improving your credit score](/learn/how-to-improve-your-credit-score) goes step by step.' },
      { type: 'p', text: 'Not sure what is listed against you? Start by [checking your credit record](/learn/am-i-blacklisted). It’s free once a year at each bureau.' },

      { type: 'h2', text: 'How we can help' },
      { type: 'p', text: 'Truemarc reviews your payment profile and listings line by line, disputes what shouldn’t be there and follows up until your record is updated. See [how we help with a bad payment profile](/services/bad-payment-profile), or start the free assessment below.' },
    ],
    sources: [
      { label: 'National Credit Regulations, 2006 (regulations 17 and 19)', url: 'https://www.gov.za/sites/default/files/gcis_document/201409/28864.pdf' },
      { label: 'National Credit Amendment Regulations, 2015 (Government Gazette 38557)', url: 'https://www.gov.za/sites/default/files/gcis_document/201503/38557rg10382gon202.pdf' },
      { label: 'National Credit Amendment Act 19 of 2014 (section 71A)', url: 'https://www.parliament.gov.za/storage/app/img/Acts/2014/Act_19_of_2014_National_Credit_Amendment_Act.pdf' },
      { label: 'NCR: Guideline on disputes (December 2025)', url: 'https://www.ncr.org.za/documents/Guidelines/Guideline%20December%202025.pdf' },
    ],
  },
  {
    slug: 'fraud-listing-on-my-name',
    title: 'Someone took credit in my name. What now?',
    description: 'Found an account you never opened on your credit report? How to report identity fraud, dispute the listing and protect your ID for free with SAFPS.',
    service: 'fraud-listing-removal',
    published: '2026-11-27',
    body: [
      { type: 'p', text: 'Finding an account you never opened on your credit report is frightening, especially if it’s the reason you were declined. The good news is that you have clear rights, and there is a free way to protect your ID number from being used again.' },
      { type: 'p', text: 'Act quickly. The sooner you report it, the easier it is to show the account isn’t yours.' },

      { type: 'h2', text: 'Step 1: See exactly what’s been opened' },
      { type: 'p', text: 'You can get a free credit report from each credit bureau once every 12 months. Our guide on [checking your credit record](/learn/am-i-blacklisted) explains how. Look for accounts, enquiries and addresses you don’t recognise, and write down the credit provider and account number for each one.' },

      { type: 'h2', text: 'Step 2: Report the fraud' },
      { type: 'list', ordered: true, items: [
        '**Open a case with the South African Police Service (SAPS)** for identity fraud, and keep the case number.',
        '**Contact the fraud department of each credit provider** involved. Tell them in writing that you did not apply for the account, and give them your case number.',
        '**Don’t sign an acknowledgement of debt** or agree to a payment arrangement for an account you didn’t open.',
      ] },

      { type: 'h2', text: 'Step 3: Protect your ID with SAFPS' },
      { type: 'p', text: 'The Southern African Fraud Prevention Service (SAFPS) offers **Protective Registration**, and it is free. It flags your ID number so that SAFPS members, such as banks and other lenders, take extra care to confirm it’s really you before they grant credit.' },
      { type: 'p', text: 'You can apply online, by email to protection@safps.org.za, or by asking for a call back on the SAFPS website. You will usually need:' },
      { type: 'list', items: [
        'a certified copy of your ID, passport or driver’s licence',
        'a selfie holding your ID, with a note showing the date',
        'proof of address that is not older than three months',
        'the completed application form',
      ] },
      { type: 'callout', title: 'Protection is not removal', text: 'Protective Registration helps stop new fraud. It does not remove accounts that are already on your credit record. That is a separate step, below.' },

      { type: 'h2', text: 'Step 4: Dispute the listing with the credit bureaus' },
      { type: 'p', text: 'The National Credit Act gives you the right to dispute information on your credit record, free of charge. Once you lodge a dispute, the bureau (or the credit provider that supplied the information) has **20 business days** to produce credible evidence that it is correct. If it can’t, the information must be removed.' },
      { type: 'p', text: 'Guidelines from the National Credit Regulator (NCR) also require bureaus to temporarily hide disputed information while they investigate, and not to put removed information back without new evidence.' },
      { type: 'p', text: 'Send your SAPS case number with the dispute, along with a sworn statement that you did not open the account. Keep copies and reference numbers of everything you send.' },
      { type: 'cta', text: '**Found an account you don’t recognise?** We help you put the dispute together, follow up with the bureaus and credit providers, and check that the listing is gone.' },

      { type: 'h2', text: 'If the listing isn’t removed' },
      { type: 'p', text: 'If the bureau sends you evidence you disagree with, you can complain to the NCR within 20 business days of receiving it. You can also take the matter to the credit division of the National Financial Ombud Scheme (NFO), which handles fraud complaints. The NFO will ask you to go to the bureau first and give it 20 business days to respond, so keep your dispute reference number.' },

      { type: 'h2', text: 'Protect yourself from here' },
      { type: 'list', items: [
        'Never share one-time PINs, passwords or copies of your ID with anyone who contacts you out of the blue.',
        'Be careful about posting photos of your ID or documents online, including in WhatsApp groups.',
        'Shred old statements and documents that show your ID number.',
        'Check your credit reports at least once a year, and straight away if a lender declines you unexpectedly.',
      ] },

      { type: 'h2', text: 'How we can help' },
      { type: 'p', text: 'Clearing a fraud listing takes paperwork, follow-ups and patience, often while you are still dealing with the shock. Truemarc can take that on with you. See [how we help with fraud listings](/services/fraud-listing-removal), or start the free assessment below.' },
    ],
    sources: [
      { label: 'SAFPS: Apply for Protective Registration', url: 'https://www.safps.org.za/Home/OurServices_ApplyProtectiveRegistration' },
      { label: 'NCR: Guideline on disputes (December 2025)', url: 'https://www.ncr.org.za/documents/Guidelines/Guideline%20December%202025.pdf' },
      { label: 'National Financial Ombud Scheme: FAQs', url: 'https://nfosa.co.za/faqs/' },
      { label: 'National Credit Act 34 of 2005 (section 72)', url: 'https://www.gov.za/sites/default/files/gcis_document/201409/a34-050_0.pdf' },
    ],
  },
  {
    slug: 'how-to-improve-your-credit-score',
    title: 'How to improve your credit score in South Africa',
    description: 'Honest, practical steps to improve your credit score in South Africa: what the bureaus look at, what helps, what hurts and how long negative listings last.',
    service: 'credit-profile-management',
    published: '2026-11-27',
    body: [
      { type: 'p', text: 'Your credit score is a number a credit bureau works out from your credit record. Lenders use it, together with your income and expenses, to decide whether to give you credit and on what terms.' },
      { type: 'p', text: 'There is no trick that fixes a score overnight. But there are steps that genuinely help, and most of them cost nothing.' },

      { type: 'h2', text: 'What affects your score' },
      { type: 'p', text: 'Each bureau uses its own scoring model, so your score can differ from one bureau to the next. But the bureaus point to the same main factors:' },
      { type: 'list', items: [
        '**Paying on time.** TransUnion says late payments drop your score, and court records lower it significantly.',
        '**How much of your limits you use.** TransUnion suggests keeping balances below about 35% of your credit limit. Experian says balances at 50% or more of your limit could affect your score.',
        '**How often you apply.** Many applications, or several new accounts in a short time, make you look like a higher risk.',
        '**Negative listings.** Defaults, judgments and administration orders weigh on your score for as long as they are on your record.',
      ] },
      { type: 'p', text: 'A good score is not the whole story. Before approving credit, lenders must also check that you can afford it, as the National Credit Act requires. So lowering your monthly debt repayments helps with approvals too.' },

      { type: 'h2', text: 'Seven steps that help' },
      { type: 'list', ordered: true, items: [
        '**Get your free credit reports first.** You can’t fix what you can’t see. Here’s [how to check your credit record](/learn/am-i-blacklisted).',
        '**Dispute anything that’s wrong.** Information that can’t be verified must be removed, and that includes accounts opened fraudulently in your name.',
        '**Pay every account on time, every month.** Set debit orders to go off just after payday so a payment is never missed by accident.',
        '**Bring arrears up to date, and settle what you can.** When you settle an account that was listed as adverse, the credit provider must tell the bureaus within seven days, and the adverse listing must then be removed.',
        '**Pay down card and store account balances** so you use less of your available limit.',
        '**Pause new applications.** Every application leaves an enquiry on your record. Apply only when you need to, and not to several lenders at once.',
        '**Don’t take on debt just to build a score.** New credit you can’t comfortably repay will do more harm than good.',
      ] },
      { type: 'callout', title: 'Checking your score is free and safe', text: 'You are entitled to one free credit report a year from each bureau, and some bureaus offer free score checks more often. Experian says it does not penalise you for checking your own score or report.' },
      { type: 'cta', text: '**Want a plan for your score?** We check what’s on your record and show you what to fix first.' },

      { type: 'h2', text: 'How long negative information lasts' },
      { type: 'p', text: 'The National Credit Regulations set the longest time that each type of information may be shown on your credit record. For example:' },
      { type: 'list', items: [
        'enquiries: up to one year',
        'your payment profile: up to five years',
        'civil court judgments: up to five years, or until the judgment is rescinded or abandoned',
      ] },
      { type: 'p', text: 'Our guide on [default listings](/learn/what-is-a-default-listing) has the full picture. Because older information drops off over time, your recent behaviour matters most. A year of on-time payments makes a real difference.' },

      { type: 'h2', text: 'Be careful of quick fixes' },
      { type: 'p', text: 'Be wary of anyone who promises to clean your record overnight or guarantees a particular score. Correct, up-to-date information can’t lawfully be removed just because you pay someone. What can be done is to remove what is wrong or outdated, settle and rescind where the law allows, and build a better payment history.' },

      { type: 'h2', text: 'How we can help' },
      { type: 'p', text: 'Truemarc looks at your full credit record, removes what shouldn’t be there through the proper channels and gives you a clear plan for the rest. See [how we help with credit profile management](/services/credit-profile-management), or start the free assessment below.' },
    ],
    sources: [
      { label: 'TransUnion CreditView: Frequently asked questions', url: 'https://creditview.transunion.co.za/Help/FAQ' },
      { label: 'Experian: Free credit check and credit report', url: 'https://www.experian.co.za/consumer/my-free-credit-check-and-your-free-credit-report' },
      { label: 'National Credit Amendment Act 19 of 2014 (section 71A)', url: 'https://www.parliament.gov.za/storage/app/img/Acts/2014/Act_19_of_2014_National_Credit_Amendment_Act.pdf' },
      { label: 'National Credit Act 34 of 2005', url: 'https://www.gov.za/sites/default/files/gcis_document/201409/a34-050_0.pdf' },
    ],
  },
]

const plain = (t: string) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '')
const words = (body: ArticleBlock[]) =>
  body.reduce((n, b) => n + plain(b.type === 'list' ? b.items.join(' ') : `${'title' in b && b.title ? b.title : ''} ${b.text}`).split(/\s+/).filter(Boolean).length, 0)

/** Words in a guide's body (used for reading time and the 600–900 word target). */
export const wordCount = (a: Pick<Article, 'body'>) => words(a.body)

export const ARTICLES: Article[] = DRAFTS.map((a) => ({ ...a, minutes: Math.max(3, Math.round(words(a.body) / 200)) }))

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug)
