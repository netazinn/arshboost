/**
 * JSON-LD Schema.org injection component (Server Component).
 * Drop inside any <head> area through layout.tsx or page.tsx.
 *
 * Usage:
 *   <JsonLd schema={buildWebSiteSchema()} />
 *   <JsonLd schema={buildServiceSchema({ name: 'Rank Boost', ... })} />
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint: required for JSON-LD injection
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ─── Schema Builders ─────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arshboost.com'

export function buildWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ArshBoost',
    url: SITE_URL,
    description:
      'Professional game boosting service — rank boost, win boost, duo boost.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ArshBoost',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['English', 'Turkish'],
    },
  }
}

interface ServiceSchemaOptions {
  name: string
  description: string
  url: string
  priceRange?: string
}

export function buildServiceSchema({
  name,
  description,
  url,
  priceRange = '$5 - $500',
}: ServiceSchemaOptions): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Game Boosting',
    name,
    description,
    url,
    provider: {
      '@type': 'Organization',
      name: 'ArshBoost',
      url: SITE_URL,
    },
    areaServed: 'Worldwide',
    priceRange,
  }
}

export function buildFaqSchema(
  faqs: Array<{ question: string; answer: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}
