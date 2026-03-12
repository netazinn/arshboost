'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { parseISO, isValid, differenceInYears } from 'date-fns'
import { X, Upload, CheckCircle2, Loader2, AlertTriangle, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { submitIDVerification } from '@/lib/actions/verification'
import { DOBPicker } from '@/components/ui/dob-picker'
import type { VerificationRecord } from '@/lib/actions/verification'

// ─── Schema ───────────────────────────────────────────────────────────────────

const wizardSchema = z.object({
  first_name:            z.string().min(1, 'First name is required'),
  last_name:             z.string().min(1, 'Last name is required'),
  dob: z.string()
    .min(1, 'Date of birth is required')
    .refine((v) => { const d = parseISO(v); return isValid(d) }, 'Invalid date')
    .refine((v) => differenceInYears(new Date(), parseISO(v)) >= 18, 'You must be at least 18 years old'),
  id_type:               z.enum(['passport', 'national_id']),
  id_serial_number:      z.string().min(1, 'Serial number is required'),
  proof_of_address_text: z.string().min(10, 'Please describe your address (min 10 characters)'),
})

type WizardValues = z.infer<typeof wizardSchema>

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i + 1 === current ? 'w-6 bg-white' :
            i + 1 < current  ? 'w-4 bg-white/40' :
            'w-4 bg-[#2a2a2a]'
          }`}
        />
      ))}
    </div>
  )
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

function FileUploadZone({
  file, onChange, accept, label, onError,
}: {
  file: File | null
  onChange: (f: File | null) => void
  accept?: string
  label: string
  onError?: (msg: string | null) => void
}) {
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!picked) { onChange(null); return }
    if (!ALLOWED_MIME_TYPES.includes(picked.type)) {
      onError?.('Invalid file type. Use JPG, PNG, WebP, or PDF.')
      return
    }
    if (picked.size > MAX_FILE_BYTES) {
      onError?.('File too large. Maximum size is 5 MB.')
      return
    }
    onError?.(null)
    onChange(picked)
  }

  return (
    <label className="flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[#2a2a2a] bg-[#0d0d0d] p-6 cursor-pointer transition-colors hover:border-[#6e6d6f]">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      {file ? (
        <>
          <CheckCircle2 size={22} strokeWidth={1.5} className="text-green-400" />
          <span className="max-w-[80%] truncate text-center font-mono text-[11px] tracking-[-0.04em] text-green-400">
            {file.name}
          </span>
          <span className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">Click to replace</span>
        </>
      ) : (
        <>
          <Upload size={22} strokeWidth={1.5} className="text-[#4a4a4a]" />
          <span className="text-center font-mono text-[11px] tracking-[-0.04em] text-[#6e6d6f]">{label}</span>
          <span className="font-mono text-[9px] tracking-[-0.03em] text-[#4a4a4a]">JPG, PNG, WebP, or PDF · Max 5 MB</span>
        </>
      )}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="font-mono text-[10px] tracking-[-0.04em] text-red-400">{message}</p>
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IDVerificationWizard({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (record: Partial<VerificationRecord>) => void
}) {
  const [step, setStep]                     = useState(1)
  const [idDocFile, setIdDocFile]           = useState<File | null>(null)
  const [selfieFile, setSelfieFile]         = useState<File | null>(null)
  const [addressFile, setAddressFile]       = useState<File | null>(null)
  const [fileError, setFileError]           = useState<string | null>(null)
  const [submitting, setSubmitting]         = useState(false)
  const [submitError, setSubmitError]       = useState<string | null>(null)

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      first_name: '', last_name: '', dob: '',
      id_type: 'passport', id_serial_number: '',
      proof_of_address_text: '',
    },
  })

  const { register, formState: { errors }, trigger, getValues } = form

  // ── Step navigation ────────────────────────────────────────────────────────

  async function handleNext() {
    setFileError(null)
    if (step === 1) {
      const ok = await trigger(['first_name', 'last_name', 'dob'])
      if (ok) setStep(2)
    } else if (step === 2) {
      const ok = await trigger(['id_type', 'id_serial_number'])
      if (!ok) return
      if (!idDocFile) { setFileError('Please upload your ID document.'); return }
      setStep(3)
    } else if (step === 3) {
      if (!selfieFile) { setFileError('Please upload your selfie with ID.'); return }
      setStep(4)
    }
  }

  // ── Final submission ───────────────────────────────────────────────────────

  async function handleSubmit() {
    setFileError(null)
    setSubmitError(null)

    const ok = await trigger(['proof_of_address_text'])
    if (!ok) return
    if (!addressFile) { setFileError('Please upload your proof of address.'); return }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSubmitError('Session expired. Please refresh.'); return }

      const ts  = Date.now()
      const ext = (f: File) => f.name.split('.').pop() ?? 'jpg'

      async function uploadFile(file: File, name: string) {
        const path = `${user!.id}/${name}_${ts}.${ext(file)}`
        const { error } = await supabase.storage
          .from('verification_documents')
          .upload(path, file, { upsert: true, contentType: file.type })
        if (error) throw new Error(error.message)
        return path
      }

      const [idDocPath, selfiePath, addressPath] = await Promise.all([
        uploadFile(idDocFile!,  'id_document'),
        uploadFile(selfieFile!, 'id_selfie'),
        uploadFile(addressFile, 'proof_of_address'),
      ])

      const values = getValues()
      const result = await submitIDVerification({
        ...values,
        id_document_path:      idDocPath,
        id_selfie_path:        selfiePath,
        proof_of_address_path: addressPath,
      })

      if (result.error) {
        setSubmitError(result.error)
      } else {
        onSuccess({
          verification_status:   'under_review',
          first_name:            values.first_name,
          last_name:             values.last_name,
          dob:                   values.dob,
          id_type:               values.id_type,
          id_serial_number:      values.id_serial_number,
          proof_of_address_text: values.proof_of_address_text,
        })
      }
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Step labels ─────────────────────────────────────────────────────────

  const STEP_LABELS = ['Personal Info', 'Government ID', 'Selfie', 'Address']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#111111] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-semibold tracking-[-0.06em] text-white">
                Identity Verification
              </span>
              <StepIndicator current={step} total={4} />
            </div>
            <p className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">
              Step {step} of 4 — {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="text-[#4a4a4a] transition-colors hover:text-white">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">

          {/* Step 1 — Personal Info */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="font-mono text-[11px] leading-relaxed tracking-[-0.04em] text-[#6e6d6f]">
                Enter your legal name and date of birth exactly as they appear on your government-issued ID.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">First Name</label>
                  <input
                    {...register('first_name')}
                    className="h-9 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none transition-colors focus:border-[#6e6d6f]"
                  />
                  <FieldError message={errors.first_name?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Last Name</label>
                  <input
                    {...register('last_name')}
                    className="h-9 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none transition-colors focus:border-[#6e6d6f]"
                  />
                  <FieldError message={errors.last_name?.message} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Date of Birth</label>
                <Controller
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <DOBPicker
                      value={field.value}
                      onChange={field.onChange}
                      hasError={!!errors.dob}
                    />
                  )}
                />
                <FieldError message={errors.dob?.message} />
              </div>
            </div>
          )}

          {/* Step 2 — Government ID */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="font-mono text-[11px] leading-relaxed tracking-[-0.04em] text-[#6e6d6f]">
                Select your ID type, enter the serial/document number, and upload a clear photo of the document.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">ID Type</label>
                <select
                  {...register('id_type')}
                  className="h-9 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none transition-colors focus:border-[#6e6d6f] appearance-none"
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Document / Serial Number</label>
                <input
                  {...register('id_serial_number')}
                  className="h-9 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 font-mono text-xs tracking-[-0.05em] text-white outline-none transition-colors focus:border-[#6e6d6f]"
                />
                <FieldError message={errors.id_serial_number?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">ID Document Photo</label>
                <FileUploadZone
                  file={idDocFile}
                  onChange={setIdDocFile}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  label="Upload front of ID document"
                  onError={setFileError}
                />
              </div>
              {fileError && <FieldError message={fileError} />}
            </div>
          )}

          {/* Step 3 — Selfie */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                <p className="font-mono text-[11px] leading-relaxed tracking-[-0.04em] text-blue-300/80">
                  Take a photo of yourself holding your ID next to your face. Ensure your face
                  and the ID details are <span className="font-semibold text-blue-300">clearly visible and well-lit</span>.
                  Do not cover any part of the ID.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Selfie with ID</label>
                <FileUploadZone
                  file={selfieFile}
                  onChange={setSelfieFile}
                  accept="image/jpeg,image/png,image/webp"
                  label="Upload selfie holding your ID"
                  onError={setFileError}
                />
              </div>
              {fileError && <FieldError message={fileError} />}
            </div>
          )}

          {/* Step 4 — Address */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <p className="font-mono text-[11px] leading-relaxed tracking-[-0.04em] text-[#6e6d6f]">
                Provide your current address and upload a proof of residence (utility bill, bank statement, etc.) dated within the last 3 months.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Current Address</label>
                <textarea
                  {...register('proof_of_address_text')}
                  rows={3}
                  placeholder="Street address, city, postcode, country"
                  className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 font-mono text-xs tracking-[-0.05em] text-white outline-none transition-colors focus:border-[#6e6d6f] resize-none placeholder:text-[#3a3a3a]"
                />
                <FieldError message={errors.proof_of_address_text?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[-0.04em] text-[#6e6d6f]">Proof of Address Document</label>
                <FileUploadZone
                  file={addressFile}
                  onChange={setAddressFile}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  label="Upload utility bill or bank statement"
                  onError={setFileError}
                />
              </div>
              {fileError && <FieldError message={fileError} />}
              {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                  <AlertTriangle size={12} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="font-mono text-[10px] tracking-[-0.04em] text-red-400">{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#2a2a2a] px-6 py-4">
          <button
            onClick={() => { setFileError(null); setStep(s => Math.max(1, s - 1)) }}
            disabled={step === 1}
            className="flex items-center gap-1.5 font-mono text-[11px] tracking-[-0.04em] text-[#6e6d6f] transition-colors hover:text-white disabled:opacity-0"
          >
            <ChevronLeft size={13} strokeWidth={2} />
            Back
          </button>
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="h-9 rounded-md bg-white px-5 font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex h-9 items-center gap-2 rounded-md bg-white px-5 font-mono text-[11px] font-semibold tracking-[-0.05em] text-black transition-opacity hover:bg-white/90 disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
              {submitting ? 'Uploading…' : 'Send →'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
