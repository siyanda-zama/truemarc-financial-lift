import { Helmet } from 'react-helmet-async'
import { BUSINESS, SITE_URL } from '@/lib/site'
import { websiteLd } from '@/lib/schema'

type Props = {
  /** Page title without the brand suffix, ≤ 55 chars (" | Truemarc" is added: keeps results under ~66 chars). */
  title: string
  /** 140–160 chars, says what the page offers and leads to action. */
  description: string
  /** Route path, e.g. "/services/debt-review". Used for canonical + og:url. */
  path: string
  /** Share image. Absolute URL or a site path ("/img/x.jpg"); defaults to the 1200×630 brand card. */
  image?: string
  /** Alt text for a custom share image. */
  imageAlt?: string
  noindex?: boolean
  /** One or more schema.org objects; rendered as JSON-LD. */
  jsonLd?: object | object[]
  /** Use the title as-is (no " | Truemarc" suffix), e.g. on the home page. */
  rawTitle?: boolean
  /** "article" on /learn guides (adds og:type article + published time). */
  type?: 'website' | 'article'
  /** ISO date, used with type="article". */
  published?: string
  modified?: string
}

export const SHARE_IMAGE = `${SITE_URL}/img/share-2026-11.jpg`
const SHARE_ALT = `${BUSINESS.name}: Declined for credit? Let's clear your name.`

const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`)

export default function Seo({ title, description, path, image = SHARE_IMAGE, imageAlt, noindex, jsonLd, rawTitle, type = 'website', published, modified }: Props) {
  const full = rawTitle ? title : `${title} | ${BUSINESS.short}`
  const url = `${SITE_URL}${path === '/' ? '/' : path.replace(/\/$/, '')}`
  const img = abs(image)
  const isDefault = img === SHARE_IMAGE
  const ld = [...(path === '/' ? [websiteLd()] : []), ...(jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [])]
  return (
    <Helmet prioritizeSeoTags>
      <title>{full}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={BUSINESS.name} />
      <meta property="og:locale" content="en_ZA" />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      {img.startsWith('https://') && <meta property="og:image:secure_url" content={img} />}
      {isDefault && <meta property="og:image:type" content="image/jpeg" />}
      {isDefault && <meta property="og:image:width" content="1200" />}
      {isDefault && <meta property="og:image:height" content="630" />}
      <meta property="og:image:alt" content={imageAlt ?? (isDefault ? SHARE_ALT : full)} />
      {type === 'article' && published && <meta property="article:published_time" content={published} />}
      {type === 'article' && (modified || published) && <meta property="article:modified_time" content={modified ?? published} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={full} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      {ld.map((o, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(o).replace(/</g, '\\u003c')}</script>
      ))}
    </Helmet>
  )
}
