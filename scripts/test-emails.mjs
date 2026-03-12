/**
 * One-off test script — sends one copy of every live email template to a target address.
 * Run with: node scripts/test-emails.mjs
 */

import { Resend } from 'resend'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const resend  = new Resend(process.env.RESEND_API_KEY)
const FROM    = process.env.RESEND_FROM_EMAIL ?? 'Arshboost <noreply@arshboost.com>'
const TO      = 'ruzgaravullu@gmail.com'
const SITE    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arshboost.com'
const ORDER   = `${SITE}/dashboard/orders/test-order-id`
const SHORT   = 'A1B2C3'

// ─── Shared HTML builder (mirrors src/lib/email.ts) ──────────────────────────

function buildHtml(title, body, ctaUrl, ctaLabel) {
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#fff;color:#000;font-family:monospace;font-size:13px;text-decoration:none;border-radius:6px;">${ctaLabel ?? 'View Order'}</a>`
    : ''
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:monospace;">
  <div style="max-width:520px;margin:40px auto;background:#111111;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
    <div style="padding:24px 32px;border-bottom:1px solid #2a2a2a;">
      <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.05em;">arshboost.</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.03em;">${title}</h1>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">${body}</p>
      ${cta}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;font-size:11px;color:#4a4a4a;">You are receiving this because you have an active order on Arshboost. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`
}

async function send(label, subject, title, body, ctaUrl, ctaLabel) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to:   TO,
      subject,
      html: buildHtml(title, body, ctaUrl, ctaLabel),
    })
    if (error) {
      console.error(`  ✗ [${label}]`, error.message ?? error)
    } else {
      console.log(`  ✓ [${label}] id=${data.id}`)
    }
  } catch (err) {
    console.error(`  ✗ [${label}] exception:`, err.message)
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

const templates = [
  // 1. Order Confirmed (client receipt — on createOrder)
  {
    label:    '1. Order Confirmed (client)',
    subject:  `Order #${SHORT} confirmed — Arshboost`,
    title:    'Order Confirmed',
    body:     `Your order #${SHORT} has been placed successfully. A booster will be assigned shortly. You can track progress at any time from your dashboard.`,
    ctaUrl:   ORDER,
    ctaLabel: 'Track Order',
  },

  // 2. Order Marked as Completed — counterparty is booster
  {
    label:    '2. Order Marked as Completed (→ booster)',
    subject:  `Order #${SHORT} marked as completed`,
    title:    'Order Marked as Completed',
    body:     `Order #${SHORT} has been marked as completed by the client. Payment will be processed after review.`,
    ctaUrl:   ORDER,
    ctaLabel: 'View Order',
  },

  // 3. Your Order Has Been Completed — counterparty is client
  {
    label:    '3. Your Order Has Been Completed (→ client)',
    subject:  `Your order #${SHORT} has been completed`,
    title:    'Your Order Has Been Completed',
    body:     `Booster has marked order #${SHORT} as completed. Please verify and confirm within 3 days, or open a dispute if something is wrong.`,
    ctaUrl:   ORDER,
    ctaLabel: 'View Order',
  },

  // 4. Dispute Opened — counterparty notified
  {
    label:    '4. Dispute Opened (→ counterparty)',
    subject:  `Dispute opened for order #${SHORT}`,
    title:    'A Dispute Has Been Opened',
    body:     `A dispute was opened for order #${SHORT}. Please wait for support to review and contact both parties.`,
    ctaUrl:   ORDER,
    ctaLabel: 'View Order',
  },

  // 5. Cancellation Requested — counterparty notified
  {
    label:    '5. Cancellation Requested (→ counterparty)',
    subject:  `Cancellation requested for order #${SHORT}`,
    title:    'Cancellation Requested',
    body:     `A cancellation was requested for order #${SHORT}. Support will review and contact both parties.`,
    ctaUrl:   ORDER,
    ctaLabel: 'View Order',
  },
]

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log(`\nSending ${templates.length} test emails to ${TO} …\n`)
for (const t of templates) {
  await send(t.label, t.subject, t.title, t.body, t.ctaUrl, t.ctaLabel)
  // Small delay to stay well within Resend's 2 req/s free-tier rate limit
  await new Promise(r => setTimeout(r, 600))
}
console.log('\nDone.\n')
