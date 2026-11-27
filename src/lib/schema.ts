// schema.org JSON-LD builders. Pass results to <Seo jsonLd={...} />.
import { BUSINESS, SITE_URL } from './site'

const ORG_ID = `${SITE_URL}/#organization`
const LOGO = `${SITE_URL}/brand/truemarc-logo.png`

/**
 * Reference to the business from other pages. Carries name/url/logo as well as the @id, because the full
 * organizationLd() only appears on some pages and Google's validators read each page on its own.
 */
export function orgRef() {
  return { '@type': 'Organization', '@id': ORG_ID, name: BUSINESS.name, url: SITE_URL, logo: { '@type': 'ImageObject', url: LOGO, width: 453, height: 179 } }
}

/** WebSite entity for the home page (lets Google show "Truemarc Consultants" as the site name). Added by <Seo> on "/". */
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: BUSINESS.name,
    alternateName: BUSINESS.short,
    url: `${SITE_URL}/`,
    inLanguage: 'en-ZA',
    publisher: { '@id': ORG_ID },
  }
}

/** The business entity. Rendered site-wide on the home page and referenced elsewhere by @id. */
export function organizationLd() {
  const a = BUSINESS.address
  return {
    '@context': 'https://schema.org',
    '@type': ['FinancialService', 'LocalBusiness'],
    '@id': ORG_ID,
    name: BUSINESS.name,
    url: SITE_URL,
    logo: LOGO,
    image: `${SITE_URL}/img/team-hero.webp`,
    slogan: 'Impacting lives',
    foundingDate: String(BUSINESS.founded),
    telephone: BUSINESS.phones[0].tel,
    email: BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${a.line1}, ${a.street}`,
      addressLocality: a.town,
      addressRegion: a.province,
      postalCode: a.postcode,
      addressCountry: a.country,
    },
    areaServed: { '@type': 'Country', name: 'South Africa' },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '17:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '09:00', closes: '13:00' },
    ],
    contactPoint: BUSINESS.phones.map((p) => ({ '@type': 'ContactPoint', telephone: p.tel, contactType: 'customer service', areaServed: 'ZA', availableLanguage: ['English'] })),
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...items].map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.path === '/' ? '/' : it.path}`,
    })),
  }
}

export function serviceLd({ name, description, path }: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url: `${SITE_URL}${path}`,
    provider: orgRef(),
    areaServed: { '@type': 'Country', name: 'South Africa' },
    serviceType: name,
  }
}

export function articleLd({ title, description, path, datePublished, dateModified }: { title: string; description: string; path: string; datePublished: string; dateModified?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${path}` },
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: orgRef(),
    publisher: orgRef(),
    inLanguage: 'en-ZA',
    image: { '@type': 'ImageObject', url: `${SITE_URL}/img/share-2026-11.jpg`, width: 1200, height: 630 },
  }
}
