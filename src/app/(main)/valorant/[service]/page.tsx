import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ValorantRankBoost } from '@/components/features/order/ValorantRankBoost'
import { buildMetadata } from '@/lib/seo'

const VALID_SERVICES: Record<string, { title: string; description: string }> = {
  'rank-boost': {
    title: 'Valorant Rank Boost – ArshBoost',
    description: 'Order professional Valorant rank boosting from ArshBoost. Fast, safe, and affordable.',
  },
  'win-boost': {
    title: 'Valorant Win Boost – ArshBoost',
    description: 'Order Valorant win boosting from ArshBoost. Choose your tier, wins count, and server.',
  },
  'placements-boost': {
    title: 'Valorant Placements Boost – ArshBoost',
    description: 'Get the best possible placement results in Valorant with ArshBoost.',
  },
  'unrated-boost': {
    title: 'Valorant Unrated Boost – ArshBoost',
    description: 'Boost your Valorant Unrated matches with professional play from ArshBoost.',
  },
}

interface Props {
  params: Promise<{ service: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service } = await params
  const meta = VALID_SERVICES[service]
  if (!meta) {
    return buildMetadata({ title: 'Valorant Boost – ArshBoost', path: '/valorant/rank-boost' })
  }
  return buildMetadata({ title: meta.title, description: meta.description, path: `/valorant/${service}` })
}

export default async function ValorantServicePage({ params }: Props) {
  const { service } = await params
  if (!VALID_SERVICES[service]) {
    redirect('/valorant/rank-boost')
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] flex flex-1 flex-col px-8 pt-10 pb-14">
      <ValorantRankBoost />
    </div>
  )
}
