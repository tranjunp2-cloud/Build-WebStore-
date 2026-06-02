/**
 * Contact form notification email — seller.
 * Sent to site owner when a visitor submits the contact form.
 * Design ref: docs/design/email-templates/07-contact-form-seller.html
 */

import { mergeTemplateConfig, applyVariables } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

type EmailLocale = 'en' | 'ms'

export interface ContactFromSellerData {
    shopName: string
    sellerName: string
    dashboardUrl?: string
    visitorName: string
    visitorEmail: string
    visitorPhone?: string
    message: string
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

export function contactFromSellerEmail(
    data: ContactFromSellerData,
    config?: EmailTemplateConfig,
): { subject: string; html: string } {
    const locale: EmailLocale = data.locale ?? 'ms'
    const esc = escapeHtml

    const vars = {
        sellerName: data.sellerName,
        brandName: data.shopName,
        dashboardUrl: data.dashboardUrl ?? '#',
        visitorName: data.visitorName,
        visitorEmail: data.visitorEmail,
    }

    const defaults = {
        subject: locale === 'ms'
            ? `${esc(data.shopName)} - Penghantaran borang hubungi baharu`
            : `${esc(data.shopName)} - New contact form submission`,
        greeting: locale === 'ms'
            ? `Hai <strong>${esc(data.sellerName)}</strong>,`
            : `Hi <strong>${esc(data.sellerName)}</strong>,`,
        body: locale === 'ms'
            ? `Anda mempunyai satu penghantaran daripada borang hubungi kami daripada <strong>${esc(data.visitorEmail)}</strong>.`
            : `You have a new contact form submission from <strong>${esc(data.visitorEmail)}</strong>.`,
        sectionTitle: locale === 'ms' ? 'Borang Kontak' : 'Contact Form',
        ctaLabel: locale === 'ms' ? 'Semak penghantaran di sini' : 'View submission',
        footer: locale === 'ms'
            ? `Hak milik oleh ${esc(data.shopName)}`
            : `Copyright by ${esc(data.shopName)}`,
        labelName: locale === 'ms' ? 'Nama penuh' : 'Full name',
        labelPhone: locale === 'ms' ? 'Telefon' : 'Phone',
        labelEmail: locale === 'ms' ? 'Emel' : 'Email',
        labelMessage: locale === 'ms' ? 'Mesej' : 'Message',
    }

    const t = mergeTemplateConfig(defaults, config ?? null, vars, {
        subject: 'subject',
        greeting: 'greeting',
        ctaLabel: 'ctaLabel',
        closing: undefined,
    })

    const subject = typeof config?.subject === 'string' && config.subject.length > 0
        ? (applyVariables(config.subject, vars) ?? t.subject)
        : t.subject

    const dashUrl = data.dashboardUrl ? esc(data.dashboardUrl) : '#'

    const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#EEF3F8;font-family:${FONT};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3F8;padding:48px 16px;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04);">

    <!-- Brand name -->
    <tr><td style="padding:36px 40px 8px;text-align:center;">
      <div style="font-family:${FONT};font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">${esc(data.shopName)}</div>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:18px 40px 6px;">
      <div style="font-family:${FONT};font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${t.greeting}</div>
    </td></tr>

    <!-- Intro body -->
    <tr><td style="padding:6px 40px 18px;">
      <div style="font-family:${FONT};font-size:14px;line-height:22px;color:#475569;">${defaults.body}</div>
    </td></tr>

    <!-- Section title -->
    <tr><td style="padding:18px 40px 10px;">
      <div style="font-family:${FONT};font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${defaults.sectionTitle}</div>
    </td></tr>

    <!-- Fields table -->
    <tr><td style="padding:6px 40px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="130" style="padding:10px 0;color:#0F172A;font-weight:500;vertical-align:top;font-family:${FONT};font-size:14px;">${defaults.labelName}</td>
          <td style="padding:10px 0;color:#94A3B8;vertical-align:top;font-family:${FONT};font-size:14px;line-height:22px;">${esc(data.visitorName)}</td>
        </tr>
        ${data.visitorPhone ? `<tr>
          <td width="130" style="padding:10px 0;color:#0F172A;font-weight:500;vertical-align:top;font-family:${FONT};font-size:14px;">${defaults.labelPhone}</td>
          <td style="padding:10px 0;color:#94A3B8;vertical-align:top;font-family:${FONT};font-size:14px;line-height:22px;">${esc(data.visitorPhone)}</td>
        </tr>` : ''}
        <tr>
          <td width="130" style="padding:10px 0;color:#0F172A;font-weight:500;vertical-align:top;font-family:${FONT};font-size:14px;">${defaults.labelEmail}</td>
          <td style="padding:10px 0;color:#94A3B8;vertical-align:top;font-family:${FONT};font-size:14px;line-height:22px;">${esc(data.visitorEmail)}</td>
        </tr>
        <tr>
          <td width="130" style="padding:10px 0;color:#0F172A;font-weight:500;vertical-align:top;font-family:${FONT};font-size:14px;">${defaults.labelMessage}</td>
          <td style="padding:10px 0;color:#94A3B8;vertical-align:top;font-family:${FONT};font-size:14px;line-height:22px;">${esc(data.message).replace(/\n/g, '<br>')}</td>
        </tr>
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td align="center" style="padding:26px 40px 14px;">
      <a href="${dashUrl}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:${FONT};font-size:14px;font-weight:700;line-height:18px;padding:14px 28px;border-radius:8px;text-decoration:none;">${t.ctaLabel}</a>
    </td></tr>

    <!-- Spacer -->
    <tr><td style="padding:40px 40px 14px;"></td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:6px 40px 36px;">
      <div style="font-family:${FONT};font-size:12px;color:#94A3B8;">${defaults.footer}</div>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`

    return { subject, html }
}
