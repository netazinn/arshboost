'use client'

import { useState, useRef } from 'react'
import {
  User,
  Lock,
  Monitor,
  Bell,
  Chrome,
  MessageSquare,
  X,
  Pencil,
  Check,
} from 'lucide-react'
import type { Profile } from '@/types'
import { updateProfileAction } from '@/lib/actions/profile'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'notifications' | 'accounts'

interface NotifToggles {
  pushEnabled: boolean
  purchaseEmail: boolean
  purchasePush: boolean
}

interface SessionRow {
  device: string
  location: string
  lastActive: string
  current: boolean
}

// ─── Static data ─────────────────────────────────────────────────────────────

const MOCK_SESSIONS: SessionRow[] = [
  { device: 'Chrome on macOS', location: 'Istanbul, Turkey', lastActive: 'now', current: true },
  { device: 'Safari on iPhone', location: 'Istanbul, Turkey', lastActive: '2 days ago', current: false },
]

const LANGUAGES = ['English', 'Turkish', 'German', 'French', 'Spanish', 'Portuguese']
const TIMEZONES = [
  'UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00',
  'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:00',
  'UTC-02:00', 'UTC-01:00', 'UTC+00:00', 'UTC+01:00', 'UTC+02:00',
  'UTC+03:00', 'UTC+04:00', 'UTC+05:00', 'UTC+05:30', 'UTC+06:00',
  'UTC+07:00', 'UTC+08:00', 'UTC+09:00', 'UTC+10:00', 'UTC+11:00', 'UTC+12:00',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 flex flex-col gap-4">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-white font-semibold text-sm">{children}</h2>
}

function Divider() {
  return <div className="h-px bg-[#2a2a2a]" />
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-white' : 'bg-[#2a2a2a]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  profile: Profile
  onClose: () => void
  onSaved: (updates: Partial<Profile>) => void
}

function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [username, setUsername] = useState(profile.username ?? '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [language, setLanguage] = useState('English')
  const [timezone, setTimezone] = useState('UTC+03:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await updateProfileAction({
      username: username.trim() || undefined,
      avatar_url: avatarPreview ?? undefined,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSaved({ username: username.trim() || null, avatar_url: avatarPreview })
    onClose()
  }

  const initials = (profile.username ?? profile.email).slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">Edit Profile</h3>
          <button onClick={onClose} className="text-[#6e6d6f] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-[#2a2a2a]" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] flex items-center justify-center ring-2 ring-[#3a3a3a]">
                <span className="text-white font-bold text-xl">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-[#6e6d6f] hover:text-white transition-colors"
            >
              <Pencil size={11} />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <p className="text-[#6e6d6f] text-xs">JPG, PNG or GIF · Max 2 MB</p>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-medium">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#6e6d6f] outline-none focus:border-white/30 transition-colors"
            />
            <p className="text-[#6e6d6f] text-xs">You can change your username once every 90 days.</p>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-medium">Email</label>
            <input
              value={profile.email}
              readOnly
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#6e6d6f] text-sm outline-none cursor-not-allowed"
            />
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-medium">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-colors appearance-none"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Timezone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-medium">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-colors appearance-none"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white text-sm rounded-lg py-2.5 hover:bg-[#252525] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-white text-black text-sm font-semibold rounded-lg py-2.5 hover:bg-[#e5e5e5] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ profile, onProfileUpdate }: { profile: Profile; onProfileUpdate: (p: Partial<Profile>) => void }) {
  const [editOpen, setEditOpen] = useState(false)

  const initials = (profile.username ?? profile.email).slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col gap-4">
      {/* Profile Card */}
      <SectionCard>
        <SectionTitle>Profile</SectionTitle>
        <Divider />
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-14 h-14 rounded-full object-cover ring-2 ring-[#2a2a2a]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">{initials}</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{profile.username ?? 'No username set'}</p>
            <p className="text-[#6e6d6f] text-xs truncate">{profile.email}</p>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="ml-auto flex-shrink-0 bg-[#1e1e1e] border border-[#2a2a2a] text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-[#252525] transition-colors"
          >
            Edit Profile
          </button>
        </div>
      </SectionCard>

      {/* Two-Factor Authentication */}
      <SectionCard>
        <SectionTitle>Two-Factor Authentication</SectionTitle>
        <Divider />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#111111] border border-[#2a2a2a] flex items-center justify-center text-white">
              <Lock size={15} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-white text-sm font-medium">Authenticator App</p>
              <p className="text-[#6e6d6f] text-xs">Use an authenticator app to generate one-time codes.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              <Check size={10} strokeWidth={2.5} />
              Enabled
            </span>
            <button
              disabled
              className="bg-[#1e1e1e] border border-[#2a2a2a] text-[#6e6d6f] text-xs rounded-lg px-4 py-2 opacity-50 cursor-not-allowed"
            >
              Manage
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Login Sessions */}
      <SectionCard>
        <SectionTitle>Login Sessions</SectionTitle>
        <Divider />
        <div className="flex flex-col gap-3">
          {MOCK_SESSIONS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#111111] border border-[#2a2a2a] flex items-center justify-center text-[#6e6d6f]">
                  <Monitor size={14} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm">{s.device}</p>
                    {s.current && (
                      <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[#6e6d6f] text-xs">{s.location} · {s.lastActive}</p>
                </div>
              </div>
              {!s.current && (
                <button className="text-red-400 hover:text-red-300 text-xs transition-colors">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {editOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(updates) => { onProfileUpdate(updates); setEditOpen(false) }}
        />
      )}
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const [notif, setNotif] = useState<NotifToggles>({
    pushEnabled: true,
    purchaseEmail: true,
    purchasePush: false,
  })

  function set(key: keyof NotifToggles, val: boolean) {
    setNotif(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Global Push */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <SectionTitle>Enable Push Notifications</SectionTitle>
            <p className="text-[#6e6d6f] text-xs">Receive browser push notifications for important updates.</p>
          </div>
          <Toggle checked={notif.pushEnabled} onChange={v => set('pushEnabled', v)} />
        </div>
      </SectionCard>

      {/* Purchases */}
      <SectionCard>
        <SectionTitle>Purchases</SectionTitle>
        <Divider />

        <div className="flex items-center justify-between py-1">
          <div className="flex flex-col gap-0.5">
            <p className="text-white text-sm">Order Updates</p>
            <p className="text-[#6e6d6f] text-xs">Status changes, completion and refund notifications.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[#6e6d6f] text-[10px] uppercase tracking-wider">Email</span>
              <Toggle checked={notif.purchaseEmail} onChange={v => set('purchaseEmail', v)} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[#6e6d6f] text-[10px] uppercase tracking-wider">Push</span>
              <Toggle checked={notif.purchasePush} onChange={v => set('purchasePush', v)} disabled={!notif.pushEnabled} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Discord */}
      <SectionCard>
        <SectionTitle>Discord</SectionTitle>
        <Divider />
        <div className="flex items-center justify-between py-1 opacity-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5865f2]/20 flex items-center justify-center">
              <MessageSquare size={14} className="text-[#5865f2]" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-white text-sm">Discord DMs</p>
              <p className="text-[#6e6d6f] text-xs">Connect Discord to receive notifications. (Coming soon)</p>
            </div>
          </div>
          <button disabled className="bg-[#1e1e1e] border border-[#2a2a2a] text-[#6e6d6f] text-xs rounded-lg px-4 py-2 cursor-not-allowed">
            Connect Discord
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Connected Accounts Tab ───────────────────────────────────────────────────

function ConnectedAccountsTab({ email }: { email: string }) {
  const isGoogleUser = email.endsWith('@gmail.com')

  return (
    <div className="flex flex-col gap-4">
      {/* Discord */}
      <SectionCard>
        <SectionTitle>Connected Accounts</SectionTitle>
        <Divider />

        {/* Discord */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#5865f2]/20 flex items-center justify-center">
              <MessageSquare size={16} className="text-[#5865f2]" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-white text-sm font-medium">Discord</p>
              <p className="text-[#6e6d6f] text-xs">Link Discord for identity verification and notifications.</p>
            </div>
          </div>
          <button className="bg-[#1e1e1e] border border-[#2a2a2a] text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-[#252525] transition-colors">
            Connect
          </button>
        </div>

        <Divider />

        {/* Google */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
              <Chrome size={16} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-white text-sm font-medium">Google</p>
              <p className="text-[#6e6d6f] text-xs">Use your Google account to sign in.</p>
            </div>
          </div>
          {isGoogleUser ? (
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-full">
              <Check size={10} strokeWidth={2.5} />
              Connected
            </span>
          ) : (
            <button className="bg-[#1e1e1e] border border-[#2a2a2a] text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-[#252525] transition-colors">
              Connect
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <User size={15} strokeWidth={1.5} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} strokeWidth={1.5} /> },
  { id: 'accounts', label: 'Connected Accounts', icon: <Chrome size={15} strokeWidth={1.5} /> },
]

interface SettingsViewProps {
  profile: Profile
}

export function SettingsView({ profile: initialProfile }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [profile, setProfile] = useState<Profile>(initialProfile)

  function handleProfileUpdate(updates: Partial<Profile>) {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto pb-6">
      {/* Tab bar — standalone clickable boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border bg-[#111111] font-mono text-sm tracking-[-0.06em] transition-all duration-200 ${
              activeTab === tab.id
                ? 'border-white text-white'
                : 'border-[#2a2a2a] text-[#6e6d6f] hover:border-[#6e6d6f] hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <GeneralTab profile={profile} onProfileUpdate={handleProfileUpdate} />
      )}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'accounts' && <ConnectedAccountsTab email={profile.email} />}
    </div>
  )
}
