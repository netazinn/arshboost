import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arshboost.com'
const SITE_NAME = 'ArshBoost'
const DEFAULT_DESCRIPTION =
  'ArshBoost offers fast, safe, and professional game boosting services. Rank boost, win boost, duo boost – achieve your desired rank today.'

interface BuildMetadataOptions {
  title: string
  description?: string
  path?: string
  image?: string
  noIndex?: boolean
  keywords?: string[]
}

/**
 * Generates consistent Next.js Metadata objects for every page.
 * Use inside generateMetadata() or as a static export.
 */
export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image,
  noIndex = false,
  keywords = [],
}: BuildMetadataOptions): Metadata {
  const url = `${SITE_URL}${path}`
  const ogImage = image ?? `${SITE_URL}/og-default.png`

  return {
    title,
    description,
    keywords: [
      'game boosting',
      'rank boost',
      'elo boost',
      'win boost',
      'duo boost',
      ...keywords,
    ],
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  }
}
