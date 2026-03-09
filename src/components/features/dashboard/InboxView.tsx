'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Shield, Headphones, Briefcase, SendHorizonal, Loader2, MessageSquare,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendDmMessage, fetchDmMessages } from '@/lib/actions/chat'
import type { ChatMessage } from '@/types'

// ─── Channel definitions ──────────────────────────────────────────────────────

type ChannelId = 'admin' | 'support' | 'accountant'

interface ChannelDef {
  id: ChannelId
  label: string
  role: string
  Icon: React.ElementType
  iconColor: string
  dotColor: string
  pillCls: string    // badge colour classes for the "secure channel" pill
  activeBg: string   // subtle left-sidebar highlight when selected
  borderAccent: string
}

const CHANNELS: ChannelDef[] = [
  {
    id:           'admin',
    label:        'Admin',
    role:         'Platform Administrator',
    Icon:         Shield,
    iconColor:    'text-purple-400',
    dotColor:     'bg-purple-500',
    pillCls:      'border-purple-500/20 text-purple-400/70',
    activeBg:     'bg-purple-500/5',
    borderAccent: 'border-l-purple-500/50',
  },
  {
    id:           'support',
    label:        'Support',
    role:         'Help & Support Team',
    Icon:         Headphones,
    iconColor:    'text-blue-400',
    dotColor:     'bg-blue-500',
    pillCls:      'border-blue-500/20 text-blue-400/70',
    activeBg:     'bg-blue-500/5',
    borderAccent: 'border-l-blue-500/50',
  },
  {
    id:           'accountant',
    label:        'Accountant',
    role:         'Finance & Payments',
    Icon:         Briefcase,
    iconColor:    'text-emerald-400',
    dotColor:     'bg-emerald-500',
    pillCls:      'border-emerald-500/20 text-emerald-400/70',
    activeBg:     'bg-emerald-500/5',
    borderAccent: 'border-l-emerald-500/50',
  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface InboxViewProps {
  userId: string
  /** Last message per channel — pre-fetched on the server for instant preview. */
  lastMessages: Record<string, ChatMessage | null>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InboxView({ userId, lastMessages: initialLastMessages }: InboxViewProps) {
  const [activeChannel,  setActiveChannel]  = useState<ChannelId | null>(null)
  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  const [lastMessages,   setLastMessages]   = useState(initialLastMessages)
  const [loadingMsgs,    setLoadingMsgs]    = useState(false)
  const [input,          setInput]          = useState('')
  const [isSending,      setIsSending]      = useState(false)

  const bottomRef       = useRef<HTMLDivElement>(null)
  const activeChannelRef = useRef<ChannelId | null>(null)

  // Keep ref in sync so Realtime callbacks (which close over the initial value)
  // can read the latest active channel without stale closure issues.
  useEffect(() => { activeChannelRef.current = activeChannel }, [activeChannel])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Realtime: subscribe to all 3 DM threads at once ──────────────────────
  useEffect(() => {
    const supabase = createClient()

    const subs = CHANNELS.map((ch) => {
      const threadId = `${userId}:${ch.id}`

      return supabase
        .channel(`dm:${threadId}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'chat_messages',
            filter: `dm_thread_id=eq.${threadId}`,
          },
          (payload) => {
            const msg = payload.new as ChatMessage

            // Always update sidebar last-message preview
            setLastMessages((prev) => ({ ...prev, [ch.id]: msg }))

            // Append/swap into the active message view if this channel is open
            if (activeChannelRef.current === ch.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev

                // Own message echo: swap the optimistic bubble out
                if (msg.sender_id === userId) {
                  const optIdx = prev.findIndex(
                    (m) => m.id.startsWith('opt-') && m.content === msg.content,
                  )
                  if (optIdx !== -1) {
                    return prev.map((m, i) => (i === optIdx ? msg : m))
                  }
                }

                return [...prev, msg]
              })
            }
          },
        )
        .subscribe()
    })

    return () => {
      subs.forEach((ch) => supabase.removeChannel(ch))
    }
  // Intentionally omit activeChannel from deps — we use the ref instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Load messages when selecting a channel ───────────────────────────────
  const openChannel = useCallback(async (channelId: ChannelId) => {
    if (channelId === activeChannel) return
    setActiveChannel(channelId)
    setMessages([])
    setLoadingMsgs(true)
    const msgs = await fetchDmMessages(`${userId}:${channelId}`)
    setMessages(msgs)
    setLoadingMsgs(false)
  }, [activeChannel, userId])

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim()
    if (!text || !activeChannel || isSending) return

    const threadId    = `${userId}:${activeChannel}`
    const optimisticId = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id:           optimisticId,
      order_id:     null,
      dm_thread_id: threadId,
      sender_id:    userId,
      content:      text,
      image_url:    null,
      status:       'sending',
      created_at:   new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setIsSending(true)

    const result = await sendDmMessage(threadId, text)
    if (result?.error) {
      // Roll back and restore input on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(text)
    }

    setIsSending(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const activeChannelDef = CHANNELS.find((c) => c.id === activeChannel)

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-md border border-[#2a2a2a]">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <div className="w-[260px] shrink-0 flex flex-col border-r border-[#1a1a1a] bg-[#111111]">

        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b border-[#1a1a1a]">
          <h1 className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">Chat Inbox</h1>
          <p className="mt-0.5 font-mono text-[10px] tracking-[-0.05em] text-[#4a4a4a]">
            Official staff channels
          </p>
        </div>

        {/* Pinned channels — always rendered */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#3a3a3a]">
              Pinned
            </span>
          </div>

          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id
            const last     = lastMessages[ch.id]

            return (
              <button
                key={ch.id}
                onClick={() => openChannel(ch.id)}
                className={`relative w-full flex items-start gap-3 px-4 py-3.5 border-b border-[#0f0f0f] text-left transition-colors ${
                  isActive
                    ? `${ch.activeBg} border-l-[3px] ${ch.borderAccent}`
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                {/* Channel icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111]">
                  <ch.Icon size={16} strokeWidth={1.5} className={ch.iconColor} />
                </div>

                {/* Text block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-mono text-[11px] font-semibold tracking-[-0.05em] ${
                      isActive ? 'text-white' : 'text-[#c8c8c8]'
                    }`}>
                      {ch.label}
                    </span>
                    {last && (
                      <span className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a] shrink-0">
                        {relativeTime(last.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a] truncate mt-0.5">
                    {last
                      ? last.sender_id === userId
                        ? `You: ${last.content}`
                        : last.content
                      : `Message ${ch.label}…`
                    }
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Chat pane ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 bg-[#0f0f0f]">

        {/* No channel selected */}
        {!activeChannelDef ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111]">
                <MessageSquare size={20} strokeWidth={1.5} className="text-[#3a3a3a]" />
              </div>
              <p className="font-mono text-sm font-semibold tracking-[-0.07em] text-white">
                Official Channels
              </p>
              <p className="font-mono text-[11px] tracking-[-0.05em] text-[#4a4a4a] max-w-[220px] leading-relaxed">
                Select Admin, Support, or Accountant to open a secure conversation.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="shrink-0 flex items-center gap-3 border-b border-[#1a1a1a] px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#111111]">
                <activeChannelDef.Icon
                  size={14}
                  strokeWidth={1.5}
                  className={activeChannelDef.iconColor}
                />
              </div>
              <div>
                <p className="font-mono text-[12px] font-semibold tracking-[-0.06em] text-white">
                  {activeChannelDef.label}
                </p>
                <p className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                  {activeChannelDef.role}
                </p>
              </div>
              {/* Secure channel badge */}
              <div className={`ml-auto flex items-center gap-1.5 rounded border px-2 py-0.5 ${activeChannelDef.pillCls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeChannelDef.dotColor} opacity-80`} />
                <span className="font-mono text-[9px] tracking-[-0.03em]">secure channel</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {loadingMsgs ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 size={18} className="animate-spin text-[#4a4a4a]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="font-mono text-[11px] tracking-[-0.05em] text-[#3a3a3a]">
                    No messages yet. Send one below to start the conversation.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === userId
                  const isOpt = msg.id.startsWith('opt-')

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sender label for incoming only */}
                      {!isOwn && (
                        <span className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">
                          {activeChannelDef.label}
                        </span>
                      )}

                      {/* Bubble */}
                      <div className={`max-w-[440px] rounded-md px-3.5 py-2.5 font-mono text-[11px] tracking-[-0.04em] leading-relaxed ${
                        isOwn
                          ? 'bg-white text-black'
                          : 'bg-[#1a1a1a] text-white border border-[#2a2a2a]'
                      } ${isOpt ? 'opacity-60' : ''}`}>
                        {msg.content}
                      </div>

                      {/* Timestamp */}
                      <span className="font-mono text-[9px] tracking-[-0.03em] text-[#3a3a3a]">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-[#1a1a1a] px-5 py-3">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={`Message ${activeChannelDef.label}…`}
                  disabled={isSending}
                  className="flex-1 h-9 rounded-md border border-[#2a2a2a] bg-[#111111] px-3 font-mono text-xs tracking-[-0.05em] text-white placeholder:text-[#3a3a3a] outline-none focus:border-[#6e6d6f] transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-black transition-opacity disabled:opacity-30"
                >
                  {isSending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <SendHorizonal size={14} strokeWidth={1.5} />
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
