/**
 * Newsletter subscriber notification email — seller.
 * Sent to site owner when a new visitor subscribes to the newsletter.
 * Design ref: docs/design/emails-f32/f32.css + edit-view.jsx
 */

import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

type EmailLocale = 'en' | 'ms'

export interface NewsletterSellerDigestData {
    shopName: string
    sellerName: string
    dashboardUrl?: string
    subscriberEmail: string
    locale?: EmailLocale
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

const FONT = `'Inter','Helvetica Neue',Helvetica,Arial,sans-serif`

export function newsletterSellerDigestEmail(
    data: NewsletterSellerDigestData,
    config?: EmailTemplateConfig,
): { subject: string; html: string } {
    const locale: EmailLocale = data.locale ?? 'ms'
    const esc = escapeHtml

    const vars = {
        sellerName: data.sellerName,
        brandName: data.shopName,
        dashboardUrl: data.dashboardUrl ?? '#',
        subscriberEmail: data.subscriberEmail,
    }

    const defaults = {
        subject: locale === 'ms'
            ? `${esc(data.shopName)} - Pelanggan surat berita baharu: ${esc(data.subscriberEmail)}`
            : `${esc(data.shopName)} - New subscriber: ${esc(data.subscriberEmail)}`,
        heroTitle: locale === 'ms'
            ? `Pelanggan baharu: ${esc(data.subscriberEmail)}`
            : `New subscriber: ${esc(data.subscriberEmail)}`,
        heroSub: locale === 'ms' ? 'Pemberitahuan dalaman' : 'Internal notification',
        greeting: locale === 'ms'
            ? `Hai ${esc(data.sellerName)},`
            : `Hi ${esc(data.sellerName)},`,
        body: locale === 'ms'
            ? `Seorang pelawat baharu telah melanggan surat berita kedai anda.`
            : `A new visitor has subscribed to your store newsletter.`,
        ctaLabel: locale === 'ms' ? 'Buka Peti Masuk' : 'Open Inbox',
        labelEmail: locale === 'ms' ? 'Emel pelanggan' : 'Subscriber email',
        footerReceiving: locale === 'ms'
            ? `Anda menerima ini sebagai pemilik ${esc(data.shopName)}.`
            : `You're receiving this as the owner of ${esc(data.shopName)}.`,
    }

    const t = mergeTemplateConfig(defaults, config ?? null, vars, {
        subject: 'subject',
        greeting: 'greeting',
        ctaLabel: 'ctaLabel',
        closing: undefined,
    })

    // t.subject already applies mergeTemplateConfig escaping + CMS override — use directly
    const subject = t.subject

    const dashUrl = data.dashboardUrl ? esc(data.dashboardUrl) : '#'

    const storeIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0 2 2 2 2 0 0 0 2-2"/><path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/></svg>`

    const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT};-webkit-font-smoothing:antialiased;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
<div style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.10),0 4px 12px rgba(15,23,42,0.08);">

  <!-- Header -->
  <div style="padding:28px 32px 24px;background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:14px;">
      <span style="width:22px;height:22px;border-radius:6px;background:rgba(255,255,255,0.18);display:inline-flex;align-items:center;justify-content:center;">${storeIconSvg}</span>
      <span style="font-family:${FONT};font-size:17px;font-weight:700;color:white;letter-spacing:-0.01em;">${esc(data.shopName)}</span>
    </div>
    <h2 style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;color:white;letter-spacing:-0.01em;line-height:1.2;">${defaults.heroTitle}</h2>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${defaults.heroSub}</p>
  </div>

  <!-- Body -->
  <div style="padding:24px 32px;">
    <p style="font-size:17px;font-weight:700;color:#0F172A;margin:0 0 10px;">${t.greeting}</p>
    <p style="font-family:${FONT};font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px;">${defaults.body}</p>

    <!-- Subscriber info -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="padding:9px 0;width:130px;font-family:${FONT};font-size:13px;font-weight:600;color:#0F172A;vertical-align:top;">${defaults.labelEmail}</td>
        <td style="padding:9px 0;font-family:${FONT};font-size:13px;color:#475569;vertical-align:top;">${esc(data.subscriberEmail)}</td>
      </tr>
    </table>

    <!-- CTA -->
    <a href="${dashUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);color:#ffffff;font-family:${FONT};font-size:14px;font-weight:700;padding:13px 24px;border-radius:8px;text-decoration:none;box-shadow:0 4px 12px rgba(14,165,233,0.30);">${t.ctaLabel}</a>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:18px 32px 28px;border-top:1px solid #f1f5f9;">
    <p style="font-family:${FONT};font-size:12px;color:#64748b;margin:0 0 4px;">${esc(data.shopName)}</p>
    <p style="font-family:${FONT};font-size:12px;color:#94a3b8;margin:0;">${defaults.footerReceiving}</p>
  </div>

</div>
</div>
</body>
</html>`

    return { subject, html }
}
