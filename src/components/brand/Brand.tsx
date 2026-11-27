import { Link } from 'react-router-dom'

/** The real Truemarc lockup. `tone="light"` is the white-text version for dark grounds. */
export function Logo({ tone = 'dark', className = '', height = 44 }: { tone?: 'dark' | 'light'; className?: string; height?: number }) {
  const src = tone === 'light' ? '/brand/truemarc-logo-light.png' : '/brand/truemarc-logo.png'
  const width = Math.round((453 / 179) * height)
  return (
    <Link to="/" className={`logo ${className}`} aria-label="Truemarc Consultants home">
      <img src={src} alt="Truemarc Consultants" width={width} height={height} />
    </Link>
  )
}

/**
 * Signature shape, lifted from the logo: the red ring with the navy "T" swoosh.
 * Use ONE per view (hero backdrop or a single feature moment), never as scattered decoration.
 * `swoosh={false}` gives the plain ring (e.g. behind a photo).
 */
export function Ring({ className = '', swoosh = true, stroke = 'var(--red)', swooshColor = 'currentColor', width = 10 }: {
  className?: string; swoosh?: boolean; stroke?: string; swooshColor?: string; width?: number
}) {
  return (
    <svg className={`brand-ring ${className}`} viewBox="0 0 400 400" fill="none" aria-hidden="true" focusable="false">
      <circle cx="200" cy="200" r={190 - width / 2} stroke={stroke} strokeWidth={width} />
      {swoosh && (
        <g stroke={swooshColor} strokeLinecap="round" fill="none">
          <path d="M-30 150 C 60 70, 220 60, 420 96" strokeWidth={width * 1.25} />
          <path d="M214 92 C 196 170, 178 250, 150 330 C 140 356, 118 364, 96 352" strokeWidth={width * 1.05} />
        </g>
      )}
    </svg>
  )
}
