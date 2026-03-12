'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Shield, Headphones, Search, SendHorizonal, Loader2,
  AlertTriangle, CheckCircle2, ChevronDown, MessageSquare, Briefcase, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendAdminMessage, resolveDispute, sendAdminDmReply, deleteStaffDmThread, relistDisputedOrder } from '@/lib/actions/admin'
import { getSenderProfile } from '@/lib/actions/chat'
import { SystemMessageDivider, SYS_COLOR_MAP } from '@/components/features/dashboard/ChatPanel'
import { GAME_ICONS } from '@/lib/config/game-icons'
import { calculateBoosterPayout } from '@/lib/payout'
import type { Order, ChatMessage, Profile, OrderStatus } from '@/types'
import type { StaffDmThread } from '@/lib/data/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  orders: Order[]
  initialOrder: Order | null
  initialMessages: ChatMessage[]
  currentUser: Pick<Profile, 'id' | 'role'>
  dmThreads: StaffDmThread[]
}

type SidebarTab = 'dms' | 'orders'
type Selection =
  | { kind: 'order'; order: Order }
  | { kind: 'dm'; thread: StaffDmThread }
  | null

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  pending:          'border-[#3a3a3a] bg-[#1a1a1a] text-[#6e6d6f]',
  awaiting_payment: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  in_progress:      'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  completed:        'border-green-500/30 bg-green-500/10 text-green-400',
  cancelled:        'border-red-500/30 bg-red-500/10 text-red-400',
  dispute:          'border-orange-500/30 bg-orange-500/10 text-orange-400',
  support:          'border-blue-500/30 bg-blue-500/10 text-blue-400',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', awaiting_payment: 'Awaiting Payment',
  in_progress: 'In Progress', completed: 'Completed',
  cancelled: 'Cancelled', dispute: 'Dispute', support: 'Support',
}

const FILTERS: { label: string; statuses: OrderStatus[] | 'all' }[] = [
  { label: 'All',       statuses: 'all' },
  { label: 'Active',    statuses: ['in_progress'] },
  { label: 'Disputed',  statuses: ['dispute', 'support'] },
  { label: 'Waiting',   statuses: ['pending', 'awaiting_payment'] },
  { label: 'Done',      statuses: ['completed', 'cancelled'] },
]

// ─── Order title helper ───────────────────────────────────────────────────────

function orderTitle(order: Order) {
  const d = (order.details ?? {}) as Record<string, string>
  return d.current_rank && d.target_rank
    ? `${d.current_rank} → ${d.target_rank}`
    : order.service?.label ?? 'Order'
}

// ─── Admin message label ─────────────────────────────────────────────────────

function getAdminLabel(role: string) {
  if (role === 'admin')   return '[SYSTEM ADMINISTRATOR]'
  if (role === 'support') return '[SUPPORT]'
  return '[STAFF]'
}

// ─── Dispute Resolution Engine ────────────────────────────────────────────────

function DisputeResolutionEngine({ order, onResolved }: { order: Order; onResolved: () => void }) {
  const { boosterPayout } = calculateBoosterPayout(order.price)
  const [tab, setTab]           = useState<'refund' | 'payout' | 'custom' | 'takeover'>('custom')
  const [boosterPct, setBoosterPct] = useState(50)
  const [notes, setNotes]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [err, setErr]           = useState('')
  // Takeover-specific state
  const [oldBoosterCut, setOldBoosterCut] = useState('')
  const [newPrice, setNewPrice]           = useState(order.price.toFixed(2))
  const [takeoverNote, setTakeoverNote]   = useState('')

  const customCredit = Math.round(boosterPayout * (boosterPct / 100) * 100) / 100

  async function execute() {
    setLoading(true)
    setErr('')
    let res: { error?: string }
    if (tab === 'takeover') {
      const cut = parseFloat(oldBoosterCut)
      const np  = parseFloat(newPrice)
      if (isNaN(cut) || cut < 0) { setErr('Enter a valid booster payout amount'); setLoading(false); return }
      if (isNaN(np)  || np <= 0)  { setErr('Enter a valid new order price');        setLoading(false); return }
      res = await relistDisputedOrder({ orderId: order.id, oldBoosterCut: cut, newPrice: np, takeoverNote })
    } else {
      const mode = tab === 'refund' ? 'full_refund' : tab === 'payout' ? 'full_payout' : 'custom'
      const pct  = tab === 'refund' ? 0 : tab === 'payout' ? 100 : boosterPct
      res = await resolveDispute({ orderId: order.id, mode, boosterPct: pct, notes })
    }
    setLoading(false)
    if (res.error) { setErr(res.error) } else { setDone(true); onResolved() }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center">
        <CheckCircle2 size={18} strokeWidth={1.5} className="text-green-400 mx-auto mb-1" />
        <p className="font-mono text-xs tracking-[-0.05em] text-green-400">Resolution executed</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} strokeWidth={1.5} className="text-orange-400 shrink-0" />
        <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-orange-400">
          Resolution Engine
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-0.5">
        {([
          { key: 'refund',   label: 'Refund',    color: 'text-blue-400'   },
          { key: 'payout',   label: 'Pay Out',   color: 'text-green-400'  },
          { key: 'custom',   label: 'Split',     color: 'text-orange-400' },
          { key: 'takeover', label: 'Takeover',  color: 'text-amber-400'  },
        ] as const).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded py-1.5 font-mono text-[9px] tracking-[-0.02em] font-semibold transition-colors ${
              tab === key ? `bg-[#1e1e1e] ${color}` : 'text-[#4a4a4a] hover:text-[#9a9a9a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      {tab === 'refund' && (
        <div className="rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          <p className="font-mono text-[10px] tracking-[-0.04em] text-blue-300">
            Client wins — order set to <span className="font-semibold">Cancelled</span>.
          </p>
          <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] mt-1">
            No wallet changes. Process refund via payment gateway.
          </p>
        </div>
      )}
      {tab === 'payout' && (
        <div className="rounded border border-green-500/20 bg-green-500/5 px-3 py-2">
          <p className="font-mono text-[10px] tracking-[-0.04em] text-green-300">
            Booster wins — order set to <span className="font-semibold">Completed</span>.
          </p>
          <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] mt-1">
            Full net <span className="text-green-400 font-semibold">${boosterPayout.toFixed(2)}</span> credited to booster wallet.
          </p>
        </div>
      )}
      {tab === 'custom' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-[9px] text-[#6e6d6f] tracking-[-0.03em]">
            <span>Booster cut: <span className="text-white font-semibold">{boosterPct}%</span></span>
            <span className="text-green-400 font-semibold">${customCredit.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0} max={100} value={boosterPct}
            onChange={(e) => setBoosterPct(Number(e.target.value))}
            className="w-full accent-orange-400 cursor-pointer"
          />
          <div className="flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-2 py-1">
            <span className="font-mono text-[9px] text-[#4a4a4a]">Booster $</span>
            <input
              type="number" min={0} max={boosterPayout} step={0.01}
              value={customCredit}
              onChange={(e) => {
                const v = Math.min(boosterPayout, Math.max(0, parseFloat(e.target.value) || 0))
                setBoosterPct(boosterPayout > 0 ? Math.round((v / boosterPayout) * 100) : 0)
              }}
              className="flex-1 bg-transparent font-mono text-[10px] text-white outline-none w-16"
            />
          </div>
          <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">
            Amount credited to booster wallet. Order → <span className="text-white">Completed</span>.
          </p>
        </div>
      )}
      {tab === 'takeover' && (
        <div className="flex flex-col gap-2">
          <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="font-mono text-[10px] tracking-[-0.04em] text-amber-300">
              Partial payout → re-list as <span className="font-semibold">Takeover</span> order.
            </p>
            <p className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] mt-1">
              Old booster is credited and unassigned. Order is re-listed for a new booster.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-2 py-1">
            <span className="font-mono text-[9px] text-[#4a4a4a] shrink-0">Old Booster Payout $</span>
            <input
              type="number" min={0} step={0.01} placeholder="0.00"
              value={oldBoosterCut}
              onChange={(e) => setOldBoosterCut(e.target.value)}
              className="flex-1 bg-transparent font-mono text-[10px] text-white outline-none w-16"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-2 py-1">
            <span className="font-mono text-[9px] text-[#4a4a4a] shrink-0">New Order Price $</span>
            <input
              type="number" min={0.01} step={0.01}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="flex-1 bg-transparent font-mono text-[10px] text-white outline-none w-16"
            />
          </div>
          <textarea
            placeholder="Takeover note (e.g. Account is Gold 3, play to Diamond 1)..."
            value={takeoverNote}
            onChange={(e) => setTakeoverNote(e.target.value)}
            rows={3}
            className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none resize-none focus:border-amber-500/30 transition-colors"
          />
        </div>
      )}

      {/* Notes — not shown for takeover (has its own note field) */}
      {tab !== 'takeover' && (
        <textarea
          placeholder="Resolution notes (optional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none resize-none focus:border-[#4a4a4a] transition-colors"
        />
      )}

      {err && <p className="font-mono text-[9px] text-red-400 tracking-[-0.03em]">{err}</p>}

      <button
        onClick={execute}
        disabled={loading}
        className={`flex items-center justify-center gap-2 rounded border px-3 py-2 font-mono text-[11px] font-semibold tracking-[-0.05em] transition-colors disabled:opacity-50 ${
          tab === 'refund'   ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
          : tab === 'payout'  ? 'border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20'
          : tab === 'takeover' ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          : 'border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
        }`}
      >
        {loading ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <AlertTriangle size={12} strokeWidth={2} />}
        {tab === 'refund' ? 'Process Full Refund' : tab === 'payout' ? 'Release Full Payout' : tab === 'takeover' ? 'Relist as Takeover' : 'Execute Split'}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminMasterInbox({ orders: initialOrders, initialOrder, initialMessages, currentUser, dmThreads: initialDmThreads }: Props) {
  const router = useRouter()
  const [orders, setOrders]           = useState<Order[]>(initialOrders)
  const [dmThreads, setDmThreads]     = useState<StaffDmThread[]>(initialDmThreads)
  const [selection, setSelection]     = useState<Selection>(
    initialOrder ? { kind: 'order', order: initialOrder } : null
  )
  const [messages, setMessages]       = useState<ChatMessage[]>(initialMessages)
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [sidebarTab, setSidebarTab]   = useState<SidebarTab>(() => {
    // Accountants can only see DMs; others default to orders when no DMs exist
    if (initialDmThreads.length > 0 || currentUser.role === 'accountant') return 'dms'
    return 'orders'
  })
  const [filterIdx, setFilterIdx]     = useState(0)
  const [search, setSearch]           = useState('')
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase  = createClient()

  // ── Scroll to bottom ──
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Live order list updates ──
  useEffect(() => {
    const ch = supabase
      .channel('admin:inbox:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        const { data } = await supabase
          .from('orders')
          .select(`*, game:games(id,name,slug,logo_url), service:games_services(id,type,label), client:profiles!orders_client_id_fkey(id,email,username,avatar_url,role), booster:profiles!orders_booster_id_fkey(id,email,username,avatar_url,role)`)
          .order('created_at', { ascending: false })
        if (data) setOrders(data as Order[])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Realtime: new DMs arriving for this staff role ──
  useEffect(() => {
    const ch = supabase
      .channel(`admin:inbox:dms:${currentUser.role}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `dm_thread_id=like.%25:${currentUser.role}`,
        },
        async (payload) => {
          const raw = payload.new as ChatMessage
          if (!raw.dm_thread_id) return

          // Enrich with sender profile so god-mode styling works
          let msg = raw
          if (!raw.sender?.role) {
            const senderProfile = await getSenderProfile(raw.sender_id)
            if (senderProfile) msg = { ...raw, sender: senderProfile as Profile }
          }

          // Update active DM messages if this thread is selected
          setSelection((sel) => {
            if (sel?.kind === 'dm' && sel.thread.threadId === msg.dm_thread_id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev
                return [...prev, msg]
              })
            }
            return sel
          })

          // Update DM threads list: bump or create the thread entry
          setDmThreads((prev) => {
            const idx = prev.findIndex((t) => t.threadId === msg.dm_thread_id)
            if (idx !== -1) {
              const updated = [...prev]
              updated[idx] = { ...updated[idx], lastMessage: msg }
              // Move to top
              const [item] = updated.splice(idx, 1)
              return [item, ...updated]
            }
            // New thread — create a minimal entry (booster profile will be unknown until reload)
            const boosterId = (msg.dm_thread_id as string).split(':')[0]
            return [
              {
                threadId: msg.dm_thread_id as string,
                boosterId,
                booster: { id: boosterId, username: null, email: boosterId, role: 'booster', avatar_url: null, created_at: '', updated_at: '' } as Profile,
                lastMessage: msg,
              },
              ...prev,
            ]
          })

          // Auto-switch sidebar to DMs tab when a new DM arrives
          setSidebarTab('dms')
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.role])

  // ── Active order chat messages + Realtime ──
  useEffect(() => {
    if (selection?.kind !== 'order') return
    const orderId = selection.order.id

    const ch = supabase
      .channel(`admin:chat:${orderId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` },
        async (payload) => {
          const raw = payload.new as ChatMessage
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, username, email, role, avatar_url, created_at, updated_at')
            .eq('id', raw.sender_id)
            .single()
          setMessages((prev) => {
            if (prev.some((m) => m.id === raw.id)) return prev
            // Own message echo: swap out the optimistic bubble for the confirmed DB row
            if (raw.sender_id === currentUser.id) {
              const optIdx = prev.findIndex((m) => m.id.startsWith('opt-') && m.content === raw.content)
              if (optIdx !== -1) {
                return prev.map((m, i) => i === optIdx ? { ...raw, sender: sender ?? undefined } : m)
              }
              return prev // already replaced or no opt- found
            }
            return [...prev, { ...raw, sender: sender ?? undefined }]
          })
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.kind === 'order' ? (selection as { kind: 'order'; order: Order }).order.id : null])

  const loadOrder = useCallback(async (order: Order) => {
    setSelection({ kind: 'order', order })
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(id, username, email, role, avatar_url)')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) ?? [])
    setLoadingMsgs(false)
    router.replace(`/admin/master-inbox?order=${order.id}`, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDmThread = useCallback(async (thread: StaffDmThread) => {
    setSelection({ kind: 'dm', thread })
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(id, username, email, role, avatar_url)')
      .eq('dm_thread_id', thread.threadId)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) ?? [])
    setLoadingMsgs(false)
    router.replace('/admin/master-inbox', { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || !selection || sending) return
    setSending(true)
    setInput('')
    const optimisticId = `opt-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        order_id: selection.kind === 'order' ? selection.order.id : null,
        dm_thread_id: selection.kind === 'dm' ? selection.thread.threadId : null,
        sender_id: currentUser.id,
        content: text,
        image_url: null,
        is_system: false,
        created_at: new Date().toISOString(),
        status: 'sending',
        sender: { id: currentUser.id, role: currentUser.role } as Profile,
      },
    ])

    let error: string | undefined
    if (selection.kind === 'order') {
      const res = await sendAdminMessage(selection.order.id, text)
      error = res.error
    } else {
      const res = await sendAdminDmReply(selection.thread.threadId, text)
      error = res.error
    }

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(text)
    }
    setSending(false)
  }

  // ── Filtered order list ──
  const activeFilter = FILTERS[filterIdx]
  const filtered = orders.filter((o) => {
    const statusOk = activeFilter.statuses === 'all'
      || (activeFilter.statuses as OrderStatus[]).includes(o.status)
    const searchOk = !search
      || o.client?.username?.toLowerCase().includes(search.toLowerCase())
      || o.client?.email?.toLowerCase().includes(search.toLowerCase())
      || o.id.toLowerCase().includes(search.toLowerCase())
      || orderTitle(o).toLowerCase().includes(search.toLowerCase())
    return statusOk && searchOk
  })

  const activeOrder  = selection?.kind === 'order' ? selection.order : null
  const activeThread = selection?.kind === 'dm'    ? selection.thread : null
  const isAccountant = currentUser.role === 'accountant'

  const isAdminRole = (role?: string) => ['admin', 'support', 'accountant'].includes(role ?? '')

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0a0a0a]">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-[#151515]">

        {/* Tab switcher — accountants only see DMs */}
        <div className="shrink-0 flex border-b border-[#151515]">
          <button
            onClick={() => setSidebarTab('dms')}
            className={`flex-1 py-3 font-mono text-[10px] tracking-[-0.04em] transition-colors relative ${
              sidebarTab === 'dms' ? 'text-white' : 'text-[#4a4a4a] hover:text-[#9a9a9a]'
            }`}
          >
            Direct Messages
            {dmThreads.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500/20 px-1 font-mono text-[8px] text-blue-400">
                {dmThreads.length}
              </span>
            )}
            {sidebarTab === 'dms' && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
            )}
          </button>
          {!isAccountant && (
            <button
              onClick={() => setSidebarTab('orders')}
              className={`flex-1 py-3 font-mono text-[10px] tracking-[-0.04em] transition-colors relative ${
                sidebarTab === 'orders' ? 'text-white' : 'text-[#4a4a4a] hover:text-[#9a9a9a]'
              }`}
            >
              Order Interventions
              {sidebarTab === 'orders' && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
              )}
            </button>
          )}
        </div>

        {/* ── DM Tab ── */}
        {sidebarTab === 'dms' && (
          <div className="flex-1 overflow-y-auto">
            {dmThreads.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <MessageSquare size={20} strokeWidth={1.3} className="text-[#2a2a2a]" />
                <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                  No direct messages yet
                </p>
                <p className="font-mono text-[9px] tracking-[-0.03em] text-[#2a2a2a] leading-relaxed">
                  When boosters message your role&apos;s channel, threads appear here.
                </p>
              </div>
            ) : (
              dmThreads.map((thread) => {
                const isActive   = activeThread?.threadId === thread.threadId
                const name       = thread.booster.username ?? thread.booster.email ?? '—'
                const initial    = name.charAt(0).toUpperCase()
                const last       = thread.lastMessage
                const isFromStaff = last.sender_id !== thread.boosterId
                // channel suffix e.g. "admin" → role icon
                const channelSuffix = thread.threadId.split(':')[1]
                const ChannelIcon   = channelSuffix === 'admin' ? Shield
                  : channelSuffix === 'support' ? Headphones : Briefcase

                return (
                  <div
                    key={thread.threadId}
                    className={`group relative border-b border-[#0f0f0f] transition-colors ${
                      isActive ? 'bg-[#1a1a1a] border-l-2 border-l-blue-400/40' : 'hover:bg-[#111]'
                    }`}
                  >
                    <button
                      onClick={() => loadDmThread(thread)}
                      className="w-full text-left px-4 py-3 pr-10"
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        {/* Avatar */}
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] font-mono text-[10px] font-bold text-[#c8c8c8]">
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white truncate">
                              {name}
                            </p>
                            <ChannelIcon size={8} strokeWidth={2} className="shrink-0 text-[#4a4a4a]" />
                            <span className="font-mono text-[8px] tracking-[-0.02em] text-[#3a3a3a] shrink-0">
                              {channelSuffix}
                            </span>
                          </div>
                          <p className="font-mono text-[9px] tracking-[-0.04em] text-[#4a4a4a] truncate">
                            {isFromStaff ? 'You: ' : ''}{last.content}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[9px] tracking-[-0.03em] text-[#3a3a3a]">
                          {new Date(last.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        await deleteStaffDmThread(thread.threadId)
                        setDmThreads((prev) => prev.filter((t) => t.threadId !== thread.threadId))
                        if (isActive) setSelection(null)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-500/10 text-[#3a3a3a] hover:text-red-400"
                      title="Delete conversation"
                    >
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Orders Tab ── */}
        {sidebarTab === 'orders' && (
          <>
            {/* Header + search */}
            <div className="shrink-0 border-b border-[#151515] px-4 py-3.5">
              <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white mb-2">
                All Orders <span className="text-[#4a4a4a]">({orders.length})</span>
              </p>
              <div className="flex items-center gap-2 rounded-md border border-[#1e1e1e] bg-[#0f0f0f] px-2.5 py-1.5">
                <Search size={11} strokeWidth={1.5} className="text-[#4a4a4a] shrink-0" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="flex-1 bg-transparent font-mono text-[10px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none"
                />
              </div>
            </div>

            {/* Filter tabs */}
            <div className="shrink-0 flex gap-1 border-b border-[#151515] px-3 py-2 overflow-x-auto">
              {FILTERS.map((f, i) => (
                <button
                  key={f.label}
                  onClick={() => setFilterIdx(i)}
                  className={`shrink-0 rounded px-2 py-0.5 font-mono text-[9px] tracking-[-0.03em] transition-colors ${
                    filterIdx === i ? 'bg-white/10 text-white' : 'text-[#4a4a4a] hover:text-[#9a9a9a]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Order list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map((order) => {
                const gameIcon = GAME_ICONS[order.game?.name ?? '']
                const title    = orderTitle(order)
                const isActive = activeOrder?.id === order.id
                return (
                  <button
                    key={order.id}
                    onClick={() => loadOrder(order)}
                    className={`w-full text-left px-4 py-3 border-b border-[#0f0f0f] transition-colors ${
                      isActive ? 'bg-[#1a1a1a] border-l-2 border-l-white/20' : 'hover:bg-[#111]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {gameIcon && (
                        <Image src={gameIcon} alt="" width={14} height={14}
                          className="h-3.5 w-3.5 rounded-sm shrink-0 object-cover" />
                      )}
                      <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-white truncate flex-1">
                        {title}
                      </p>
                      <span className={`shrink-0 inline-flex items-center rounded border px-1 py-px font-mono text-[7px] tracking-[-0.02em] ${STATUS_CLS[order.status] ?? STATUS_CLS.pending}`}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="font-mono text-[9px] tracking-[-0.04em] text-[#4a4a4a] truncate">
                      {order.client?.username ?? order.client?.email ?? '—'} · #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Chat panel ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">

        {!selection ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111]">
                <Shield size={20} strokeWidth={1.5} className="text-red-400" />
              </div>
              <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Select a conversation</p>
              <p className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a] max-w-[220px] leading-relaxed">
                Pick a direct message or an order from the sidebar.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#1a1a1a] px-5 py-3.5">
              {selection.kind === 'dm' ? (() => {
                const thread = selection.thread
                const name   = thread.booster.username ?? thread.booster.email ?? '—'
                const suffix = thread.threadId.split(':')[1]
                const ChannelIcon = suffix === 'admin' ? Shield : suffix === 'support' ? Headphones : Briefcase
                return (
                  <>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] font-mono text-xs font-bold text-white">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white truncate">{name}</p>
                      <p className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f] flex items-center gap-1">
                        <ChannelIcon size={9} strokeWidth={2} />
                        Direct message via {suffix} channel
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] text-blue-400">
                      <MessageSquare size={8} strokeWidth={2} />
                      DM
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] text-red-400">
                      <Shield size={8} strokeWidth={2} />
                      GOD MODE
                    </span>
                  </>
                )
              })() : (() => {
                const order    = selection.order
                const gameIcon = GAME_ICONS[order.game?.name ?? '']
                const title    = orderTitle(order)
                const badgeCls = STATUS_CLS[order.status] ?? STATUS_CLS.pending
                const badgeLbl = STATUS_LABEL[order.status] ?? order.status
                return (
                  <>
                    {gameIcon
                      ? <Image src={gameIcon} alt="" width={32} height={32}
                          className="h-8 w-8 shrink-0 rounded-md object-cover" />
                      : <div className="h-8 w-8 shrink-0 rounded-md bg-[#2a2a2a]" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white truncate">{title}</p>
                      <p className="font-mono text-[10px] tracking-[-0.05em] text-[#6e6d6f] truncate">
                        {order.game?.name} · #{order.id.slice(0, 8).toUpperCase()}
                        {' · '}Client: {order.client?.username ?? order.client?.email ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] ${badgeCls}`}>
                        {badgeLbl}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] text-red-400">
                        <Shield size={8} strokeWidth={2} />
                        GOD MODE
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Messages */}
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {loadingMsgs ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 size={20} strokeWidth={1.5} className="text-[#3a3a3a] animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="font-mono text-[11px] text-[#3a3a3a] tracking-[-0.04em]">No messages yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((msg) => {
                        if (msg.is_system) {
                          const colorCls = (msg.system_type && SYS_COLOR_MAP[msg.system_type]) ?? undefined
                          return <SystemMessageDivider key={msg.id} text={msg.content} colorCls={colorCls} />
                        }

                        const senderRole  = msg.sender?.role ?? ''
                        const isAdminMsg  = isAdminRole(senderRole)
                        const isOwn       = msg.sender_id === currentUser.id
                        const senderName  = msg.sender?.username ?? msg.sender?.email ?? 'Unknown'
                        const adminLabel  = isAdminMsg ? getAdminLabel(senderRole) : null

                        return (
                          <div key={msg.id} className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                            {/* Sender label */}
                            <div className="flex items-center gap-2">
                              {!isOwn && (
                                <span className={`font-mono text-[10px] tracking-[-0.05em] ${
                                  isAdminMsg
                                    ? senderRole === 'admin' ? 'text-red-400 font-semibold' : 'text-yellow-400 font-semibold'
                                    : 'text-[#6e6d6f]'
                                }`}>
                                  {adminLabel ? `${adminLabel} ${senderName}` : senderName}
                                </span>
                              )}
                              {isOwn && adminLabel && (
                                <span className={`font-mono text-[10px] tracking-[-0.05em] font-semibold ${
                                  senderRole === 'admin' ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                  {adminLabel} You
                                </span>
                              )}
                              <span className="font-mono text-[10px] tracking-[-0.05em] text-[#3a3a3a]">
                                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {/* Bubble */}
                            <div className={`relative max-w-[70%] rounded-md px-3.5 py-2.5 font-mono text-xs tracking-[-0.05em] leading-relaxed ${
                              isAdminMsg
                                ? senderRole === 'admin'
                                  ? isOwn
                                    ? 'bg-red-500/10 border border-red-500/40 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.15)] rounded-br-none'
                                    : 'bg-red-500/5 border border-red-500/30 text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.1)] rounded-bl-none'
                                  : isOwn
                                    ? 'bg-yellow-500/10 border border-yellow-500/40 text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.15)] rounded-br-none'
                                    : 'bg-yellow-500/5 border border-yellow-500/30 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.1)] rounded-bl-none'
                                : isOwn
                                  ? 'bg-white text-black rounded-br-none'
                                  : 'bg-[#1e1e1e] text-[#e8e8e8] rounded-bl-none'
                            }`}>
                              {isAdminMsg && (
                                <div className={`flex items-center gap-1 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  {senderRole === 'admin'
                                    ? <Shield size={9} strokeWidth={2} className="text-red-400" />
                                    : <Headphones size={9} strokeWidth={2} className="text-yellow-400" />
                                  }
                                  <span className={`font-mono text-[8px] tracking-[0.02em] font-semibold uppercase ${
                                    senderRole === 'admin' ? 'text-red-400' : 'text-yellow-400'
                                  }`}>
                                    {senderRole}
                                  </span>
                                </div>
                              )}
                              {msg.content}
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-[#1a1a1a] px-4 py-3">
                  <div className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-4 py-2.5 focus-within:border-yellow-500/40 transition-colors">
                    <Shield size={13} strokeWidth={1.5} className="text-yellow-400/60 shrink-0" />
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={`Message as ${currentUser.role === 'admin' ? '[SYSTEM ADMINISTRATOR]' : currentUser.role === 'support' ? '[SUPPORT]' : '[STAFF]'}...`}
                      className="flex-1 bg-transparent font-mono text-xs tracking-[-0.04em] text-white placeholder-[#4a4a4a] outline-none"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-30 transition-colors"
                    >
                      {sending
                        ? <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                        : <SendHorizonal size={12} strokeWidth={2} />
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Details + Actions — always shown when order is selected */}
              {activeOrder && (
                <div className="w-[280px] shrink-0 border-l border-[#1a1a1a] overflow-y-auto p-4 flex flex-col gap-4">

                  {/* Order Info */}
                  <div className="rounded-lg border border-[#1e1e1e] bg-[#111] p-3 flex flex-col gap-2">
                    <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-[#c8c8c8] mb-1">Order Info</p>
                    {([
                      ['Client',  activeOrder.client?.username ?? activeOrder.client?.email ?? '—'],
                      ['Booster', activeOrder.booster?.username ?? activeOrder.booster?.email ?? 'Unassigned'],
                      ['Game',    activeOrder.game?.name ?? '—'],
                      ['Service', activeOrder.service?.label ?? '—'],
                      ['Status',  activeOrder.status],
                      ['Created', new Date(activeOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em] shrink-0">{k}</span>
                        <span className="font-mono text-[9px] text-[#c8c8c8] tracking-[-0.03em] text-right break-all">{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Boost Details from order.details JSON */}
                  {(() => {
                    const d = (activeOrder.details ?? {}) as Record<string, unknown>
                    const rows: [string, string][] = []
                    if (d.current_rank) rows.push(['From Rank', String(d.current_rank)])
                    if (d.target_rank)  rows.push(['To Rank',   String(d.target_rank)])
                    if (d.server)       rows.push(['Region',    String(d.server)])
                    if (d.queue)        rows.push(['Queue',     String(d.queue)])
                    if (d.wins !== undefined) rows.push(['Wins', String(d.wins)])
                    if (!rows.length) return null
                    return (
                      <div className="rounded-lg border border-[#1e1e1e] bg-[#111] p-3 flex flex-col gap-2">
                        <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-[#c8c8c8] mb-1">Boost Details</p>
                        {rows.map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em] shrink-0">{k}</span>
                            <span className="font-mono text-[9px] text-[#c8c8c8] tracking-[-0.03em] truncate max-w-[140px]">{v}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Financial Breakdown */}
                  {(() => {
                    const { grossPrice, platformFee, boosterPayout } = calculateBoosterPayout(activeOrder.price)
                    return (
                      <div className="rounded-lg border border-[#1e1e1e] bg-[#111] p-3 flex flex-col gap-2">
                        <p className="font-mono text-[10px] font-semibold tracking-[-0.06em] text-[#c8c8c8] mb-1">Financials</p>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">Gross (Client Paid)</span>
                          <span className="font-mono text-[9px] text-white font-semibold">${grossPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">Booster Net Cut</span>
                          <span className="font-mono text-[9px] text-green-400 font-semibold">${boosterPayout.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-[#1e1e1e] my-0.5" />
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-[#4a4a4a] tracking-[-0.03em]">Platform Profit</span>
                          <span className="font-mono text-[9px] text-yellow-400 font-semibold">${platformFee.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Dispute Resolution Engine — dispute/support orders only */}
                  {(activeOrder.status === 'dispute' || activeOrder.status === 'support') && (
                    <DisputeResolutionEngine
                      order={activeOrder}
                      onResolved={() => setSelection((sel) => sel?.kind === 'order' ? { kind: 'order', order: { ...sel.order, status: 'completed' } } : sel)}
                    />
                  )}

                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
