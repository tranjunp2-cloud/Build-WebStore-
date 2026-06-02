/**
 * New order notification email — seller.
 * Sent to tenant owners when a new order is placed (any payment method).
 * Design ref: docs/design/emails-f32/f32.css + edit-view.jsx
 */

import { mergeTemplateConfig, applyVariables } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

type EmailLocale = 'en' | 'ms'

export interface NewOrderSellerItem {
    name: string
    variant?: string
    quantity: number
    lineTotal: number
}

export interface NewOrderSellerData {
    shopName: string
    /** Owner/staff name for greeting — falls back to shopName if not provided */
    sellerName?: string
    orderNumber: string
    customerName: string
    /** Dashboard/order URL seller is directed to */
    orderPageUrl: string
    items?: NewOrderSellerItem[]
    orderTotal?: number
    shippingFee?: number
    currency?: string
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

function formatPrice(amount: number, currency: string): string {
    return `${currency} ${amount.toFixed(2)}`
}

const FONT = `'Inter','Helvetica Neue',Helvetica,Arial,sans-serif`

export function newOrderSellerEmail(data: NewOrderSellerData, config?: EmailTemplateConfig): { subject: string; html: string } {
    const locale: EmailLocale = data.locale ?? 'ms'
    const esc = escapeHtml
    const currency = data.currency ?? 'MYR'
    const fp = (n: number) => formatPrice(n, currency)
    const recipientName = data.sellerName ?? data.shopName

    const vars = {
        orderNumber: data.orderNumber,
        orderTotal: data.orderTotal != null ? fp(data.orderTotal) : '',
        brandName: data.shopName,
        dashboardUrl: data.orderPageUrl,
    }

    const defaults = {
        subject: locale === 'ms'
            ? `Pesanan baharu ${esc(data.orderNumber)} — ${esc(data.customerName)}`
            : `New order ${esc(data.orderNumber)} — ${esc(data.customerName)}`,
        heroTitle: locale === 'ms'
            ? `Pesanan baharu ${esc(data.orderNumber)} — ${esc(data.customerName)}`
            : `New order ${esc(data.orderNumber)} — ${esc(data.customerName)}`,
        heroSub: locale === 'ms' ? 'Pemberitahuan dalaman' : 'Internal notification',
        greeting: locale === 'ms'
            ? `Hai ${esc(recipientName)},`
            : `Hi ${esc(recipientName)},`,
        body: locale === 'ms'
            ? 'Pesanan baharu telah masuk. Sahkan sebelum 6 PTG untuk penghantaran hari ini.'
            : 'A new order just landed. Confirm it before 6 PM to ship today.',
        ctaLabel: locale === 'ms' ? 'Tunaikan Pesanan' : 'Fulfil Order',
        colItem: locale === 'ms' ? 'Item' : 'Item',
        colQty: locale === 'ms' ? 'Kuantiti' : 'Qty',
        colSubtotal: locale === 'ms' ? 'Jumlah Kecil' : 'Subtotal',
        rowShipping: locale === 'ms' ? 'Penghantaran' : 'Shipping',
        rowShippingFree: locale === 'ms' ? 'Percuma' : 'Free',
        rowTotal: locale === 'ms' ? 'Jumlah' : 'Total',
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

    const subject = (typeof config?.subject === 'string' && config.subject.length > 0)
        ? (applyVariables(config.subject, vars) ?? t.subject)
        : t.subject

    const orderUrl = esc(data.orderPageUrl)

    const storeIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M3 9a2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 0 2 2 2 2 0 0 0 2-2"/><path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/></svg>`

    // Items table — only rendered when items array is provided
    const itemsTable = data.items && data.items.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:13px;margin:16px 0;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:9px 12px;font-size:11.5px;font-weight:600;color:#475569;letter-spacing:0.03em;font-family:${FONT};">${defaults.colItem}</th>
          <th style="text-align:center;width:48px;padding:9px 12px;font-size:11.5px;font-weight:600;color:#475569;letter-spacing:0.03em;font-family:${FONT};">${defaults.colQty}</th>
          <th style="text-align:right;width:100px;padding:9px 12px;font-size:11.5px;font-weight:600;color:#475569;letter-spacing:0.03em;font-family:${FONT};">${defaults.colSubtotal}</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item) => `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:13px;color:#0F172A;vertical-align:top;">
            ${esc(item.name)}${item.variant ? `<div style="color:#94a3b8;font-size:12px;">${esc(item.variant)}</div>` : ''}
          </td>
          <td style="padding:10px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:13px;color:#0F172A;text-align:center;vertical-align:top;">${item.quantity}</td>
          <td style="padding:10px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:13px;color:#0F172A;text-align:right;vertical-align:top;">${fp(item.lineTotal)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:9px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:13px;color:#0F172A;">${defaults.rowShipping}</td>
          <td style="padding:9px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:13px;color:#0F172A;text-align:right;">
            ${data.shippingFee != null && data.shippingFee > 0 ? fp(data.shippingFee) : defaults.rowShippingFree}
          </td>
        </tr>
        ${data.orderTotal != null ? `
        <tr>
          <td colspan="2" style="padding:9px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:14px;font-weight:700;color:#0F172A;">${defaults.rowTotal}</td>
          <td style="padding:9px 12px;border-top:1px solid #edeff2;font-family:${FONT};font-size:14px;font-weight:700;color:#0F172A;text-align:right;">${fp(data.orderTotal)}</td>
        </tr>` : ''}
      </tfoot>
    </table>` : ''

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
    <p style="font-size:17px;font-weight:700;color:#0F172A;margin:0 0 8px;">${t.greeting}</p>
    <p style="font-family:${FONT};font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 4px;">${defaults.body}</p>

    ${itemsTable}

    <!-- CTA -->
    <a href="${orderUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);color:#ffffff;font-family:${FONT};font-size:14px;font-weight:700;padding:13px 24px;border-radius:8px;text-decoration:none;margin-top:20px;box-shadow:0 4px 12px rgba(14,165,233,0.30);">${t.ctaLabel}</a>
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
