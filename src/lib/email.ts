/**
 * Resend email helper — server-side only.
 * Install: npm install resend
 * Requires: RESEND_API_KEY in .env.local
 * Requires: RESEND_FROM_EMAIL in .env.local (e.g. "Arshboost <noreply@arshboost.com>")
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Arshboost <noreply@arshboost.com>'

// ─── Shared email template ────────────────────────────────────────────────────

function buildHtml(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
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

// ─── Future triggers (not yet implemented) ──────────────────────────────────
// TODO: Send Email + In-App when a Booster Withdrawal Request is Approved/Rejected.

// ─── Public send helper ───────────────────────────────────────────────────────

export async function sendNotificationEmail({
  to,
  subject,
  title,
  body,
  ctaUrl,
  ctaLabel,
}: {
  to: string
  subject: string
  title: string
  body: string
  ctaUrl?: string
  ctaLabel?: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email to', to)
    return
  }
  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject,
      html:    buildHtml(title, body, ctaUrl, ctaLabel),
    })
  } catch (err) {
    // Email failures must never crash the main action — just log
    console.error('[Email] Failed to send to', to, ':', err)
  }
}
