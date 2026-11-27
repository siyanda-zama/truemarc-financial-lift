import { Link } from 'react-router-dom'
import Seo from '@/components/Seo'
import LegalDoc, { type LegalSection } from '@/components/company/LegalDoc'
import { breadcrumbLd } from '@/lib/schema'
import { BUSINESS } from '@/lib/site'

// DRAFT for legal review: plain-language POPIA notice. Retention periods, analytics tools and the
// Information Officer's name must be confirmed by the client before launch.

const UPDATED = '27 November 2026'
const IR_SITE = 'https://inforegulator.org.za/complaints/'
const IR_COMPLAINTS = 'POPIAComplaints@inforegulator.org.za'

const a = BUSINESS.address
const mail = <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>

const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: <>
      <p>{BUSINESS.name} (“Truemarc”, “we”, “us”) is the responsible party for the personal information collected through this website, under the Protection of Personal Information Act, 2013 (POPIA).</p>
      <p>Our office is at {a.line1}, {a.street}, {a.town} {a.postcode}, {a.province}. You can reach us on {BUSINESS.phones.map((p) => p.label).join(' or ')}, or at {mail}.</p>
    </>,
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: <>
      <h3>When you use the free assessment</h3>
      <ul>
        <li>The answers you choose: your situation, what you want to do next, and a rough range of what you owe.</li>
        <li>Your first name, mobile number and, if you give it, your email address.</li>
      </ul>
      <h3>When you use the contact form</h3>
      <ul>
        <li>Your first name, mobile number, email address (optional) and your message.</li>
      </ul>
      <h3>Campaign and visit details sent with a form</h3>
      <ul>
        <li>The page you first arrived on and the website that sent you to us.</li>
        <li>Campaign tags in the link you clicked, such as <b>utm_source</b> or <b>utm_campaign</b>, and ad click IDs from Google (<b>gclid</b>) or Meta (<b>fbclid</b>).</li>
        <li>The page you sent the form from, and the date and time.</li>
      </ul>
      <p>These help us see which adverts and pages lead to enquiries. They don’t tell us anything about your credit record.</p>
      <h3>When you call, WhatsApp or email us</h3>
      <p>Your number or email address, and whatever you choose to tell us.</p>
      <h3>If you become a client</h3>
      <p>To help you, we will need more, such as your ID number, your credit reports and supporting documents. We explain what we need, and why, at that stage, and only collect it with your consent.</p>
      <h3>Technical details when you send a form</h3>
      <p>To block spam and repeated abuse, our server keeps your IP address only as a salted hash: a scrambled code that can’t be turned back into the address.</p>
      <h3>Analytics and cookies</h3>
      <p>We may use Google Tag Manager, Google Analytics, Google Ads and the Meta Pixel to understand how people use this site and which adverts work. Only when these tools are switched on, they may set cookies in your browser and record things like the pages you visit and the buttons you tap. You can block or delete cookies in your browser settings; the site still works without them.</p>
    </>,
  },
  {
    id: 'why-we-use-it',
    title: 'Why we use it',
    body: <>
      <ul>
        <li>To contact you about your enquiry or assessment, normally {BUSINESS.responseTime}.</li>
        <li>To understand your situation and recommend the right service.</li>
        <li>To carry out the services you ask us for.</li>
        <li>To measure which pages and adverts bring enquiries, so we spend our marketing budget well.</li>
        <li>To keep proper records and meet our legal obligations.</li>
      </ul>
      <p>We only use your information for these purposes, or for a purpose that is compatible with them.</p>
    </>,
  },
  {
    id: 'consent',
    title: 'Your consent',
    body: <>
      <p>Our forms ask you to tick a box agreeing that Truemarc may contact you. By ticking it, you agree that we may phone, WhatsApp, SMS or email you about your enquiry.</p>
      <p>You can withdraw your consent at any time by telling us. This doesn’t affect anything we lawfully did before you withdrew it.</p>
      <p>We will only send you marketing messages if you have agreed to receive them, and every marketing message will tell you how to opt out.</p>
    </>,
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: <>
      <p><b>We never sell your personal information.</b> We only share it when we need to:</p>
      <ul>
        <li><b>Credit bureaus and credit providers</b>, only as part of a service you have asked us to do, for example to get your credit report or dispute a listing.</li>
        <li><b>Courts, debt counsellors, attorneys or other professionals</b>, when your matter needs them and you have instructed us to proceed.</li>
        <li><b>Service providers who help us run the business</b>, such as website hosting, email, phone and messaging services (including WhatsApp), and analytics and advertising platforms. They may only use your information to provide their service to us.</li>
        <li><b>Authorities</b>, when the law requires us to.</li>
      </ul>
    </>,
  },
  {
    id: 'outside-sa',
    title: 'Information sent outside South Africa',
    body: <>
      <p>Some of our service providers, such as Google and Meta (WhatsApp), may store or process information on servers outside South Africa. When that happens, we rely on providers that are bound by data protection laws or agreements that give a similar level of protection to POPIA.</p>
    </>,
  },
  {
    id: 'how-long',
    title: 'How long we keep it',
    body: <>
      <p>We keep personal information only for as long as we need it for the purpose we collected it for. If you don’t become a client, we delete or anonymise your enquiry details once we no longer need them to follow up with you.</p>
      <p>If you become a client, we keep your file for as long as the law requires us to keep records, and then destroy it securely.</p>
    </>,
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: <>
      <ul>
        <li>Our forms are sent over an encrypted (HTTPS) connection, and what you submit is stored securely.</li>
        <li>We don’t keep your IP address in readable form, only as a salted hash used to prevent spam.</li>
        <li>Only staff who need your information to help you can see it.</li>
        <li>Our service providers must keep your information confidential and secure.</li>
      </ul>
      <p>If we ever believe your personal information has been accessed by someone without authority, we will tell you and the Information Regulator as soon as reasonably possible, as POPIA requires.</p>
    </>,
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: <>
      <p>Under POPIA you have the right to:</p>
      <ul>
        <li>Ask whether we hold personal information about you, and ask for a copy of it.</li>
        <li>Ask us to correct information that is wrong, or delete information we are no longer allowed to keep.</li>
        <li>Object to us using your information, including for direct marketing.</li>
        <li>Withdraw your consent.</li>
        <li>Complain to the Information Regulator.</li>
      </ul>
      <p>To use any of these rights, email our Information Officer at {mail}. We may need to confirm your identity before we act on a request, so that we don’t give your information to someone else.</p>
    </>,
  },
  {
    id: 'information-officer',
    title: 'Our Information Officer',
    body: <>
      <p>Questions about this notice or how we handle your information can go to our Information Officer:</p>
      <ul>
        <li>Email: {mail}</li>
        <li>Phone: {BUSINESS.phones[0].label}</li>
        <li>Post or visit: {a.line1}, {a.street}, {a.town} {a.postcode}, {a.province}</li>
      </ul>
    </>,
  },
  {
    id: 'complaints',
    title: 'Complaints',
    body: <>
      <p>If you are unhappy with how we have handled your personal information, please tell us first so we can try to put it right.</p>
      <p>You also have the right to lodge a complaint with the Information Regulator (South Africa):</p>
      <ul>
        <li>Online: <a href={IR_SITE} target="_blank" rel="noopener">inforegulator.org.za/complaints</a> (complaints use the Regulator’s Form 5)</li>
        <li>Email: <a href={`mailto:${IR_COMPLAINTS}`}>{IR_COMPLAINTS}</a></li>
      </ul>
    </>,
  },
  {
    id: 'changes',
    title: 'Changes to this notice',
    body: <>
      <p>We may update this notice from time to time. The date at the top shows when it last changed. Please also read our <Link to="/terms">website terms of use</Link>.</p>
    </>,
  },
]

export default function Privacy() {
  return (
    <>
      <Seo
        title="Privacy notice (POPIA)"
        description="How Truemarc Consultants collects, uses and protects your personal information under POPIA, who we share it with, and how to use your privacy rights."
        path="/privacy"
        jsonLd={breadcrumbLd([{ name: 'Privacy notice', path: '/privacy' }])}
      />
      <LegalDoc
        title="Privacy notice"
        updated={UPDATED}
        crumb={{ to: '/privacy', label: 'Privacy notice' }}
        intro={<p>This notice explains, in plain language, what personal information we collect through this website, why we collect it, and the rights you have under the Protection of Personal Information Act (POPIA).</p>}
        sections={SECTIONS}
      />
    </>
  )
}
