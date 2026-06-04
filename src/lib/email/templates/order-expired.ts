/**
 * Order auto-cancellation email — buyer.
 * Sent when a bank-transfer order is auto-cancelled after 24h without payment.
 * Matches design: 10-order-auto-cancelled-buyer.html
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { mergeTemplateConfig, applyVariables } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

type EmailLocale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

export interface OrderExpiredData {
    shopName: string
    orderNumber: string
    customerName: string
    customerEmail: string
    customerPhone?: string | null
    customerAddress?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
    } | null
    items: Array<{
        name: string
        variant?: string | null
        quantity: number
        unitPrice: number
        lineTotal: number
    }>
    subtotal: number
    discountAmount?: number | null
    discountCode?: string | null
    shippingFee: number
    total: number
    currency: string
    orderDate: string
    cancellationDate: string
    /** Formatted elapsed time e.g. "25 jam 10 minit" */
    elapsedTime?: string | null
    /** URL to shop/products page for the reorder CTA */
    reorderUrl: string
    supportEmail?: string
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

function formatPrice(amount: number, currency: string, locale: EmailLocale): string {
    if (currency === 'MYR') return locale === 'ms' ? `RM${amount.toFixed(2)}` : `MYR ${amount.toFixed(2)}`
    return `${currency} ${amount.toFixed(2)}`
}

function formatDate(iso: string, locale: EmailLocale): string {
    try {
        return new Date(iso).toLocaleString(locale === 'ms' ? 'en-MY' : 'en-GB', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso
    }
}

function buildAddress(addr: OrderExpiredData['customerAddress']): string {
    if (!addr) return '—'
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
        .filter(Boolean)
        .join(', ')
}

export function orderExpiredEmail(data: OrderExpiredData, config?: EmailTemplateConfig): { subject: string; html: string } {
    const locale = data.locale ?? 'ms'
    const orderBase = (locales[locale] ?? locales.ms).order
    const tA = (locales[locale] ?? locales.ms).autoCancelledOrder
    const vars = { customerName: data.customerName, orderNumber: data.orderNumber, brandName: data.shopName, supportEmail: data.supportEmail ?? '' }
    const t = mergeTemplateConfig(orderBase, config ?? null, vars, {
        greeting: 'greeting',
        closing: 'farewell',
    })
    const tAMerged = mergeTemplateConfig(tA, config ?? null, vars, {
        subject: 'subject',
        ctaLabel: 'cta',
    })

    const fp = (n: number) => formatPrice(n, data.currency, locale)
    const esc = escapeHtml

    const elapsedText = data.elapsedTime
        ? tA.paymentExpiredText.replace('{elapsed}', data.elapsedTime)
        : tA.paymentExpiredText.replace(' ({elapsed})', '')

    const itemRows = data.items.map((item) => `
        <tr>
            <td style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:20px;color:#0F172A;vertical-align:top;">
                ${esc(item.name)}${item.variant ? `<br><span style="color:#94A3B8;font-size:12.5px;">${esc(item.variant)}</span>` : ''}
                <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#ECFDF5;color:#047857;font-size:11px;font-weight:600;">${tA.restockedBadge}</span>
            </td>
            <td align="center" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${item.quantity}</td>
            <td align="right" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${fp(item.unitPrice)}</td>
            <td align="right" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${fp(item.lineTotal)}</td>
        </tr>`).join('')

    const discountRow = data.discountAmount
        ? `<tr>
            <td colspan="3" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">
                ${t.discount}${data.discountCode ? ` <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#F1F5F9;color:#475569;font-size:12px;margin-left:6px;">${esc(data.discountCode)}</span>` : ''}
            </td>
            <td align="right" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#EF4444;">-${fp(data.discountAmount)}</td>
        </tr>` : ''

    const defaultSubject = `${data.shopName} - ${tAMerged.subject} - ${data.orderNumber}`
    const subject = (typeof config?.subject === 'string' && config.subject.length > 0)
        ? (applyVariables(escapeHtml(config.subject), vars) ?? defaultSubject)
        : defaultSubject
    const htmlTitle = (typeof config?.subject === 'string' && config.subject.length > 0)
        ? subject
        : `${esc(data.shopName)} - ${tAMerged.subject} - ${esc(data.orderNumber)}`

    return {
        subject,
        html: `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlTitle}</title>
<style>
  body{margin:0;background:transparent;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;word-wrap:break-word;}
  img{max-width:100%;height:auto;display:block;}
  .page-bg{background:transparent;padding:0;}
  @media(max-width:640px){
    .page-bg{padding:0;}
    .page-bg table[width="600"]{width:100%!important;max-width:100%!important;border-radius:12px!important;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:20px!important;padding-right:20px!important;}
    .page-bg table[width="600"] table{width:100%!important;table-layout:auto;}
    .page-bg table[width="600"] thead th,.page-bg table[width="600"] tbody td{font-size:13px!important;}
  }
  @media(max-width:420px){
    .page-bg{padding:0;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:16px!important;padding-right:16px!important;}
  }
</style>
</head>
<body>
<div class="page-bg">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:transparent;">
    <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04);">

      <!-- Shop name -->
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0F172A;">${esc(data.shopName)}</div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:18px 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${t.greeting},</div>
      </td></tr>
      <tr><td style="padding:6px 40px 18px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#475569;">${tA.body}</div>
      </td></tr>

      <!-- Orange info box: payment expired -->
      <tr><td style="padding:6px 40px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;">
          <tr>
            <td width="48" style="padding:16px 0 16px 16px;vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:36px;height:36px;background:#FFEDD5;border-radius:50%;text-align:center;vertical-align:middle;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
              </td></tr></table>
            </td>
            <td style="padding:14px 16px 14px 12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;">
              <div style="font-size:14px;font-weight:700;color:#9A3412;line-height:20px;margin-bottom:4px;">${tA.paymentExpiredTitle}</div>
              <div style="font-size:13.5px;line-height:20px;color:#7C2D12;">${elapsedText}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Recipient info -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${t.recipientInfoHeading}</div>
      </td></tr>
      <tr><td style="padding:0 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;">
          <tr>
            <td width="120" style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.fullName}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${esc(data.customerName)}</td>
            <td width="80" style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.address}</td>
            <td style="padding:6px 0;color:#94A3B8;vertical-align:top;line-height:22px;">${esc(buildAddress(data.customerAddress))}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.phone}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${data.customerPhone ? esc(data.customerPhone) : '—'}</td>
            <td style="vertical-align:top;">&nbsp;</td>
            <td></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.email}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${esc(data.customerEmail)}</td>
            <td style="vertical-align:top;">&nbsp;</td>
            <td></td>
          </tr>
        </table>
      </td></tr>

      <!-- Order info -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${t.orderInfoHeading} — ID: ${esc(data.orderNumber)}</div>
      </td></tr>
      <tr><td style="padding:4px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;">
          <tr>
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.orderStatus}</td>
            <td style="padding:8px 16px 8px 0;color:#EF4444;vertical-align:top;font-weight:600;">${tA.orderStatusCancelled}</td>
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.orderDate}</td>
            <td style="padding:8px 16px 8px 0;color:#0F172A;vertical-align:top;font-weight:600;">${formatDate(data.orderDate, locale)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tA.cancellationDate}</td>
            <td style="padding:8px 16px 8px 0;color:#0F172A;vertical-align:top;font-weight:600;">${formatDate(data.cancellationDate, locale)}</td>
            <td style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tA.cancellationReason}</td>
            <td style="padding:8px 16px 8px 0;color:#94A3B8;vertical-align:top;">${tA.cancellationReasonValue}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Product table -->
      <tr><td style="padding:8px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th align="left" style="padding:12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0F172A;">${t.productName}</th>
              <th align="center" width="50" style="padding:12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0F172A;">${t.quantity}</th>
              <th align="right" width="100" style="padding:12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0F172A;">${t.unitCost}</th>
              <th align="right" width="100" style="padding:12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0F172A;">${t.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr><td colspan="4" style="padding:0;border-top:1px solid #EDEFF2;"></td></tr>
            <tr>
              <td colspan="3" style="padding:12px 14px 6px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">${t.subtotal}</td>
              <td align="right" style="padding:12px 14px 6px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">${fp(data.subtotal)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td colspan="3" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">${t.shippingFee}</td>
              <td align="right" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">${fp(data.shippingFee)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0F172A;">${tA.originalTotalLabel}</td>
              <td align="right" style="padding:6px 14px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0F172A;">${fp(data.total)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

      <!-- Green callout: no refund needed -->
      <tr><td style="padding:18px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;">
          <tr>
            <td width="48" style="padding:16px 0 16px 16px;vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:36px;height:36px;background:#DCFCE7;border-radius:50%;text-align:center;vertical-align:middle;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M20 6 9 17l-5-5"></path></svg>
              </td></tr></table>
            </td>
            <td style="padding:14px 16px 14px 12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;">
              <div style="font-size:14px;font-weight:700;color:#065F46;line-height:20px;margin-bottom:4px;">${tA.noRefundTitle}</div>
              <div style="font-size:13.5px;line-height:20px;color:#047857;">${tA.noRefundText}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Payment info row -->
      <tr><td style="padding:14px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;">
          <tr>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${t.paymentMethod}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${tA.paymentMethodValue}</td>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${tA.paymentStatusLabel}</td>
            <td align="right" style="padding:6px 0;color:#94A3B8;">${tA.paymentStatusValue}</td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:22px 40px 8px;">
        <a href="${data.reorderUrl}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:18px;padding:14px 28px;border-radius:8px;text-decoration:none;">${tAMerged.cta}</a>
      </td></tr>
      <tr><td align="center" style="padding:0 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:18px;color:#94A3B8;">${tA.ctaSubtitle}</div>
      </td></tr>

      <!-- Farewell -->
      <tr><td align="center" style="padding:18px 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0F172A;">${t.farewell}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:6px 40px 36px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#94A3B8;">${t.copyright} ${esc(data.shopName)}</div>
      </td></tr>

    </table>
    </td></tr>
  </table>
</div>
</body>
</html>`.trim(),
    }
}
