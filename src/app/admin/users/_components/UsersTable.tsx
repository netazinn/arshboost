'use client'

import type { ReactNode } from 'react'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MoreVertical, Eye, UserCog, ShieldBan, ShieldCheck, X, Loader2,
  Pencil, KeyRound, Zap, BadgeCheck, Trash2, Search, ChevronDown,
  Copy, Check, Shield, MapPin, Wifi,
} from 'lucide-react'
import type { Profile, UserRole } from '@/types'
import type { UserFilter, UserSort } from '@/lib/data/admin'
import {
  updateUserRole,
  toggleUserBanStatus,
  getUserDetails,
  getUserSecurityDetails,
  adminSendPasswordReset,
  adminSendMagicLink,
  adminVerifyEmail,
  adminHardDeleteUser,
  adminUpdateUserProfile,
} from '@/lib/actions/admin'
import {
  getVerificationForAdmin,
  getVerificationDocumentUrl,
  updateVerificationStatus,
  saveVerificationNotes,
} from '@/lib/actions/verification'
import type { VerificationRecord } from '@/lib/actions/verification'
import { submitBanRequest } from '@/lib/actions/ban-requests'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetailsData {
  balance:             number
  bank_holder_name:    string | null
  bank_name:           string | null
  bank_swift:          string | null
  bank_iban:           string | null
  bank_details_status: 'none' | 'approved' | 'under_review'
  activeOrders:        number
  completedOrders:     number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  admin:      'border-red-500/30 bg-red-500/10 text-red-400',
  support:    'border-blue-500/30 bg-blue-500/10 text-blue-400',
  accountant: 'border-green-500/30 bg-green-500/10 text-green-400',
  booster:    'border-purple-500/30 bg-purple-500/10 text-purple-400',
  client:     'border-[#3a3a3a] bg-[#1a1a1a] text-[#9a9a9a]',
}

const ALL_ROLES: UserRole[] = ['client', 'booster', 'support', 'accountant', 'admin']

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1)  return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MenuDivider() {
  return <div className="mx-3 my-1 border-t border-[#2a2a2a]" />
}

function MenuItem({
  icon: Icon, label, onClick, disabled = false, danger = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-2 font-mono text-[10px] tracking-[-0.04em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-red-400 hover:bg-red-950/30'
          : 'text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-white'
      }`}
    >
      <Icon size={12} strokeWidth={2} />
      {label}
    </button>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-[#3a3a3a]">
      {children}
    </p>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">{label}</span>
      <span className="max-w-[200px] truncate text-right font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a]">
        {value}
      </span>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">
      {children}
    </label>
  )
}

function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 font-mono text-[11px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none transition-colors focus:border-[#3a3a3a]"
    />
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, confirmLabel, onConfirm, onCancel, loading, danger = true,
}: {
  title:        string
  description:  string
  confirmLabel: string
  onConfirm:    () => void
  onCancel:     () => void
  loading:      boolean
  danger?:      boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-6 shadow-2xl">
        <h2 className="mb-1 font-mono text-[14px] font-bold tracking-[-0.06em] text-white">{title}</h2>
        <p className="mb-5 font-mono text-[10px] tracking-[-0.04em] text-[#6a6a6a]">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded border border-[#2a2a2a] px-4 py-2 font-mono text-[10px] tracking-[-0.04em] text-[#6a6a6a] transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded border px-4 py-2 font-mono text-[10px] font-semibold tracking-[-0.04em] transition-colors disabled:opacity-40 ${
              danger
                ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'border-[#3a3a3a] bg-white text-black hover:bg-[#f0f0f0]'
            }`}
          >
            {loading && <Loader2 size={11} strokeWidth={2} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] rounded-lg border px-4 py-3 font-mono text-[11px] tracking-[-0.04em] shadow-2xl ${
        type === 'success'
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UsersTable({
  initialUsers,
  currentUserId,
  currentUserRole = 'admin',
  initialSearch = '',
  initialFilter = 'all',
  initialSort   = 'newest',
  isIpSearch    = false,
  ipSearchQuery,
}: {
  initialUsers:     Profile[]
  currentUserId:    string
  currentUserRole?: UserRole
  initialSearch?:   string
  initialFilter?:   UserFilter
  initialSort?:     UserSort
  isIpSearch?:      boolean
  ipSearchQuery?:   string
}) {
  const router = useRouter()
  const isSupport = currentUserRole === 'support'
  const [isPending, startTransition] = useTransition()
  const [users, setUsers] = useState<Profile[]>(initialUsers)

  // Keep local users in sync when server re-renders with new filtered data
  useEffect(() => { setUsers(initialUsers) }, [initialUsers])

  // ── Toolbar state (mirrors URL params)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [filterValue, setFilterValue] = useState<UserFilter>(initialFilter)
  const [sortValue, setSortValue]     = useState<UserSort>(initialSort)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function pushParams(overrides: { search?: string; filter?: UserFilter; sort?: UserSort }) {
    const params = new URLSearchParams()
    const s = overrides.search !== undefined ? overrides.search : searchInput
    const f = overrides.filter !== undefined ? overrides.filter : filterValue
    const o = overrides.sort   !== undefined ? overrides.sort   : sortValue
    if (s) params.set('search', s)
    if (f !== 'all')    params.set('filter', f)
    if (o !== 'newest') params.set('sort', o)
    startTransition(() => {
      router.push(`/admin/users${params.size ? `?${params.toString()}` : ''}`)
    })
  }

  function handleSearchChange(val: string) {
    setSearchInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushParams({ search: val }), 400)
  }

  function handleFilterChange(val: UserFilter) {
    setFilterValue(val)
    pushParams({ filter: val })
  }

  function handleSortChange(val: UserSort) {
    setSortValue(val)
    pushParams({ sort: val })
  }

  // Dropdown
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos]       = useState<{ top: number; right: number } | null>(null)

  // Change Role dialog
  const [roleTarget, setRoleTarget]     = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('client')
  const [roleLoading, setRoleLoading]   = useState(false)
  const [roleError, setRoleError]       = useState('')

  // View Details sheet
  const [viewTarget, setViewTarget]                   = useState<Profile | null>(null)
  const [viewData, setViewData]                       = useState<UserDetailsData | null>(null)
  const [viewLoading, setViewLoading]                 = useState(false)
  const [viewError, setViewError]                     = useState('')
  const [verificationRecord, setVerificationRecord]   = useState<VerificationRecord | null | undefined>(undefined)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [adminNotes, setAdminNotes]                   = useState('')
  const [approvalLoading, setApprovalLoading]         = useState(false)

  // Edit Profile dialog
  const [editTarget, setEditTarget]             = useState<Profile | null>(null)
  const [editUsername, setEditUsername]         = useState('')
  const [editEmail, setEditEmail]               = useState('')
  const [editClearAvatar, setEditClearAvatar]   = useState(false)
  const [editLoading, setEditLoading]           = useState(false)
  const [editError, setEditError]               = useState('')

  // Hard Delete confirm
  const [deleteTarget, setDeleteTarget]   = useState<Profile | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Ban
  const [banLoadingId, setBanLoadingId] = useState<string | null>(null)

  // Ban requests (support flow)
  const [banRequestTarget,  setBanRequestTarget]  = useState<Profile | null>(null)
  const [banRequestReason,  setBanRequestReason]  = useState('')
  const [banRequestLoading, setBanRequestLoading] = useState(false)

  // KYC notes saving (support flow)
  const [notesSaving, setNotesSaving] = useState(false)

  // Security details (admin-only)
  const [securityData, setSecurityData]       = useState<{ last_sign_in_ip: string | null; last_sign_in_at: string | null; geo: { country: string; countryCode: string; city: string; isp: string } | null } | null>(null)
  const [securityLoading, setSecurityLoading] = useState(false)
  const [copiedIp, setCopiedIp]               = useState(false)

  // Auth quick-action loading & toast
  const [authLoadingId, setAuthLoadingId]       = useState<string | null>(null)
  const [toast, setToast]                       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ─── Toast helper ──────────────────────────────────────────────────────────

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Dropdown ──────────────────────────────────────────────────────────────

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>, userId: string) {
    if (openMenuId === userId) { setOpenMenuId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpenMenuId(userId)
  }

  // ─── Change Role ───────────────────────────────────────────────────────────

  function openRoleDialog(u: Profile) {
    setRoleTarget(u)
    setSelectedRole(u.role)
    setRoleError('')
    setOpenMenuId(null)
  }

  async function handleRoleChange() {
    if (!roleTarget) return
    setRoleLoading(true); setRoleError('')
    const res = await updateUserRole(roleTarget.id, selectedRole)
    setRoleLoading(false)
    if (res.error) { setRoleError(res.error) }
    else {
      setUsers(prev => prev.map(p => p.id === roleTarget.id ? { ...p, role: selectedRole } : p))
      setRoleTarget(null)
      showToast('Role updated.', 'success')
    }
  }

  // ─── View Details ──────────────────────────────────────────────────────────

  async function openViewSheet(u: Profile) {
    setViewTarget(u); setViewData(null); setViewError(''); setViewLoading(true)
    setVerificationRecord(undefined); setAdminNotes('')
    setSecurityData(null)
    setOpenMenuId(null)
    const [detailsRes] = await Promise.all([
      getUserDetails(u.id),
    ])
    setViewLoading(false)
    if (detailsRes.error) setViewError(detailsRes.error)
    else if (detailsRes.data) setViewData(detailsRes.data)

    if (!isSupport) {
      setSecurityLoading(true)
      const secRes = await getUserSecurityDetails(u.id)
      setSecurityLoading(false)
      if (secRes.data) setSecurityData(secRes.data)
    }

    if (u.role === 'booster') {
      setVerificationLoading(true)
      const vRes = await getVerificationForAdmin(u.id)
      setVerificationLoading(false)
      if (vRes.data) {
        setVerificationRecord(vRes.data)
        setAdminNotes(vRes.data.admin_notes ?? '')
      } else {
        setVerificationRecord(null)
      }
    }
  }

  // ─── Ban toggle ────────────────────────────────────────────────────────────

  async function handleBanToggle(u: Profile) {
    setOpenMenuId(null)
    setBanLoadingId(u.id)
    const res = await toggleUserBanStatus(u.id)
    setBanLoadingId(null)
    if (!res.error && res.is_banned !== undefined) {
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_banned: res.is_banned as boolean } : p))
      showToast(res.is_banned ? 'User banned.' : 'User unbanned.', 'success')
    } else if (res.error) {
      showToast(res.error, 'error')
    }
  }

  // ─── Submit Ban Request (support) ───────────────────────────────────────

  async function handleSubmitBanRequest() {
    if (!banRequestTarget) return
    setBanRequestLoading(true)
    const res = await submitBanRequest(
      banRequestTarget.id,
      banRequestTarget.is_banned ? 'unban' : 'ban',
      banRequestReason,
    )
    setBanRequestLoading(false)
    if (res.error) {
      showToast(res.error, 'error')
    } else {
      setBanRequestTarget(null)
      setBanRequestReason('')
      showToast('Request submitted. Awaiting admin approval.', 'success')
    }
  }

  // ─── Save KYC Notes (support) ─────────────────────────────────────────

  async function handleSaveNotes() {
    if (!viewTarget) return
    setNotesSaving(true)
    const res = await saveVerificationNotes(viewTarget.id, adminNotes)
    setNotesSaving(false)
    if (res.error) showToast(res.error, 'error')
    else showToast('Notes saved.', 'success')
  }

  // ─── Edit Profile ──────────────────────────────────────────────────────────

  function openEditDialog(u: Profile) {
    setEditTarget(u)
    setEditUsername(u.username ?? '')
    setEditEmail(u.email)
    setEditClearAvatar(false)
    setEditError('')
    setOpenMenuId(null)
  }

  async function handleEditSave() {
    if (!editTarget) return
    setEditLoading(true); setEditError('')
    const res = await adminUpdateUserProfile(editTarget.id, {
      username:    editUsername !== editTarget.username ? editUsername : undefined,
      email:       editEmail    !== editTarget.email    ? editEmail    : undefined,
      clearAvatar: editClearAvatar || undefined,
    })
    setEditLoading(false)
    if (res.error) { setEditError(res.error) }
    else {
      setUsers(prev => prev.map(p => p.id === editTarget.id ? {
        ...p,
        username:   editUsername || null,
        email:      editEmail,
        avatar_url: editClearAvatar ? null : p.avatar_url,
      } : p))
      setEditTarget(null)
      showToast('Profile updated.', 'success')
    }
  }

  // ─── Auth quick actions ────────────────────────────────────────────────────

  async function handleAuthAction(
    u: Profile,
    action: 'password_reset' | 'magic_link' | 'verify_email',
  ) {
    setOpenMenuId(null)
    setAuthLoadingId(`${u.id}:${action}`)
    let res: { error?: string }
    if (action === 'password_reset') res = await adminSendPasswordReset(u.email)
    else if (action === 'magic_link') res = await adminSendMagicLink(u.email)
    else res = await adminVerifyEmail(u.id)
    setAuthLoadingId(null)
    if (res.error) showToast(res.error, 'error')
    else showToast(
      action === 'verify_email' ? 'Email marked as verified.' : 'Email sent.',
      'success',
    )
  }

  // ─── Hard delete ───────────────────────────────────────────────────────────

  async function handleHardDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const res = await adminHardDeleteUser(deleteTarget.id)
    setDeleteLoading(false)
    if (res.error) { showToast(res.error, 'error'); setDeleteTarget(null) }
    else {
      setUsers(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast('User permanently deleted.', 'success')
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const activeUser = users.find(u => u.id === openMenuId)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={13}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a] pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by email, username, or ID..."
            className="w-full rounded-md border border-[#1a1a1a] bg-[#0a0a0a] py-2 pl-8 pr-8 font-mono text-[11px] tracking-[-0.04em] text-white placeholder-[#3a3a3a] outline-none transition-colors focus:border-[#3a3a3a]"
          />
          {isPending && (
            <Loader2 size={11} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#4a4a4a]" />
          )}
        </div>

        {/* Role / status filter */}
        <div className="relative">
          <select
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value as UserFilter)}
            className="appearance-none rounded-md border border-[#1a1a1a] bg-[#0a0a0a] py-2 pl-3 pr-7 font-mono text-[11px] tracking-[-0.04em] text-[#9a9a9a] outline-none transition-colors focus:border-[#3a3a3a] cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="booster">Booster</option>
            <option value="client">Client</option>
            <option value="support">Support</option>
            <option value="accountant">Accountant</option>
            <option value="banned">Banned Users</option>
          </select>
          <ChevronDown size={11} strokeWidth={2} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value as UserSort)}
            className="appearance-none rounded-md border border-[#1a1a1a] bg-[#0a0a0a] py-2 pl-3 pr-7 font-mono text-[11px] tracking-[-0.04em] text-[#9a9a9a] outline-none transition-colors focus:border-[#3a3a3a] cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="active">Recently Active</option>
          </select>
          <ChevronDown size={11} strokeWidth={2} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
        </div>

        {/* Clear — only shown when filters are active */}
        {(searchInput || filterValue !== 'all' || sortValue !== 'newest') && (
          <button
            onClick={() => {
              setSearchInput('')
              setFilterValue('all')
              setSortValue('newest')
              pushParams({ search: '', filter: 'all', sort: 'newest' })
            }}
            className="whitespace-nowrap rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-[#6a6a6a] transition-colors hover:border-[#3a3a3a] hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── IP Search Banner ──────────────────────────────────────────────────── */}
      {isIpSearch && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <Wifi size={14} strokeWidth={1.5} className="shrink-0 text-blue-400" />
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[-0.04em] text-blue-300">
              IP Address Search — {ipSearchQuery}
            </p>
            <p className="font-mono text-[9px] tracking-[-0.02em] text-[#5a5a5a]">
              Showing all users whose last sign-in IP matches this address.
              Filters and sort are disabled in IP search mode.
            </p>
          </div>
          <button
            onClick={() => { pushParams({ search: '' }); }}
            className="ml-auto shrink-0 font-mono text-[9px] text-[#5a5a5a] transition-colors hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#1a1a1a]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
              {(['User', 'Email', 'Role', 'Joined', 'Last Active', ''] as const).map((h, i) => (
                <th
                  key={i}
                  className={`px-5 py-3 text-left font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a] ${i === 5 ? 'w-12' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <p className="font-mono text-[11px] tracking-[-0.04em] text-[#4a4a4a]">
                    No users found matching your criteria.
                  </p>
                </td>
              </tr>
            ) : users.map((u) => {
              const isAuthBusy = authLoadingId?.startsWith(u.id) || banLoadingId === u.id
              return (
                <tr
                  key={u.id}
                  className={`border-b border-[#0f0f0f] transition-colors ${
                    u.is_banned ? 'bg-red-950/5 opacity-40' : 'hover:bg-[#0d0d0d]'
                  }`}
                >
                  {/* User */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono text-[11px] font-semibold tracking-[-0.06em] text-white">
                        {u.username ?? '(no username)'}
                      </p>
                      {u.is_banned && (
                        <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[8px] tracking-[-0.01em] text-red-400">
                          🚫 BANNED
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">
                      #{u.id.slice(0, 8).toUpperCase()}
                    </p>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a]">{u.email}</span>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] tracking-[-0.02em] ${ROLE_BADGE[u.role] ?? ROLE_BADGE.client}`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
                      {new Date(u.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                  </td>

                  {/* Last Active */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
                      {formatRelative(u.last_sign_in_at)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3.5 text-right">
                    <button
                      onClick={(e) => toggleMenu(e, u.id)}
                      disabled={isAuthBusy}
                      className="flex items-center justify-center rounded p-1.5 text-[#4a4a4a] transition-colors hover:bg-[#1a1a1a] hover:text-white disabled:opacity-40"
                    >
                      {isAuthBusy
                        ? <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                        : <MoreVertical size={14} strokeWidth={2} />
                      }
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      {openMenuId && menuPos && activeUser && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)} />
          <div
            className="fixed z-40 w-52 rounded-md border border-[#2a2a2a] bg-[#111111] py-1 shadow-2xl"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <SectionLabel>Profile</SectionLabel>
            <MenuItem icon={Eye} label="View Details" onClick={() => openViewSheet(activeUser)} />
            {!isSupport && (
              <>
                <MenuItem icon={Pencil} label="Edit Profile" onClick={() => openEditDialog(activeUser)} />
                <MenuItem
                  icon={UserCog} label="Change Role"
                  onClick={() => openRoleDialog(activeUser)}
                  disabled={activeUser.id === currentUserId}
                />
              </>
            )}

            <MenuDivider />
            <SectionLabel>Auth</SectionLabel>
            <MenuItem icon={KeyRound}   label="Send Password Reset" onClick={() => handleAuthAction(activeUser, 'password_reset')} />
            {!isSupport && (
              <MenuItem icon={Zap} label="Send Magic Link" onClick={() => handleAuthAction(activeUser, 'magic_link')} />
            )}
            <MenuItem icon={BadgeCheck} label="Verify Email" onClick={() => handleAuthAction(activeUser, 'verify_email')} />

            <MenuDivider />
            <SectionLabel>Danger</SectionLabel>
            {isSupport ? (
              <button
                onClick={() => { setBanRequestTarget(activeUser); setBanRequestReason(''); setOpenMenuId(null) }}
                disabled={activeUser.id === currentUserId}
                className={`flex w-full items-center gap-2.5 px-3 py-2 font-mono text-[10px] tracking-[-0.04em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  activeUser.is_banned
                    ? 'text-green-400 hover:bg-green-950/30'
                    : 'text-orange-400 hover:bg-orange-950/30'
                }`}
              >
                {activeUser.is_banned ? <ShieldCheck size={12} strokeWidth={2} /> : <ShieldBan size={12} strokeWidth={2} />}
                {activeUser.is_banned ? 'Request Unban' : 'Request Ban'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleBanToggle(activeUser)}
                  disabled={activeUser.id === currentUserId}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 font-mono text-[10px] tracking-[-0.04em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    activeUser.is_banned
                      ? 'text-green-400 hover:bg-green-950/30'
                      : 'text-orange-400 hover:bg-orange-950/30'
                  }`}
                >
                  {activeUser.is_banned
                    ? <ShieldCheck size={12} strokeWidth={2} />
                    : <ShieldBan   size={12} strokeWidth={2} />
                  }
                  {activeUser.is_banned ? 'Unban User' : 'Ban User'}
                </button>
                <MenuItem
                  icon={Trash2} label="Hard Delete User" danger
                  onClick={() => { setDeleteTarget(activeUser); setOpenMenuId(null) }}
                  disabled={activeUser.id === currentUserId}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Change Role Dialog ────────────────────────────────────────────── */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-mono text-[14px] font-bold tracking-[-0.06em] text-white">Change Role</h2>
                <p className="mt-0.5 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                  {roleTarget.username ?? roleTarget.email}
                </p>
              </div>
              <button onClick={() => setRoleTarget(null)} className="text-[#4a4a4a] transition-colors hover:text-white">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="mb-4">
              <FieldLabel>New Role</FieldLabel>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full rounded border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 font-mono text-[11px] tracking-[-0.04em] text-white outline-none transition-colors focus:border-[#3a3a3a]"
              >
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {roleError && (
              <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-red-400">
                {roleError}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setRoleTarget(null)} className="flex-1 rounded border border-[#2a2a2a] px-4 py-2 font-mono text-[10px] tracking-[-0.04em] text-[#6a6a6a] transition-colors hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={roleLoading || selectedRole === roleTarget.role}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-[#3a3a3a] bg-white px-4 py-2 font-mono text-[10px] font-semibold tracking-[-0.04em] text-black transition-colors hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {roleLoading && <Loader2 size={11} strokeWidth={2} className="animate-spin text-black" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Profile Dialog ───────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-mono text-[14px] font-bold tracking-[-0.06em] text-white">Edit Profile</h2>
                <p className="mt-0.5 font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">
                  #{editTarget.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-[#4a4a4a] transition-colors hover:text-white">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-4">
              <div>
                <FieldLabel>Username</FieldLabel>
                <TextInput value={editUsername} onChange={setEditUsername} placeholder="(none)" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <TextInput value={editEmail} onChange={setEditEmail} type="email" />
              </div>
              {editTarget.avatar_url && (
                <label className="flex cursor-pointer items-center gap-2.5 rounded border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={editClearAvatar}
                    onChange={(e) => setEditClearAvatar(e.target.checked)}
                    className="accent-red-500"
                  />
                  <span className="font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a]">Reset avatar</span>
                </label>
              )}
            </div>

            {editError && (
              <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-red-400">
                {editError}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setEditTarget(null)} className="flex-1 rounded border border-[#2a2a2a] px-4 py-2 font-mono text-[10px] tracking-[-0.04em] text-[#6a6a6a] transition-colors hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-[#3a3a3a] bg-white px-4 py-2 font-mono text-[10px] font-semibold tracking-[-0.04em] text-black transition-colors hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editLoading && <Loader2 size={11} strokeWidth={2} className="animate-spin text-black" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Details Sheet ────────────────────────────────────────────── */}
      {viewTarget && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setViewTarget(null)}
        >
          <div
            className="h-full w-full max-w-sm overflow-y-auto border-l border-[#2a2a2a] bg-[#0a0a0a] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#1a1a1a] px-6 py-5">
              <div>
                <h2 className="font-mono text-[14px] font-bold tracking-[-0.06em] text-white">
                  {viewTarget.username ?? '(no username)'}
                </h2>
                <p className="mt-0.5 font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">
                  #{viewTarget.id.slice(0, 8).toUpperCase()} · {viewTarget.email}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[8px] tracking-[-0.01em] ${ROLE_BADGE[viewTarget.role] ?? ROLE_BADGE.client}`}>
                    {viewTarget.role}
                  </span>
                  {viewTarget.is_banned && (
                    <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[8px] tracking-[-0.01em] text-red-400">
                      🚫 BANNED
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setViewTarget(null)} className="mt-0.5 text-[#4a4a4a] transition-colors hover:text-white">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 py-5">
              {viewLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} strokeWidth={2} className="animate-spin text-[#4a4a4a]" />
                </div>
              ) : viewError ? (
                <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[10px] tracking-[-0.04em] text-red-400">
                  {viewError}
                </p>
              ) : viewData ? (
                <>
                  <section>
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">Wallet</p>
                    <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                      <p className="font-mono text-[24px] font-bold tracking-[-0.06em] text-white">${viewData.balance.toFixed(2)}</p>
                      <p className="mt-0.5 font-mono text-[9px] tracking-[-0.02em] text-[#4a4a4a]">Available balance</p>
                    </div>
                  </section>

                  <section>
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">Orders</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                        <p className="font-mono text-[20px] font-bold tracking-[-0.06em] text-yellow-400">{viewData.activeOrders}</p>
                        <p className="mt-0.5 font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">Active</p>
                      </div>
                      <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                        <p className="font-mono text-[20px] font-bold tracking-[-0.06em] text-green-400">{viewData.completedOrders}</p>
                        <p className="mt-0.5 font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">Completed</p>
                      </div>
                    </div>
                  </section>

                  {!isSupport && (
                  <section>
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a] flex items-center gap-1.5"><Shield size={10} strokeWidth={2} />Security &amp; Access</p>
                    <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                      {securityLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} strokeWidth={2} className="animate-spin text-[#4a4a4a]" />
                          <span className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">Loading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] tracking-[-0.04em] text-[#5a5a5a]">Last Sign-in IP</span>
                            {securityData?.last_sign_in_ip ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-semibold tracking-[-0.04em] text-white">{securityData.last_sign_in_ip}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(securityData!.last_sign_in_ip!)
                                    setCopiedIp(true)
                                    setTimeout(() => setCopiedIp(false), 2000)
                                  }}
                                  title="Copy IP"
                                  className="text-[#4a4a4a] transition-colors hover:text-white"
                                >
                                  {copiedIp ? <Check size={11} strokeWidth={2.5} className="text-green-400" /> : <Copy size={11} strokeWidth={2} />}
                                </button>
                              </div>
                            ) : (
                              <span className="font-mono text-[10px] tracking-[-0.04em] text-[#3a3a3a]">No IP logged yet</span>
                            )}
                          </div>
                          {securityData?.last_sign_in_ip && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] tracking-[-0.04em] text-[#5a5a5a]">
                                <MapPin size={9} strokeWidth={2} />Location
                              </span>
                              {securityData.geo ? (
                                <span className="text-right font-mono text-[10px] leading-snug tracking-[-0.04em] text-[#9a9a9a]">
                                  {securityData.geo.countryCode
                                    ? Array.from(securityData.geo.countryCode)
                                        .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
                                        .join('')
                                    : '🌐'}{' '}
                                  {securityData.geo.city && `${securityData.geo.city}, `}{securityData.geo.country}
                                  {securityData.geo.isp && (
                                    <span className="block text-[9px] text-[#5a5a5a]">{securityData.geo.isp}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] tracking-[-0.04em] text-[#3a3a3a]">Unable to resolve</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] tracking-[-0.04em] text-[#5a5a5a]">Last Sign-in</span>
                            <span className="font-mono text-[10px] tracking-[-0.04em] text-[#7a7a7a]">{formatRelative(securityData?.last_sign_in_at)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                  )}

                  {!isSupport && (
                  <section>
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">Bank Details</p>
                    {viewData.bank_holder_name ? (
                      <div className="flex flex-col gap-2.5 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                        <DetailRow
                          label="Status"
                          value={
                            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[8px] tracking-[-0.01em] ${
                              viewData.bank_details_status === 'approved'
                                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                : viewData.bank_details_status === 'under_review'
                                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                                : 'border-[#3a3a3a] bg-[#1a1a1a] text-[#6a6a6a]'
                            }`}>
                              {viewData.bank_details_status}
                            </span>
                          }
                        />
                        <DetailRow label="Name"  value={viewData.bank_holder_name} />
                        <DetailRow label="Bank"  value={viewData.bank_name  ?? '—'} />
                        <DetailRow label="SWIFT" value={viewData.bank_swift ?? '—'} />
                        <DetailRow label="IBAN"  value={viewData.bank_iban  ?? '—'} />
                      </div>
                    ) : (
                      <p className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                        No bank details saved.
                      </p>
                    )}
                  </section>
                  )}

                  {/* Verification — boosters only */}
                  {viewTarget?.role === 'booster' && (
                    <section>
                      <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#4a4a4a]">Verification</p>
                      {verificationLoading ? (
                        <div className="flex items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                          <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#4a4a4a]" />
                          <span className="font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">Loading...</span>
                        </div>
                      ) : !verificationRecord ? (
                        <p className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                          No verification submitted.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {/* Status + personal info */}
                          <div className="flex flex-col gap-2.5 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                            <DetailRow
                              label="Status"
                              value={
                                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[8px] tracking-[-0.01em] ${
                                  verificationRecord.verification_status === 'approved'    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                  : verificationRecord.verification_status === 'under_review' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                                  : verificationRecord.verification_status === 'declined'   ? 'border-red-500/30 bg-red-500/10 text-red-400'
                                  : 'border-[#3a3a3a] bg-[#1a1a1a] text-[#6a6a6a]'
                                }`}>
                                  {verificationRecord.verification_status.replace('_', ' ')}
                                </span>
                              }
                            />
                            {verificationRecord.first_name && (
                              <DetailRow label="Name" value={`${verificationRecord.first_name} ${verificationRecord.last_name ?? ''}`} />
                            )}
                            {verificationRecord.dob && (
                              <DetailRow label="DOB" value={verificationRecord.dob} />
                            )}
                            {verificationRecord.id_type && (
                              <DetailRow label="ID Type" value={verificationRecord.id_type === 'passport' ? 'Passport' : 'National ID'} />
                            )}
                            {verificationRecord.id_serial_number && (
                              <DetailRow label="Serial #" value={verificationRecord.id_serial_number} />
                            )}
                          </div>

                          {/* Documents — admin only (E14 not granted to support) */}
                          {!isSupport && (verificationRecord.id_document_url || verificationRecord.id_selfie_url || verificationRecord.proof_of_address_url) && (
                            <div className="flex flex-col gap-1.5">
                              <FieldLabel>Documents</FieldLabel>
                              {verificationRecord.id_document_url && (
                                <button
                                  onClick={async () => { const r = await getVerificationDocumentUrl(verificationRecord.id_document_url!); if (r.url) window.open(r.url, '_blank') }}
                                  className="w-full rounded-md border border-[#2a2a2a] px-3 py-2 text-left font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a] transition-colors hover:border-[#6e6d6f] hover:text-white"
                                >View Government ID →</button>
                              )}
                              {verificationRecord.id_selfie_url && (
                                <button
                                  onClick={async () => { const r = await getVerificationDocumentUrl(verificationRecord.id_selfie_url!); if (r.url) window.open(r.url, '_blank') }}
                                  className="w-full rounded-md border border-[#2a2a2a] px-3 py-2 text-left font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a] transition-colors hover:border-[#6e6d6f] hover:text-white"
                                >View Selfie with ID →</button>
                              )}
                              {verificationRecord.proof_of_address_url && (
                                <button
                                  onClick={async () => { const r = await getVerificationDocumentUrl(verificationRecord.proof_of_address_url!); if (r.url) window.open(r.url, '_blank') }}
                                  className="w-full rounded-md border border-[#2a2a2a] px-3 py-2 text-left font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a] transition-colors hover:border-[#6e6d6f] hover:text-white"
                                >View Proof of Address →</button>
                              )}
                            </div>
                          )}

                          {/* Discord */}
                          {verificationRecord.discord_username && (
                            <div className="flex flex-col gap-2.5 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                              <FieldLabel>Discord</FieldLabel>
                              <DetailRow label="Username" value={verificationRecord.discord_username} />
                              {verificationRecord.discord_unique_id && (
                                <DetailRow label="Unique ID" value={verificationRecord.discord_unique_id} />
                              )}
                            </div>
                          )}

                          {/* Address notes */}
                          {verificationRecord.proof_of_address_text && (
                            <div className="flex flex-col gap-1.5 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-4 py-3">
                              <FieldLabel>Address Details</FieldLabel>
                              <p className="font-mono text-[10px] leading-relaxed tracking-[-0.04em] text-[#9a9a9a]">{verificationRecord.proof_of_address_text}</p>
                            </div>
                          )}

                          {/* Admin Review / Support Notes */}
                          {(verificationRecord.verification_status === 'under_review' || isSupport) && (
                            <div className="flex flex-col gap-2">
                              <FieldLabel>Notes {isSupport ? '' : '(optional)'}</FieldLabel>
                              <textarea
                                value={adminNotes}
                                onChange={e => setAdminNotes(e.target.value)}
                                placeholder="Reason for decline, additional info..."
                                rows={3}
                                className="w-full resize-none rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 font-mono text-[10px] tracking-[-0.04em] text-white outline-none placeholder:text-[#3a3a3a] focus:border-[#6e6d6f]"
                              />
                              {isSupport ? (
                                <button
                                  onClick={handleSaveNotes}
                                  disabled={notesSaving}
                                  className="flex items-center justify-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#111111] py-2 font-mono text-[10px] tracking-[-0.04em] text-[#9a9a9a] transition-colors hover:border-[#6e6d6f] hover:text-white disabled:opacity-50"
                                >
                                  {notesSaving && <Loader2 size={11} strokeWidth={2} className="animate-spin" />}
                                  Save Notes
                                </button>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      if (!viewTarget || approvalLoading) return
                                      setApprovalLoading(true)
                                      const res = await updateVerificationStatus(viewTarget.id, 'approved', adminNotes || undefined)
                                      setApprovalLoading(false)
                                      if (!res.error) { setVerificationRecord(prev => prev ? { ...prev, verification_status: 'approved' } : prev); showToast('Verification approved.', 'success') }
                                      else showToast(res.error, 'error')
                                    }}
                                    disabled={approvalLoading}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/10 py-2 font-mono text-[10px] tracking-[-0.04em] text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                                  >
                                    {approvalLoading ? <Loader2 size={11} strokeWidth={2} className="animate-spin" /> : <ShieldCheck size={11} strokeWidth={1.5} />}
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!viewTarget || approvalLoading) return
                                      setApprovalLoading(true)
                                      const res = await updateVerificationStatus(viewTarget.id, 'declined', adminNotes || undefined)
                                      setApprovalLoading(false)
                                      if (!res.error) { setVerificationRecord(prev => prev ? { ...prev, verification_status: 'declined' } : prev); showToast('Verification declined.', 'success') }
                                      else showToast(res.error, 'error')
                                    }}
                                    disabled={approvalLoading}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 py-2 font-mono text-[10px] tracking-[-0.04em] text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                  >
                                    {approvalLoading ? <Loader2 size={11} strokeWidth={2} className="animate-spin" /> : <X size={11} strokeWidth={2} />}
                                    Decline
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Hard Delete Confirm ───────────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.username ?? deleteTarget.email}?`}
          description="This permanently removes the user from Supabase Auth and cascades to all their profile data. This cannot be undone."
          confirmLabel="Permanently Delete"
          onConfirm={handleHardDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* ── Ban Request Dialog (support) ─────────────────────────────────── */}
      {banRequestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-mono text-[14px] font-bold tracking-[-0.06em] text-white">
                  {banRequestTarget.is_banned ? 'Request Unban' : 'Request Ban'}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] tracking-[-0.04em] text-[#4a4a4a]">
                  {banRequestTarget.username ?? banRequestTarget.email}
                </p>
              </div>
              <button onClick={() => setBanRequestTarget(null)} className="text-[#4a4a4a] transition-colors hover:text-white">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="mb-1.5">
              <FieldLabel>Reason (required)</FieldLabel>
            </div>
            <textarea
              value={banRequestReason}
              onChange={e => setBanRequestReason(e.target.value)}
              placeholder="Describe why this user should be banned/unbanned..."
              rows={3}
              className="mb-4 w-full resize-none rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 font-mono text-[10px] tracking-[-0.04em] text-white outline-none placeholder:text-[#3a3a3a] focus:border-[#6e6d6f]"
            />
            <div className="flex gap-2">
              <button onClick={() => setBanRequestTarget(null)} className="flex-1 rounded border border-[#2a2a2a] px-4 py-2 font-mono text-[10px] tracking-[-0.04em] text-[#6a6a6a] transition-colors hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSubmitBanRequest}
                disabled={banRequestLoading || !banRequestReason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-orange-500/30 bg-orange-500/10 px-4 py-2 font-mono text-[10px] font-semibold tracking-[-0.04em] text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {banRequestLoading && <Loader2 size={11} strokeWidth={2} className="animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  )
}
