import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface ResendUploadLinkData {
    shopName: string
    orderNumber: string
    customerName: string
    resumeUrl: string
    locale?: string
}

export function resendUploadLinkEmail(data: ResendUploadLinkData, config?: EmailTemplateConfig): { subject: string; html: string } {
    const { shopName, orderNumber, customerName, resumeUrl, locale = 'ms' } = data
    const isMs = locale === 'ms'

    const baseSubject = isMs
        ? `[${shopName}] Semak semula — muat naik resit bayaran anda untuk pesanan #${orderNumber}`
        : `[${shopName}] Action required — upload your payment receipt for order #${orderNumber}`
    const baseGreeting = isMs ? 'Hai {customerName}' : 'Hi {customerName}'
    const baseCta = isMs ? 'Muat Naik Resit Sekarang' : 'Upload Receipt Now'
    const baseFooter = isMs ? `Terima kasih kerana membeli di ${shopName}.` : `Thank you for shopping at ${shopName}.`

    const base = {
        subject: baseSubject,
        greeting: baseGreeting,
        cta: baseCta,
        footer: baseFooter,
    }
    const vars = { customerName, orderNumber, uploadLink: resumeUrl }
    const t = mergeTemplateConfig(base, config ?? null, vars, {
        subject: 'subject',
        greeting: 'greeting',
        ctaLabel: 'cta',
        closing: 'footer',
    })

    const subject = t.subject
    const greeting = `${t.greeting},`
    const body = isMs
        ? `Kami perasan anda belum muat naik resit pembayaran untuk pesanan <strong>#${esc(orderNumber)}</strong>. Sila muat naik resit bank transfer anda supaya penjual boleh mengesahkan pembayaran dan memproses pesanan anda.`
        : `We noticed you haven't uploaded your payment receipt for order <strong>#${esc(orderNumber)}</strong>. Please upload your bank transfer receipt so the seller can verify your payment and process your order.`
    const cta = t.cta
    const note = isMs
        ? 'Link ini hanya sah untuk 24 jam. Selepas tempoh tersebut, hubungi penjual untuk mendapatkan bantuan.'
        : 'This link is valid for 24 hours. After that, please contact the seller for assistance.'
    const footer = t.footer

    const html = `<!DOCTYPE html>
<html lang="${isMs ? 'ms' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#f8fafc;">${esc(shopName)}</p>
        </td></tr>

        <!-- Warning banner -->
        <tr><td style="background:#fef3c7;padding:14px 32px;border-bottom:1px solid #fde68a;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#92400e;">&#9888;&#65039; ${isMs ? 'Tindakan Diperlukan — Pesanan Belum Lengkap' : 'Action Required — Order Incomplete'}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">${body}</p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#0ea5e9;border-radius:10px;">
              <a href="${resumeUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${cta}</a>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;">${note}</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
          <p style="margin:0;font-size:13px;color:#64748b;">${footer}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    return { subject, html }
}
