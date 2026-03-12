import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFraudIntelligence } from '@/lib/actions/security'
import { SecurityTable } from './_components/SecurityTable'
import { Fingerprint, AlertTriangle, Activity } from 'lucide-react'

export const metadata = { title: 'Security & Fraud Control Center' }
export const dynamic  = 'force-dynamic'

export default async function SecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/admin')

  const { data: profiles = [], error } = await getFraudIntelligence()

  const vpnCount     = (profiles ?? []).filter(p => p.geo?.isVpn).length
  const smurfCount   = (profiles ?? []).filter(p => p.linkedAccounts.length > 0).length
  const flaggedCount = (profiles ?? []).filter(p => p.riskFlags.length > 0).length

  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1600px] mx-auto px-8 py-10 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Fingerprint size={22} strokeWidth={1.5} className="text-red-400" />
          <div>
            <h1 className="font-mono text-[22px] font-bold tracking-[-0.06em] text-white">
              Security & Fraud Control Center
            </h1>
            <p className="mt-0.5 font-mono text-[11px] tracking-[-0.04em] text-[#4a4a4a]">
              IP geolocation, VPN detection, and multi-account radar
            </p>
          </div>
        </div>

        {/* Risk summary badges */}
        <div className="flex items-center gap-2">
          {vpnCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-red-400">
              <AlertTriangle size={11} strokeWidth={2} />
              {vpnCount} VPN / Proxy
            </span>
          )}
          {smurfCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-amber-400">
              <AlertTriangle size={11} strokeWidth={2} />
              {smurfCount} Linked Accounts
            </span>
          )}
          {flaggedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-red-400">
              <Activity size={11} strokeWidth={2} />
              {flaggedCount} Flagged
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}

      {/* Table */}
      <SecurityTable initialProfiles={profiles ?? []} />
    </main>
  )
}
