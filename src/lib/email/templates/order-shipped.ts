/**
 * Order shipped email — buyer.
 * Sent when seller marks order status as "shipped".
 * Matches design: 04-order-delivered-buyer.html
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

type EmailLocale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

export interface OrderShippedData {
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
    paymentMethod: string
    shippingProvider?: string | null
    orderDate: string
    shippedDate: string
    orderPageUrl: string
    currency: string
    buyerNote?: string | null
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

function buildAddress(addr: OrderShippedData['customerAddress']): string {
    if (!addr) return '—'
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
        .filter(Boolean)
        .join(', ')
}

function paymentMethodLabel(method: string, locale: EmailLocale): string {
    if (method === 'cod') return 'COD'
    if (method === 'bank_transfer') return locale === 'ms' ? 'Pindahan Bank' : 'Bank Transfer'
    return locale === 'ms' ? 'Kad / FPX' : 'Card / FPX'
}

export function orderShippedEmail(data: OrderShippedData): { subject: string; html: string } {
    const locale = data.locale ?? 'ms'
    const t = (locales[locale] ?? locales.ms).order
    const tS = (locales[locale] ?? locales.ms).shippedOrder

    const fp = (n: number) => formatPrice(n, data.currency, locale)
    const esc = escapeHtml

    const prepaid = data.paymentMethod === 'stripe' || data.paymentMethod === 'card' || data.paymentMethod === 'fpx' ? data.total : 0
    const cod = data.paymentMethod === 'cod' ? data.total : 0

    const itemRows = data.items.map((item) => `
        <tr>
            <td style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:20px;color:#0F172A;vertical-align:top;">
                ${esc(item.name)}${item.variant ? `<br><span style="color:#94A3B8;font-size:12.5px;">${esc(item.variant)}</span>` : ''}
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

    const providerRow = data.shippingProvider
        ? `<tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;">${t.shippingProvider}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${esc(data.shippingProvider)}</td>
            <td colspan="2"></td>
        </tr>` : ''

    const subject = `${data.shopName} - ${tS.subject} - ${data.orderNumber}`
    const htmlTitle = `${esc(data.shopName)} - ${tS.subject} - ${esc(data.orderNumber)}`

    return {
        subject,
        html: `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlTitle}</title>
<style>
  body{margin:0;background:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;word-wrap:break-word;}
  img{max-width:100%;height:auto;display:block;}
  .page-bg{background:#EEF3F8;padding:48px 16px;}
  @media(max-width:640px){
    .page-bg{padding:16px 10px;}
    .page-bg table[width="600"]{width:100%!important;max-width:100%!important;border-radius:12px!important;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:20px!important;padding-right:20px!important;}
    .page-bg table[width="600"] table{width:100%!important;table-layout:auto;}
    .page-bg table[width="600"] thead th,.page-bg table[width="600"] tbody td{font-size:13px!important;}
  }
  @media(max-width:420px){
    .page-bg{padding:12px 6px;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:16px!important;padding-right:16px!important;}
  }
</style>
</head>
<body>
<div class="page-bg">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3F8;">
    <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04);">

      <!-- Shop name -->
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0F172A;">${esc(data.shopName)}</div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:18px 40px 6px;">
        <div style="font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${t.greeting} ${esc(data.customerName)},</div>
      </td></tr>
      <tr><td style="padding:6px 40px 18px;">
        <div style="font-size:14px;line-height:22px;color:#475569;">${tS.body}</div>
      </td></tr>

      <!-- Recipient info -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${t.recipientInfoHeading}</div>
      </td></tr>
      <tr><td style="padding:0 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
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

      <!-- Order info header -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${t.orderInfoHeading} — ID: ${esc(data.orderNumber)}</div>
      </td></tr>
      <tr><td style="padding:4px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.orderStatus}</td>
            <td style="padding:8px 16px 8px 0;color:#10B981;vertical-align:top;font-weight:600;">${tS.orderStatusShipped}</td>
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${t.orderDate}</td>
            <td style="padding:8px 16px 8px 0;color:#0F172A;vertical-align:top;font-weight:600;">${formatDate(data.orderDate, locale)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tS.shippedDate}</td>
            <td style="padding:8px 16px 8px 0;color:#0F172A;vertical-align:top;font-weight:600;">${formatDate(data.shippedDate, locale)}</td>
            <td></td>
            <td></td>
          </tr>
        </table>
      </td></tr>

      <!-- Product table -->
      <tr><td style="padding:8px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th align="left" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${t.productName}</th>
              <th align="center" width="50" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${t.quantity}</th>
              <th align="right" width="100" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${t.unitCost}</th>
              <th align="right" width="100" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${t.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr><td colspan="4" style="padding:0;border-top:1px solid #EDEFF2;"></td></tr>
            <tr>
              <td colspan="3" style="padding:12px 14px 6px;font-size:13.5px;color:#0F172A;">${t.subtotal}</td>
              <td align="right" style="padding:12px 14px 6px;font-size:13.5px;color:#0F172A;">${fp(data.subtotal)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${t.shippingFee}</td>
              <td align="right" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${fp(data.shippingFee)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:14px;font-weight:700;color:#0F172A;">${t.total}</td>
              <td align="right" style="padding:6px 14px;font-size:14px;font-weight:700;color:#0F172A;">${fp(data.total)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${t.prepaid}</td>
              <td align="right" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${fp(prepaid)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px 14px;font-size:13.5px;color:#0F172A;">${t.codPayment}</td>
              <td align="right" style="padding:6px 14px 14px;font-size:13.5px;color:#0F172A;">${fp(cod)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

      <!-- Payment method / shipping provider / buyer note -->
      <tr><td style="padding:14px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${t.paymentMethod}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${paymentMethodLabel(data.paymentMethod, locale)}</td>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${t.buyerNote}</td>
            <td align="right" style="padding:6px 0;color:#94A3B8;">${data.buyerNote ? esc(data.buyerNote) : '—'}</td>
          </tr>
          ${providerRow}
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:26px 40px 14px;">
        <a href="${data.orderPageUrl}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:18px;padding:14px 28px;border-radius:8px;text-decoration:none;">${t.cta}</a>
      </td></tr>

      <!-- Farewell -->
      <tr><td align="center" style="padding:10px 40px 6px;">
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
