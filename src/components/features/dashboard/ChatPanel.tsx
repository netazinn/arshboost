'use client'

import { useRef, useEffect, useState, useTransition } from 'react'
import { SendHorizonal, ImagePlus, Loader2, Check, CheckCheck, Shield } from 'lucide-react'
import { sendMessage, fetchMessages, getSenderProfile } from '@/lib/actions/chat'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage, Profile } from '@/types'

// ─── Shared system-message primitives (also used by OrderDetailView) ───────────
export const SYS_COLOR_MAP: Record<string, string> = {
  completed:      'text-green-400',
  dispute:        'text-orange-400',
  support:        'text-blue-400',
  cancel:         'text-red-400',
  rank_update:    'text-purple-400',
  waiting_action: 'text-yellow-400',
}

export function SystemMessageDivider({ text, colorCls }: { text: string; colorCls?: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="h-px flex-1 bg-[#2a2a2a]" />
      <span className={`font-mono text-[10px] tracking-[-0.05em] text-center px-1 ${colorCls ?? 'text-[#4a4a4a]'}`}>
        {text}
      </span>
      <div className="h-px flex-1 bg-[#2a2a2a]" />
    </div>
  )
}

interface ChatPanelProps {
  orderId: string
  messages: ChatMessage[]
  currentUser: Pick<Profile, 'id' | 'role'>
  /** Show image upload button (for booster role) */
  allowImages?: boolean
}

export function ChatPanel({
  orderId,
  messages: initialMessages,
  currentUser,
  allowImages = false,
}: ChatPanelProps) {
  // Local state — seeded from server prop, then kept live via Realtime
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)

  // Note: no polling fallback — Realtime postgres_changes + broadcast nudge
  // below handle all new message delivery without periodic REST fetching.
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime: two parallel delivery paths for maximum reliability.
  // Path A — postgres_changes: instant for messages where RLS allows SELECT.
  // Path B — broadcast nudge: instant for ALL messages, bypasses RLS on CDC.
  useEffect(() => {
    const supabase = createClient()
    console.log(`[ChatPanel][Realtime] Subscribing to chat_messages for order ${orderId}`)

    const applyMsg = async (newMsg: ChatMessage) => {
      if (newMsg.sender_id === currentUser.id) return // own message already shown optimistically
      // Fetch sender profile via server action (bypasses profiles RLS) so admin/support
      // role styling works correctly in booster/client views.
      let msgWithSender = newMsg
      if (!newMsg.sender?.role) {
        const senderProfile = await getSenderProfile(newMsg.sender_id)
        if (senderProfile) {
          msgWithSender = { ...newMsg, sender: senderProfile as ChatMessage['sender'] }
        }
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === msgWithSender.id)) return prev
        return [...prev, msgWithSender]
      })
    }

    // Path A — postgres_changes (works when RLS allows the Booster to see Client rows)
    const pgChannel = supabase
      .channel(`chatpanel:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          console.log('[ChatPanel][Realtime] postgres_changes INSERT:', newMsg.id, 'from:', newMsg.sender_id)
          applyMsg(newMsg)
        },
      )
      .subscribe((status, err) => {
        console.log('[ChatPanel][Realtime] pg channel status:', status, err ? `| error: ${String(err)}` : '')
      })

    // Path B — broadcast nudge sent by the Client immediately after their INSERT.
    // Does not carry the message payload; triggers a fetchMessages pull instead.
    const syncChannel = supabase
      .channel(`chat-sync:${orderId}`)
      .on('broadcast', { event: 'nudge' }, async () => {
        console.log('[ChatPanel][Broadcast] Nudge received — pulling latest messages')
        const latest = await fetchMessages(orderId)
        setMessages((prev) => {
          const confirmedIds = new Set(prev.filter((m) => !m.id.startsWith('opt-')).map((m) => m.id))
          const hasNew = latest.some((m) => !confirmedIds.has(m.id))
          if (!hasNew) return prev
          const pendingOpts = prev.filter(
            (m) => m.id.startsWith('opt-') && !latest.some((db) => db.content === m.content && db.sender_id === currentUser.id)
          )
          return [...latest, ...pendingOpts]
        })
      })
      .subscribe((status, err) => {
        console.log('[ChatPanel][Broadcast] sync channel status:', status, err ? `| error: ${String(err)}` : '')
      })

    return () => {
      console.log(`[ChatPanel][Realtime] Unsubscribing from order ${orderId}`)
      supabase.removeChannel(pgChannel)
      supabase.removeChannel(syncChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, currentUser.id])

  function handleSend() {
    if (!input.trim() || isPending) return
    const text = input
    setInput('')
    setError(null)

    // Optimistic: show own message immediately
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      order_id: orderId,
      sender_id: currentUser.id,
      content: text,
      image_url: null,
      status: 'sending',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    startTransition(async () => {
      const result = await sendMessage(orderId, text)
      if (result?.error) {
        setError(result.error)
        // Roll back optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      } else {
        // Replace optimistic entry with the confirmed DB state immediately
        // so no duplicate appears when the polling interval fires.
        const confirmed = await fetchMessages(orderId)
        setMessages(confirmed)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-xs tracking-[-0.1em] text-[#4a4a4a]">
              No messages yet. Start the conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUser.id
            const senderRole = msg.sender?.role ?? ''
            const isStaffSender = ['admin', 'support', 'accountant'].includes(senderRole)
            const staffLabel = senderRole === 'admin' ? '[SYSTEM ADMINISTRATOR]'
              : senderRole === 'support' ? '[SUPPORT]'
              : senderRole === 'accountant' ? '[ACCOUNTANT]'
              : null

            // ── System message: centred divider ───────────────────
            if (msg.is_system) {
              const colorCls = (msg.system_type && SYS_COLOR_MAP[msg.system_type]) ?? undefined
              return <SystemMessageDivider key={msg.id} text={msg.content} colorCls={colorCls} />
            }

            // Resolve sender label — staff override takes priority over generic party label
            const otherPartyLabel = currentUser.role === 'booster' ? 'Client' : 'Booster'
            const displayName = msg.sender?.username ?? msg.sender?.email ?? otherPartyLabel
            const senderName = isOwn
              ? (staffLabel ? `${staffLabel} You` : 'You')
              : (staffLabel ? `${staffLabel} ${displayName}` : displayName)

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {/* Sender label */}
                <div className="flex items-center gap-2">
                  {(!isOwn || (isOwn && isStaffSender)) && (
                    <span className={`font-mono text-[10px] tracking-[-0.05em] ${
                      isStaffSender
                        ? senderRole === 'admin' ? 'text-red-400 font-semibold' : 'text-yellow-400 font-semibold'
                        : 'text-[#6e6d6f]'
                    }`}>
                      {senderName}
                    </span>
                  )}
                  <span className="font-mono text-[10px] tracking-[-0.05em] text-[#3a3a3a]">
                    {formatTime(msg.created_at)}
                  </span>
                </div>

                {/* Bubble */}
                {msg.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.image_url}
                    alt="Attached image"
                    className="max-w-[240px] rounded-md border border-[#2a2a2a]"
                  />
                ) : (
                  <div
                    className={`max-w-[320px] rounded-md px-3 py-2 font-mono text-xs tracking-[-0.05em] leading-relaxed ${
                      isStaffSender
                        ? senderRole === 'admin'
                          ? isOwn
                            ? 'bg-red-500/10 border border-red-500/40 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.15)] rounded-br-none'
                            : 'bg-red-500/5 border border-red-500/30 text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.1)] rounded-bl-none'
                          : isOwn
                            ? 'bg-yellow-500/10 border border-yellow-500/40 text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.15)] rounded-br-none'
                            : 'bg-yellow-500/5 border border-yellow-500/30 text-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.1)] rounded-bl-none'
                        : isOwn
                          ? 'bg-white text-black'
                          : 'bg-[#2a2a2a] text-white'
                    }`}
                  >
                    {isStaffSender && (
                      <div className={`flex items-center gap-1 mb-1 ${
                        isOwn ? 'justify-end' : 'justify-start'
                      }`}>
                        <Shield size={9} strokeWidth={2} className={senderRole === 'admin' ? 'text-red-400' : 'text-yellow-400'} />
                        <span className={`font-mono text-[8px] tracking-[0.02em] font-semibold uppercase ${
                          senderRole === 'admin' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {senderRole}
                        </span>
                      </div>
                    )}
                    {msg.content}
                  </div>
                )}

                {/* Read receipt — only on own messages */}
                {isOwn && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {msg.is_read
                      ? <CheckCheck size={11} strokeWidth={2} className="text-green-400" />
                      : <Check      size={11} strokeWidth={2} className="text-[#4a4a4a]" />
                    }
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="shrink-0 px-4 pb-1 font-mono text-[10px] tracking-[-0.05em] text-red-400">
          {error}
        </p>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[#2a2a2a] p-3">
        <div className="flex items-end gap-2">
          {allowImages && (
            <button
              type="button"
              title="Attach image (Phase 4)"
              disabled
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] text-[#4a4a4a] opacity-40 cursor-not-allowed"
            >
              <ImagePlus size={14} strokeWidth={1.5} />
            </button>
          )}

          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            disabled={isPending}
            className="flex-1 resize-none rounded-md border border-[#2a2a2a] bg-[#111111] px-3 py-2 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#4a4a4a] focus:border-[#6e6d6f] focus:outline-none disabled:opacity-50 transition-colors"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-black transition-opacity disabled:opacity-30"
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <SendHorizonal size={14} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
