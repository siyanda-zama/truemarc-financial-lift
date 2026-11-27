import { Link } from 'react-router-dom'
import Seo from '@/components/Seo'
import LegalDoc, { type LegalSection } from '@/components/company/LegalDoc'
import { breadcrumbLd } from '@/lib/schema'
import { BUSINESS, SITE_URL } from '@/lib/site'

// DRAFT for legal review: short website terms of use.

const UPDATED = '27 November 2026'
const a = BUSINESS.address
const domain = SITE_URL.replace(/^https?:\/\//, '')

const SECTIONS: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: <>
      <p>These terms apply to your use of {domain}, run by {BUSINESS.name} (“Truemarc”, “we”, “us”). By using the website you agree to them. If you don’t agree, please don’t use the site.</p>
    </>,
  },
  {
    id: 'information-not-advice',
    title: 'Information, not advice',
    body: <>
      <p>Our guides and pages explain South African credit matters in general terms. They are not legal or financial advice, and they can’t take your personal circumstances into account.</p>
      <p>Laws and credit bureau practices change. We try to keep everything accurate and up to date, but we can’t promise that every page is complete or current. Before you act, speak to us or another qualified professional about your situation.</p>
    </>,
  },
  {
    id: 'no-guarantees',
    title: 'No guarantees',
    body: <>
      <p>We can’t guarantee that a listing will be removed, that a credit application will be approved, or that you will get any particular result. Accurate, up-to-date information may lawfully stay on your credit record for the period the law allows.</p>
      <p>What we can do is check your record, challenge what is wrong or outdated, and tell you honestly what is realistic.</p>
    </>,
  },
  {
    id: 'our-services',
    title: 'Our services',
    body: <>
      <p>The free assessment and first consultation do not commit you to anything. If you decide to use our services, the scope, fees and terms will be set out in a separate written agreement before any work starts. That agreement will apply to the services, alongside these terms.</p>
    </>,
  },
  {
    id: 'using-the-site',
    title: 'Using the website',
    body: <>
      <ul>
        <li>Only submit your own details, or details you are authorised to share, and make sure they are accurate.</li>
        <li>Don’t use the site for anything unlawful, or try to disrupt, overload or gain unauthorised access to it.</li>
        <li>Don’t use automated tools to submit forms or copy content from the site.</li>
      </ul>
    </>,
  },
  {
    id: 'content',
    title: 'Our content and brand',
    body: <>
      <p>The Truemarc name, logo, text, design and graphics on this site belong to Truemarc or are used with permission. You may view, print or share pages for your own personal, non-commercial use. Please don’t copy or republish them without our written permission.</p>
    </>,
  },
  {
    id: 'other-sites',
    title: 'Links to other websites',
    body: <>
      <p>We link to other websites, such as government bodies and credit bureaus, for your convenience. We don’t control those sites and aren’t responsible for their content or how they handle your information.</p>
    </>,
  },
  {
    id: 'liability',
    title: 'Our liability',
    body: <>
      <p>To the extent the law allows, Truemarc is not liable for any loss or damage that comes from using this website or relying on its general information. Nothing in these terms limits any right you have under the Consumer Protection Act or other South African law that can’t be excluded.</p>
    </>,
  },
  {
    id: 'privacy',
    title: 'Your privacy',
    body: <>
      <p>Our <Link to="/privacy">privacy notice</Link> explains how we collect, use and protect your personal information.</p>
    </>,
  },
  {
    id: 'law-and-changes',
    title: 'Governing law and changes',
    body: <>
      <p>These terms are governed by the laws of the Republic of South Africa. We may update them from time to time; the date at the top shows when they last changed.</p>
    </>,
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: <>
      <ul>
        <li>Email: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>
        <li>Phone: {BUSINESS.phones.map((p) => p.label).join(' or ')}</li>
        <li>Office: {a.line1}, {a.street}, {a.town} {a.postcode}, {a.province}</li>
      </ul>
    </>,
  },
]

export default function Terms() {
  return (
    <>
      <Seo
        title="Website terms of use"
        description="Terms for using the Truemarc Consultants website: general information only, no guarantees of removal or approval, your responsibilities and how to reach us."
        path="/terms"
        jsonLd={breadcrumbLd([{ name: 'Terms of use', path: '/terms' }])}
      />
      <LegalDoc
        title="Terms of use"
        updated={UPDATED}
        crumb={{ to: '/terms', label: 'Terms of use' }}
        intro={<p>The short version: our website gives general information, not advice, and nobody can honestly guarantee a credit outcome. The details are below.</p>}
        sections={SECTIONS}
      />
    </>
  )
}
