import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBanRequests } from '@/lib/actions/ban-requests'
import { BanRequestsTable } from './_components/BanRequestsTable'
import { ShieldAlert } from 'lucide-react'

export const metadata = { title: 'Ban / Unban Requests' }

const TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

type Tab = (typeof TABS)[number]['key']

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function BanRequestsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/admin')

  const { tab: rawTab } = await searchParams
  const activeTab: Tab = TABS.some(t => t.key === rawTab) ? (rawTab as Tab) : 'pending'

  const { data: requests = [], error } = await getBanRequests(activeTab)

  return (
    <div className="min-h-screen bg-[#080808] px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <ShieldAlert size={20} strokeWidth={1.5} className="text-orange-400" />
        <div>
          <h1 className="font-mono text-[22px] font-bold tracking-[-0.06em] text-white">
            Ban / Unban Requests
          </h1>
          <p className="mt-0.5 font-mono text-[11px] tracking-[-0.04em] text-[#4a4a4a]">
            Review support-submitted ban and unban requests
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-[#1a1a1a]">
        {TABS.map(tab => (
          <a
            key={tab.key}
            href={`/admin/ban-requests?tab=${tab.key}`}
            className={[
              'px-4 py-2 font-mono text-[11px] font-semibold tracking-[-0.04em] transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-orange-400 text-white'
                : 'border-transparent text-[#4a4a4a] hover:text-[#9a9a9a]',
            ].join(' ')}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-6 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] px-6 py-4">
        <BanRequestsTable requests={requests ?? []} />
      </div>
    </div>
  )
}
