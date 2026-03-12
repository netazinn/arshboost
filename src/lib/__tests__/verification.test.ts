/**
 * Tests for the Booster KYC Verification flow.
 *
 * Coverage areas:
 *   1.  Zod wizardSchema — happy path (valid payload passes)
 *   2.  Zod wizardSchema — empty first name rejected
 *   3.  Zod wizardSchema — empty last name rejected
 *   4.  Zod wizardSchema — empty DOB rejected
 *   5.  Zod wizardSchema — malformed DOB string rejected
 *   6.  Zod wizardSchema — under-18 DOB rejected
 *   7.  Zod wizardSchema — exactly-18 DOB accepted
 *   8.  Zod wizardSchema — address too short rejected  (<10 chars)
 *   9.  Zod wizardSchema — invalid id_type rejected
 *  10.  File validation   — .jpg accepted
 *  11.  File validation   — .png accepted
 *  12.  File validation   — .pdf accepted
 *  13.  File validation   — disallowed MIME type rejected
 *  14.  File validation   — file exactly at 5 MB limit accepted
 *  15.  File validation   — file 1 byte over 5 MB rejected
 *  16.  File validation   — large file (10 MB) rejected
 *  17.  Server age guard  — under-18 DOB returns error
 *  18.  Server age guard  — invalid ISO string returns error
 *  19.  Server age guard  — valid adult DOB returns null (no error)
 *  20.  Server age guard  — exactly-18 today accepted
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseISO, isValid, differenceInYears, subYears, format } from 'date-fns'

// ─── Mirror of wizardSchema from IDVerificationWizard.tsx ────────────────────
//
// Kept in sync manually. If the production schema changes, update this too.

const wizardSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name:  z.string().min(1, 'Last name is required'),
  dob: z.string()
    .min(1, 'Date of birth is required')
    .refine((v) => { const d = parseISO(v); return isValid(d) }, 'Invalid date')
    .refine((v) => differenceInYears(new Date(), parseISO(v)) >= 18, 'You must be at least 18 years old'),
  id_type:               z.enum(['passport', 'national_id']),
  id_serial_number:      z.string().min(1, 'Serial number is required'),
  proof_of_address_text: z.string().min(10, 'Please describe your address (min 10 characters)'),
})

// ─── Mirror of file-validation logic from FileUploadZone ────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

function validateFile(type: string, size: number): string | null {
  if (!ALLOWED_MIME_TYPES.includes(type)) return 'Invalid file type. Use JPG, PNG, WebP, or PDF.'
  if (size > MAX_FILE_BYTES) return 'File too large. Maximum size is 5 MB.'
  return null
}

// ─── Mirror of server-side age guard from submitIDVerification ───────────────

function serverAgeGuard(dob: string): string | null {
  const parsed = parseISO(dob)
  if (!isValid(parsed) || differenceInYears(new Date(), parsed) < 18) {
    return 'You must be at least 18 years old.'
  }
  return null
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  first_name:            'Alice',
  last_name:             'Smith',
  dob:                   '1990-06-15',
  id_type:               'passport' as const,
  id_serial_number:      'AB123456',
  proof_of_address_text: '123 Main Street, London, SW1A 1AA',
}

// ─── 1–9: Zod wizardSchema ───────────────────────────────────────────────────

describe('wizardSchema — happy path', () => {
  it('accepts a fully valid payload', () => {
    expect(wizardSchema.safeParse(VALID_PAYLOAD).success).toBe(true)
  })
})

describe('wizardSchema — field errors', () => {
  it('rejects empty first_name', () => {
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, first_name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.first_name
      expect(msgs).toBeDefined()
    }
  })

  it('rejects empty last_name', () => {
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, last_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty dob', () => {
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, dob: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed date string', () => {
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, dob: 'not-a-date' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.dob
      expect(msgs?.some((m) => m.includes('Invalid date'))).toBe(true)
    }
  })

  it('rejects an under-18 DOB', () => {
    const under18 = format(subYears(new Date(), 17), 'yyyy-MM-dd')
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, dob: under18 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.dob
      expect(msgs?.some((m) => m.includes('18'))).toBe(true)
    }
  })

  it('accepts an exactly-18 DOB (today minus 18 years)', () => {
    const exactly18 = format(subYears(new Date(), 18), 'yyyy-MM-dd')
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, dob: exactly18 })
    expect(result.success).toBe(true)
  })

  it('rejects proof_of_address_text shorter than 10 characters', () => {
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, proof_of_address_text: 'short' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.proof_of_address_text
      expect(msgs).toBeDefined()
    }
  })

  it('rejects an invalid id_type value', () => {
    const result = wizardSchema.safeParse({ ...VALID_PAYLOAD, id_type: 'driving_licence' })
    expect(result.success).toBe(false)
  })
})

// ─── 10–16: File upload validation ───────────────────────────────────────────

describe('validateFile — accepted types', () => {
  it('accepts image/jpeg', () => {
    expect(validateFile('image/jpeg', 1024)).toBeNull()
  })

  it('accepts image/png', () => {
    expect(validateFile('image/png', 1024)).toBeNull()
  })

  it('accepts application/pdf', () => {
    expect(validateFile('application/pdf', 512 * 1024)).toBeNull()
  })
})

describe('validateFile — size limits', () => {
  it('accepts a file exactly at the 5 MB limit', () => {
    expect(validateFile('image/jpeg', MAX_FILE_BYTES)).toBeNull()
  })

  it('rejects a file 1 byte over 5 MB', () => {
    const error = validateFile('image/jpeg', MAX_FILE_BYTES + 1)
    expect(error).toMatch(/too large/i)
  })

  it('rejects a 10 MB file', () => {
    const error = validateFile('image/png', 10 * 1024 * 1024)
    expect(error).toMatch(/too large/i)
  })
})

describe('validateFile — disallowed types', () => {
  it('rejects image/gif', () => {
    const error = validateFile('image/gif', 1024)
    expect(error).toMatch(/invalid file type/i)
  })

  it('rejects application/zip', () => {
    const error = validateFile('application/zip', 1024)
    expect(error).toMatch(/invalid file type/i)
  })

  it('rejects video/mp4', () => {
    const error = validateFile('video/mp4', 1024)
    expect(error).toMatch(/invalid file type/i)
  })
})

// ─── 17–20: Server-side age guard ────────────────────────────────────────────

describe('serverAgeGuard — mirrors submitIDVerification validation', () => {
  it('returns an error for an under-18 DOB', () => {
    const dob = format(subYears(new Date(), 16), 'yyyy-MM-dd')
    expect(serverAgeGuard(dob)).toMatch(/18/i)
  })

  it('returns an error for an invalid ISO date string', () => {
    expect(serverAgeGuard('not-a-date')).toMatch(/18/i)
  })

  it('returns null for a valid adult DOB', () => {
    expect(serverAgeGuard('1990-01-01')).toBeNull()
  })

  it('returns null for an exactly-18 DOB', () => {
    const exactly18 = format(subYears(new Date(), 18), 'yyyy-MM-dd')
    expect(serverAgeGuard(exactly18)).toBeNull()
  })
})
